import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { type Database, EmployeeRole } from '@/types/database'

const ROUTE_PERMISSIONS: { prefix: string; allowed: EmployeeRole[] }[] = [
  { prefix: '/dashboard', allowed: ['ceo'] },
  { prefix: '/approvals', allowed: ['ceo'] },
  { prefix: '/submit', allowed: ['staff', 'finance', 'ceo'] },
  { prefix: '/transactions', allowed: ['ceo', 'finance'] },
  { prefix: '/budgets', allowed: ['ceo', 'finance'] },
  { prefix: '/reports', allowed: ['ceo', 'finance'] },
  { prefix: '/settings', allowed: ['ceo'] },
]

const ROLE_HOME: Record<EmployeeRole, string> = {
  ceo: '/dashboard',
  finance: '/transactions',
  staff: '/submit',
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/auth')
  const isPublicRoute = pathname === '/'
  const isApiRoute = pathname.startsWith('/api')

  // Slack 경로는 HMAC 서명으로 자체 인증, categorize는 서버→서버 내부 호출 — 익명 허용
  const ANON_API = ['/api/slack-webhook', '/api/slack-interactions', '/api/categorize']
  const isAnonApi = ANON_API.some((p) => pathname.startsWith(p))

  if (!user) {
    if (isAuthRoute || isPublicRoute || isAnonApi) return supabaseResponse
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Always verify role from DB — never trust a client-supplied cookie for authorization
  const { data } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  const employee = data as { role: EmployeeRole } | null

  if (!employee?.role) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const role = employee.role

  if (isAuthRoute) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
  }

  const permission = ROUTE_PERMISSIONS.find(({ prefix }) => pathname.startsWith(prefix))
  if (permission && !permission.allowed.includes(role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

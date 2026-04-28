import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { EmployeeRole } from '@/types/database'

const ROLE_REDIRECT: Record<EmployeeRole, string> = {
  ceo: '/dashboard',
  finance: '/approvals',
  staff: '/submit',
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const { data: raw } = await supabase
        .from('employees')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .single()
      const employee = raw as { role: EmployeeRole } | null

      if (employee?.role) {
        return NextResponse.redirect(`${origin}${ROLE_REDIRECT[employee.role]}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}

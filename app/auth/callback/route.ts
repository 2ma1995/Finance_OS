import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // 초대 수락 후 비밀번호 설정 페이지로 이동
      return NextResponse.redirect(`${origin}/auth/set-password`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}

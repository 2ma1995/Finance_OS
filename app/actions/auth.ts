'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { EmployeeRole } from '@/types/database'

const ROLE_REDIRECT: Record<EmployeeRole, string> = {
  ceo: '/dashboard',
  finance: '/approvals',
  staff: '/submit',
}

export type SignInState = { error: string } | null

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createSupabaseServerClient()

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? '로그인에 실패했습니다.' }
  }

  const { data, error: empError } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .single()
  const employee = data as { role: EmployeeRole } | null

  if (empError || !employee) {
    await supabase.auth.signOut()
    return { error: '등록된 직원 정보가 없습니다. 관리자에게 문의하세요.' }
  }

  redirect(ROLE_REDIRECT[employee.role])
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

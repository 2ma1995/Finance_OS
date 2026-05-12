'use server'

import { requireRole } from '@/lib/server-auth'
import { rawSupabase } from '@/lib/utils'
import { createServiceClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { EmployeeRole } from '@/types/database'

export async function updateEmployee(
  id: string,
  updates: { role?: EmployeeRole; is_active?: boolean; department?: string | null }
) {
  const auth = await requireRole(['ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  const db = rawSupabase(auth.supabase)
  const { error } = await db.from('employees').update(updates).eq('id', id)
  if (error) return { error: '저장 실패' }

  revalidatePath('/settings')
  return { success: true }
}

export async function addEmployee(data: {
  name: string
  email: string
  role: EmployeeRole
  department: string | null
}) {
  const auth = await requireRole(['ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  if (!data.name?.trim()) return { error: '이름을 입력해주세요.' }
  if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    return { error: '유효한 이메일을 입력해주세요.' }
  if (!['ceo', 'finance', 'staff'].includes(data.role)) return { error: '역할을 선택해주세요.' }

  const service = createServiceClient()
  const db = rawSupabase(service)

  const { data: existing } = await db
    .from('employees')
    .select('id, user_id')
    .eq('email', data.email.trim())
    .maybeSingle() as { data: { id: string; user_id: string } | null }

  if (existing) {
    // auth 유저가 살아있으면 진짜 중복
    const { error: authLookupError } = await service.auth.admin.getUserById(existing.user_id)
    if (!authLookupError) return { error: '이미 등록된 이메일입니다.' }
    // auth 유저가 없는 고아 레코드 → 삭제 후 재등록
    await db.from('employees').delete().eq('id', existing.id)
  }

  // auth에 이미 계정이 있는지 확인
  const { data: usersPage } = await service.auth.admin.listUsers({ perPage: 1000 })
  const existingAuthUser = usersPage?.users.find(
    (u) => u.email?.toLowerCase() === data.email.trim().toLowerCase()
  )

  let userId: string

  if (existingAuthUser) {
    // 기존 auth 계정 재사용 — 비밀번호·메타데이터만 초기화
    userId = existingAuthUser.id
    await service.auth.admin.updateUserById(userId, {
      password: '000000',
      user_metadata: { full_name: data.name.trim(), must_change_password: true },
    })
  } else {
    // 새 계정 생성 (기본 비밀번호 000000, 이메일 인증 불필요)
    const { data: createData, error: createError } = await service.auth.admin.createUser({
      email: data.email.trim(),
      password: '000000',
      email_confirm: true,
      user_metadata: { full_name: data.name.trim(), must_change_password: true },
    })
    if (createError) return { error: `계정 생성 실패: ${createError.message}` }
    userId = createData.user.id
  }

  const { error: insertError } = await db.from('employees').insert({
    user_id: userId,
    email: data.email.trim(),
    name: data.name.trim(),
    role: data.role,
    department: data.department || null,
    is_active: true,
  })

  if (insertError) {
    if (!existingAuthUser) await service.auth.admin.deleteUser(userId)
    return { error: '직원 등록 실패' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function addDepartment(name: string) {
  const auth = await requireRole(['ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  if (!name || name.trim().length < 1) return { error: '부서명을 입력해주세요.' }

  revalidatePath('/settings')
  revalidatePath('/budgets')
  return { success: true }
}

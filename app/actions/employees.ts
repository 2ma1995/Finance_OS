'use server'

import { requireRole } from '@/lib/server-auth'
import { rawSupabase } from '@/lib/utils'
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

export async function addDepartment(name: string) {
  const auth = await requireRole(['ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  if (!name || name.trim().length < 1) return { error: '부서명을 입력해주세요.' }

  revalidatePath('/settings')
  revalidatePath('/budgets')
  return { success: true }
}

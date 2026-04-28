'use server'

import { requireRole } from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'
import type { EmployeeRole } from '@/types/database'

export async function updateEmployee(
  id: string,
  updates: { role?: EmployeeRole; is_active?: boolean; department?: string }
) {
  const auth = await requireRole(['ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  const { error } = await auth.supabase.from('employees').update(updates).eq('id', id)
  if (error) return { error: '저장 실패' }

  revalidatePath('/settings')
  return { success: true }
}

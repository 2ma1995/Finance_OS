'use server'

import { requireRole } from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'

export async function upsertBudget(department: string, month: string, amount: number) {
  const auth = await requireRole(['finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  if (!amount || amount <= 0) return { error: '유효하지 않은 금액입니다.' }

  const { error } = await auth.supabase
    .from('department_budgets')
    .upsert({ department, month, budget_amount: amount }, { onConflict: 'department,month' })

  if (error) return { error: '저장 실패' }
  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  return { success: true }
}

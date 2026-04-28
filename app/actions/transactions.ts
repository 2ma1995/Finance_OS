'use server'

import { createServiceClient } from '@/lib/supabase-server'
import { requireRole } from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'

export async function addIncomeTransaction(data: {
  amount: number
  description: string
  date: string
  memo?: string
}) {
  const auth = await requireRole(['finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  if (!data.amount || data.amount <= 0) return { error: '유효하지 않은 금액입니다.' }
  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { error: '유효하지 않은 날짜입니다.' }

  const supabase = auth.supabase

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .limit(1)

  let accountId: string
  if (accounts?.length) {
    accountId = accounts[0].id
  } else {
    const { data: newAccount, error: accErr } = await supabase
      .from('accounts')
      .insert({ user_id: auth.user.id, name: '기본 계좌', type: 'checking', currency: 'KRW', balance: 0 })
      .select('id')
      .single()
    if (accErr || !newAccount) return { error: '저장 실패' }
    accountId = newAccount.id
  }

  const { error } = await supabase.from('transactions').insert({
    user_id: auth.user.id,
    account_id: accountId,
    amount: data.amount,
    type: 'income',
    description: data.description,
    memo: data.memo ?? null,
    date: data.date,
    currency: 'KRW',
    tags: [],
  })

  if (error) return { error: '저장 실패' }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const auth = await requireRole(['finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  const { error } = await createServiceClient()
    .from('transactions')
    .delete()
    .eq('id', id)

  if (error) return { error: '삭제 실패' }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

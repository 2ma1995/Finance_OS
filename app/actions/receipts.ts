'use server'

import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase-server'
import { rawSupabase } from '@/lib/utils'
import { requireRole } from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'
import type { ReceiptInsert } from '@/types/database'

async function sendSlackRejectionDM(
  employeeEmail: string,
  receipt: { merchant_name: string; amount: number; rejection_comment: string }
) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return

  try {
    const userRes = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(employeeEmail)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const userData = await userRes.json()
    if (!userData.ok) return

    const dmRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: userData.user.id }),
    })
    const dmData = await dmRes.json()
    if (!dmData.ok) return

    const amount = receipt.amount.toLocaleString('ko-KR')

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: dmData.channel.id,
        text: `영수증이 반려되었습니다: ${receipt.merchant_name} ${amount}원`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '❌ 영수증 반려 알림', emoji: true },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*상호명*\n${receipt.merchant_name}` },
              { type: 'mrkdwn', text: `*금액*\n${amount}원` },
            ],
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*반려 사유*\n${receipt.rejection_comment || '사유 없음'}` },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: 'Finance OS에서 확인하세요.' }],
          },
        ],
      }),
    })
  } catch (err) {
    console.error('Slack DM 전송 실패:', err)
  }
}

export async function submitReceipt(data: Omit<ReceiptInsert, 'employee_id' | 'employee_name' | 'department'>) {
  const auth = await requireRole(['staff', 'finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  // 기본 입력값 검증
  if (!data.amount || data.amount <= 0 || data.amount > 100_000_000) return { error: '유효하지 않은 금액입니다.' }
  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { error: '유효하지 않은 날짜입니다.' }
  if (!data.merchant_name || data.merchant_name.length > 100) return { error: '상호명이 유효하지 않습니다.' }
  if (data.memo && data.memo.length > 500) return { error: '메모가 너무 깁니다.' }

  const supabase = auth.supabase
  const db = rawSupabase(supabase)

  const { data: empData } = await supabase
    .from('employees')
    .select('name, department')
    .eq('user_id', auth.user.id)
    .single()
  const employee = empData as { name: string; department: string } | null

  if (!employee) return { error: '직원 정보를 찾을 수 없습니다.' }

  const { error } = await db.from('receipts').insert({
    ...data,
    employee_id: auth.user.id,
    employee_name: employee.name,
    department: employee.department,
    status: 'pending',
    is_manual_review: false, // 클라이언트 제공 값 무시, 서버에서 고정
  })

  if (error) return { error: '저장 실패' }

  revalidatePath('/submit')
  return { success: true }
}

async function getSubmitterRole(
  supabase: ReturnType<typeof createSupabaseServerClient> extends Promise<infer T> ? T : never,
  receiptId: string
): Promise<string | null> {
  const db = rawSupabase(supabase)
  const { data: receipt } = await db
    .from('receipts')
    .select('employee_id')
    .eq('id', receiptId)
    .single() as { data: { employee_id: string } | null }
  if (!receipt) return null
  const { data: emp } = await db
    .from('employees')
    .select('role')
    .eq('user_id', receipt.employee_id)
    .single() as { data: { role: string } | null }
  return emp?.role ?? null
}

export async function approveReceipt(receiptId: string) {
  const auth = await requireRole(['finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  // 재무팀: 직원 영수증만 / CEO: 재무팀 영수증만
  const submitterRole = await getSubmitterRole(auth.supabase as never, receiptId)
  if (auth.role === 'finance' && submitterRole !== 'staff') return { error: '권한이 없습니다.' }
  if (auth.role === 'ceo' && submitterRole !== 'finance') return { error: '권한이 없습니다.' }

  const supabase = auth.supabase
  const { data: empData } = await supabase
    .from('employees')
    .select('name')
    .eq('user_id', auth.user.id)
    .single()
  const approver = empData as { name: string } | null

  const { error } = await rawSupabase(supabase).rpc('approve_receipt', {
    p_receipt_id: receiptId,
    p_approver_id: auth.user.id,
    p_approver_name: approver?.name ?? auth.user.id,
  })

  if (error) return { error: '처리 실패' }

  revalidatePath('/approvals')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateReceipt(
  receiptId: string,
  data: { merchant_name: string; amount: number; date: string; category: string; memo: string | null; supply_value?: number | null; vat?: number | null; tax_free_amount?: number | null }
) {
  const auth = await requireRole(['staff', 'finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  // 기본 입력값 검증
  if (!data.amount || data.amount <= 0) return { error: '유효하지 않은 금액입니다.' }

  const db = rawSupabase(auth.supabase)

  const { data: existing } = await db
    .from('receipts')
    .select('employee_id, status')
    .eq('id', receiptId)
    .single() as { data: { employee_id: string; status: string } | null }

  if (!existing) return { error: '영수증을 찾을 수 없습니다.' }

  if (auth.role === 'staff') {
    // 본인 소유의 pending만
    if (existing.employee_id !== auth.user.id || existing.status !== 'pending') {
      return { error: '수정 권한이 없습니다.' }
    }
  } else if (auth.role === 'finance') {
    // 본인 영수증(pending)이거나, 직원(staff) 영수증만
    const isOwn = existing.employee_id === auth.user.id && existing.status === 'pending'
    if (!isOwn) {
      const submitterRole = await getSubmitterRole(auth.supabase as never, receiptId)
      if (submitterRole !== 'staff') return { error: '수정 권한이 없습니다.' }
    }
  } else if (auth.role === 'ceo') {
    // 본인 영수증(pending)이거나, 재무팀(finance) 영수증만
    const isOwn = existing.employee_id === auth.user.id && existing.status === 'pending'
    if (!isOwn) {
      const submitterRole = await getSubmitterRole(auth.supabase as never, receiptId)
      if (submitterRole !== 'finance') return { error: '수정 권한이 없습니다.' }
    }
  }

  const { error } = await db
    .from('receipts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', receiptId)

  if (error) return { error: '저장 실패' }

  revalidatePath('/approvals')
  revalidatePath('/submit')
  return { success: true }
}

export async function rejectReceipt(receiptId: string, comment: string) {
  const auth = await requireRole(['finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  // 재무팀: 직원 영수증만 / CEO: 재무팀 영수증만
  const submitterRole = await getSubmitterRole(auth.supabase as never, receiptId)
  if (auth.role === 'finance' && submitterRole !== 'staff') return { error: '권한이 없습니다.' }
  if (auth.role === 'ceo' && submitterRole !== 'finance') return { error: '권한이 없습니다.' }

  const supabase = auth.supabase
  const db = rawSupabase(supabase)

  const { data: empData } = await supabase
    .from('employees')
    .select('name')
    .eq('user_id', auth.user.id)
    .single()
  const approver = empData as { name: string } | null

  const { error } = await db.rpc('reject_receipt', {
    p_receipt_id: receiptId,
    p_approver_id: auth.user.id,
    p_approver_name: approver?.name ?? auth.user.id,
    p_comment: comment,
  })

  if (error) return { error: '처리 실패' }

  const { data: receiptData } = await db
    .from('receipts')
    .select('merchant_name, amount, employee_id')
    .eq('id', receiptId)
    .single() as { data: { merchant_name: string; amount: number; employee_id: string } | null }

  if (receiptData) {
    const { data: employeeData } = await supabase
      .from('employees')
      .select('email')
      .eq('user_id', receiptData.employee_id)
      .single() as { data: { email: string } | null }

    if (employeeData?.email) {
      await sendSlackRejectionDM(employeeData.email, {
        merchant_name: receiptData.merchant_name,
        amount: receiptData.amount,
        rejection_comment: comment,
      })
    }
  }

  revalidatePath('/approvals')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteReceipt(id: string) {
  const auth = await requireRole(['finance', 'ceo'])
  if (!auth) return { error: '권한이 없습니다.' }

  const db = rawSupabase(createServiceClient())

  await db.from('approvals').delete().eq('receipt_id', id)
  const { error } = await db.from('receipts').delete().eq('id', id)

  if (error) return { error: '삭제 실패' }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function markRejectionsRead() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await rawSupabase(supabase)
    .from('receipts')
    .update({ rejection_notified_at: new Date().toISOString() })
    .eq('employee_id', user.id)
    .eq('status', 'rejected')
    .is('rejection_notified_at', null)
}

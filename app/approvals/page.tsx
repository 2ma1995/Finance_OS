import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rawSupabase } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { ApprovalTable } from './_components/approval-table'
import type { Receipt, EmployeeRole } from '@/types/database'

export default async function ApprovalsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const db = rawSupabase(supabase)

  const { data: empData } = await db
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single() as { data: { role: EmployeeRole } | null }

  if (!empData?.role) redirect('/auth/login')

  let receipts: Receipt[] = []

  if (empData.role === 'finance') {
    // 재무팀: staff + ceo 제출 영수증
    const { data: targetEmps } = await db
      .from('employees')
      .select('user_id')
      .in('role', ['staff', 'ceo']) as { data: { user_id: string }[] | null }

    const targetUserIds = (targetEmps ?? []).map((e) => e.user_id)

    if (targetUserIds.length > 0) {
      const { data } = await db
        .from('receipts')
        .select('*')
        .eq('status', 'pending')
        .in('employee_id', targetUserIds)
        .order('submitted_at', { ascending: true })
      receipts = (data as Receipt[] | null) ?? []
    }
  } else {
    // CEO: finance 제출 영수증 + 본인(ceo) 영수증
    const { data: financeEmps } = await db
      .from('employees')
      .select('user_id')
      .eq('role', 'finance') as { data: { user_id: string }[] | null }

    const financeUserIds = (financeEmps ?? []).map((e) => e.user_id)
    const targetUserIds = [...financeUserIds, user.id]

    const { data } = await db
      .from('receipts')
      .select('*')
      .eq('status', 'pending')
      .in('employee_id', targetUserIds)
      .order('submitted_at', { ascending: true })
    receipts = (data as Receipt[] | null) ?? []
  }

  const title = empData.role === 'finance' ? '직원·대표 결재 관리' : '재무팀·본인 결재 관리'
  const desc =
    empData.role === 'finance'
      ? '직원 및 대표가 제출한 영수증을 승인 또는 반려합니다.'
      : '재무팀 및 본인이 제출한 영수증을 승인 또는 반려합니다.'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>

      <ApprovalTable initial={receipts} />
    </div>
  )
}

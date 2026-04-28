import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ApprovalTable } from './_components/approval-table'
import type { Receipt } from '@/types/database'

export default async function ApprovalsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">결재 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">대기중인 영수증을 승인 또는 반려합니다.</p>
      </div>

      <ApprovalTable initial={(receipts as Receipt[]) ?? []} />
    </div>
  )
}

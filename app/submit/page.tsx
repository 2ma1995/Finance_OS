import { createSupabaseServerClient } from '@/lib/supabase-server'
import { markRejectionsRead } from '@/app/actions/receipts'
import { ReceiptForm } from './_components/receipt-form'
import { MyReceiptsRealtime } from './_components/my-receipts-realtime'
import type { Receipt } from '@/types/database'

export default async function SubmitPage() {
  const supabase = await createSupabaseServerClient()

  // middleware가 인증을 보장하므로 user는 항상 존재
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  // 페이지 진입 시 미읽은 반려 알림 읽음 처리
  await markRejectionsRead()

  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .eq('employee_id', userId)
    .order('submitted_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">지출 신청</h1>
          <p className="text-sm text-muted-foreground mt-1">영수증을 업로드하고 지출을 신청합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ReceiptForm userId={userId} />
        </div>
        <div className="lg:col-span-3">
          <MyReceiptsRealtime initial={(receipts as Receipt[]) ?? []} userId={userId} />
        </div>
      </div>
    </div>
  )
}

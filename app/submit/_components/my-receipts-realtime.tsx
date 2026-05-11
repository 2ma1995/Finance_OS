'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate, receiptImageUrl } from '@/lib/utils'
import type { Receipt, ReceiptStatus } from '@/types/database'
import { ImageIcon, Pencil } from 'lucide-react'
import { EditReceiptDialog } from '@/app/approvals/_components/edit-receipt-dialog'

const STATUS: Record<ReceiptStatus, { label: string; className: string }> = {
  pending: { label: '대기중', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  approved: { label: '승인', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  rejected: { label: '반려', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
}

interface MyReceiptsRealtimeProps {
  initial: Receipt[]
  userId: string
}

export function MyReceiptsRealtime({ initial, userId }: MyReceiptsRealtimeProps) {
  const [receipts, setReceipts] = useState<Receipt[]>(initial)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`my-receipts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'receipts',
          filter: `employee_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReceipts((prev) => [payload.new as Receipt, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Receipt
            const prev = payload.old as Partial<Receipt>
            // 방금 반려된 경우 토스트 알림
            if (updated.status === 'rejected' && prev.status !== 'rejected') {
              toast.error(`영수증 반려: ${updated.merchant_name}`, {
                description: updated.rejection_comment || '반려 사유 없음',
                duration: 6000,
              })
            }
            setReceipts((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            )
          } else if (payload.eventType === 'DELETE') {
            setReceipts((prev) => prev.filter((r) => r.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">내 영수증 목록</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상호명</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>일자</TableHead>
                <TableHead>이미지</TableHead>
                <TableHead>메모</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>반려 사유</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    제출한 영수증이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((r) => {
                  const s = STATUS[r.status] ?? STATUS.pending
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.merchant_name}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell>
                        {r.image_url ? (
                          <a
                            href={receiptImageUrl(r.image_url) ?? r.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            <ImageIcon className="h-3 w-3" />
                            보기
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">없음</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-32 truncate text-sm text-muted-foreground">
                        {r.memo ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={s.className}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-40 text-sm text-muted-foreground">
                        {r.status === 'rejected' && r.rejection_comment ? (
                          <span className="text-red-600">{r.rejection_comment}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {r.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingReceipt(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditReceiptDialog
        receipt={editingReceipt}
        hideSubmitterInfo
        onClose={() => setEditingReceipt(null)}
        onSuccess={(updated) => {
          setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
          setEditingReceipt(null)
        }}
      />
    </>
  )
}

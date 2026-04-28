'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Receipt, ReceiptStatus } from '@/types/database'

const STATUS: Record<ReceiptStatus, { label: string; className: string }> = {
  pending: { label: '대기중', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  approved: { label: '승인', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  rejected: { label: '반려', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
}

export function RecentReceiptsRealtime({ initial }: { initial: Receipt[] }) {
  const [receipts, setReceipts] = useState<Receipt[]>(initial)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard-receipts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReceipts((prev) => [payload.new as Receipt, ...prev].slice(0, 10))
          } else if (payload.eventType === 'UPDATE') {
            setReceipts((prev) =>
              prev.map((r) => (r.id === (payload.new as Receipt).id ? (payload.new as Receipt) : r))
            )
          } else if (payload.eventType === 'DELETE') {
            setReceipts((prev) => prev.filter((r) => r.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">최근 영수증 요청</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>신청자</TableHead>
              <TableHead>부서</TableHead>
              <TableHead>상호명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead>일자</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  데이터 없음
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((r) => {
                const s = STATUS[r.status] ?? STATUS.pending
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee_name}</TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell>{r.merchant_name}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                    <TableCell>{formatDateShort(r.date)}</TableCell>
                    <TableCell>
                      <Badge className={s.className}>{s.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

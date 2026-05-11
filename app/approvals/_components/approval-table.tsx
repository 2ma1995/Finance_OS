'use client'

import { useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { approveReceipt } from '@/app/actions/receipts'
import { formatCurrency, formatDate, receiptImageUrl } from '@/lib/utils'
import { toast } from 'sonner'
import type { Receipt } from '@/types/database'
import { RejectModal } from './reject-modal'
import { EditReceiptDialog } from './edit-receipt-dialog'
import { CheckCircle, XCircle, ImageIcon, Pencil } from 'lucide-react'

interface ApprovalTableProps {
  initial: Receipt[]
}

export function ApprovalTable({ initial }: ApprovalTableProps) {
  const [receipts, setReceipts] = useState<Receipt[]>(initial)
  const [isPending, startTransition] = useTransition()
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Receipt | null>(null)

  // 필터 상태
  const [filterDept, setFilterDept] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const departments = useMemo(
    () => ['all', ...Array.from(new Set(receipts.map((r) => r.department)))],
    [receipts]
  )
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(receipts.map((r) => r.category)))],
    [receipts]
  )

  const filtered = useMemo(() => {
    return receipts.filter((r) => {
      if (filterDept !== 'all' && r.department !== filterDept) return false
      if (filterCat !== 'all' && r.category !== filterCat) return false
      if (filterFrom && r.date < filterFrom) return false
      if (filterTo && r.date > filterTo) return false
      return true
    })
  }, [receipts, filterDept, filterCat, filterFrom, filterTo])

  const handleApprove = (receiptId: string) => {
    startTransition(async () => {
      const result = await approveReceipt(receiptId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('승인되었습니다.')
        setReceipts((prev) => prev.filter((r) => r.id !== receiptId))
      }
    })
  }

  const handleRejectSuccess = (receiptId: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId))
  }

  const handleEditSuccess = (updated: Receipt) => {
    setReceipts((prev) => prev.map((r) => r.id === updated.id ? updated : r))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs">부서</Label>
              <Select value={filterDept} onValueChange={(v) => { if (v) setFilterDept(v) }}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d === 'all' ? '전체' : d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">카테고리</Label>
              <Select value={filterCat} onValueChange={(v) => { if (v) setFilterCat(v) }}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === 'all' ? '전체' : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">시작일</Label>
              <Input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">종료일</Label>
              <Input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            승인 대기 ({filtered.length}건)
          </CardTitle>
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
                <TableHead>이미지</TableHead>
                <TableHead>메모</TableHead>
                <TableHead className="w-10" />
                <TableHead className="text-center">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    승인 대기 항목이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee_name}</TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell>{r.merchant_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span>{r.category}</span>
                        {r.is_manual_review && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            검토필요
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.amount)}
                    </TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>
                      {r.image_url ? (
                        <a
                          href={receiptImageUrl(r.image_url) ?? r.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <ImageIcon className="h-3 w-3" />
                          보기
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">없음</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-sm text-muted-foreground">
                      {r.memo ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditTarget(r)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          disabled={isPending}
                          onClick={() => handleApprove(r.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          disabled={isPending}
                          onClick={() => setRejectTargetId(r.id)}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          반려
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RejectModal
        receiptId={rejectTargetId}
        onClose={() => setRejectTargetId(null)}
        onSuccess={handleRejectSuccess}
      />

      <EditReceiptDialog
        receipt={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={handleEditSuccess}
      />
    </>
  )
}

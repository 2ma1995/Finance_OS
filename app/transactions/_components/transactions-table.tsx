'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTransaction } from '@/app/actions/transactions'
import { deleteReceipt } from '@/app/actions/receipts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ImageIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export type TransactionRow = {
  id: string
  date: string
  label: string
  sub: string
  amount: number
  type: 'income' | 'expense'
  badge: string
  memo: string | null
  department?: string
  category?: string
  status?: string
  image_url?: string | null
  employee_name?: string
}

function fmt(amount: number) {
  return amount.toLocaleString('ko-KR') + '원'
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  pending: '결재 대기',
  approved: '승인',
  rejected: '반려',
}

const CONFIRM_KEYWORD = '삭제'

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<TransactionRow | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelected(null)
      setShowConfirm(false)
      setConfirmText('')
    }
  }

  const handleDeleteClick = () => {
    setShowConfirm(true)
    setConfirmText('')
  }

  const handleDeleteConfirm = async () => {
    if (!selected || confirmText !== CONFIRM_KEYWORD) return

    setDeleting(true)
    const result = selected.type === 'income'
      ? await deleteTransaction(selected.id)
      : await deleteReceipt(selected.id)
    setDeleting(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('삭제되었습니다.')
      setSelected(null)
      setShowConfirm(false)
      setConfirmText('')
      router.refresh()
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>내용</TableHead>
                <TableHead>구분</TableHead>
                <TableHead className="text-right">금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    거래 내역이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow
                  key={`${row.type}-${row.id}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelected(row); setShowConfirm(false); setConfirmText('') }}
                >
                  <TableCell className="text-sm text-muted-foreground">{row.date}</TableCell>
                  <TableCell>
                    <p className="font-medium">{row.label}</p>
                    {row.sub && <p className="text-xs text-muted-foreground">{row.sub}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.type === 'income' ? 'default' : 'secondary'}>
                      {row.badge}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${row.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                    {row.type === 'income' ? '+' : '-'}{fmt(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selected?.type === 'income' ? '수입 상세' : '지출 상세'}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between mb-3">
                <Badge variant={selected.type === 'income' ? 'default' : 'secondary'}>
                  {selected.badge}
                </Badge>
                <span className={`text-xl font-bold ${selected.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                  {selected.type === 'income' ? '+' : '-'}{fmt(selected.amount)}
                </span>
              </div>

              <Separator />

              <div className="py-1">
                <DetailRow label="날짜" value={selected.date} />
                <DetailRow
                  label={selected.type === 'income' ? '내용' : '상호명'}
                  value={selected.label}
                />
                {selected.type === 'expense' && (
                  <>
                    <DetailRow label="카테고리" value={selected.category} />
                    <DetailRow label="부서" value={selected.department} />
                    <DetailRow label="신청자" value={selected.employee_name} />
                    <DetailRow
                      label="상태"
                      value={selected.status ? STATUS_LABEL[selected.status] ?? selected.status : null}
                    />
                  </>
                )}
                <DetailRow label="메모" value={selected.memo} />
              </div>

              {selected.image_url && (
                <>
                  <Separator />
                  <a
                    href={selected.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 pt-1 text-sm text-primary hover:underline"
                  >
                    <ImageIcon className="h-4 w-4" />
                    영수증 이미지 보기
                  </a>
                </>
              )}

              <Separator />

              {!showConfirm ? (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </div>
              ) : (
                <div className="pt-1 space-y-2">
                  <Label className="text-sm text-destructive">
                    삭제하려면 아래에 <strong>삭제</strong>를 입력하세요.
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="삭제"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteConfirm() }}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setShowConfirm(false); setConfirmText('') }}
                    >
                      취소
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      disabled={confirmText !== CONFIRM_KEYWORD || deleting}
                      onClick={handleDeleteConfirm}
                    >
                      {deleting ? '삭제 중...' : '확인'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

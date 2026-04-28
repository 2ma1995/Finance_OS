'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { rejectReceipt } from '@/app/actions/receipts'
import { toast } from 'sonner'

interface RejectModalProps {
  receiptId: string | null
  onClose: () => void
  onSuccess: (receiptId: string) => void
}

export function RejectModal({ receiptId, onClose, onSuccess }: RejectModalProps) {
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleReject = () => {
    if (!receiptId || !comment.trim()) return

    startTransition(async () => {
      const result = await rejectReceipt(receiptId, comment)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('반려 처리되었습니다.')
        onSuccess(receiptId)
        setComment('')
        onClose()
      }
    })
  }

  return (
    <Dialog open={!!receiptId} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>반려 사유 입력</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="comment">사유 (필수)</Label>
          <Textarea
            id="comment"
            placeholder="반려 사유를 입력하세요..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={!comment.trim() || isPending}
          >
            {isPending ? '처리중...' : '반려'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

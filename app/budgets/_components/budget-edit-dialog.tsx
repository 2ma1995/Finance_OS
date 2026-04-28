'use client'

import { useState } from 'react'
import { upsertBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'

interface Props {
  department: string
  month: string
  currentAmount: number
}

export function BudgetEditDialog({ department, month, currentAmount }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(currentAmount))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await upsertBudget(department, month, Number(amount))
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('예산이 업데이트되었습니다.')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3 w-3" />
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{department} 예산 설정</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="budget">예산 금액 (원)</Label>
            <Input
              id="budget"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button type="submit" disabled={loading}>{loading ? '저장 중...' : '저장'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

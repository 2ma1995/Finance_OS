'use client'

import { useState } from 'react'
import { upsertBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface Props {
  month: string
  existingDepartments: string[]
}

export function AddBudgetDialog({ month, existingDepartments }: Props) {
  const [open, setOpen] = useState(false)
  const [department, setDepartment] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!department.trim()) return

    if (existingDepartments.includes(department.trim())) {
      toast.error('이미 등록된 부서입니다. 편집 버튼을 사용해주세요.')
      return
    }

    setLoading(true)
    const result = await upsertBudget(department.trim(), month, Number(amount))
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(`${department} 예산이 등록되었습니다.`)
      setDepartment('')
      setAmount('')
      setOpen(false)
    }
  }

  const [year, mon] = month.split('-')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        부서 예산 추가
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{year}년 {Number(mon)}월 부서 예산 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="dept">부서명 *</Label>
            <Input
              id="dept"
              placeholder="예: 개발팀, 영업팀, 마케팅팀"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">예산 금액 (원) *</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button type="submit" disabled={loading}>{loading ? '저장 중...' : '추가'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

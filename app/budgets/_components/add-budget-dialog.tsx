'use client'

import { useState } from 'react'
import { upsertBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

const CUSTOM = '__custom__'

interface Props {
  month: string
  existingDepartments: string[]
  availableDepartments: string[]
}

export function AddBudgetDialog({ month, existingDepartments, availableDepartments }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [customDept, setCustomDept] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const department = selected === CUSTOM ? customDept.trim() : selected

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!department) return

    if (existingDepartments.includes(department)) {
      toast.error('이미 등록된 부서입니다. 편집 버튼을 사용해주세요.')
      return
    }

    setLoading(true)
    const result = await upsertBudget(department, month, Number(amount))
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(`${department} 예산이 등록되었습니다.`)
      setSelected('')
      setCustomDept('')
      setAmount('')
      setOpen(false)
    }
  }

  const [year, mon] = month.split('-')

  // 이미 예산 등록된 부서는 드롭다운에서 제외
  const selectableDepts = availableDepartments.filter((d) => !existingDepartments.includes(d))

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
            <Label>부서 *</Label>
            <Select value={selected} onValueChange={(v) => setSelected(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="부서 선택" />
              </SelectTrigger>
              <SelectContent>
                {selectableDepts.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
                <SelectItem value={CUSTOM}>직접 입력</SelectItem>
              </SelectContent>
            </Select>
            {selected === CUSTOM && (
              <Input
                placeholder="부서명 직접 입력"
                value={customDept}
                onChange={(e) => setCustomDept(e.target.value)}
                required
              />
            )}
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
            <Button type="submit" disabled={loading || !department}>
              {loading ? '저장 중...' : '추가'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

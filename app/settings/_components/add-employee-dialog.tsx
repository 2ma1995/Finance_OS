'use client'

import { useState } from 'react'
import { addEmployee } from '@/app/actions/employees'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import type { EmployeeRole } from '@/types/database'

const CUSTOM = '__custom__'

export function AddEmployeeDialog({ departments }: { departments: string[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<EmployeeRole>('staff')
  const [deptSelect, setDeptSelect] = useState('')
  const [customDept, setCustomDept] = useState('')
  const [loading, setLoading] = useState(false)

  const department = deptSelect === CUSTOM ? customDept.trim() : deptSelect

  const reset = () => {
    setName('')
    setEmail('')
    setRole('staff')
    setDeptSelect('')
    setCustomDept('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await addEmployee({
      name,
      email,
      role,
      department: department || null,
    })
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('직원이 등록되었습니다. 초기 비밀번호: 000000')
      setOpen(false)
      reset()
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 mr-2" />
        직원 추가
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>직원 추가</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>이메일</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hong@company.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>역할</Label>
              <Select value={role} onValueChange={(v) => setRole(v as EmployeeRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">일반직원</SelectItem>
                  <SelectItem value="finance">재무</SelectItem>
                  <SelectItem value="ceo">대표</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>부서 (선택)</Label>
              <Select value={deptSelect} onValueChange={(v) => setDeptSelect(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="부서 없음" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">부서 없음</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>직접 입력</SelectItem>
                </SelectContent>
              </Select>
              {deptSelect === CUSTOM && (
                <Input
                  placeholder="부서명 직접 입력"
                  value={customDept}
                  onChange={(e) => setCustomDept(e.target.value)}
                />
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              입력한 이메일로 초대 링크가 발송됩니다.
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset() }}>
                취소
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '처리 중...' : '초대 발송'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

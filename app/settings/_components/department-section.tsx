'use client'

import { useState, useTransition } from 'react'
import { updateEmployee } from '@/app/actions/employees'
import { addDepartment } from '@/app/actions/employees'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Building2, Plus, UserRound } from 'lucide-react'
import type { Employee } from '@/types/database'

interface Props {
  employees: Employee[]
  departments: string[]
}

function AssignDialog({
  employee,
  departments,
  onSuccess,
}: {
  employee: Employee
  departments: string[]
  onSuccess: (emp: Employee, dept: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [dept, setDept] = useState(employee.department ?? '')
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateEmployee(employee.id, { department: dept || null as unknown as string })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('부서가 변경되었습니다.')
        onSuccess(employee, dept)
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-7 text-xs">
        변경
      </Button>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{employee.name} 부서 변경</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>부서 선택</Label>
            <Select value={dept} onValueChange={(v) => setDept(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="부서 없음" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">부서 없음</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AddDepartmentDialog({
  onAdd,
}: {
  onAdd: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const result = await addDepartment(name.trim())
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`${name.trim()} 부서가 추가되었습니다.`)
        onAdd(name.trim())
        setName('')
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        부서 추가
      </Button>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>새 부서 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="dept-name">부서명 *</Label>
            <Input
              id="dept-name"
              placeholder="예: 개발팀, 영업팀"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? '추가 중...' : '추가'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DepartmentSection({ employees, departments: initialDepts }: Props) {
  const [emps, setEmps] = useState<Employee[]>(employees)
  const [depts, setDepts] = useState<string[]>(initialDepts)

  const handleAssign = (emp: Employee, dept: string) => {
    setEmps((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, department: dept || null } : e))
    )
  }

  const handleAddDept = (name: string) => {
    if (!depts.includes(name)) {
      setDepts((prev) => [...prev, name].sort())
    }
  }

  // 부서별 직원 그룹핑
  const grouped: Record<string, Employee[]> = {}
  for (const dept of depts) {
    grouped[dept] = emps.filter((e) => e.department === dept)
  }
  const unassigned = emps.filter((e) => !e.department)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            부서 관리
          </CardTitle>
          <AddDepartmentDialog onAdd={handleAddDept} />
        </div>
      </CardHeader>
      <CardContent>
        {depts.length === 0 && unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            등록된 부서가 없습니다. 부서를 추가해주세요.
          </p>
        ) : (
          <div className="space-y-4">
            {depts.map((dept) => (
              <div key={dept} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{dept}</span>
                  <Badge variant="secondary" className="text-xs">{grouped[dept]?.length ?? 0}명</Badge>
                </div>
                {(grouped[dept] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">소속 직원 없음</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pl-6">
                    {grouped[dept].map((emp) => (
                      <div key={emp.id} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                        <UserRound className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{emp.name}</span>
                        <AssignDialog employee={emp} departments={depts} onSuccess={handleAssign} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {unassigned.length > 0 && (
              <div className="border rounded-lg p-4 border-dashed">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-medium text-sm text-muted-foreground">미배정</span>
                  <Badge variant="outline" className="text-xs">{unassigned.length}명</Badge>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  {unassigned.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                      <UserRound className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs">{emp.name}</span>
                      <AssignDialog employee={emp} departments={depts} onSuccess={handleAssign} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

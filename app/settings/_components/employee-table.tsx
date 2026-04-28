'use client'

import { useState } from 'react'
import { updateEmployee } from '@/app/actions/employees'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { Employee, EmployeeRole } from '@/types/database'

const ROLE_LABEL: Record<EmployeeRole, string> = {
  ceo: '대표',
  finance: '재무',
  staff: '일반직원',
}

function EditDialog({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<EmployeeRole>(employee.role)
  const [department, setDepartment] = useState(employee.department ?? '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await updateEmployee(employee.id, { role, department: department || null as unknown as string })
    setLoading(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('직원 정보가 업데이트되었습니다.')
      setOpen(false)
    }
  }

  const handleToggleActive = async () => {
    const result = await updateEmployee(employee.id, { is_active: !employee.is_active })
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(employee.is_active ? '비활성화되었습니다.' : '활성화되었습니다.')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>편집</Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{employee.name} 편집</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>역할</Label>
            <Select value={role} onValueChange={(v) => setRole(v as EmployeeRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ceo">대표</SelectItem>
                <SelectItem value="finance">재무</SelectItem>
                <SelectItem value="staff">일반직원</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept">부서</Label>
            <Input
              id="dept"
              placeholder="예: 개발팀, 영업팀"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleActive}
            >
              {employee.is_active ? '비활성화' : '활성화'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" disabled={loading}>{loading ? '저장 중...' : '저장'}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EmployeeTable({ employees }: { employees: Employee[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>이메일</TableHead>
          <TableHead>역할</TableHead>
          <TableHead>부서</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="w-16" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
              직원이 없습니다.
            </TableCell>
          </TableRow>
        )}
        {employees.map((emp) => (
          <TableRow key={emp.id}>
            <TableCell className="font-medium">{emp.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{emp.email}</TableCell>
            <TableCell>
              <Badge variant={emp.role === 'ceo' ? 'default' : 'secondary'}>
                {ROLE_LABEL[emp.role]}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">{emp.department ?? '-'}</TableCell>
            <TableCell>
              <Badge variant={emp.is_active ? 'default' : 'outline'}>
                {emp.is_active ? '활성' : '비활성'}
              </Badge>
            </TableCell>
            <TableCell>
              <EditDialog employee={emp} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

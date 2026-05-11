import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rawSupabase } from '@/lib/utils'
import { BudgetEditDialog } from './_components/budget-edit-dialog'
import { AddBudgetDialog } from './_components/add-budget-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export default async function BudgetsPage() {
  const supabase = await createSupabaseServerClient()
  const db = rawSupabase(supabase)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstOfMonth = `${currentMonth}-01`

  type SpendRow = { department: string; amount: number }
  type BudgetRow = { id: string; department: string; month: string; budget_amount: number }

  type EmpDeptRow = { department: string | null }

  const [{ data: spending }, { data: budgets }, { data: empDepts }] = await Promise.all([
    db
      .from('receipts')
      .select('department, amount')
      .eq('status', 'approved')
      .gte('date', firstOfMonth) as Promise<{ data: SpendRow[] | null }>,
    db
      .from('department_budgets')
      .select('*')
      .eq('month', currentMonth) as Promise<{ data: BudgetRow[] | null }>,
    db
      .from('employees')
      .select('department')
      .not('department', 'is', null) as Promise<{ data: EmpDeptRow[] | null }>,
  ])

  const availableDepartments = Array.from(
    new Set((empDepts ?? []).map((e) => e.department).filter(Boolean) as string[])
  ).sort()

  // 부서별 지출 집계
  const spendMap: Record<string, number> = {}
  for (const row of spending ?? []) {
    spendMap[row.department] = (spendMap[row.department] ?? 0) + row.amount
  }

  // 예산 있는 부서 + 지출만 있는 부서 합산
  const departments = Array.from(
    new Set([
      ...(budgets ?? []).map((b) => b.department),
      ...Object.keys(spendMap),
    ])
  ).sort()

  const rows = departments.map((dept) => {
    const budget = (budgets ?? []).find((b) => b.department === dept)
    const spent = spendMap[dept] ?? 0
    const budgetAmount = budget?.budget_amount ?? 0
    const remaining = budgetAmount - spent
    const pct = budgetAmount > 0 ? Math.min((spent / budgetAmount) * 100, 100) : 0
    return { dept, budgetId: budget?.id, budgetAmount, spent, remaining, pct }
  })

  const totalBudget = rows.reduce((s, r) => s + r.budgetAmount, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">예산 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {now.getFullYear()}년 {now.getMonth() + 1}월 부서별 예산 현황
          </p>
        </div>
        <AddBudgetDialog
          month={currentMonth}
          existingDepartments={departments}
          availableDepartments={availableDepartments}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 예산</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{fmt(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">잔여 예산</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalBudget - totalSpent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(totalBudget - totalSpent)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>부서</TableHead>
                <TableHead className="text-right">예산</TableHead>
                <TableHead className="text-right">지출</TableHead>
                <TableHead className="text-right">잔여</TableHead>
                <TableHead>사용률</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.dept}>
                  <TableCell className="font-medium">{row.dept}</TableCell>
                  <TableCell className="text-right">{fmt(row.budgetAmount)}</TableCell>
                  <TableCell className="text-right text-red-500">{fmt(row.spent)}</TableCell>
                  <TableCell className={`text-right font-medium ${row.remaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmt(row.remaining)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${row.pct >= 90 ? 'bg-red-500' : row.pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {row.pct.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <BudgetEditDialog
                      department={row.dept}
                      month={currentMonth}
                      currentAmount={row.budgetAmount}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

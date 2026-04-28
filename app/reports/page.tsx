import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rawSupabase } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BudgetBarChart } from '@/app/dashboard/_components/budget-bar-chart'
import { ExpenseDonutChart } from '@/app/dashboard/_components/expense-donut-chart'
import { MonthSelector } from './_components/month-selector'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const now = new Date()
  const currentMonth = monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = currentMonth.split('-')
  const firstOfMonth = `${currentMonth}-01`
  const lastOfMonth = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

  const supabase = await createSupabaseServerClient()
  const db = rawSupabase(supabase)

  type ApprovedRow = { amount: number; department: string; category: string }
  type IncomeRow = { amount: number }

  const [{ data: approvedReceipts }, { data: incomeData }, { data: deptBudgets }] = await Promise.all([
    db
      .from('receipts')
      .select('amount, department, category')
      .eq('status', 'approved')
      .gte('date', firstOfMonth)
      .lte('date', lastOfMonth) as Promise<{ data: ApprovedRow[] | null }>,
    supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'income')
      .gte('date', firstOfMonth)
      .lte('date', lastOfMonth)
      .returns<IncomeRow[]>(),
    db
      .from('department_budgets')
      .select('*')
      .eq('month', currentMonth) as Promise<{ data: { department: string; budget_amount: number }[] | null }>,
  ])

  const totalExpense = (approvedReceipts ?? []).reduce((s, r) => s + r.amount, 0)
  const totalIncome = (incomeData ?? []).reduce((s, r) => s + r.amount, 0)
  const netProfit = totalIncome - totalExpense

  type DeptMap = Record<string, number>
  const deptSpending = (approvedReceipts ?? []).reduce<DeptMap>((acc, r) => {
    acc[r.department] = (acc[r.department] ?? 0) + r.amount
    return acc
  }, {})

  const budgetChartData = Object.entries(deptSpending).map(([department, spent]) => {
    const budgetRow = (deptBudgets ?? []).find((b) => b.department === department)
    return { department, spent, budget: budgetRow?.budget_amount ?? Math.ceil(spent * 1.25) }
  })

  const catSpending = (approvedReceipts ?? []).reduce<DeptMap>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.amount
    return acc
  }, {})
  const donutChartData = Object.entries(catSpending)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  // 월 선택용: 최근 12개월
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    return { value, label }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">리포트</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {year}년 {Number(month)}월 재무 현황
          </p>
        </div>
        <MonthSelector options={monthOptions} current={currentMonth} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 수입</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{fmt(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{fmt(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">순이익</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetBarChart data={budgetChartData} />
        <ExpenseDonutChart data={donutChartData} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">부서별 지출 상세</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>부서</TableHead>
                <TableHead className="text-right">지출 금액</TableHead>
                <TableHead className="text-right">비율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(deptSpending).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    해당 월 데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {Object.entries(deptSpending)
                .sort(([, a], [, b]) => b - a)
                .map(([dept, amount]) => (
                  <TableRow key={dept}>
                    <TableCell className="font-medium">{dept}</TableCell>
                    <TableCell className="text-right">{fmt(amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : 0}%
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

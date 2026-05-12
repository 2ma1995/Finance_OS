import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rawSupabase } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BudgetBarChart } from '@/app/dashboard/_components/budget-bar-chart'
import { ExpenseDonutChart } from '@/app/dashboard/_components/expense-donut-chart'
import { MonthSelector } from './_components/month-selector'
import { ReportTabs } from './_components/report-tabs'
import { YearNavigator } from './_components/year-navigator'
import { AnnualReport } from './_components/annual-report'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string; year?: string }>
}) {
  const { tab: tabParam, month: monthParam, year: yearParam } = await searchParams
  const now = new Date()
  const currentTab = tabParam === 'annual' ? 'annual' : 'monthly'
  const currentMonth = monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentYear = yearParam ?? String(now.getFullYear())

  const supabase = await createSupabaseServerClient()
  const db = rawSupabase(supabase)

  // ── Annual tab ──────────────────────────────────────────────────────────────
  if (currentTab === 'annual') {
    const firstOfYear = `${currentYear}-01-01`
    const lastOfYear = `${currentYear}-12-31`

    type AnnualReceiptRow = { amount: number; department: string; category: string; date: string }
    type AnnualIncomeRow = { amount: number; date: string }

    const [{ data: annualReceipts }, { data: annualIncome }] = await Promise.all([
      db
        .from('receipts')
        .select('amount, department, category, date')
        .eq('status', 'approved')
        .gte('date', firstOfYear)
        .lte('date', lastOfYear) as Promise<{ data: AnnualReceiptRow[] | null }>,
      supabase
        .from('transactions')
        .select('amount, date')
        .eq('type', 'income')
        .gte('date', firstOfYear)
        .lte('date', lastOfYear)
        .returns<AnnualIncomeRow[]>(),
    ])

    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      const monthKey = `${currentYear}-${m}`
      const income = (annualIncome ?? [])
        .filter((r) => r.date.startsWith(monthKey))
        .reduce((s, r) => s + r.amount, 0)
      const expense = (annualReceipts ?? [])
        .filter((r) => r.date.startsWith(monthKey))
        .reduce((s, r) => s + r.amount, 0)
      return { month: monthKey, label: `${i + 1}월`, income, expense }
    })

    const totalIncome = (annualIncome ?? []).reduce((s, r) => s + r.amount, 0)
    const totalExpense = (annualReceipts ?? []).reduce((s, r) => s + r.amount, 0)

    type DeptMap = Record<string, number>
    const deptMap = (annualReceipts ?? []).reduce<DeptMap>((acc, r) => {
      acc[r.department] = (acc[r.department] ?? 0) + r.amount
      return acc
    }, {})
    const deptSpending = Object.entries(deptMap)
      .map(([department, amount]) => ({ department, amount }))
      .sort((a, b) => b.amount - a.amount)

    const catMap = (annualReceipts ?? []).reduce<DeptMap>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + r.amount
      return acc
    }, {})
    const donutData = Object.entries(catMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">리포트</h1>
            <p className="text-sm text-muted-foreground mt-1">{currentYear}년 연간 재무 현황</p>
          </div>
          <div className="flex items-center gap-3">
            <ReportTabs currentTab="annual" month={currentMonth} year={currentYear} />
            <YearNavigator year={currentYear} />
          </div>
        </div>

        <AnnualReport
          year={currentYear}
          monthlyTrend={monthlyTrend}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          deptSpending={deptSpending}
          donutData={donutData}
        />
      </div>
    )
  }

  // ── Monthly tab ─────────────────────────────────────────────────────────────
  const [year, month] = currentMonth.split('-')
  const firstOfMonth = `${currentMonth}-01`
  const lastOfMonth = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

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
        <div className="flex items-center gap-3">
          <ReportTabs currentTab="monthly" month={currentMonth} year={currentYear} />
          <MonthSelector options={monthOptions} current={currentMonth} />
        </div>
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

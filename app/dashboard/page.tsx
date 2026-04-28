import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rawSupabase } from '@/lib/utils'
import { KpiCards } from './_components/kpi-cards'
import { BudgetBarChart } from './_components/budget-bar-chart'
import { ExpenseDonutChart } from './_components/expense-donut-chart'
import { RecentReceiptsRealtime } from './_components/recent-receipts-realtime'
import type { Receipt, DepartmentBudget } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const db = rawSupabase(supabase)

  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  type ApprovedRow = { amount: number; department: string; category: string }
  type IncomeRow = { amount: number }

  const [
    { data: approvedReceipts },
    { count: pendingCount },
    { data: incomeData },
    { data: recentReceipts },
    { data: deptBudgets },
  ] = await Promise.all([
    db.from('receipts')
      .select('amount, department, category')
      .eq('status', 'approved')
      .gte('date', firstOfMonth) as Promise<{ data: ApprovedRow[] | null }>,
    db.from('receipts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending') as Promise<{ count: number | null }>,
    supabase.from('transactions')
      .select('amount')
      .eq('type', 'income')
      .gte('date', firstOfMonth)
      .returns<IncomeRow[]>(),
    db.from('receipts')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(10) as Promise<{ data: Receipt[] | null }>,
    db.from('department_budgets')
      .select('*')
      .eq('month', currentMonth) as Promise<{ data: DepartmentBudget[] | null }>,
  ])

  const monthlyExpense = (approvedReceipts ?? []).reduce((sum, r) => sum + r.amount, 0)
  const weeklyBurnRate = monthlyExpense / 4.33
  const monthlyIncome = (incomeData ?? []).reduce((sum: number, t: IncomeRow) => sum + t.amount, 0)
  const expectedProfit = monthlyIncome - monthlyExpense

  type DeptMap = Record<string, number>
  const deptSpending = (approvedReceipts ?? []).reduce<DeptMap>((acc, r) => {
    acc[r.department] = (acc[r.department] ?? 0) + r.amount
    return acc
  }, {})

  const budgetChartData = Object.entries(deptSpending).map(([department, spent]) => {
    const budgetRow = (deptBudgets ?? []).find((b) => b.department === department)
    return {
      department,
      spent,
      budget: budgetRow?.budget_amount ?? Math.ceil(spent * 1.25),
    }
  })

  const catSpending = (approvedReceipts ?? []).reduce<DeptMap>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.amount
    return acc
  }, {})

  const donutChartData = Object.entries(catSpending)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {now.getFullYear()}년 {now.getMonth() + 1}월 현황
          </p>
        </div>
      </div>

      <KpiCards
        data={{ monthlyExpense, weeklyBurnRate, expectedProfit, pendingCount: pendingCount ?? 0 }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetBarChart data={budgetChartData} />
        <ExpenseDonutChart data={donutChartData} />
      </div>

      <RecentReceiptsRealtime initial={recentReceipts ?? []} />
    </div>
  )
}

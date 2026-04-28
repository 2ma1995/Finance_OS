import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rawSupabase } from '@/lib/utils'
import { AddIncomeDialog } from './_components/add-income-dialog'
import { TransactionsTable, type TransactionRow } from './_components/transactions-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Receipt } from '@/types/database'

type IncomeRow = { id: string; date: string; description: string; amount: number; memo: string | null }

function fmt(amount: number) {
  return amount.toLocaleString('ko-KR') + '원'
}

export default async function TransactionsPage() {
  const supabase = await createSupabaseServerClient()
  const db = rawSupabase(supabase)

  const [{ data: incomeRows }, { data: expenseRows }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, description, amount, memo')
      .eq('type', 'income')
      .order('date', { ascending: false })
      .returns<IncomeRow[]>(),
    db
      .from('receipts')
      .select('id, date, merchant_name, amount, category, department, status, memo, image_url, employee_name')
      .in('status', ['approved', 'pending'])
      .order('date', { ascending: false }) as Promise<{ data: Receipt[] | null }>,
  ])

  const rows: TransactionRow[] = [
    ...(incomeRows ?? []).map((t) => ({
      id: t.id,
      date: t.date,
      label: t.description,
      sub: t.memo ?? '',
      amount: t.amount,
      type: 'income' as const,
      badge: '수입',
      memo: t.memo,
    })),
    ...(expenseRows ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      label: r.merchant_name,
      sub: r.category,
      amount: r.amount,
      type: 'expense' as const,
      badge: r.status === 'approved' ? '승인' : '대기',
      memo: r.memo,
      department: r.department,
      category: r.category,
      status: r.status,
      image_url: r.image_url,
      employee_name: r.employee_name,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const totalIncome = (incomeRows ?? []).reduce((s, t) => s + t.amount, 0)
  const totalExpense = (expenseRows ?? [])
    .filter((r) => r.status === 'approved')
    .reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">거래 내역</h1>
          <p className="text-sm text-muted-foreground mt-1">수입 및 지출 내역을 확인합니다.</p>
        </div>
        <AddIncomeDialog />
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
            <CardTitle className="text-sm font-medium text-muted-foreground">총 지출 (승인)</CardTitle>
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
            <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(totalIncome - totalExpense)}
            </p>
          </CardContent>
        </Card>
      </div>

      <TransactionsTable rows={rows} />
    </div>
  )
}

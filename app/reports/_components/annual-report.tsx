import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExpenseDonutChart } from '@/app/dashboard/_components/expense-donut-chart'
import { MonthlyTrendChart, type MonthlyTrendData } from './monthly-trend-chart'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

interface Props {
  year: string
  monthlyTrend: MonthlyTrendData[]
  totalIncome: number
  totalExpense: number
  deptSpending: { department: string; amount: number }[]
  donutData: { category: string; amount: number }[]
}

export function AnnualReport({ year, monthlyTrend, totalIncome, totalExpense, deptSpending, donutData }: Props) {
  const netProfit = totalIncome - totalExpense

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">연간 수입</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{fmt(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">연간 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{fmt(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">연간 순이익</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <MonthlyTrendChart data={monthlyTrend} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpenseDonutChart data={donutData} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">부서별 연간 지출</CardTitle>
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
                {deptSpending.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      {year}년 데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
                {deptSpending.map(({ department, amount }) => (
                  <TableRow key={department}>
                    <TableCell className="font-medium">{department}</TableCell>
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
    </div>
  )
}

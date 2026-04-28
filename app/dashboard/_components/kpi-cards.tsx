import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TrendingDown, Flame, TrendingUp, Clock } from 'lucide-react'

interface KpiData {
  monthlyExpense: number
  weeklyBurnRate: number
  expectedProfit: number
  pendingCount: number
}

export function KpiCards({ data }: { data: KpiData }) {
  const cards = [
    {
      title: '이번달 총지출',
      value: formatCurrency(data.monthlyExpense),
      icon: TrendingDown,
      color: 'text-red-500',
    },
    {
      title: 'Cash Burn Rate (주당)',
      value: formatCurrency(data.weeklyBurnRate),
      icon: Flame,
      color: 'text-orange-500',
    },
    {
      title: '예상 영업이익',
      value: formatCurrency(data.expectedProfit),
      icon: TrendingUp,
      color: data.expectedProfit >= 0 ? 'text-green-500' : 'text-red-500',
    },
    {
      title: '승인 대기',
      value: `${data.pendingCount}건`,
      icon: Clock,
      color: 'text-yellow-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

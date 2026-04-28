'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899']

export interface CategoryExpenseData {
  category: string
  amount: number
}

function DonutTooltip({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border bg-card p-2 text-sm shadow">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function ExpenseDonutChart({ data }: { data: CategoryExpenseData[] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">비용 카테고리 분포</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">데이터 없음</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                dataKey="amount"
                nameKey="category"
                paddingAngle={2}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
              <Legend
                formatter={(value) => {
                  const item = data.find((d) => d.category === value)
                  const pct = item ? ((item.amount / total) * 100).toFixed(1) : 0
                  return `${value} (${pct}%)`
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

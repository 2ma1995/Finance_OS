'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export interface MonthlyTrendData {
  month: string
  label: string
  income: number
  expense: number
}

function TrendTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border bg-card p-2 text-sm shadow">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export function MonthlyTrendChart({ data }: { data: MonthlyTrendData[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">월별 수입·지출 추이</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-16 text-center text-sm text-muted-foreground">데이터 없음</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 10000)}만`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend />
              <Bar dataKey="income" name="수입" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expense" name="지출" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export interface DeptBudgetData {
  department: string
  spent: number
  budget: number
}

function BudgetTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border bg-card p-2 text-sm shadow">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export function BudgetBarChart({ data }: { data: DeptBudgetData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">부서별 예산 집행률</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">데이터 없음</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <XAxis dataKey="department" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 10000)}만`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<BudgetTooltip />} />
              <Legend />
              <Bar dataKey="budget" name="예산" fill="#e2e8f0" radius={[2, 2, 0, 0]} />
              <Bar dataKey="spent" name="집행액" radius={[2, 2, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.spent / entry.budget > 0.9 ? '#ef4444' : '#3b82f6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useRouter, usePathname } from 'next/navigation'

interface MonthOption {
  value: string
  label: string
}

export function MonthSelector({ options, current }: { options: MonthOption[]; current: string }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <select
      value={current}
      onChange={(e) => router.push(`${pathname}?month=${e.target.value}`)}
      className="text-sm border rounded-md px-3 py-1.5 bg-background"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

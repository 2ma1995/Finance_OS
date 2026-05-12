'use client'

import { useRouter, usePathname } from 'next/navigation'

interface Props {
  currentTab: string
  month: string
  year: string
}

export function ReportTabs({ currentTab, month, year }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const go = (tab: string) => {
    if (tab === 'monthly') {
      router.push(`${pathname}?tab=monthly&month=${month}`)
    } else {
      router.push(`${pathname}?tab=annual&year=${year}`)
    }
  }

  return (
    <div className="flex gap-1 rounded-lg border bg-muted p-1">
      {(['monthly', 'annual'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => go(tab)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            currentTab === tab
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab === 'monthly' ? '월별' : '연간'}
        </button>
      ))}
    </div>
  )
}

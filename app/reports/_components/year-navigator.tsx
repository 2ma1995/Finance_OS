'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function YearNavigator({ year }: { year: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const navigate = (delta: number) => {
    const newYear = String(Number(year) + delta)
    router.push(`${pathname}?tab=annual&year=${newYear}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-base font-semibold w-16 text-center">{year}년</span>
      <Button variant="outline" size="icon" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

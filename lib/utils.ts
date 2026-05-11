import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Supabase 타입 추론이 never를 반환하는 테이블(receipts, approvals, department_budgets 등)에 사용
// 근본 해결책: `supabase gen types typescript` 로 타입 재생성
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rawSupabase(client: unknown) { return client as any }

// Supabase storage URL → 서명된 URL 프록시 경로로 변환
export function receiptImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null
  const match = imageUrl.match(/\/receipts\/(.+)$/)
  if (!match) return imageUrl
  return `/api/receipt-image?path=${encodeURIComponent(match[1])}`
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currency: string = 'KRW',
  locale: string = 'ko-KR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(amount)
}

export function formatDate(date: string | Date, locale: string = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date, locale: string = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

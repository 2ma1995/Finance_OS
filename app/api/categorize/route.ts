import { NextRequest, NextResponse } from 'next/server'

const OCR_SERVER_URL = process.env.OCR_SERVER_URL ?? 'http://localhost:8000'

const SUPABASE_STORAGE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null

interface ReceiptData {
  merchant_name: string
  total_amount: number
  supply_value: number | null
  vat: number | null
  tax_free_amount: number | null
  ocr_failed: boolean
  raw_text: string
  lines: string[]
}

function isAllowedImageUrl(url: string): boolean {
  if (!SUPABASE_STORAGE_HOST) return true // env 미설정 시 개발 환경용 통과
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === SUPABASE_STORAGE_HOST &&
      parsed.pathname.startsWith('/storage/v1/object/public/receipts/')
    )
  } catch {
    return false
  }
}

async function notifySlackMismatch(data: ReceiptData) {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_ALERT_CHANNEL
  if (!token || !channel) return

  const computed = (data.supply_value ?? 0) + (data.vat ?? 0) + (data.tax_free_amount ?? 0)
  const taxFreeText = data.tax_free_amount ? ` + ${data.tax_free_amount.toLocaleString()}(면세)` : ''
  const text =
    `:warning: *OCR 검증 불일치 — 수정 필요*\n` +
    `• 상호명: *${data.merchant_name || '알 수 없음'}*\n` +
    `• 합계: *${data.total_amount.toLocaleString()}원*\n` +
    `• 공급가액 + 부가세${taxFreeText} = ${computed.toLocaleString()}원 (차이 ${Math.abs(computed - data.total_amount).toLocaleString()}원)`

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, text }),
  }).catch((e) => console.error('[Slack mismatch alert]', e))
}

export async function POST(request: NextRequest) {
  let imageUrl: string
  try {
    const body = await request.json()
    imageUrl = body.imageUrl
    if (!imageUrl || typeof imageUrl !== 'string') throw new Error()
  } catch {
    return NextResponse.json({ error: '유효하지 않은 요청입니다.' }, { status: 400 })
  }

  if (!isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: '유효하지 않은 이미지 URL입니다.' }, { status: 400 })
  }

  try {
    const ocrRes = await fetch(`${OCR_SERVER_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    })
    if (!ocrRes.ok) throw new Error(`OCR 서버 오류 ${ocrRes.status}`)

    const data: ReceiptData = await ocrRes.json()

    if (process.env.NODE_ENV !== 'production') {
      console.log('[OCR result]', {
        merchant: data.merchant_name,
        total: data.total_amount,
        supply: data.supply_value,
        vat: data.vat,
      })
    }

    if (data.total_amount > 0 && data.supply_value != null && data.vat != null) {
      const computed = data.supply_value + data.vat + (data.tax_free_amount ?? 0)
      if (Math.abs(computed - data.total_amount) > 10) {
        notifySlackMismatch(data)
      }
    }

    return NextResponse.json({
      amount: data.total_amount,
      merchant: data.merchant_name,
      supply_value: data.supply_value,
      vat: data.vat,
      tax_free_amount: data.tax_free_amount,
      extracted_text: data.raw_text?.slice(0, 500) ?? '',
      ocr_failed: data.ocr_failed,
    })
  } catch (err) {
    console.error('OCR 서버 호출 실패:', err)
    return NextResponse.json({
      amount: 0,
      merchant: '',
      supply_value: null,
      vat: null,
      tax_free_amount: null,
      extracted_text: '',
      ocr_failed: true,
    })
  }
}

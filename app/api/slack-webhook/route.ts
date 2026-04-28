import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase-server'

function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret || !timestamp || !signature) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const baseString = `v0:${timestamp}:${body}`
  const expected = 'v0=' + createHmac('sha256', secret).update(baseString).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

interface SlackFile {
  id: string
  name: string
  mimetype: string
  url_private: string
}

interface SlackEvent {
  type: string
  subtype?: string
  user: string
  text?: string
  channel: string
  ts: string
  files?: SlackFile[]
}

async function postSlackBlocks(channel: string, threadTs: string, text: string, blocks?: object[]) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({ channel, thread_ts: threadTs, text, blocks }),
  })
}

interface OCRResult {
  amount: number
  merchant: string
  supply_value: number | null
  vat: number | null
  tax_free_amount: number | null
  ocr_failed: boolean
}

async function extractReceiptInfo(imageUrl: string): Promise<OCRResult> {
  const failed: OCRResult = { amount: 0, merchant: '', supply_value: null, vat: null, tax_free_amount: null, ocr_failed: true }
  try {
    if (process.env.NODE_ENV !== 'production') console.log('[OCR] 요청 URL:', imageUrl)
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    })
    if (!res.ok) {
      console.error('[OCR] categorize 실패:', res.status, await res.text())
      return failed
    }
    const data = await res.json()
    if (process.env.NODE_ENV !== 'production') console.log('[OCR] 결과:', { amount: data.amount, merchant: data.merchant, ocr_failed: data.ocr_failed })
    return {
      amount: data.amount ?? 0,
      merchant: data.merchant ?? '',
      supply_value: data.supply_value ?? null,
      vat: data.vat ?? null,
      tax_free_amount: data.tax_free_amount ?? null,
      ocr_failed: data.ocr_failed ?? false,
    }
  } catch (e) {
    console.error('[OCR] 예외 발생:', e)
    return failed
  }
}

async function processSlackMessage(event: SlackEvent) {
  const supabase = createServiceClient()

  // 1. Slack 유저 이메일로 직원 조회
  const userRes = await fetch(`https://slack.com/api/users.info?user=${event.user}`, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  })
  const userJson = await userRes.json()
  const email = userJson.user?.profile?.email as string | undefined

  if (!email) {
    await postSlackBlocks(event.channel, event.ts, '❌ Slack 프로필에 이메일이 설정되지 않았습니다.')
    return
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('user_id, name, department, role')
    .eq('email', email)
    .eq('is_active', true)
    .single()

  if (!employee) {
    await postSlackBlocks(event.channel, event.ts, `❌ 등록된 직원이 아닙니다. (${email})`)
    return
  }

  if (employee.role === 'finance') {
    await postSlackBlocks(event.channel, event.ts, '❌ 재무 담당자는 Slack으로 영수증을 제출할 수 없습니다.')
    return
  }

  // 2. 파일 다운로드 → Supabase Storage 업로드
  const file = event.files![0]
  const fileRes = await fetch(file.url_private, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  })

  if (!fileRes.ok) {
    await postSlackBlocks(event.channel, event.ts, `❌ 파일 다운로드 실패 (${fileRes.status})`)
    return
  }

  const fileBuffer = await fileRes.arrayBuffer()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${employee.user_id}/${Date.now()}-slack.${ext}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(storagePath, fileBuffer, { contentType: file.mimetype })

  if (uploadError) {
    await postSlackBlocks(event.channel, event.ts, `❌ 스토리지 업로드 실패: ${uploadError.message}`)
    return
  }

  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(uploadData.path)

  // 3. GPT-4o Vision으로 금액 + 상호명 추출
  await postSlackBlocks(event.channel, event.ts, '🔍 영수증을 분석 중입니다...')

  const { amount, merchant, supply_value, vat, tax_free_amount } = await extractReceiptInfo(publicUrl)

  // 금액 불일치 감지 → 스레드 경고
  if (amount > 0 && supply_value != null && vat != null) {
    const computed = supply_value + vat + (tax_free_amount ?? 0)
    if (Math.abs(computed - amount) > 10) {
      const taxFreeText = tax_free_amount ? ` + ${tax_free_amount.toLocaleString()}(면세)` : ''
      await postSlackBlocks(
        event.channel, event.ts,
        `:warning: OCR 검증 불일치 — 수동 확인 필요\n• 합계: ${amount.toLocaleString()}원\n• 공급가액 + 부가세${taxFreeText} = ${computed.toLocaleString()}원`,
      )
    }
  }

  // 4. receipts 테이블에 저장 (카테고리는 미분류로 임시 저장)
  const today = new Date().toISOString().split('T')[0]
  const { data: receipt, error: insertError } = await supabase
    .from('receipts')
    .insert({
      employee_id: employee.user_id,
      employee_name: employee.name,
      department: employee.department ?? '미지정',
      amount,
      merchant_name: merchant || '(인식 불가)',
      date: today,
      category: '미분류',
      image_url: publicUrl,
      is_manual_review: true,
      status: 'pending',
      supply_value,
      vat,
      tax_free_amount,
    })
    .select('id')
    .single()

  if (insertError || !receipt) {
    await postSlackBlocks(event.channel, event.ts, `❌ 저장 실패: ${insertError?.message}`)
    return
  }

  // 5. 카테고리 선택 버튼 전송
  const amountText = amount > 0 ? `${amount.toLocaleString()}원` : '⚠️ 금액 인식 실패'
  const merchantText = merchant || '⚠️ 상호명 인식 실패'

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ 영수증 인식 완료\n• 담당자: *${employee.name}*\n• 금액: *${amountText}*\n• 상호명: *${merchantText}*\n\n*카테고리를 선택해주세요:*`,
      },
    },
    {
      type: 'actions',
      block_id: `category_${receipt.id}`,
      elements: [
        { type: 'button', text: { type: 'plain_text', text: '복리후생비' }, value: '복리후생비', action_id: 'cat_welfare' },
        { type: 'button', text: { type: 'plain_text', text: '소모품비' }, value: '소모품비', action_id: 'cat_supplies' },
        { type: 'button', text: { type: 'plain_text', text: '출장비' }, value: '출장비', action_id: 'cat_travel' },
        { type: 'button', text: { type: 'plain_text', text: '접대비' }, value: '접대비', action_id: 'cat_entertainment' },
        { type: 'button', text: { type: 'plain_text', text: '기타' }, value: '기타', action_id: 'cat_other' },
      ],
    },
  ]

  await postSlackBlocks(event.channel, event.ts, '카테고리를 선택해주세요.', blocks)
}

export async function POST(request: NextRequest) {
  const body = await request.text()

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const timestamp = request.headers.get('x-slack-request-timestamp') ?? ''
  const signature = request.headers.get('x-slack-signature') ?? ''

  if (!verifySlackSignature(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  const event = payload.event as SlackEvent | undefined
  if (
    event &&
    event.type === 'message' &&
    event.files?.length &&
    event.subtype !== 'bot_message' &&
    event.subtype !== 'message_changed'
  ) {
    processSlackMessage(event).catch((err) => console.error('[slack-webhook]', err))
  }

  return NextResponse.json({ ok: true })
}

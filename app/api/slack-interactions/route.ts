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

export async function POST(request: NextRequest) {
  const body = await request.text()
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? ''
  const signature = request.headers.get('x-slack-signature') ?? ''

  if (!verifySlackSignature(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Slack은 interactions을 form-encoded로 전송
  const params = new URLSearchParams(body)
  const rawPayload = params.get('payload')
  if (!rawPayload) return NextResponse.json({ ok: true })

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawPayload)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (payload.type !== 'block_actions') return NextResponse.json({ ok: true })

  const actions = payload.actions as { block_id: string; value: string }[]
  const action = actions?.[0]
  if (!action) return NextResponse.json({ ok: true })

  // block_id 형식: "category_{receiptId}"
  const receiptId = action.block_id.replace('category_', '')
  const category = action.value

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const ALLOWED_CATEGORIES = ['복리후생비', '소모품비', '출장비', '접대비', '기타', '미분류']

  if (!UUID_RE.test(receiptId) || !ALLOWED_CATEGORIES.includes(category)) {
    console.error('[slack-interactions] 유효하지 않은 입력:', { receiptId, category })
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('receipts')
    .update({ category, is_manual_review: false })
    .eq('id', receiptId)

  if (error) {
    console.error('[slack-interactions] 업데이트 실패:', error.message)
    return NextResponse.json({ ok: true })
  }

  // 버튼 메시지를 완료 메시지로 교체
  const message = payload.message as { ts: string }
  const channel = (payload.channel as { id: string }).id

  await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel,
      ts: message.ts,
      text: `✅ 카테고리 선택 완료: *${category}*\n영수증이 결재 대기 상태로 등록되었습니다.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ 카테고리 선택 완료: *${category}*\n영수증이 결재 대기 상태로 등록되었습니다.`,
          },
        },
      ],
    }),
  })

  return NextResponse.json({ ok: true })
}

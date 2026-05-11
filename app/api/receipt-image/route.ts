import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const { data } = await createServiceClient()
    .storage
    .from('receipts')
    .createSignedUrl(path, 3600) // 1시간 유효

  if (!data?.signedUrl) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.redirect(data.signedUrl)
}

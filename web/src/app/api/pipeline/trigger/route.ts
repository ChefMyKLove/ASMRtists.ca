import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secret = process.env.PIPELINE_WEBHOOK_SECRET
  const incoming = request.headers.get('x-pipeline-secret') ?? ''

  if (secret && incoming !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let artworkId: string | undefined
  try {
    const body = await request.json()
    artworkId = body.artworkId
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const webhookUrl = process.env.PIPELINE_WEBHOOK_URL
  if (!webhookUrl) {
    console.log(`Pipeline trigger: no PIPELINE_WEBHOOK_URL set — artwork ${artworkId} queued for next run`)
    return NextResponse.json({ queued: true })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artworkId }),
    })
    if (!res.ok) {
      console.error(`Pipeline webhook returned ${res.status}`)
      return NextResponse.json({ error: 'Pipeline webhook failed' }, { status: 502 })
    }
    return NextResponse.json({ triggered: true })
  } catch (err) {
    console.error('Pipeline webhook error:', err)
    return NextResponse.json({ error: 'Pipeline webhook unreachable' }, { status: 502 })
  }
}

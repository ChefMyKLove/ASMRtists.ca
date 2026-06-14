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

  // If an external pipeline URL is configured, forward to it
  if (webhookUrl) {
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

  // No external URL — run internal pipeline (fire-and-forget so this request returns quickly)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const processUrl = `${baseUrl}/api/pipeline/process`
  const pipelineSecret = process.env.PIPELINE_WEBHOOK_SECRET ?? ''

  // Kick off async — don't await so the trigger returns immediately
  fetch(processUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pipeline-secret': pipelineSecret,
    },
    body: JSON.stringify({ artworkId }),
  }).catch((err) => console.error('Internal pipeline process error:', err))

  return NextResponse.json({ triggered: true, internal: true })
}

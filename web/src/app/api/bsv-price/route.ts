let cache: { value: number; expires: number } | null = null

export async function GET() {
  if (cache && Date.now() < cache.expires) {
    return Response.json({ usd: cache.value })
  }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-sv&vs_currencies=usd',
      { next: { revalidate: 0 } },
    )
    if (!res.ok) throw new Error('CoinGecko fetch failed')
    const data = await res.json() as Record<string, { usd?: number }>
    const usd = data?.['bitcoin-sv']?.usd
    if (typeof usd !== 'number') throw new Error('Invalid response')
    cache = { value: usd, expires: Date.now() + 60_000 }
    return Response.json({ usd })
  } catch {
    if (cache) return Response.json({ usd: cache.value })
    return Response.json({ usd: null }, { status: 503 })
  }
}

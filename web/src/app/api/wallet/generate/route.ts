import { NextResponse } from 'next/server'

/**
 * GET /api/wallet/generate
 *
 * Returns ONLY a freshly generated BSV address — the mnemonic and WIF
 * are never touched server-side. Wallet generation happens client-side
 * in the browser via src/lib/bsv/wallet.ts.
 *
 * This endpoint exists as a no-op placeholder for reference.
 * Real wallet generation should be done in the client component.
 */
export async function GET() {
  return NextResponse.json(
    {
      message:
        'Wallet generation is performed client-side. Use src/lib/bsv/wallet.ts in your browser component.',
      docs: 'Call generateWallet() from @/lib/bsv/wallet in a Client Component. Never send mnemonic or WIF to the server.',
    },
    { status: 200 }
  )
}

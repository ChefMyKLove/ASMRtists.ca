/**
 * Run with: node verify-wallet.mjs
 * Reads PLATFORM_FUNDING_WIF from your .env.local and derives the BSV address.
 * Compare the output to: 1GBLvfRCUZePBwXfm3Ehyw777hfAzWbGvt
 */
import { readFileSync } from 'fs'
import { PrivateKey } from '@bsv/sdk'

// Load .env.local manually
let wif = process.env.PLATFORM_FUNDING_WIF

if (!wif) {
  try {
    const env = readFileSync('./web/.env.local', 'utf8')
    const match = env.match(/^PLATFORM_FUNDING_WIF=(.+)$/m)
    if (match) wif = match[1].trim()
  } catch {
    // not found
  }
}

if (!wif) {
  console.error('No PLATFORM_FUNDING_WIF found. Pass it directly:')
  console.error('  PLATFORM_FUNDING_WIF=<your-wif> node verify-wallet.mjs')
  process.exit(1)
}

try {
  const key = PrivateKey.fromWif(wif)
  const address = key.toAddress().toString()
  const expected = '1GBLvfRCUZePBwXfm3Ehyw777hfAzWbGvt'

  console.log('Derived address:', address)
  console.log('Expected address:', expected)
  console.log(address === expected ? '✓ MATCH — this is the right WIF' : '✗ MISMATCH — wrong key')
} catch (err) {
  console.error('Invalid WIF:', err.message)
}

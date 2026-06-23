/**
 * Generates a new BSV platform funding wallet, or derives the address from
 * an existing PLATFORM_FUNDING_WIF if one is already set.
 *
 * Run from the web directory:
 *   cd web && node ..\scripts\get-funding-address.mjs
 */

import { PrivateKey } from '@bsv/sdk'

const existingWif = process.env.PLATFORM_FUNDING_WIF

let key
if (existingWif) {
  key = PrivateKey.fromWif(existingWif)
  console.log('\n✓ Using existing PLATFORM_FUNDING_WIF')
} else {
  key = PrivateKey.fromRandom()
  console.log('\n⚠ No PLATFORM_FUNDING_WIF found — generated a new wallet.')
  console.log('\n─────────────────────────────────────────')
  console.log('WIF (add this to Vercel env as PLATFORM_FUNDING_WIF):')
  console.log(key.toWif())
  console.log('─────────────────────────────────────────')
  console.log('Save the WIF somewhere safe — it cannot be recovered!')
}

const address = key.toAddress().toString()

console.log('\nBSV Address (send funds here):')
console.log(address)
console.log('\nNeeded: ~2000–5000 sats per inscription at 0.5 sat/byte.')
console.log('Check balance: https://whatsonchain.com/address/' + address)
console.log()

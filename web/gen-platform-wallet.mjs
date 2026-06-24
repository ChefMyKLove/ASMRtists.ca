import { HD, Mnemonic } from '@bsv/sdk'

const mnemonic = Mnemonic.fromRandom()
const seed = mnemonic.toSeed()
const master = HD.fromSeed(seed)

const payKey  = master.derive("m/44'/236'/0'/0/0").privKey
const ordKey  = master.derive("m/44'/236'/1'/0/0").privKey
const idKey   = master.derive("m/0'/236'/0'/0/0").privKey

console.log('\n=== PLATFORM WALLET — SAVE THIS SOMEWHERE SAFE ===\n')
console.log('Mnemonic (12 words):', mnemonic.toString())
console.log()
console.log('--- PAY (funding) ---')
console.log('Address:', payKey.toAddress().toString())
console.log('WIF:    ', payKey.toWif())
console.log()
console.log('--- ORDINALS ---')
console.log('Address:', ordKey.toAddress().toString())
console.log('WIF:    ', ordKey.toWif())
console.log()
console.log('--- IDENTITY ---')
console.log('Address:', idKey.toAddress().toString())
console.log('WIF:    ', idKey.toWif())
console.log()
console.log('=== NEXT STEPS ===')
console.log('1. Copy the Mnemonic to a password manager NOW')
console.log('2. Send BSV to the PAY Address above')
console.log('3. Set PLATFORM_FUNDING_WIF = PAY WIF in Vercel')
console.log()

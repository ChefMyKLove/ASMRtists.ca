/**
 * BSV HD Wallet utilities using @bsv/sdk
 *
 * SECURITY: Private keys and mnemonics are NEVER stored server-side.
 * All sensitive material must be handled client-side only.
 */

import { HD, Mnemonic, PrivateKey } from '@bsv/sdk'

export interface WalletResult {
  mnemonic: string
  /** BSV payment address — m/44'/236'/0'/0/0 — used for payouts */
  address: string
  /** Ordinals address — m/44'/236'/1'/0/0 — used for 1Sat ordinals ownership */
  ordAddress: string
  wif: string
}

/**
 * Generate a new BIP39 mnemonic HD wallet.
 * Returns the mnemonic, derived address, and WIF private key.
 *
 * Call this client-side only — never persist the mnemonic or WIF on the server.
 */
export function generateWallet(): WalletResult {
  const mnemonic = Mnemonic.fromRandom()
  const seed = mnemonic.toSeed()
  const masterKey = HD.fromSeed(seed)

  // Payment address — m/44'/236'/0'/0/0
  const paymentKey = masterKey.derive("m/44'/236'/0'/0/0").privKey
  const address = paymentKey.toAddress().toString()
  const wif = paymentKey.toWif()

  // Ordinals address — m/44'/236'/1'/0/0 (account index 1 = ordinals)
  const ordKey = masterKey.derive("m/44'/236'/1'/0/0").privKey
  const ordAddress = ordKey.toAddress().toString()

  return {
    mnemonic: mnemonic.toString(),
    address,
    ordAddress,
    wif,
  }
}

/**
 * Derive the BSV address from an existing BIP39 mnemonic.
 * Uses the same derivation path as generateWallet().
 */
export function addressFromMnemonic(mnemonicPhrase: string): string {
  const mnemonic = Mnemonic.fromString(mnemonicPhrase)
  const seed = mnemonic.toSeed()
  const masterKey = HD.fromSeed(seed)
  const derived = masterKey.derive("m/44'/236'/0'/0/0")
  return derived.privKey.toAddress().toString()
}

/**
 * Derive a PrivateKey from a mnemonic (client-side only).
 * Do not expose this result to any server endpoint.
 */
export function privateKeyFromMnemonic(mnemonicPhrase: string): PrivateKey {
  const mnemonic = Mnemonic.fromString(mnemonicPhrase)
  const seed = mnemonic.toSeed()
  const masterKey = HD.fromSeed(seed)
  const derived = masterKey.derive("m/44'/236'/0'/0/0")
  return derived.privKey
}

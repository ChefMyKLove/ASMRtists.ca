/**
 * BSV wallet ownership proof — server-side helpers
 *
 * Flow:
 *   1. Client calls POST /api/ordinals/challenge  → server issues a nonce
 *   2. Client signs the nonce with their wallet    → returns base64 signature
 *   3. Client calls POST /api/ordinals/claim       → server calls verifyChallenge()
 *
 * SECURITY: Nonces are single-use and expire in 5 minutes.
 * Ownership is also re-verified against GorillaPool on every claim.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const CHALLENGE_TTL_MS = 5 * 60 * 1000   // 5 minutes
const CHALLENGE_PREFIX = 'ASMR_AUTH'

// ─── Challenge issuance ───────────────────────────────────────────────────────

/**
 * Issue a signed-challenge nonce for an ordinal address.
 * Returns the nonce string the wallet must sign.
 */
export async function issueChallenge(ordAddress: string): Promise<string> {
  const nonce = `${CHALLENGE_PREFIX}:${ordAddress}:${Date.now()}:${crypto.randomUUID()}`
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()

  const admin = createAdminClient()
  const { error } = await admin.from('claim_challenges').insert({
    ord_address: ordAddress,
    nonce,
    expires_at: expiresAt,
  })

  if (error) throw new Error(`Failed to store challenge: ${error.message}`)
  return nonce
}

// ─── Challenge verification ───────────────────────────────────────────────────

interface VerifyResult {
  valid: boolean
  reason?: string
}

/**
 * Verify a wallet-signed challenge nonce.
 * Burns the nonce on success (sets used_at).
 *
 * NOTE: Full cryptographic BSV message signature verification requires
 * @bsv/sdk's BSM module. If the library isn't available server-side,
 * we fall back to GorillaPool ownership as the authority.
 * Set SKIP_SIG_VERIFY=true in env to skip sig check (dev/test only).
 */
export async function verifyChallenge(
  ordAddress: string,
  nonce: string,
  signature: string,
): Promise<VerifyResult> {
  const admin = createAdminClient()

  // Look up the nonce
  const { data: challenge } = await admin
    .from('claim_challenges')
    .select('id, expires_at, used_at, ord_address')
    .eq('nonce', nonce)
    .eq('ord_address', ordAddress)
    .maybeSingle()

  if (!challenge) return { valid: false, reason: 'challenge not found or address mismatch' }
  if (challenge.used_at) return { valid: false, reason: 'challenge already used' }
  if (new Date(challenge.expires_at) < new Date()) return { valid: false, reason: 'challenge expired' }

  // Cryptographic signature check
  if (process.env.SKIP_SIG_VERIFY !== 'true') {
    const sigOk = await verifySig(ordAddress, nonce, signature)
    if (!sigOk) return { valid: false, reason: 'signature invalid' }
  }

  // Burn the nonce
  await admin
    .from('claim_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challenge.id)

  return { valid: true }
}

// ─── GorillaPool ownership check ─────────────────────────────────────────────

/**
 * Verify that ordAddress currently holds the given inscription outpoint.
 *
 * Uses the 1sat.app TXO endpoint — the authoritative source for 1Sat ordinals.
 * outpoint must be in "txid_vout" (underscore) format.
 *
 * NOTE: ordAddress is the ORDINALS address (m/44'/236'/1'/0/0), NOT the payment address.
 */
/**
 * Verify that ordAddress currently holds the given inscription outpoint.
 *
 * Uses the same approach as /api/ordinals/check-ownership:
 *  1. Follow the spend chain on 1sat.app to find the current UTXO
 *  2. Fetch raw tx hex from WhatsonChain
 *  3. Decode with @bsv/sdk and compare the P2PKH locking script
 *
 * This is more reliable than checking an `owner` field because 1sat.app
 * does not always populate that field on the original inscription TXO.
 */
export async function verifyOwnership(outpoint: string, ordAddress: string): Promise<boolean> {
  try {
    const { Transaction, P2PKH } = await import('@bsv/sdk')

    // Compute expected P2PKH locking script hex for the address
    let expectedHex: string
    try {
      expectedHex = new P2PKH().lock(ordAddress).toHex()
    } catch {
      return false
    }

    // 1sat.app uses dot format; DB stores underscore format
    let currentOp = outpoint.replace(/_(\d+)$/, '.$1')

    for (let hop = 0; hop < 10; hop++) {
      const txoRes = await fetch(`https://api.1sat.app/1sat/txo/${currentOp}`, {
        next: { revalidate: 0 },
      })
      if (!txoRes.ok) return false

      const txo = await txoRes.json() as Record<string, unknown>
      const spend = txo.spend

      if (!spend) {
        // This is the current UTXO — verify locking script matches the address
        const [txid, voutStr] = currentOp.split('.')
        const vout = parseInt(voutStr ?? '0', 10)

        const wocHeaders: Record<string, string> = {}
        if (process.env.WOC_API_KEY) wocHeaders['Authorization'] = process.env.WOC_API_KEY

        const hexRes = await fetch(
          `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`,
          { headers: wocHeaders },
        )
        if (!hexRes.ok) return false

        const rawHex = (await hexRes.text()).trim()
        let tx: InstanceType<typeof Transaction>
        try {
          tx = Transaction.fromHex(rawHex)
        } catch {
          return false
        }

        const output = tx.outputs[vout]
        if (!output) return false

        const lockHex = output.lockingScript.toHex()
        // Plain P2PKH: exact match; inscription origin: P2PKH is the prefix
        return lockHex === expectedHex || lockHex.startsWith(expectedHex)
      }

      // Follow the spend chain — ordinals move to vout 0 by 1Sat protocol
      const spendTxid =
        typeof spend === 'string' ? spend
        : typeof spend === 'object' ? (spend as Record<string, unknown>).txid as string
        : null
      if (!spendTxid) return false
      currentOp = `${spendTxid}.0`
    }

    return false
  } catch {
    return false
  }
}

// ─── BSV message signature verification ──────────────────────────────────────

/**
 * Verify a Bitcoin Signed Message (BSV variant).
 * Uses @bsv/sdk if available; returns true in dev if SKIP_SIG_VERIFY=true.
 */
async function verifySig(address: string, message: string, signature: string): Promise<boolean> {
  try {
    const { BSM, BigNumber, Signature } = await import('@bsv/sdk')
    const msgBytes = Array.from(Buffer.from(message))
    const msgHash = BSM.magicHash(msgBytes)
    const hashBN = BigNumber.fromHex(Buffer.from(msgHash).toString('hex'))
    const sig = Signature.fromCompact(signature, 'base64')
    for (const i of [0, 1]) {
      try {
        const recovered = sig.RecoverPublicKey(i, hashBN)
        if (recovered.toAddress().toString() === address) return true
      } catch {
        // try next recovery index
      }
    }
    return false
  } catch {
    // BSV sig verification failed — GorillaPool ownership is the primary guard.
    return false
  }
}

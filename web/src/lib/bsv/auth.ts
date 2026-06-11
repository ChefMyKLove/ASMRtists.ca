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
export async function verifyOwnership(outpoint: string, ordAddress: string): Promise<boolean> {
  try {
    // 1sat.app uses dot format (txid.vout); DB stores underscore format (txid_vout)
    const dotOutpoint = outpoint.replace(/_(\d+)$/, '.$1')
    const url = `https://api.1sat.app/1sat/txo/${dotOutpoint}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return false
    const data = await res.json()
    // 1sat.app returns the current lock/owner address
    const owner: string =
      data?.owner ?? data?.address ?? data?.lock?.address ?? data?.data?.lock?.address ?? ''
    return owner.toLowerCase() === ordAddress.toLowerCase()
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

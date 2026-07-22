import 'server-only'
import { KVHelper } from '@/lib/kv-helper'

interface RateBucket {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter: number // seconds until the window resets
  remaining: number
}

// Best-effort sliding-ish window limiter backed by Cloudflare KV.
//
// NOTE: KV is eventually consistent, so this is an approximation intended to
// blunt brute-force/abuse, not a strict guarantee. For production-grade
// protection, combine with Cloudflare Rate Limiting Rules / WAF.
export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<RateLimitResult> {
  const kv = KVHelper.getInstance()
  const now = Date.now()

  let bucket: RateBucket | null = null
  const raw = await kv.get(`rl:${key}`)
  if (raw) {
    try {
      bucket = JSON.parse(raw) as RateBucket
    } catch {
      bucket = null
    }
  }

  // Reset the bucket if the previous window has elapsed.
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSec * 1000 }
  }

  bucket.count += 1

  const allowed = bucket.count <= max
  const retryAfter = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000))

  // Persist with a TTL matching the window so stale keys self-expire.
  await kv.put(`rl:${key}`, JSON.stringify(bucket), {
    expirationTtl: windowSec
  })

  return {
    allowed,
    retryAfter,
    remaining: Math.max(0, max - bucket.count)
  }
}

// Resolve the client IP from Cloudflare / proxy headers, falling back to a
// stable-ish key when no IP is available.
export function getClientIp(request: Request): string {
  const headers = request.headers
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

import 'server-only'

// PBKDF2 password hashing using the Web Crypto API (available in Cloudflare
// Workers and Node 20+). Stored format: pbkdf2$<iterations>$<saltB64>$<hashB64>

// Cloudflare Workers caps PBKDF2 iterations at 100000, so we stay at the max
// allowed value. (Web Crypto: SHA-256, 16-byte salt, 32-byte hash.)
const ITERATIONS = 100000
const SALT_LENGTH = 16 // bytes
const HASH_LENGTH = 32 // bytes
const ALGORITHM = 'SHA-256'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: ALGORITHM },
    keyMaterial,
    HASH_LENGTH * 8
  )

  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const hash = await deriveBits(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

// Constant-time comparison to avoid timing side-channels.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

  const iterations = parseInt(parts[1], 10)
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = base64ToBytes(parts[2])
    expected = base64ToBytes(parts[3])
  } catch {
    return false
  }

  const actual = await deriveBits(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}

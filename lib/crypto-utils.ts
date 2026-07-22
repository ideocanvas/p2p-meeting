// Cryptographically secure ID generation using the Web Crypto API.
// Works in both the browser and Cloudflare Workers / Node 20+.

const ROOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function getRandomInt(max: number): number {
  // Rejection sampling to avoid modulo bias.
  const maxUint32 = 0xffffffff
  const limit = maxUint32 - (maxUint32 % max)
  const array = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(array)
    value = array[0]
  } while (value > limit)
  return value % max
}

// Generates a secure random alphanumeric code (e.g. 6-char room IDs / codes).
export function generateSecureCode(length: number, alphabet: string = ROOM_ALPHABET): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt(getRandomInt(alphabet.length))
  }
  return result
}

// 6-character uppercase room ID, e.g. "K4P9X2".
export function generateRoomId(): string {
  return generateSecureCode(6)
}

// Longer opaque identifier for participants / tokens.
export function generateOpaqueId(length: number = 16): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return generateSecureCode(length, alphabet)
}

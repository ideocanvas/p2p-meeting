import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

interface VerifyHostRequest {
  password: string
}

// Verifies the host master password WITHOUT leaking it through the URL query
// string. The room page posts the password here on "Start as Host".
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<NextResponse> {
  const { roomId } = await params

  // Rate limit per IP + room to blunt brute-force attempts.
  const ip = getClientIp(request)
  const limit = await checkRateLimit(`verify:${ip}:${roomId}`, 10, 600)
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  let body: VerifyHostRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }

  if (!body.password) {
    return NextResponse.json(
      { success: false, error: 'Password is required' },
      { status: 400 }
    )
  }

  const isHost = await roomService.verifyMasterPassword(roomId, body.password)
  return NextResponse.json({ success: true, isHost })
}

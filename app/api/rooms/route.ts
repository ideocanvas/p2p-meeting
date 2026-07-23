import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit room creation per IP to blunt abuse.
  const ip = getClientIp(request)
  const limit = await checkRateLimit(`create:${ip}`, 10, 600)
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many rooms created. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  try {
    const body = await request.json()
    const { title, password } = body

    if (!title || !password) {
      return NextResponse.json({ success: false, error: 'Title and password required' }, { status: 400 })
    }

    const room = await roomService.createRoom(title, password)

    return NextResponse.json({
      success: true,
      roomId: room.id
    })
  } catch (error) {
    console.error('Failed to create room:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
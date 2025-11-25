import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const room = await roomService.getRoom(roomId)

  if (!room) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 })
  }

  // Check password if provided in query for Host verification
  const { searchParams } = new URL(request.url)
  const password = searchParams.get('password')
  const isHost = password === room.masterPassword

  return NextResponse.json({
    success: true,
    room: roomService.sanitize(room),
    isHost,
    hostPeerId: room.hostPeerId // Needed for participants to connect to host
  })
}

// Called by Host to update their PeerID
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const body = await request.json()
  const { password, hostPeerId } = body

  // Check authentication via password only
  const isValid = await roomService.verifyMasterPassword(roomId, password)
  if (!isValid) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  await roomService.updateHostPeerId(roomId, hostPeerId)
  return NextResponse.json({ success: true })
}
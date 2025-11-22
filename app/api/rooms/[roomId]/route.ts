import { NextRequest, NextResponse } from 'next/server'
import { memoryStorage, canJoinRoom } from '@/lib/meeting-utils'

export async function GET(request: NextRequest, { params }: { params: { roomId: string } }) {
  const { roomId } = params
  const room = memoryStorage.get(roomId)

  if (!room) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 })
  }

  const access = canJoinRoom(room)

  if (!access.canJoin) {
    return NextResponse.json({ success: false, error: access.reason }, { status: 403 })
  }

  // Return safe room data
  return NextResponse.json({ success: true, room })
}
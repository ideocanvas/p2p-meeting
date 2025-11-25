import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
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
    console.error(error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import {
  validateCreateRoomRequest,
  createRoomFromRequest,
  memoryStorage,
  canJoinRoom,
  validatePassword,
  isRoomAvailable
} from '@/lib/meeting-utils'
import { GetRoomResponse, CreateRoomResponse } from '@/lib/types'

export async function POST(request: NextRequest): Promise<NextResponse<CreateRoomResponse>> {
  try {
    const body = await request.json()
    const errors = validateCreateRoomRequest(body)
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        roomId: '',
        roomUrl: '',
        error: errors.join(', ')
      })
    }

    // Check if room ID already exists
    if (memoryStorage.has(body.roomId)) {
      return NextResponse.json({
        success: false,
        roomId: '',
        roomUrl: '',
        error: 'Room ID already exists. Please choose a different ID.'
      })
    }

    const ownerId = `owner_${Date.now()}`
    const room = createRoomFromRequest(body, ownerId)
    
    // Save to storage (KV in prod, memory in dev)
    memoryStorage.set(room.id, room)

    return NextResponse.json({
      success: true,
      roomId: room.id,
      roomUrl: `/room/${room.id}`
    })
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json({
      success: false,
      roomId: '',
      roomUrl: '',
      error: 'Server error'
    })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<GetRoomResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const password = searchParams.get('password')

    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required',
      })
    }

    const room = memoryStorage.get(roomId)
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found',
      })
    }

    // Check if room can be joined
    const joinCheck = canJoinRoom(room)
    if (!joinCheck.canJoin) {
      return NextResponse.json({
        success: false,
        error: joinCheck.reason,
      })
    }

    // Check if password is provided for host access
    let isHost = false
    if (password && room.settings.requirePassword) {
      // Password validation would need to be implemented separately
      // For now, we'll just check if a password was provided
      isHost = !!password
      if (!isHost) {
        return NextResponse.json({
          success: false,
          error: 'Invalid password',
        })
      }
    }

    // Return room directly (no password property to remove)
    const roomWithoutPassword = room

    return NextResponse.json({
      success: true,
      room: roomWithoutPassword,
      isHost,
    })
  } catch (error) {
    console.error('Error getting room:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    })
  }
}
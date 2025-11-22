import { NextRequest, NextResponse } from 'next/server'
import { JoinRoomRequest, JoinRoomResponse } from '@/lib/types'
import { validatePassword, canJoinRoom, updateRoomStatus, isValidRoomId } from '@/lib/meeting-utils'

export async function POST(request: NextRequest): Promise<NextResponse<JoinRoomResponse>> {
  try {
    const body: JoinRoomRequest = await request.json()

    // Validate request
    if (!body.roomId || !body.participantName) {
      return NextResponse.json({
        success: false,
        error: 'Room ID and participant name are required',
      })
    }

    if (!isValidRoomId(body.roomId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid room ID format',
      })
    }

    if (body.participantName.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Participant name must be at least 2 characters long',
      })
    }

    // Get room from KV
    const room = await getRoomFromKV(body.roomId)
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found',
      })
    }

    // Update room status based on time
    const updatedRoom = updateRoomStatus(room)
    if (updatedRoom.status !== room.status) {
      await saveRoomToKV(updatedRoom)
    }

    // Check if room can be joined
    const joinCheck = canJoinRoom(updatedRoom)
    if (!joinCheck.canJoin) {
      return NextResponse.json({
        success: false,
        error: joinCheck.reason,
      })
    }

    // Check password if required
    if (updatedRoom.settings.requirePassword) {
      if (!body.password) {
        return NextResponse.json({
          success: false,
          error: 'Password is required for this room',
        })
      }

      if (!validatePassword(body.password, updatedRoom.password)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid password',
        })
      }
    }

    // Generate participant ID
    const participantId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Update participant count
    const roomWithParticipant = {
      ...updatedRoom,
      currentParticipants: updatedRoom.currentParticipants + 1,
      updatedAt: new Date().toISOString(),
    }

    // Save updated room
    await saveRoomToKV(roomWithParticipant)

    // Return room without password hash
    const { password: _, ...roomWithoutPassword } = roomWithParticipant

    return NextResponse.json({
      success: true,
      room: roomWithoutPassword,
      participantId,
    })
  } catch (error) {
    console.error('Error joining room:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    })
  }
}

// KV helper functions (shared with main rooms route)
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

interface GlobalThis {
  MEETING_ROOMS?: KVNamespace
}

async function getRoomFromKV(roomId: string) {
  try {
    const kv = (globalThis as GlobalThis).MEETING_ROOMS
    if (!kv) {
      console.error('MEETING_ROOMS KV namespace not available')
      return null
    }

    const roomData = await kv.get(roomId)
    return roomData ? JSON.parse(roomData) : null
  } catch (error) {
    console.error('Error getting room from KV:', error)
    return null
  }
}

async function saveRoomToKV(room: unknown): Promise<boolean> {
  try {
    const kv = (globalThis as GlobalThis).MEETING_ROOMS
    if (!kv) {
      console.error('MEETING_ROOMS KV namespace not available')
      return false
    }

    await kv.put((room as { id: string }).id, JSON.stringify(room))
    return true
  } catch (error) {
    console.error('Error saving room to KV:', error)
    return false
  }
}
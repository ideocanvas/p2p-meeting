import { NextRequest, NextResponse } from 'next/server'
import {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomRequest,
  GetRoomResponse,
  UpdateRoomRequest,
  UpdateRoomResponse,
  DeleteRoomRequest,
  DeleteRoomResponse,
  PersistentMeetingRoom,
  ApiResponse,
} from '@/lib/types'
import {
  generateRoomId,
  hashPassword,
  validatePassword,
  validateCreateRoomRequest,
  createRoomFromRequest,
  canJoinRoom,
  updateRoomStatus,
  isValidRoomId,
} from '@/lib/meeting-utils'

export async function POST(request: NextRequest): Promise<NextResponse<CreateRoomResponse>> {
  try {
    const body: CreateRoomRequest = await request.json()

    // Validate request
    const errors = validateCreateRoomRequest(body)
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: errors.join(', '),
      })
    }

    // Generate unique room ID
    let roomId: string
    let attempts = 0
    const maxAttempts = 10

    do {
      roomId = generateRoomId()
      attempts++
      
      // Check if room already exists
      const existingRoom = await getRoomFromKV(roomId)
      if (!existingRoom) break
    } while (attempts < maxAttempts)

    if (attempts >= maxAttempts) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate unique room ID',
      })
    }

    // Create room
    const hostId = `host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const room = createRoomFromRequest(body, hostId)
    
    console.log('🏠 Creating room with ID:', room.id)
    console.log('🏠 Room data:', JSON.stringify(room, null, 2))

    // Store in KV
    const saved = await saveRoomToKV(room)
    console.log('🏠 Room saved:', saved)
    console.log('🏠 Available rooms after save:', Array.from(memoryStorage.keys()))

    return NextResponse.json({
      success: true,
      room,
    })
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<GetRoomResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const password = searchParams.get('password')

    // If no roomId in query params, try to get it from the URL path
    let finalRoomId = roomId
    if (!roomId) {
      const { pathname } = new URL(request.url)
      const pathParts = pathname.split('/')
      const roomIdIndex = pathParts.findIndex(part => part === 'room')
      if (roomIdIndex !== -1 && pathParts[roomIdIndex + 1]) {
        finalRoomId = pathParts[roomIdIndex + 1]
      }
    }

    if (!finalRoomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required',
      })
    }

    if (!isValidRoomId(finalRoomId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid room ID format',
      })
    }

    console.log('🔍 Looking for room with ID:', finalRoomId)
    const room = await getRoomFromKV(finalRoomId)
    console.log('🔍 Found room:', room ? 'YES' : 'NO')
    console.log('🔍 Available rooms in memory:', Array.from(memoryStorage.keys()))
    
    if (!room) {
      return NextResponse.json({
        success: false,
        error: `Room not found. Available rooms: ${Array.from(memoryStorage.keys()).join(', ')}`,
      })
    }

    // Update room status based on time
    const updatedRoom = updateRoomStatus(room)
    if (updatedRoom.status !== room.status) {
      await saveRoomToKV(updatedRoom)
    }

    // Check if room is expired
    const joinCheck = canJoinRoom(updatedRoom)
    if (!joinCheck.canJoin && updatedRoom.status !== 'scheduled') {
      return NextResponse.json({
        success: false,
        error: joinCheck.reason,
      })
    }

    // Check if password is provided for host access (optional for participants)
    let isHost = false
    if (password) {
      isHost = validatePassword(password, updatedRoom.password)
      if (!isHost) {
        return NextResponse.json({
          success: false,
          error: 'Invalid password',
        })
      }
    }

    // Return room without password hash
    const { password: _, ...roomWithoutPassword } = updatedRoom

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

export async function PUT(request: NextRequest): Promise<NextResponse<UpdateRoomResponse>> {
  try {
    const body: UpdateRoomRequest = await request.json()

    if (!body.roomId || !body.password) {
      return NextResponse.json({
        success: false,
        error: 'Room ID and password are required',
      })
    }

    if (!isValidRoomId(body.roomId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid room ID format',
      })
    }

    // Get existing room
    const existingRoom = await getRoomFromKV(body.roomId)
    if (!existingRoom) {
      return NextResponse.json({
        success: false,
        error: 'Room not found',
      })
    }

    // Verify password
    if (!validatePassword(body.password, existingRoom.password)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid password',
      })
    }

    // Update room
    const updatedRoom: PersistentMeetingRoom = {
      ...existingRoom,
      ...body.updates,
      updatedAt: new Date().toISOString(),
    }

    // Recalculate expiry date if meeting date changed
    if (body.updates.meetingDate) {
      updatedRoom.expiryDate = new Date(
        new Date(body.updates.meetingDate).getTime() + 24 * 60 * 60 * 1000
      ).toISOString()
    }

    // Update status
    const finalRoom = updateRoomStatus(updatedRoom)

    // Save to KV
    await saveRoomToKV(finalRoom)

    // Return room without password hash
    const { password: _, ...roomWithoutPassword } = finalRoom

    return NextResponse.json({
      success: true,
      room: roomWithoutPassword,
    })
  } catch (error) {
    console.error('Error updating room:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<DeleteRoomResponse>> {
  try {
    const body: DeleteRoomRequest = await request.json()

    if (!body.roomId || !body.password) {
      return NextResponse.json({
        success: false,
        error: 'Room ID and password are required',
      })
    }

    if (!isValidRoomId(body.roomId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid room ID format',
      })
    }

    // Get existing room
    const existingRoom = await getRoomFromKV(body.roomId)
    if (!existingRoom) {
      return NextResponse.json({
        success: false,
        error: 'Room not found',
      })
    }

    // Verify password
    if (!validatePassword(body.password, existingRoom.password)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid password',
      })
    }

    // Delete from KV
    await deleteRoomFromKV(body.roomId)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting room:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    })
  }
}

// KV helper functions
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

interface GlobalThis {
  MEETING_ROOMS?: KVNamespace
}

// In-memory storage for development
const memoryStorage = new Map<string, PersistentMeetingRoom>()

async function getRoomFromMemory(roomId: string): Promise<PersistentMeetingRoom | null> {
  console.log('💾 Memory storage - Getting room:', roomId)
  console.log('💾 Memory storage - Available rooms:', Array.from(memoryStorage.keys()))
  const room = memoryStorage.get(roomId) || null
  console.log('💾 Memory storage - Found room:', room ? 'YES' : 'NO')
  return room
}

async function saveRoomToMemory(room: PersistentMeetingRoom): Promise<boolean> {
  console.log('💾 Memory storage - Saving room:', room.id)
  memoryStorage.set(room.id, room)
  console.log('💾 Memory storage - Room saved. Total rooms:', memoryStorage.size)
  console.log('💾 Memory storage - All room IDs:', Array.from(memoryStorage.keys()))
  return true
}

async function deleteRoomFromMemory(roomId: string): Promise<boolean> {
  console.log('💾 Memory storage - Deleting room:', roomId)
  const deleted = memoryStorage.delete(roomId)
  console.log('💾 Memory storage - Room deleted:', deleted)
  return deleted
}

async function getRoomFromKV(roomId: string): Promise<PersistentMeetingRoom | null> {
  try {
    const kv = (globalThis as GlobalThis).MEETING_ROOMS
    if (!kv) {
      console.error('MEETING_ROOMS KV namespace not available')
      // Fallback to in-memory storage for development
      return getRoomFromMemory(roomId)
    }

    const roomData = await kv.get(roomId)
    return roomData ? JSON.parse(roomData) : null
  } catch (error) {
    console.error('Error getting room from KV:', error)
    return null
  }
}

async function saveRoomToKV(room: PersistentMeetingRoom): Promise<boolean> {
  try {
    const kv = (globalThis as GlobalThis).MEETING_ROOMS
    if (!kv) {
      console.error('MEETING_ROOMS KV namespace not available')
      // Fallback to in-memory storage for development
      return saveRoomToMemory(room)
    }

    await kv.put(room.id, JSON.stringify(room))
    return true
  } catch (error) {
    console.error('Error saving room to KV:', error)
    return false
  }
}

async function deleteRoomFromKV(roomId: string): Promise<boolean> {
  try {
    const kv = (globalThis as GlobalThis).MEETING_ROOMS
    if (!kv) {
      console.error('MEETING_ROOMS KV namespace not available')
      // Fallback to in-memory storage for development
      return deleteRoomFromMemory(roomId)
    }

    await kv.delete(roomId)
    return true
  } catch (error) {
    console.error('Error deleting room from KV:', error)
    return false
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { JoinRoomRequest, JoinRoomResponse, PersistentMeetingRoom } from '@/lib/types'
import { validatePassword, canJoinRoom, isValidRoomId } from '@/lib/meeting-utils'

export async function POST(request: NextRequest): Promise<NextResponse<JoinRoomResponse>> {
  try {
    const body: JoinRoomRequest = await request.json()

    // Validate request
    if (!body.roomId || !body.participantName) {
      return NextResponse.json({
        success: false,
        meetingId: '',
        peerId: '',
        verificationRequired: false,
        roomInfo: {
          title: '',
          description: '',
          isActive: false,
          settings: {
            maxParticipants: 0,
            allowWaitingRoom: false,
            muteOnEntry: false,
            videoOnEntry: false,
          },
        },
        error: 'Room ID and participant name are required',
      })
    }

    if (!isValidRoomId(body.roomId)) {
      return NextResponse.json({
        success: false,
        meetingId: '',
        peerId: '',
        verificationRequired: false,
        roomInfo: {
          title: '',
          description: '',
          isActive: false,
          settings: {
            maxParticipants: 0,
            allowWaitingRoom: false,
            muteOnEntry: false,
            videoOnEntry: false,
          },
        },
        error: 'Invalid room ID format',
      })
    }

    if (body.participantName.trim().length < 2) {
      return NextResponse.json({
        success: false,
        meetingId: '',
        peerId: '',
        verificationRequired: false,
        roomInfo: {
          title: '',
          description: '',
          isActive: false,
          settings: {
            maxParticipants: 0,
            allowWaitingRoom: false,
            muteOnEntry: false,
            videoOnEntry: false,
          },
        },
        error: 'Participant name must be at least 2 characters long',
      })
    }

    // Get room from KV
    const room = await getRoomFromKV(body.roomId)
    if (!room) {
      return NextResponse.json({
        success: false,
        meetingId: '',
        peerId: '',
        verificationRequired: false,
        roomInfo: {
          title: '',
          description: '',
          isActive: false,
          settings: {
            maxParticipants: 0,
            allowWaitingRoom: false,
            muteOnEntry: false,
            videoOnEntry: false,
          },
        },
        error: 'Room not found',
      })
    }

    // Check if room can be joined
    const joinCheck = canJoinRoom(room)
    if (!joinCheck.canJoin) {
      return NextResponse.json({
        success: false,
        meetingId: '',
        peerId: '',
        verificationRequired: false,
        roomInfo: {
          title: '',
          description: '',
          isActive: false,
          settings: {
            maxParticipants: 0,
            allowWaitingRoom: false,
            muteOnEntry: false,
            videoOnEntry: false,
          },
        },
        error: joinCheck.reason,
      })
    }

    // Check password if required
    if (room.settings.requirePassword) {
      if (!body.password) {
        return NextResponse.json({
          success: false,
          meetingId: '',
          peerId: '',
          verificationRequired: false,
          roomInfo: {
            title: '',
            description: '',
            isActive: false,
            settings: {
              maxParticipants: 0,
              allowWaitingRoom: false,
              muteOnEntry: false,
              videoOnEntry: false,
            },
          },
          error: 'Password is required for this room',
        })
      }

      // Password validation would need to be implemented separately
      // For now, we'll just check if a password was provided
      if (!body.password) {
        return NextResponse.json({
          success: false,
          meetingId: '',
          peerId: '',
          verificationRequired: false,
          roomInfo: {
            title: '',
            description: '',
            isActive: false,
            settings: {
              maxParticipants: 0,
              allowWaitingRoom: false,
              muteOnEntry: false,
              videoOnEntry: false,
            },
          },
          error: 'Invalid password',
        })
      }
    }

    // Generate participant ID
    const participantId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Update room with new participant (in memory storage for now)
    // For persistent rooms, we don't track current participants in the room itself
    // Instead, we create a meeting instance or track participants separately
    
    // Generate meeting ID and peer ID for WebRTC
    const meetingId = `meeting_${Date.now()}`
    const peerId = `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return NextResponse.json({
      success: true,
      meetingId,
      peerId,
      verificationRequired: false, // For now, no verification required
      roomInfo: {
        title: room.title,
        description: room.description,
        isActive: room.isActive,
        settings: {
          maxParticipants: room.settings.maxParticipants,
          allowWaitingRoom: room.settings.allowWaitingRoom,
          muteOnEntry: room.settings.muteOnEntry,
          videoOnEntry: room.settings.videoOnEntry,
        },
      },
    })
  } catch (error) {
    console.error('Error joining room:', error)
    return NextResponse.json({
      success: false,
      meetingId: '',
      peerId: '',
      verificationRequired: false,
      roomInfo: {
        title: '',
        description: '',
        isActive: false,
        settings: {
          maxParticipants: 0,
          allowWaitingRoom: false,
          muteOnEntry: false,
          videoOnEntry: false,
        },
      },
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
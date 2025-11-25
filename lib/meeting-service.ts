import {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomRequest,
  GetRoomResponse,
  SimplifiedRoom,
} from './types'

const API_BASE_URL = ''

class MeetingService {
  private async request<T>(
    endpoint: string,
    options: Record<string, unknown> = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}/api${endpoint}`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error((errorData as { error?: string }).error || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Create a new persistent meeting room
  async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    return this.request<CreateRoomResponse>('/rooms', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  // Get meeting room details
  async getRoom(request: GetRoomRequest): Promise<GetRoomResponse> {
    const params = new URLSearchParams({
      roomId: request.roomId,
      ...(request.password && { password: request.password }),
    })

    return this.request<GetRoomResponse>(`/rooms?${params.toString()}`)
  }

  // Join a meeting room as participant (simplified)
  async joinRoom(roomId: string, participantName: string, peerId: string): Promise<{ success: boolean; participantId?: string; error?: string }> {
    return this.request<{ success: boolean; participantId?: string; error?: string }>(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ participantName, peerId }),
    })
  }

  // Approve a participant in the waiting room
  async approveParticipant(roomId: string, participantId: string, password: string): Promise<{ success: boolean; error?: string }> {
    return this.request<{ success: boolean; error?: string }>(`/rooms/${roomId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ participantId, password }),
    })
  }

  // Host reconnection
  async hostReconnect(roomId: string, password: string, hostPeerId: string): Promise<{ success: boolean; room?: SimplifiedRoom; error?: string }> {
    return this.request<{ success: boolean; room?: SimplifiedRoom; error?: string }>(`/rooms/${roomId}/reconnect`, {
      method: 'POST',
      body: JSON.stringify({ password, hostPeerId }),
    })
  }

  // End meeting
  async endMeeting(roomId: string, password: string): Promise<{ success: boolean; error?: string }> {
    return this.request<{ success: boolean; error?: string }>(`/rooms/${roomId}/end`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  }

  // Generate join link for a room
  generateJoinLink(roomId: string): string {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'

    // Get current locale from window location or default to 'en'
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    const localeMatch = currentPath.match(/^\/([a-z]{2})\//)
    const locale = localeMatch ? localeMatch[1] : 'en'

    return `${baseUrl}/${locale}/room/${roomId}`
  }

  // Validate room ID format (simplified)
  isValidRoomId(roomId: string): boolean {
    return /^[a-z0-9]{6}$/.test(roomId)
  }

  // Check if room is active (simplified)
  isRoomActive(room: SimplifiedRoom): boolean {
    return room.status === 'active' || room.status === 'waiting'
  }

  // Get room status for display (simplified)
  getRoomStatus(room: SimplifiedRoom): string {
    switch (room.status) {
      case 'waiting': return 'Waiting for host';
      case 'active': return 'Active';
      case 'ended': return 'Ended';
      default: return 'Unknown';
    }
  }

  // Get room status color (simplified)
  getRoomStatusColor(room: SimplifiedRoom): string {
    switch (room.status) {
      case 'waiting': return 'text-yellow-600';
      case 'active': return 'text-green-600';
      case 'ended': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  }

  // Check if room has expired
  isRoomExpired(room: SimplifiedRoom): boolean {
    return new Date(room.expiresAt) < new Date();
  }
}

export const meetingService = new MeetingService()
export default meetingService
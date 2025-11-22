import {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomRequest,
  GetRoomResponse,
  UpdateRoomRequest,
  UpdateRoomResponse,
  DeleteRoomRequest,
  DeleteRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  PersistentMeetingRoom,
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

  // Update meeting room
  async updateRoom(request: UpdateRoomRequest): Promise<UpdateRoomResponse> {
    return this.request<UpdateRoomResponse>('/rooms', {
      method: 'PUT',
      body: JSON.stringify(request),
    })
  }

  // Delete meeting room
  async deleteRoom(request: DeleteRoomRequest): Promise<DeleteRoomResponse> {
    return this.request<DeleteRoomResponse>('/rooms', {
      method: 'DELETE',
      body: JSON.stringify(request),
    })
  }

  // Join a meeting room as participant
  async joinRoom(roomId: string, request: JoinRoomRequest): Promise<JoinRoomResponse> {
    return this.request<JoinRoomResponse>(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify(request),
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

  // Validate room ID format
  isValidRoomId(roomId: string): boolean {
    return /^[A-Z0-9]{6,12}$/.test(roomId)
  }

  // Format meeting date for display
  formatMeetingDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      return date.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    } catch (error) {
      return 'Invalid date'
    }
  }

  // Check if room is active (persistent rooms are always active unless disabled)
  isRoomActive(room: PersistentMeetingRoom): boolean {
    return room.isActive
  }

  // Get room status for display
  getRoomStatus(room: PersistentMeetingRoom): string {
    return room.isActive ? 'Active' : 'Inactive'
  }

  // Get room status color
  getRoomStatusColor(room: PersistentMeetingRoom): string {
    return room.isActive ? 'text-green-600' : 'text-gray-600'
  }

  // Calculate time until meeting
  getTimeUntilMeeting(meetingDate: string): string {
    try {
      const now = new Date()
      const meetingTime = new Date(meetingDate)
      const diff = meetingTime.getTime() - now.getTime()

      if (diff <= 0) return 'Meeting has started'

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`
      return `${minutes} minute${minutes > 1 ? 's' : ''}`
    } catch (error) {
      return 'Invalid date'
    }
  }

  // Calculate meeting duration
  getMeetingDuration(startDate: string, endDate?: string): string {
    try {
      const start = new Date(startDate)
      const end = endDate ? new Date(endDate) : new Date()
      const diff = end.getTime() - start.getTime()

      if (diff <= 0) return 'Not started'

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (hours > 0) return `${hours}h ${minutes}m`
      return `${minutes}m`
    } catch (error) {
      return 'Invalid date'
    }
  }
}

export const meetingService = new MeetingService()
export default meetingService
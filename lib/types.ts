
export type ConnectionState = 'waiting' | 'connecting' | 'verifying' | 'connected' | 'active' | 'disconnected'

// Simple Room stored in KV
export interface RoomData {
  id: string
  title: string
  masterPassword: string // Plain text master password (for simplicity)
  hostPeerId: string | null
  createdAt: number
  participants: {
    id: string
    name: string
    peerId: string
    status: 'waiting' | 'active'
    joinedAt: number
  }[]
  settings: {
    maxParticipants: number
  }
}

// Response when fetching room info (hides password)
export interface PublicRoomInfo {
  id: string
  title: string
  createdAt: number
  participantCount: number
  hostConnected: boolean
}

// Local storage structure for room management
export interface LocalRoomData {
  roomId: string
  title: string
  createdAt: number
  lastAccessed: number
}

export interface Participant {
  id: string
  name: string
  role: 'host' | 'participant'
  status: 'connecting' | 'waiting' | 'connected' | 'disconnected'
  hasVideo: boolean
  hasAudio: boolean
  stream?: MediaStream
}

export interface LogEntry {
  timestamp: Date
  level: "info" | "success" | "warning" | "error"
  message: string
  details?: string
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

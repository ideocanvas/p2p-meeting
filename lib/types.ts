
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
  isScreenSharing?: boolean // Added for screen share status
  stream?: MediaStream
}

// Added Chat Message Type
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean; // For "User joined/left" messages
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

// Temporary types for meeting-utils (will be removed after cleanup)
export interface PersistentMeetingRoom {
  id: string
  title: string
  description: string
  ownerId: string
  createdAt: string
  updatedAt: string
  isActive: boolean
  settings: {
    maxParticipants: number
    requirePassword: boolean
    allowWaitingRoom: boolean
    muteOnEntry: boolean
    videoOnEntry: boolean
    enableChat: boolean
    enableScreenShare: boolean
    autoRecord: boolean
  }
}

// API Response types
export interface CreateRoomResponse {
  success: boolean
  roomId?: string
  error?: string
}

export interface GetRoomRequest {
  roomId: string
  password?: string
}

export interface GetRoomResponse {
  success: boolean
  room?: SimplifiedRoom
  error?: string
}

export interface SimplifiedRoom {
  id: string
  title: string
  status: 'waiting' | 'active' | 'ended'
  expiresAt: string
  participantCount: number
  hostConnected: boolean
}

export interface CreateRoomRequest {
  roomId: string
  title: string
  description: string
  password: string
  settings: {
    maxParticipants?: number
    requirePassword?: boolean
    allowWaitingRoom?: boolean
    muteOnEntry?: boolean
    videoOnEntry?: boolean
    enableChat?: boolean
    enableScreenShare?: boolean
    autoRecord?: boolean
  }
}

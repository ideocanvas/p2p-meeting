
export type ConnectionState = 'waiting' | 'connecting' | 'verifying' | 'connected' | 'active' | 'disconnected'

// Simple Room stored in KV
export interface RoomData {
  id: string
  title: string
  passwordHash: string // PBKDF2 hash of the host master password
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
  isScreenSharing?: boolean
  stream?: MediaStream
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface SimplifiedRoom {
  id: string
  title: string
  status: 'waiting' | 'active' | 'ended'
  expiresAt: string
  participantCount: number
  hostConnected: boolean
}

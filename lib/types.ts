
// Use native MediaStream and MediaStreamTrack types
export type IMediaStream = MediaStream
export type IMediaStreamTrack = MediaStreamTrack

export interface Participant {
  id: string
  name: string
  role: 'host' | 'participant'
  status: 'connecting' | 'connected' | 'disconnected'
  hasVideo: boolean
  hasAudio: boolean
  stream?: IMediaStream
  peerConnection?: RTCPeerConnection
  joinedAt: number
  lastActivity?: number
}

export interface WebRTCMessage {
  type: 'verification-request' | 'verification-response' | 'verification-success' | 'verification-failed' |
        'join-request' | 'join-accepted' | 'join-rejected' | 'participant-joined' | 'participant-left' |
        'video-offer' | 'video-answer' | 'ice-candidate' | 'audio-toggle' | 'video-toggle' |
        'connection-status' | 'ping' | 'pong' | 'meeting-ended'
  data?: unknown
  verificationCode?: string
  participantId?: string
  participantName?: string
  role?: 'host' | 'participant'
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  hasVideo?: boolean
  hasAudio?: boolean
  error?: string
  timestamp?: number
}

export interface MeetingRoom {
  id: string
  hostId: string
  title?: string
  status: 'waiting' | 'active' | 'ended'
  participants: Participant[]
  createdAt: number
  lastActivity?: number
  maxParticipants?: number
  requiresVerification: boolean
}

export interface QRCodeData {
  roomId: string
  url: string
  timestamp: number
}

export interface MeetingConfig {
  maxParticipants?: number
  requiresVerification: boolean
  idleTimeout: number // in milliseconds
  videoQuality: 'low' | 'medium' | 'high'
  audioEnabled: boolean
  videoEnabled: boolean
}

export interface MeetingStats {
  totalParticipants: number
  activeParticipants: number
  meetingDuration: number // in seconds
  startTime: number
  endTime?: number
}

export interface ConnectionInfo {
  localCandidate?: RTCIceCandidate
  remoteCandidate?: RTCIceCandidate
  connectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState
  signalingState: RTCSignalingState
}

export type ConnectionState = 'waiting' | 'connecting' | 'verifying' | 'connected' | 'active' | 'disconnected'

export type UserRole = 'host' | 'participant'

export interface WebRTCHookReturn {
  connectionState: ConnectionState
  participants: Participant[]
  meetingStats?: MeetingStats
  connectionInfo?: ConnectionInfo
  localStream?: IMediaStream
  initializeMeeting: (role: UserRole) => void
  joinMeeting: (roomId: string) => void
  leaveMeeting: () => void
  toggleAudio: () => void
  toggleVideo: () => void
  sendMessage: (message: WebRTCMessage) => void
  isConnected: boolean
  isHost: boolean
  error?: string
}

// New meeting room system types for persistent storage
export interface PersistentMeetingRoom {
  id: string
  title: string
  hostId: string
  hostName: string
  password: string // hashed
  meetingDate: string // ISO string
  expiryDate: string // ISO string
  createdAt: string
  updatedAt: string
  status: 'scheduled' | 'active' | 'ended' | 'expired'
  maxParticipants: number
  currentParticipants: number
  description?: string
  settings: MeetingRoomSettings
}

export interface MeetingRoomSettings {
  requirePassword: boolean
  allowWaitingRoom: boolean
  muteOnEntry: boolean
  videoOnEntry: boolean
  enableChat: boolean
  enableScreenShare: boolean
  recordMeeting: boolean
}

export interface CreateRoomRequest {
  title: string
  hostName: string
  password: string
  meetingDate: string
  maxParticipants?: number
  description?: string
  settings?: Partial<MeetingRoomSettings>
}

export interface CreateRoomResponse {
  success: boolean
  room?: PersistentMeetingRoom
  error?: string
}

export interface GetRoomRequest {
  roomId: string
  password?: string
}

export interface GetRoomResponse {
  success: boolean
  room?: Omit<PersistentMeetingRoom, 'password'>
  isHost?: boolean
  error?: string
}

export interface UpdateRoomRequest {
  roomId: string
  password: string
  updates: Partial<Pick<PersistentMeetingRoom, 'title' | 'meetingDate' | 'maxParticipants' | 'description' | 'settings'>>
}

export interface UpdateRoomResponse {
  success: boolean
  room?: Omit<PersistentMeetingRoom, 'password'>
  error?: string
}

export interface DeleteRoomRequest {
  roomId: string
  password: string
}

export interface DeleteRoomResponse {
  success: boolean
  error?: string
}

export interface JoinRoomRequest {
  roomId: string
  participantName: string
  password?: string
}

export interface JoinRoomResponse {
  success: boolean
  room?: Omit<PersistentMeetingRoom, 'password'>
  participantId?: string
  error?: string
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

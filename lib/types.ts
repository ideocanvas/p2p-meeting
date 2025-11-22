
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

export interface TemporaryMeetingRoom {
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

// New persistent meeting room system with fixed, reusable links
export interface PersistentMeetingRoom {
  id: string;                    // Fixed, human-readable ID (e.g., "team-weekly", "project-review")
  title: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  settings: {
    maxParticipants: number;
    requirePassword: boolean;
    allowWaitingRoom: boolean;
    muteOnEntry: boolean;
    videoOnEntry: boolean;
    enableChat: boolean;
    enableScreenShare: boolean;
    autoRecord: boolean;
    defaultMeetingDuration: number; // in minutes
  };
  recurringSchedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    days: number[];              // For weekly: [1,3,5] for Mon,Wed,Fri
    time: string;                // "14:30" format
    timezone: string;
  };
}

export interface MeetingInstance {
  id: string;
  roomId: string;                // References the persistent room
  scheduledTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  currentParticipants: number;
  maxParticipants: number;
  recordingUrl?: string;
  meetingTitle?: string;         // Optional override for this specific meeting
}

export interface CreateRoomRequest {
  title: string;
  description: string;
  roomId: string;                // Fixed, human-readable ID provided by user
  password: string;
  settings: {
    maxParticipants: number;
    requirePassword: boolean;
    allowWaitingRoom: boolean;
    muteOnEntry: boolean;
    videoOnEntry: boolean;
    enableChat: boolean;
    enableScreenShare: boolean;
    autoRecord: boolean;
    defaultMeetingDuration: number;
  };
  recurringSchedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    days: number[];
    time: string;
    timezone: string;
  };
}

export interface CreateRoomResponse {
  success: boolean;
  roomId: string;
  roomUrl: string;
  error?: string;
}

export interface GetRoomRequest {
  roomId: string;
  password?: string;
}

export interface GetRoomResponse {
  success: boolean;
  room?: Omit<PersistentMeetingRoom, 'password'>;
  isHost?: boolean;
  error?: string;
}

export interface UpdateRoomRequest {
  password: string;
  title?: string;
  description?: string;
  meetingDate?: string;
  meetingTime?: string;
  maxParticipants?: number;
  timezone?: string;
}

export interface UpdateRoomResponse {
  success: boolean;
  room?: Omit<PersistentMeetingRoom, 'password'>;
  error?: string;
}

export interface DeleteRoomRequest {
  roomId: string;
  password: string;
}

export interface DeleteRoomResponse {
  success: boolean;
  error?: string;
}

export interface JoinRoomRequest {
  roomId: string;
  participantName: string;
  password?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  meetingId: string;
  peerId: string;
  verificationRequired: boolean;
  roomInfo: {
    title: string;
    description: string;
    isActive: boolean;
    settings: {
      maxParticipants: number;
      allowWaitingRoom: boolean;
      muteOnEntry: boolean;
      videoOnEntry: boolean;
    };
  };
  error?: string;
}

export interface ScheduleMeetingRequest {
  roomId: string;
  scheduledTime: string;
  meetingTitle?: string;
  maxParticipants?: number;
}

export interface ScheduleMeetingResponse {
  success: boolean;
  meetingId: string;
  scheduledTime: string;
  error?: string;
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

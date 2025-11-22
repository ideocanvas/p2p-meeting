import { PersistentMeetingRoom, CreateRoomRequest, MeetingRoomSettings } from './types'

// Utility functions for meeting room management
export function generateRoomId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function hashPassword(password: string): string {
  // Simple hash function for demo purposes
  // In production, use a proper hashing library like bcrypt
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString()
}

export function validatePassword(password: string, hashedPassword: string): boolean {
  return hashPassword(password) === hashedPassword
}

export function isValidMeetingDate(dateString: string): boolean {
  const date = new Date(dateString)
  const now = new Date()
  return date > now
}

export function isRoomExpired(room: PersistentMeetingRoom): boolean {
  return new Date(room.expiryDate) < new Date()
}

export function createDefaultSettings(): MeetingRoomSettings {
  return {
    requirePassword: true,
    allowWaitingRoom: false,
    muteOnEntry: false,
    videoOnEntry: true,
    enableChat: true,
    enableScreenShare: true,
    recordMeeting: false,
  }
}

export function validateCreateRoomRequest(request: CreateRoomRequest): string[] {
  const errors: string[] = []

  if (!request.title || request.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long')
  }

  if (!request.hostName || request.hostName.trim().length < 2) {
    errors.push('Host name must be at least 2 characters long')
  }

  if (!request.password || request.password.length < 4) {
    errors.push('Password must be at least 4 characters long')
  }

  if (!request.meetingDate) {
    errors.push('Meeting date is required')
  } else if (!isValidMeetingDate(request.meetingDate)) {
    errors.push('Meeting date must be in the future')
  }

  if (request.maxParticipants && (request.maxParticipants < 2 || request.maxParticipants > 50)) {
    errors.push('Max participants must be between 2 and 50')
  }

  return errors
}

export function sanitizeRoomTitle(title: string): string {
  return title.trim().substring(0, 100)
}

export function sanitizeHostName(hostName: string): string {
  return hostName.trim().substring(0, 50)
}

export function sanitizeDescription(description?: string): string {
  return description ? description.trim().substring(0, 500) : ''
}

export function calculateExpiryDate(meetingDate: string): string {
  const meeting = new Date(meetingDate)
  const expiry = new Date(meeting.getTime() + 24 * 60 * 60 * 1000) // Add 24 hours
  return expiry.toISOString()
}

export function formatMeetingDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}

export function generateJoinLink(roomId: string, baseUrl: string = ''): string {
  return `${baseUrl}/room/${roomId}`
}

export function isValidRoomId(roomId: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(roomId)
}

export function createRoomFromRequest(
  request: CreateRoomRequest,
  hostId: string
): PersistentMeetingRoom {
  const now = new Date().toISOString()
  const roomId = generateRoomId()

  return {
    id: roomId,
    title: sanitizeRoomTitle(request.title),
    hostId,
    hostName: sanitizeHostName(request.hostName),
    password: hashPassword(request.password),
    meetingDate: request.meetingDate,
    expiryDate: calculateExpiryDate(request.meetingDate),
    createdAt: now,
    updatedAt: now,
    status: 'scheduled',
    maxParticipants: request.maxParticipants || 10,
    currentParticipants: 0,
    description: sanitizeDescription(request.description),
    settings: { ...createDefaultSettings(), ...request.settings },
  }
}

export function canJoinRoom(room: PersistentMeetingRoom): { canJoin: boolean; reason?: string } {
  if (isRoomExpired(room)) {
    return { canJoin: false, reason: 'Room has expired' }
  }

  if (room.status === 'ended') {
    return { canJoin: false, reason: 'Meeting has ended' }
  }

  if (room.currentParticipants >= room.maxParticipants) {
    return { canJoin: false, reason: 'Room is full' }
  }

  return { canJoin: true }
}

export function updateRoomStatus(room: PersistentMeetingRoom): PersistentMeetingRoom {
  const now = new Date()
  const meetingTime = new Date(room.meetingDate)
  const expiryTime = new Date(room.expiryDate)

  let newStatus = room.status

  if (now > expiryTime) {
    newStatus = 'expired'
  } else if (now >= meetingTime && room.status === 'scheduled') {
    newStatus = 'active'
  }

  return {
    ...room,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  }
}
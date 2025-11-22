import { PersistentMeetingRoom, CreateRoomRequest, MeetingInstance } from './types'

// In-memory storage for development (replace with KV in production)
export const memoryStorage = new Map<string, PersistentMeetingRoom>();
export const meetingInstancesStorage = new Map<string, MeetingInstance>();

// Utility functions for persistent meeting room management
export function isValidRoomId(id: string): boolean {
  // Allow human-readable IDs with letters, numbers, hyphens, underscores
  return /^[a-zA-Z0-9-_]{3,50}$/.test(id);
}

export function hashPassword(password: string): string {
  // In a real app, use bcrypt.hash(password, 10)
  return password;
}

export function validatePassword(input: string, hash: string): boolean {
  // In a real app, use bcrypt.compare(input, hash)
  return input === hash;
}

export function createRoomFromRequest(body: CreateRoomRequest, ownerId: string): PersistentMeetingRoom {
  const now = new Date().toISOString();
  
  return {
    id: body.roomId, // Use the user-provided fixed ID
    title: body.title,
    description: body.description,
    ownerId,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    settings: {
      maxParticipants: body.settings.maxParticipants || 10,
      requirePassword: body.settings.requirePassword !== false,
      allowWaitingRoom: body.settings.allowWaitingRoom || false,
      muteOnEntry: body.settings.muteOnEntry || false,
      videoOnEntry: body.settings.videoOnEntry !== false,
      enableChat: body.settings.enableChat !== false,
      enableScreenShare: body.settings.enableScreenShare !== false,
      autoRecord: body.settings.autoRecord || false,
      defaultMeetingDuration: body.settings.defaultMeetingDuration || 60,
    },
    recurringSchedule: body.recurringSchedule,
  };
}

export function validateCreateRoomRequest(body: CreateRoomRequest): string[] {
  const errors = [];
  
  if (!body.title || body.title.trim().length < 3) {
    errors.push("Title must be at least 3 characters long");
  }
  
  if (!body.description || body.description.trim().length < 10) {
    errors.push("Description must be at least 10 characters long");
  }
  
  if (!body.roomId || !isValidRoomId(body.roomId)) {
    errors.push("Room ID must be 3-50 characters containing letters, numbers, hyphens, or underscores");
  }
  
  if (!body.password || body.password.length < 4) {
    errors.push("Password must be at least 4 characters long");
  }
  
  if (body.settings.maxParticipants && (body.settings.maxParticipants < 2 || body.settings.maxParticipants > 100)) {
    errors.push("Max participants must be between 2 and 100");
  }
  
  return errors;
}

export function canJoinRoom(room: PersistentMeetingRoom): { canJoin: boolean; reason?: string } {
  if (!room.isActive) {
    return { canJoin: false, reason: 'Room is not active' }
  }

  // For persistent rooms, we don't check expiration - rooms are permanent
  // Instead, we check if the room is currently hosting a meeting
  // This would be enhanced with meeting instance checking in a real implementation
  
  return { canJoin: true }
}

export function generateMeetingId(): string {
  return `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createMeetingInstance(roomId: string, scheduledTime: string, maxParticipants: number): MeetingInstance {
  return {
    id: generateMeetingId(),
    roomId,
    scheduledTime,
    status: 'scheduled',
    currentParticipants: 0,
    maxParticipants,
  };
}

export function isRoomAvailable(roomId: string): boolean {
  const room = memoryStorage.get(roomId);
  return !!room && room.isActive;
}
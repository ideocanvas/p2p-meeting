# Meeting Room System Implementation Plan

## Overview
This document outlines the complete implementation of a persistent meeting room system with KV storage, replacing the current temporary short code system.

## 1. Data Types and Interfaces

### MeetingRoom Interface
```typescript
interface MeetingRoom {
  id: string;              // Short code (6-8 characters, alphanumeric)
  title: string;           // Meeting title
  description?: string;    // Optional meeting description
  password: string;        // Admin password (hashed)
  meetingDate: string;     // ISO date string (YYYY-MM-DD)
  meetingTime: string;     // Time string (HH:MM)
  expiryDate: string;      // ISO datetime when room expires
  createdAt: string;       // ISO datetime when created
  updatedAt: string;       // ISO datetime when last updated
  isActive: boolean;       // Whether meeting is currently active
  maxParticipants?: number; // Optional participant limit
  hostId?: string;         // Optional host identifier
  timezone?: string;       // Meeting timezone (default: UTC)
}
```

### API Request/Response Types
```typescript
interface CreateRoomRequest {
  title: string;
  description?: string;
  meetingDate: string;
  meetingTime: string;
  password: string;
  maxParticipants?: number;
  timezone?: string;
}

interface CreateRoomResponse {
  success: boolean;
  roomId: string;
  roomUrl: string;
  expiryDate: string;
  error?: string;
}

interface UpdateRoomRequest {
  password: string;
  title?: string;
  description?: string;
  meetingDate?: string;
  meetingTime?: string;
  maxParticipants?: number;
  timezone?: string;
}

interface JoinRoomRequest {
  participantName: string;
}

interface JoinRoomResponse {
  success: boolean;
  meetingId: string;
  peerId: string;
  verificationRequired: boolean;
  roomInfo?: {
    title: string;
    meetingDate: string;
    meetingTime: string;
    isActive: boolean;
  };
  error?: string;
}
```

## 2. KV Storage Setup

### New KV Namespace: `MEETING_ROOMS`

#### Storage Structure
```
MEETING_ROOMS {
  "ABC123": '{"id":"ABC123","title":"Team Standup","password":"$2b$12$hash...","meetingDate":"2024-01-15","meetingTime":"10:00","expiryDate":"2024-01-16T23:59:59Z","createdAt":"2024-01-10T08:00:00Z","updatedAt":"2024-01-10T08:00:00Z","isActive":false,"maxParticipants":10}',
  "XYZ789": '{"id":"XYZ789","title":"Client Review","password":"$2b$12$hash...","meetingDate":"2024-01-20","meetingTime":"14:30","expiryDate":"2024-01-21T23:59:59Z","createdAt":"2024-01-10T09:00:00Z","updatedAt":"2024-01-10T09:00:00Z","isActive":false,"maxParticipants":5}'
}
```

#### Room ID Generation
- Generate 6-8 character alphanumeric codes
- Check for collisions in KV storage
- Retry with different codes if collision occurs
- Provide option for custom room IDs (future feature)

## 3. API Endpoints Implementation

### POST /api/rooms - Create Meeting Room
```typescript
export async function POST(request: Request) {
  try {
    const body: CreateRoomRequest = await request.json();
    
    // Validate input
    if (!body.title || !body.meetingDate || !body.meetingTime || !body.password) {
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }
    
    // Generate unique room ID
    let roomId: string;
    let attempts = 0;
    do {
      roomId = generateRoomId();
      attempts++;
      if (attempts > 10) {
        throw new Error("Failed to generate unique room ID");
      }
    } while (await roomExists(roomId));
    
    // Calculate expiry date (meeting date + 1 day at 23:59:59)
    const meetingDateTime = new Date(`${body.meetingDate}T${body.meetingTime}:00`);
    const expiryDate = new Date(meetingDateTime);
    expiryDate.setDate(expiryDate.getDate() + 1);
    expiryDate.setHours(23, 59, 59, 999);
    
    // Hash password
    const hashedPassword = await hashPassword(body.password);
    
    // Create room object
    const room: MeetingRoom = {
      id: roomId,
      title: body.title,
      description: body.description,
      password: hashedPassword,
      meetingDate: body.meetingDate,
      meetingTime: body.meetingTime,
      expiryDate: expiryDate.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: false,
      maxParticipants: body.maxParticipants,
      timezone: body.timezone || 'UTC'
    };
    
    // Store in KV
    await MEETING_ROOMS.put(roomId, JSON.stringify(room), {
      expirationTtl: Math.floor((expiryDate.getTime() - Date.now()) / 1000)
    });
    
    return Response.json({
      success: true,
      roomId,
      roomUrl: `${request.headers.get('origin')}/room/${roomId}`,
      expiryDate: room.expiryDate
    });
    
  } catch (error) {
    console.error('Failed to create room:', error);
    return Response.json({ success: false, error: "Failed to create room" }, { status: 500 });
  }
}
```

### GET /api/rooms/:roomId - Get Room Information
```typescript
export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const { roomId } = params;
    
    // Get room from KV
    const roomData = await MEETING_ROOMS.get(roomId);
    if (!roomData) {
      return Response.json({ success: false, error: "Room not found" }, { status: 404 });
    }
    
    const room: MeetingRoom = JSON.parse(roomData);
    
    // Check if room has expired
    if (new Date() > new Date(room.expiryDate)) {
      return Response.json({ success: false, error: "Room has expired" }, { status: 410 });
    }
    
    // Return safe room data (without password)
    const safeRoomData = {
      id: room.id,
      title: room.title,
      description: room.description,
      meetingDate: room.meetingDate,
      meetingTime: room.meetingTime,
      expiryDate: room.expiryDate,
      isActive: room.isActive,
      maxParticipants: room.maxParticipants,
      timezone: room.timezone,
      timeUntilExpiry: Math.floor((new Date(room.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) // days
    };
    
    return Response.json({ success: true, room: safeRoomData });
    
  } catch (error) {
    console.error('Failed to get room:', error);
    return Response.json({ success: false, error: "Failed to get room" }, { status: 500 });
  }
}
```

### PUT /api/rooms/:roomId - Update Room Information
```typescript
export async function PUT(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const { roomId } = params;
    const body: UpdateRoomRequest = await request.json();
    
    // Get existing room
    const roomData = await MEETING_ROOMS.get(roomId);
    if (!roomData) {
      return Response.json({ success: false, error: "Room not found" }, { status: 404 });
    }
    
    const room: MeetingRoom = JSON.parse(roomData);
    
    // Verify password
    const passwordValid = await verifyPassword(body.password, room.password);
    if (!passwordValid) {
      return Response.json({ success: false, error: "Invalid password" }, { status: 401 });
    }
    
    // Update room fields
    if (body.title) room.title = body.title;
    if (body.description !== undefined) room.description = body.description;
    if (body.meetingDate) room.meetingDate = body.meetingDate;
    if (body.meetingTime) room.meetingTime = body.meetingTime;
    if (body.maxParticipants !== undefined) room.maxParticipants = body.maxParticipants;
    if (body.timezone) room.timezone = body.timezone;
    
    // Recalculate expiry date if date/time changed
    if (body.meetingDate || body.meetingTime) {
      const meetingDateTime = new Date(`${room.meetingDate}T${room.meetingTime}:00`);
      const expiryDate = new Date(meetingDateTime);
      expiryDate.setDate(expiryDate.getDate() + 1);
      expiryDate.setHours(23, 59, 59, 999);
      room.expiryDate = expiryDate.toISOString();
    }
    
    room.updatedAt = new Date().toISOString();
    
    // Store updated room
    await MEETING_ROOMS.put(roomId, JSON.stringify(room), {
      expirationTtl: Math.floor((new Date(room.expiryDate).getTime() - Date.now()) / 1000)
    });
    
    return Response.json({ success: true, room });
    
  } catch (error) {
    console.error('Failed to update room:', error);
    return Response.json({ success: false, error: "Failed to update room" }, { status: 500 });
  }
}
```

### DELETE /api/rooms/:roomId - Delete Room
```typescript
export async function DELETE(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const { roomId } = params;
    const body = await request.json();
    
    // Get existing room
    const roomData = await MEETING_ROOMS.get(roomId);
    if (!roomData) {
      return Response.json({ success: false, error: "Room not found" }, { status: 404 });
    }
    
    const room: MeetingRoom = JSON.parse(roomData);
    
    // Verify password
    const passwordValid = await verifyPassword(body.password, room.password);
    if (!passwordValid) {
      return Response.json({ success: false, error: "Invalid password" }, { status: 401 });
    }
    
    // Delete room
    await MEETING_ROOMS.delete(roomId);
    
    return Response.json({ success: true, message: "Room deleted successfully" });
    
  } catch (error) {
    console.error('Failed to delete room:', error);
    return Response.json({ success: false, error: "Failed to delete room" }, { status: 500 });
  }
}
```

### POST /api/rooms/:roomId/join - Join Meeting Room
```typescript
export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const { roomId } = params;
    const body: JoinRoomRequest = await request.json();
    
    // Get room from KV
    const roomData = await MEETING_ROOMS.get(roomId);
    if (!roomData) {
      return Response.json({ success: false, error: "Room not found" }, { status: 404 });
    }
    
    const room: MeetingRoom = JSON.parse(roomData);
    
    // Check if room has expired
    if (new Date() > new Date(room.expiryDate)) {
      return Response.json({ success: false, error: "Room has expired" }, { status: 410 });
    }
    
    // Check if meeting is active (within 30 minutes of scheduled time)
    const meetingDateTime = new Date(`${room.meetingDate}T${room.meetingTime}:00`);
    const now = new Date();
    const timeDiff = Math.abs(meetingDateTime.getTime() - now.getTime());
    const isActive = timeDiff < 30 * 60 * 1000; // 30 minutes
    
    // Generate meeting ID for this session
    const meetingId = generateMeetingId();
    
    return Response.json({
      success: true,
      meetingId,
      peerId: roomId, // Use room ID as peer ID for simplicity
      verificationRequired: !isActive, // Require verification if not active time
      roomInfo: {
        title: room.title,
        meetingDate: room.meetingDate,
        meetingTime: room.meetingTime,
        isActive
      }
    });
    
  } catch (error) {
    console.error('Failed to join room:', error);
    return Response.json({ success: false, error: "Failed to join room" }, { status: 500 });
  }
}
```

## 4. Utility Functions

### Room ID Generation
```typescript
function generateRoomId(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function roomExists(roomId: string): Promise<boolean> {
  const roomData = await MEETING_ROOMS.get(roomId);
  return roomData !== null;
}

function generateMeetingId(): string {
  return `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### Password Hashing
```typescript
import { hash, verify } from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
  return await hash(password, 12);
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await verify(password, hashedPassword);
}
```

## 5. Cloudflare Workers Configuration

### wrangler.jsonc Updates
```json
{
  "kv_namespaces": [
    {
      "binding": "SHORT_CODE",
      "id": "existing-short-code-id",
      "preview_id": "existing-short-code-preview-id"
    },
    {
      "binding": "MEETING_ROOMS",
      "id": "new-meeting-rooms-id",
      "preview_id": "new-meeting-rooms-preview-id"
    }
  ]
}
```

## 6. Integration with Existing System

### Update MeetingManager
- Modify to use room-based meeting IDs instead of peer IDs
- Integrate with new room validation system
- Update participant admission flow

### Update Frontend Components
- Replace short code system with room ID system
- Add room creation and management UI
- Update join flow to use room IDs

## 7. Security Considerations

### Password Protection
- Hash passwords using bcrypt
- Never store plain text passwords
- Implement rate limiting for room access attempts

### Room Expiration
- Automatic cleanup of expired rooms
- Validate room expiry on all operations
- Implement grace period for meeting start/end

### Input Validation
- Validate all input data types and formats
- Sanitize room titles and descriptions
- Implement proper error handling

## 8. Testing Strategy

### Unit Tests
- Test room creation, retrieval, update, and deletion
- Test password hashing and verification
- Test room ID generation and collision handling

### Integration Tests
- Test complete room lifecycle
- Test API endpoints with various scenarios
- Test room expiration and cleanup

### Load Tests
- Test concurrent room creation and access
- Test KV storage performance
- Test system behavior under high load

## 9. Deployment Steps

1. **Setup KV Namespace**
   - Create new KV namespace in Cloudflare dashboard
   - Update wrangler.jsonc configuration
   - Deploy KV namespace

2. **Implement API Endpoints**
   - Create new API route files
   - Implement utility functions
   - Add error handling and validation

3. **Update Frontend**
   - Create room creation form
   - Update join flow
   - Add room management interface

4. **Testing and Deployment**
   - Test all functionality
   - Deploy to staging environment
   - Deploy to production

## 10. Future Enhancements

### Advanced Features
- Custom room IDs
- Room templates
- Recurring meetings
- Calendar integration
- Meeting recordings
- Participant permissions

### Performance Optimizations
- KV caching strategies
- Room data compression
- Batch operations
- CDN integration

### Analytics and Monitoring
- Room usage statistics
- Performance metrics
- Error tracking
- User analytics
import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'

interface JoinRoomRequest {
  participantName: string;
  peerId: string;
}

interface JoinRoomResponse {
  success: boolean;
  participantId?: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<NextResponse<JoinRoomResponse>> {
  try {
    const { roomId } = await params;
    const body = await request.json() as JoinRoomRequest;

    // Validate request
    if (!body.participantName || body.participantName.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Participant name must be at least 2 characters long'
      });
    }

    if (!body.peerId) {
      return NextResponse.json({
        success: false,
        error: 'Peer ID is required'
      });
    }

    // Join room using the room service
    const result = await roomService.joinRoom(roomId, body.participantName, body.peerId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        participantId: result.participantId
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to join room'
      });
    }
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error'
    });
  }
}
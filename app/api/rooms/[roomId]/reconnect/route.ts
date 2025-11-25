import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'
import { SimplifiedRoom } from '@/lib/types'

interface ReconnectRequest {
  password: string;
  hostPeerId: string;
}

interface ReconnectResponse {
  success: boolean;
  room?: SimplifiedRoom;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<NextResponse<ReconnectResponse>> {
  try {
    const { roomId } = await params;
    const body = await request.json() as ReconnectRequest;

    // Validate request
    if (!body.password) {
      return NextResponse.json({
        success: false,
        error: 'Password is required for host reconnection'
      });
    }

    if (!body.hostPeerId) {
      return NextResponse.json({
        success: false,
        error: 'Host Peer ID is required'
      });
    }

    // Reconnect host using the room service
    const result = await roomService.hostReconnect(roomId, body.password, body.hostPeerId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        room: result.room
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to reconnect host'
      });
    }
  } catch (error) {
    console.error('Error reconnecting host:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error'
    });
  }
}
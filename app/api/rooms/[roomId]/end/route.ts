import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'

interface EndMeetingRequest {
  password: string;
}

interface EndMeetingResponse {
  success: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<NextResponse<EndMeetingResponse>> {
  try {
    const { roomId } = await params;
    const body = await request.json() as EndMeetingRequest;

    // Validate request
    if (!body.password) {
      return NextResponse.json({
        success: false,
        error: 'Password is required to end the meeting'
      });
    }

    // End meeting using the room service
    const result = await roomService.endMeeting(roomId, body.password);

    if (result.success) {
      return NextResponse.json({
        success: true
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to end meeting'
      });
    }
  } catch (error) {
    console.error('Error ending meeting:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error'
    });
  }
}
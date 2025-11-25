import { NextRequest, NextResponse } from 'next/server'
import { roomService } from '@/services/room-service'

interface ApproveParticipantRequest {
  participantId: string;
  password: string;
}

interface ApproveParticipantResponse {
  success: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<NextResponse<ApproveParticipantResponse>> {
  try {
    const { roomId } = await params;
    const body = await request.json() as ApproveParticipantRequest;

    // Validate request
    if (!body.participantId) {
      return NextResponse.json({
        success: false,
        error: 'Participant ID is required'
      });
    }

    if (!body.password) {
      return NextResponse.json({
        success: false,
        error: 'Password is required for host actions'
      });
    }

    // Approve participant - verify host password first
    const isValidPassword = await roomService.verifyMasterPassword(roomId, body.password);
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Invalid password'
      });
    }

    const result = await roomService.approveParticipant(roomId, body.participantId);

    if (result.success) {
      return NextResponse.json({
        success: true
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to approve participant'
      });
    }
  } catch (error) {
    console.error('Error approving participant:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error'
    });
  }
}
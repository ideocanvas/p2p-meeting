
import { NextRequest, NextResponse } from "next/server";

// In-memory store for signaling data (in production, use Redis or similar)
const sessions = new Map<
  string,
  {
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    iceCandidates: RTCIceCandidateInit[];
    senderCandidates: RTCIceCandidateInit[];
    receiverCandidates: RTCIceCandidateInit[];
    createdAt: number;
  }
>();

// Clean up old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 15 * 60 * 1000) {
      // 15 minutes
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, type, data, role } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Initialize session if it doesn't exist
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        iceCandidates: [],
        senderCandidates: [],
        receiverCandidates: [],
        createdAt: Date.now(),
      });
    }

    const session = sessions.get(sessionId)!;

    switch (type) {
      case "offer":
        session.offer = data;
        break;
      case "answer":
        session.answer = data;
        break;
      case "ice-candidate":
        if (role === "sender") {
          session.senderCandidates.push(data);
        } else {
          session.receiverCandidates.push(data);
        }
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signaling error:", error);
    return NextResponse.json({ error: "Signaling failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const role = searchParams.get("role");
    const lastCount = parseInt(searchParams.get("lastCount") || "0");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const response: any = {};

    if (role === "sender") {
      if (session.answer) response.answer = session.answer;
      const newCandidates = session.receiverCandidates.slice(lastCount);
      if (newCandidates.length > 0) {
        response.iceCandidates = newCandidates;
        response.candidateCount = session.receiverCandidates.length;
      }
    } else {
      if (session.offer) response.offer = session.offer;
      const newCandidates = session.senderCandidates.slice(lastCount);
      if (newCandidates.length > 0) {
        response.iceCandidates = newCandidates;
        response.candidateCount = session.senderCandidates.length;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Signaling polling error:", error);
    return NextResponse.json({ error: "Polling failed" }, { status: 500 });
  }
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

// Cloudflare KV binding for short code mappings
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

const TTL = 2 * 60 * 60; // 2 hours in seconds for meetings

// Generate a random 6-character alphanumeric code
function generateShortCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { peerId, roomId } = body;

    const id = roomId || peerId;

    if (!id) {
      return NextResponse.json({ error: "Room ID or Peer ID required" }, { status: 400 });
    }

    // Get the Cloudflare context
    const { env } = await getCloudflareContext({async: true});

    // @ts-expect-error - Cloudflare KV binding
    const SHORT_CODES: KVNamespace = env.SHORT_CODES;

    if (!SHORT_CODES) {
      return NextResponse.json(
        { error: "KV storage not available" },
        { status: 500 }
      );
    }

    // Generate a unique short code
    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = generateShortCode();
      const existing = await SHORT_CODES.get(shortCode);

      if (!existing) {
        // Code is available, store it
        await SHORT_CODES.put(shortCode, id, { expirationTtl: TTL });
        break;
      }

      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Failed to generate unique short code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      shortCode,
      expiresIn: TTL,
    });
  } catch (error) {
    console.error("Short code registration error:", error);
    return NextResponse.json(
      { error: "Failed to register short code" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get("shortCode");

    if (!shortCode) {
      return NextResponse.json(
        { error: "Short code required" },
        { status: 400 }
      );
    }

    // Get the Cloudflare context
    const { env } = await getCloudflareContext({async: true});

    // @ts-expect-error - Cloudflare KV binding
    const SHORT_CODES: KVNamespace = env.SHORT_CODES;

    if (!SHORT_CODES) {
      return NextResponse.json(
        { error: "KV storage not available" },
        { status: 500 }
      );
    }

    // Lookup ID from short code (could be peerId or roomId)
    const id = await SHORT_CODES.get(shortCode);

    if (!id) {
      return NextResponse.json(
        { error: "Short code not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      peerId: id, // Keep as peerId for backward compatibility
      roomId: id, // Add roomId for meeting functionality
      shortCode,
    });
  } catch (error) {
    console.error("Short code lookup error:", error);
    return NextResponse.json(
      { error: "Failed to lookup short code" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get("shortCode");

    if (!shortCode) {
      return NextResponse.json(
        { error: "Short code required" },
        { status: 400 }
      );
    }

    // Get the Cloudflare context
    const { env } = await getCloudflareContext({async: true});

    // @ts-expect-error - Cloudflare KV binding
    const SHORT_CODES: KVNamespace = env.SHORT_CODES;

    if (!SHORT_CODES) {
      return NextResponse.json(
        { error: "KV storage not available" },
        { status: 500 }
      );
    }

    await SHORT_CODES.delete(shortCode);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Short code deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete short code" },
      { status: 500 }
    );
  }
}

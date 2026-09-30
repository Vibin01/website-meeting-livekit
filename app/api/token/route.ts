import { NextRequest, NextResponse } from 'next/server';
import {
  AccessToken,
  type AccessTokenOptions,
  RoomAgentDispatch,
  RoomConfiguration,
  type VideoGrant,
} from 'livekit-server-sdk';

export const revalidate = 0;

interface TokenResponse {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}

export async function GET(req: NextRequest) {
  return handleTokenRequest(req);
}

export async function POST(req: NextRequest) {
  return handleTokenRequest(req);
}

async function handleTokenRequest(req: NextRequest) {
  try {
    const API_KEY = process.env.LIVEKIT_API_KEY;
    const API_SECRET = process.env.LIVEKIT_API_SECRET;
    const LIVEKIT_URL = process.env.LIVEKIT_URL;

    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        {
          error:
            'LiveKit server environment variables (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are not configured in .env.local.',
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    let body: Record<string, string | undefined> = {};
    if (req.method === 'POST') {
      body = (await req.json().catch(() => ({}))) as Record<string, string | undefined>;
    }

    // Room ID / Token ID
    const roomName =
      searchParams.get('room') ||
      searchParams.get('roomName') ||
      body?.room_name ||
      body?.roomName ||
      body?.room ||
      'interview-meeting-room';

    // Participant Mail ID (Name)
    const participantName =
      searchParams.get('name') ||
      searchParams.get('participantName') ||
      searchParams.get('email') ||
      body?.participant_name ||
      body?.participantName ||
      body?.email ||
      'guest@example.com';

    // Role (Candidate, Recruiter, Panel)
    const rawRole =
      searchParams.get('role') ||
      searchParams.get('user_type') ||
      body?.role ||
      body?.user_type ||
      'Candidate';

    const normalizedRole =
      rawRole.toLowerCase() === 'recruiter'
        ? 'Recruiter'
        : rawRole.toLowerCase() === 'panel'
          ? 'Panel'
          : 'Candidate';

    // Unique identity while preserving mail ID
    const participantIdentity = `${participantName}_${Math.random().toString(36).substring(2, 7)}`;

    // Create LiveKit token with RoomConfiguration for agent dispatch
    const token = await createToken(
      API_KEY,
      API_SECRET,
      {
        identity: participantIdentity,
        name: participantName,
        metadata: JSON.stringify({
          role: normalizedRole,
          email: participantName,
          joinedAt: new Date().toISOString(),
        }),
      },
      roomName
    );

    const responseData: TokenResponse = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken: token,
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    console.error('Error generating LiveKit token:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate token';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function createToken(
  apiKey: string,
  apiSecret: string,
  userInfo: AccessTokenOptions,
  roomName: string
): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    ...userInfo,
    ttl: '2h',
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };

  at.addGrant(grant);

  // Configure AI Agent dispatch to the room if AGENT_NAME is set
  const agentName = process.env.AGENT_NAME?.trim();
  if (agentName) {
    const roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: agentName,
        }),
      ],
    });
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}

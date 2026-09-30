import { NextRequest, NextResponse } from 'next/server';
import { AgentDispatchClient } from 'livekit-server-sdk';

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const roomName = body?.room || 'interview-meeting';

    const LIVEKIT_URL = process.env.LIVEKIT_URL;
    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
    const AGENT_NAME = process.env.AGENT_NAME || 'transcriber-agent';

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json(
        { error: 'LiveKit environment variables missing' },
        { status: 500 }
      );
    }

    const client = new AgentDispatchClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Check if dispatch already active
    const existing = await client.listDispatch(roomName).catch(() => []);
    const alreadyActive = existing.some(
      (d) => d.agentName === AGENT_NAME && (!d.state?.deletedAt || d.state.deletedAt === BigInt(0))
    );

    if (alreadyActive) {
      return NextResponse.json({
        success: true,
        message: 'Agent already dispatched to room',
        room: roomName,
      });
    }

    const dispatch = await client.createDispatch(roomName, AGENT_NAME);
    console.log(`[API] Created agent dispatch for room: "${roomName}" (Dispatch ID: ${dispatch.id})`);

    return NextResponse.json({
      success: true,
      dispatchId: dispatch.id,
      room: roomName,
      agentName: AGENT_NAME,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to dispatch agent';
    console.error('[API] Error dispatching agent:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

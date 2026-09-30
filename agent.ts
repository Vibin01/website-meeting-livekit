import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  stt,
} from '@livekit/agents';
import {
  AudioStream,
  RoomEvent,
  RemoteParticipant,
  Track,
  TrackKind,
} from '@livekit/rtc-node';
import { fileURLToPath } from 'node:url';

// Load .env.local credentials
try {
  process.loadEnvFile?.('.env.local');
} catch {
  console.log("Credentials is missing")
}

/**
 * Get speaker username directly from participant metadata, name, or identity
 */
function getSpeakerName(participant: RemoteParticipant): string {
  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      if (meta.name) return meta.name.split('@')[0];
      if (meta.email) return meta.email.split('@')[0];
    } catch {}
  }
  return participant.name || participant.identity.split('_')[0] || 'Participant';
}

const activeStreams = new Set<string>();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`\n[AGENT] Connected to room: "${ctx.room.name}"`);

    // Language configured via STT_LANGUAGE in .env.local (e.g. 'en', 'hi', 'es', 'fr', 'multi')
    const sttLanguage = (process.env.STT_LANGUAGE?.trim() || 'en') as any;
    // console.log(`[STT] Speech-to-Text language set to: "${sttLanguage}"`);

    // Initialize AssemblyAI Speech-to-Text via LiveKit Inference
    const sttInstance = new inference.STT({
      model: 'assemblyai/universal-3-5-pro',
      language: 'en',
      modelOptions: { speaker_labels: true },
    });

    const transcribeParticipant = async (track: Track, participant: RemoteParticipant) => {
      const trackId = track.sid || participant.identity;
      if (activeStreams.has(trackId)) return;
      activeStreams.add(trackId);

      const user = getSpeakerName(participant);
      console.log(`[AUDIO] 🎙️ Transcribing audio for: ${user}`);

      const audioStream = new AudioStream(track, 16000, 1);
      const sttStream = sttInstance.stream();

      // Send audio frames to AssemblyAI
      (async () => {
        const reader = audioStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sttStream.pushFrame(value);
          }
        } finally {
          reader.releaseLock();
          sttStream.endInput();
        }
      })();

      // 3-second silence threshold: only transcribe when speaker stops for 3 seconds
      const SILENCE_STOP_MS = 2000;
      let silenceTimer: NodeJS.Timeout | null = null;
      let speechBuffer: string[] = [];
      let lastInterim = '';

      const flushTranscript = () => {
        if (speechBuffer.length === 0 && lastInterim) {
          speechBuffer.push(lastInterim);
        }
        if (speechBuffer.length === 0) return;

        const fullText = speechBuffer.join(' ').trim();
        speechBuffer = [];
        lastInterim = '';

        if (!fullText) return;

        // Speaker stopped for 3 seconds -> Output finalized transcript
        console.log('\n========================================');
        console.log(`USER: ${user}`);
        console.log(`TEXT: ${fullText}`);
        console.log('========================================\n');

        // Broadcast to meeting-room.tsx
        if (ctx.room.localParticipant) {
          const payload = new TextEncoder().encode(
            JSON.stringify({ user, text: fullText, isFinal: true })
          );
          ctx.room.localParticipant
            .publishData(payload, { topic: 'transcription', reliable: true })
            .then(() => {
              console.log(`[DATA] Published transcript to room (${user}: "${fullText}")`);
            })
            .catch((err) => {
              console.error('[DATA] ⚠️ Failed to publish data to room:', err);
            });
        }
      };

      // Read transcribed speech events
      try {
        for await (const event of sttStream) {
          const text = event.alternatives?.[0]?.text?.trim();
          if (!text) continue;

          if (event.type === stt.SpeechEventType.FINAL_TRANSCRIPT) {
            speechBuffer.push(text);
            lastInterim = '';
          } else if (event.type === stt.SpeechEventType.INTERIM_TRANSCRIPT) {
            lastInterim = text;
          }

          // Reset 5-second silence timer while speaking
          if (silenceTimer) clearTimeout(silenceTimer);

          // Only when speaker stops speaking for 5 seconds -> transcript it!
          silenceTimer = setTimeout(() => {
            flushTranscript();
          }, SILENCE_STOP_MS);
        }
      } finally {
        if (silenceTimer) clearTimeout(silenceTimer);
        flushTranscript();
        activeStreams.delete(trackId);
      }
    };

    // Transcribe incoming participant audio
    ctx.room.on(RoomEvent.TrackSubscribed, (track: Track, _, participant: RemoteParticipant) => {
      if (track.kind === TrackKind.KIND_AUDIO) {
        transcribeParticipant(track, participant);
      }
    });

    // Transcribe existing participants already in the room
    for (const participant of ctx.room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.track && pub.kind === TrackKind.KIND_AUDIO) {
          transcribeParticipant(pub.track, participant);
        }
      }
    }
  },
});

// Run agent worker
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.AGENT_NAME || 'transcriber-agent',
    wsURL: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  })
);

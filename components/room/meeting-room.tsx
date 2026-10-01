'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Participant,
  RemoteParticipant,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from 'livekit-client';
import {
  RoomAudioRenderer,
  useIsSpeaking,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import {
  Briefcase,
  CaretDown,
  CaretUp,
  ChatText,
  Clock,
  DownloadSimple,
  GraduationCap,
  Info,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  Robot,
  Screencast,
  Sparkle,
  User,
  UsersThree,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { ParticipantManager, ActivityLog } from './participant-manager';

export type { ActivityLog };

export interface TranscriptItem {
  id: string;
  user: string;
  text: string;
  time: string;
}

interface MeetingRoomProps {
  tokenId: string;
  userEmail: string;
  userRole: string;
  initialCameraEnabled?: boolean;
  initialMicEnabled?: boolean;
}

// Helper to extract role from participant metadata safely
function parseParticipantRole(p: Participant, fallbackRole = 'Candidate'): string {
  try {
    if (p.metadata) {
      const parsed = JSON.parse(p.metadata);
      if (parsed.role) return parsed.role;
    }
  } catch {
    // fallback
  }
  return fallbackRole;
}

export function MeetingRoom({
  tokenId,
  userEmail,
  userRole,
  initialCameraEnabled = true,
  initialMicEnabled = true,
}: MeetingRoomProps) {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // State: Slide-open Info Drawer (shows participant list)
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // State: Join / Left activity history with timestamps
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // State: Call duration timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // State: Full history of transcribed messages with auto-scrolling
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  // State: Currently active interim speech being spoken right now
  const [interimTranscript, setInterimTranscript] = useState<{ user: string; text: string } | null>(null);
  // State: Toggle transcript box visibility
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(true);
  // State: Minimize / collapse transcript box
  const [isTranscriptCollapsed, setIsTranscriptCollapsed] = useState(false);

  // Auto-scroll ref for the transcript box
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Helper to append a transcript entry
  const addTranscript = (user: string, text: string, customId?: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const id = customId || `transcript-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTranscripts((prev) => [...prev, { id, user, text, time }]);
    setInterimTranscript(null);
    return { id, time };
  };

  // Helper to extract role for local or remote participant
  const getParticipantRole = (p: Participant): string => {
    return p.identity === localParticipant.identity ? userRole : parseParticipantRole(p);
  };

  // Auto-scroll inside the box whenever new transcripts or speech arrive
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcripts, interimTranscript, isTranscriptCollapsed]);

  // Video camera tracks for all participants
  const cameraTracks = useTracks([Track.Source.Camera]);

  // Check if transcriber agent worker is currently connected to the room
  const agentParticipant = useMemo(() => {
    console.log('[Meeting Room] All remoteParticipants:', remoteParticipants);

    return remoteParticipants.find((p) => {
      console.log('[Meeting Room] Checking participant p:', p, {
        identity: p.identity,
        name: p.name,
        isAgent: p.isAgent,
        metadata: p.metadata,
      });

      return (
        p.isAgent ||
        p.identity.toLowerCase().startsWith('agent-') ||
        p.name?.toLowerCase().includes('agent')
      );
    });
  }, [remoteParticipants]);
  const isAgentConnected = !!agentParticipant;

  // Filter out background agent workers from human video list
  const humanRemoteParticipants = useMemo(() => {
    return remoteParticipants.filter(
      (p) => !p.isAgent && !p.identity.toLowerCase().startsWith('agent-')
    );
  }, [remoteParticipants]);

  // Combine local and remote human participants
  const allParticipants: Participant[] = useMemo(() => {
    return [localParticipant, ...humanRemoteParticipants];
  }, [localParticipant, humanRemoteParticipants]);

  // Total active participants in meeting (including AI agent if connected)
  const totalParticipantCount = allParticipants.length + (isAgentConnected ? 1 : 0);

  // Set initial mic and camera preferences from Welcome View
  useEffect(() => {
    if (!room) return;
    if (!initialCameraEnabled) {
      localParticipant.setCameraEnabled(false).catch(() => {});
    }
    if (!initialMicEnabled) {
      localParticipant.setMicrophoneEnabled(false).catch(() => {});
    }
  }, [room, initialCameraEnabled, initialMicEnabled, localParticipant]);

  // Call timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Meeting timer from (default 30 mins)
  const durationMinutes = Number(process.env.NEXT_PUBLIC_MEETING_DURATION_MINUTES) || 30;
  const remainingSeconds = Math.max(0, durationMinutes * 60 - elapsedSeconds);
  const isTimeExpiring = remainingSeconds <= 300 && remainingSeconds > 0; // < 5 mins
  const isTimeExpired = remainingSeconds === 0;

  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');
  const formattedTimer = `${mins}:${secs}`;

  // Track join/left events and real-time transcriptions from agent.ts
  useEffect(() => {
    if (!room) return;

    // 1. Log local participant joining
    const localEmail = localParticipant.name || localParticipant.identity || userEmail;
    const initialTime = new Date().toLocaleTimeString();

    console.log(`Meeting Activity - Local participant JOINED: ${localEmail} at ${initialTime}`);

    setActivityLogs([
      {
        id: `local-join-${Date.now()}`,
        email: `${localEmail} (You)`,
        role: userRole,
        action: 'joined',
        time: initialTime,
      },
    ]);

    // 2. Listener for remote participant joining
    const handleParticipantConnected = (participant: RemoteParticipant) => {
      // Don't clutter activity logs with background transcriber agents
      if (participant.isAgent || participant.identity.toLowerCase().startsWith('agent-')) {
        console.log(`[Meeting Activity] Transcriber Agent connected to room: ${participant.identity}`);
        return;
      }

      const email = participant.name || participant.identity || 'Participant';
      const time = new Date().toLocaleTimeString();
      const role = parseParticipantRole(participant);

      console.log(`[Meeting Activity] Participant JOINED: ${email} (${role}) at ${time}`);

      setActivityLogs((prev) => [
        ...prev,
        {
          id: `${participant.identity}-join-${Date.now()}`,
          email,
          role,
          action: 'joined',
          time,
        },
      ]);
    };

    // 3. Listener for remote participant leaving
    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      if (participant.isAgent || participant.identity.toLowerCase().startsWith('agent-')) {
        console.log(`[Meeting Activity] 🤖 Transcriber Agent disconnected from room`);
        return;
      }

      const email = participant.name || participant.identity || 'Participant';
      const time = new Date().toLocaleTimeString();
      const role = parseParticipantRole(participant);

      console.log(`[Meeting Activity] Participant LEFT: ${email} (${role}) at ${time}`);

      setActivityLogs((prev) => [
        ...prev,
        {
          id: `${participant.identity}-left-${Date.now()}`,
          email,
          role,
          action: 'left',
          time,
        },
      ]);
    };

    // 4. Listener for real-time transcription from agent.ts
    const handleDataReceived = (payload: Uint8Array, _participant?: Participant, _kind?: unknown, topic?: string) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);

        // Process transcription if topic matches or payload has text
        if (topic === 'transcription' || data.type === 'transcription' || data.text) {
          console.log(
            `%c[Transcription Received] USER: ${data.user} | TEXT: ${data.text} | FINAL: ${data.isFinal}`,
            'color: #0668E1; font-weight: bold; font-size: 13px; background: #EBF3FF; padding: 2px 6px; border-radius: 4px;'
          );

          if (data.isFinal) {
            addTranscript(data.user || 'Speaker', data.text);
          } else {
            console.log(`[LIVE] ${data.user}: ${data.text}`);
            setInterimTranscript({ user: data.user || 'Speaker', text: data.text });
          }
        }
      } catch (err) {
        console.warn('[MeetingRoom] DataReceived parse error:', err);
      }
    };

    // 5. Official LiveKit Cloud native transcription event listener
    const handleTranscriptionReceived = (
      segments: TranscriptionSegment[],
      participant?: Participant
    ) => {
      const speaker = participant?.name || participant?.identity?.split('@')[0] || 'Speaker';
      for (const segment of segments) {
        if (!segment.text?.trim()) continue;
        console.log(
          `%c[LiveKit Transcription] ${speaker}: "${segment.text}" (final: ${segment.final})`,
          'color: #9333ea; font-weight: bold; font-size: 13px; background: #F3E8FF; padding: 2px 6px; border-radius: 4px;'
        );

        if (segment.final) {
          addTranscript(speaker, segment.text, segment.id);
        } else {
          setInterimTranscript({ user: speaker, text: segment.text });
        }
      }
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.TranscriptionReceived, handleTranscriptionReceived);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.TranscriptionReceived, handleTranscriptionReceived);
    };
  }, [room, localParticipant, userEmail, userRole]);

  // Real-time Browser Speech Recognition (captures local speech and broadcasts to room)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (!isMicrophoneEnabled) {
      setInterimTranscript(null);
      return;
    }

    let recognition: any = null;
    let isStoppedManually = false;

    try {
      recognition = new (SpeechRecognition as any)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimText = '';
        const myName =
          localParticipant.name ||
          localParticipant.identity.split('@')[0] ||
          userEmail.split('@')[0] ||
          'You';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const spoken = res[0]?.transcript?.trim();
          if (!spoken) continue;

          if (res.isFinal) {
            const { id: newId, time: timeStr } = addTranscript(`${myName} (You)`, spoken);

            // Broadcast to other participants in the meeting room
            if (room?.localParticipant) {
              const payload = new TextEncoder().encode(
                JSON.stringify({
                  type: 'transcription',
                  user: myName,
                  text: spoken,
                  isFinal: true,
                  time: timeStr,
                  id: newId,
                })
              );
              room.localParticipant
                .publishData(payload, { topic: 'transcription', reliable: true })
                .catch(() => {});
            }
          } else {
            interimText += spoken + ' ';
          }
        }

        if (interimText.trim()) {
          setInterimTranscript({ user: `${myName} (You)`, text: interimText.trim() });
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[STT] Speech recognition warning:', e.error);
        }
      };

      recognition.onend = () => {
        if (!isStoppedManually && isMicrophoneEnabled) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[STT] Speech recognition start error:', err);
    }

    return () => {
      isStoppedManually = true;
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
    };
  }, [isMicrophoneEnabled, localParticipant, userEmail, room]);

  // Handler to download transcript exclusively as a clean 
  const handleDownloadTranscript = () => {
    if (transcripts.length === 0) return;

    const now = new Date();
    const cleanRoomCode = tokenId || 'meeting';
    const divider = '='.repeat(70);

    const content = [
      divider,
      'CONNECTEC MEET - MEETING TRANSCRIPT',
      divider,
      `Room Code     : ${cleanRoomCode}`,
      `Meeting Date  : ${now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`,
      `Downloaded At : ${now.toLocaleTimeString()}`,
      `Total Lines   : ${transcripts.length}`,
      divider,
      '',
      'TRANSCRIPT LOG:',
      '-'.repeat(70),
      '',
      ...transcripts.map((t) => `[${t.time}] ${t.user}:\n${t.text}\n`),
      divider,
      'End of Transcript',
      divider,
      '',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting-transcript-${cleanRoomCode}-${now.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Media toggle handlers
  const handleToggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error('Error toggling mic:', err);
    }
  };

  const handleToggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error('Error toggling camera:', err);
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      console.error('Error toggling screen share:', err);
    }
  };

  const handleLeaveRoom = () => {
    try {
      room.disconnect();
    } finally {
      router.push('/');
    }
  };

  // Grid layout depending on participant count
  const gridLayout = useMemo(() => {
    const count = totalParticipantCount;
    if (count <= 1) return 'grid-cols-1 max-w-4xl max-h-[75vh]';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-5xl max-h-[75vh]';
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 max-w-5xl max-h-[80vh]';
    return 'grid-cols-2 lg:grid-cols-3 max-w-6xl max-h-[85vh]';
  }, [totalParticipantCount]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#F2F8FF] font-sans text-[#1B1C17] select-none">
      {/* LiveKit Remote Audio Renderer to play any WebRTC audio streams */}
      <RoomAudioRenderer />

      {/* 30-Minute Meeting Time Expired Notice */}
      {isTimeExpired && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50/95 px-4 py-2 text-xs font-semibold text-red-700 shadow-xl backdrop-blur-md animate-bounce">
          <WarningCircle weight="fill" className="size-4 text-red-600" />
          <span>Meeting time limit of {durationMinutes} minutes has ended. Please wrap up the call.</span>
        </div>
      )}

      {/* ================= 1. CONNECT EC TOP BAR ================= */}
      <header className="relative z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-[#D1E5FF] bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-xs">
        {/* Left: Connect EC Brand & Room Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-bold tracking-tight text-[#1B1C17] sm:text-base">
              {tokenId}
            </span>
          </div>

          <span className="hidden text-neutral-300 sm:inline">|</span>

          {/* Connect EC Live Call Timer (Configured from .env.local) */}
          <div
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold sm:flex transition-all ${
              isTimeExpired
                ? 'border-red-400 bg-red-50 text-red-600 animate-pulse shadow-xs'
                : isTimeExpiring
                  ? 'border-amber-400 bg-amber-50 text-amber-700 animate-pulse'
                  : 'border-[#B2D0F6] bg-[#F2F8FF] text-[#0668E1]'
            }`}
            title={`Meeting time limit: ${durationMinutes} minutes (from .env.local)`}
          >
            <Clock
              className={`size-3.5 ${
                isTimeExpired
                  ? 'text-red-600'
                  : isTimeExpiring
                    ? 'text-amber-600'
                    : 'text-[#0668E1]'
              }`}
            />
            <span>{isTimeExpired ? 'Time Expired (30m)' : `${formattedTimer} left`}</span>
          </div>
        </div>

        {/* Right: Participants Info Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsInfoOpen(!isInfoOpen)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              isInfoOpen
                ? 'bg-[#0668E1] text-white shadow-sm'
                : 'border border-[#DCEBFF] bg-[#F2F8FF] text-[#0668E1] hover:bg-[#E5F0FF]'
            }`}
            title="Toggle Participant List"
          >
            <Info className="size-4" weight={isInfoOpen ? 'fill' : 'bold'} />
            <span className="hidden sm:inline">Participants ({totalParticipantCount})</span>
          </button>
        </div>
      </header>

      {/* ================= 2. CENTER BODY (VIDEO GRID & SLIDE DRAWER) ================= */}
      <div className="relative flex flex-1 overflow-hidden bg-[#F2F8FF]">
        {/* Main Video Grid */}
        <main className="relative flex flex-1 items-center justify-center p-3 sm:p-5 overflow-hidden">
          <div
            className={`grid h-full w-full auto-rows-fr place-items-center gap-3 sm:gap-4 transition-all duration-300 ${gridLayout}`}
          >
            {/* 1. Local participant */}
            <ParticipantTile
              participant={localParticipant}
              localParticipant={localParticipant}
              userEmail={userEmail}
              cameraTracks={cameraTracks}
              getParticipantRole={getParticipantRole}
            />

            {/* 2. AI Transcriber Agent Participant Tile (when connected) */}
            {isAgentConnected && <AiAgentTile isConnected={isAgentConnected} />}

            {/* 3. Remote human participants */}
            {humanRemoteParticipants.map((p) => (
              <ParticipantTile
                key={p.identity}
                participant={p}
                localParticipant={localParticipant}
                userEmail={userEmail}
                cameraTracks={cameraTracks}
                getParticipantRole={getParticipantRole}
              />
            ))}
          </div>
        </main>

        {/* ================= MODULAR PARTICIPANT & JOIN/LEFT MANAGER DRAWER ================= */}
        <ParticipantManager
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
          userEmail={userEmail}
          userRole={userRole}
          activityLogs={activityLogs}
          onClearLogs={() => setActivityLogs([])}
          getParticipantRole={getParticipantRole}
          isAgentConnected={isAgentConnected}
        />
      </div>

      {/* ================= 3. CONNECT EC BOTTOM CONTROL BAR ================= */}
      <footer className="relative z-20 flex h-20 w-full shrink-0 items-center justify-center border-t border-[#D1E5FF] bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {/* Microphone Toggle */}
          <button
            type="button"
            onClick={handleToggleMic}
            className={`flex size-11 cursor-pointer items-center justify-center rounded-full shadow-xs transition-all active:scale-95 sm:size-12 ${
              isMicrophoneEnabled
                ? 'border border-[#B2D0F6] bg-[#F2F8FF] text-[#0668E1] hover:bg-[#E5F0FF]'
                : 'bg-[#EA4335] text-white hover:bg-[#D93025]'
            }`}
            title={isMicrophoneEnabled ? 'Turn off microphone' : 'Turn on microphone'}
          >
            {isMicrophoneEnabled ? (
              <Microphone weight="bold" className="size-5" />
            ) : (
              <MicrophoneSlash weight="fill" className="size-5" />
            )}
          </button>

          {/* Camera Toggle */}
          <button
            type="button"
            onClick={handleToggleCamera}
            className={`flex size-11 cursor-pointer items-center justify-center rounded-full shadow-xs transition-all active:scale-95 sm:size-12 ${
              isCameraEnabled
                ? 'border border-[#B2D0F6] bg-[#F2F8FF] text-[#0668E1] hover:bg-[#E5F0FF]'
                : 'bg-[#EA4335] text-white hover:bg-[#D93025]'
            }`}
            title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraEnabled ? (
              <VideoCamera weight="bold" className="size-5" />
            ) : (
              <VideoCameraSlash weight="fill" className="size-5" />
            )}
          </button>

          {/* Screen Share Toggle */}
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`flex size-11 cursor-pointer items-center justify-center rounded-full shadow-xs transition-all active:scale-95 sm:size-12 ${
              isScreenShareEnabled
                ? 'bg-[#0668E1] text-white shadow-[#0668E1]/25 hover:bg-[#005FCC]'
                : 'border border-[#B2D0F6] bg-[#F2F8FF] text-[#0668E1] hover:bg-[#E5F0FF]'
            }`}
            title={isScreenShareEnabled ? 'Stop presenting' : 'Present screen'}
          >
            <Screencast weight={isScreenShareEnabled ? 'fill' : 'bold'} className="size-5" />
          </button>

          {/* Live Transcript / Subtitles Toggle Button */}
          <button
            type="button"
            onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
            className={`relative flex size-11 cursor-pointer items-center justify-center rounded-full shadow-xs transition-all active:scale-95 sm:size-12 ${
              isTranscriptVisible
                ? 'bg-[#0668E1] text-white shadow-[#0668E1]/25 hover:bg-[#005FCC]'
                : 'border border-[#B2D0F6] bg-[#F2F8FF] text-[#0668E1] hover:bg-[#E5F0FF]'
            }`}
            title={isTranscriptVisible ? 'Hide live transcript box' : 'Show live transcript box'}
          >
            <ChatText weight={isTranscriptVisible ? 'fill' : 'bold'} className="size-5" />
            {transcripts.length > 0 && !isTranscriptVisible && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-xs">
                {transcripts.length > 99 ? '99+' : transcripts.length}
              </span>
            )}
          </button>

       

          {/* Leave Call Button */}
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="ml-1 sm:ml-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#EA4335] px-4 sm:px-6 text-sm font-semibold text-white shadow-md shadow-[#EA4335]/25 transition-all hover:bg-[#D93025] active:scale-95 sm:h-12"
            title="Leave Meeting"
          >
            <PhoneDisconnect weight="fill" className="size-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </footer>

      {/* ================= CENTER SCROLLABLE TRANSCRIPT BOX ================= */}
      {isTranscriptVisible && (
        <div className="absolute bottom-24 left-1/2 z-30 w-[92%] max-w-xl -translate-x-1/2 rounded-2xl border border-[#D1E5FF] bg-white/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 sm:max-w-2xl sm:p-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5EFFF] pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-[#0668E1]/10 text-[#0668E1]">
                <ChatText className="size-4" weight="bold" />
              </div>
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[#1B1C17]">
                <span>Live Transcript</span>
                {transcripts.length > 0 && (
                  <span className="rounded-full bg-[#EBF3FF] px-2 py-0.5 text-[10px] font-semibold text-[#0668E1]">
                    {transcripts.length} {transcripts.length === 1 ? 'line' : 'lines'}
                  </span>
                )}
              </div>
            </div>

            {/* Actions: Download .txt, Collapse, Close */}
            <div className="flex items-center gap-1.5">
              {/* Direct Download Button (.txt only) */}
              <button
                type="button"
                onClick={handleDownloadTranscript}
                disabled={transcripts.length === 0}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0668E1] px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#005FCC] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                title="Download speech transcript as a .txt text file"
              >
                <DownloadSimple className="size-3.5" weight="bold" />
                <span>Download .txt</span>
              </button>

              {/* Minimize/Expand Button */}
              <button
                type="button"
                onClick={() => setIsTranscriptCollapsed(!isTranscriptCollapsed)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
                title={isTranscriptCollapsed ? 'Expand transcript box' : 'Collapse transcript box'}
              >
                {isTranscriptCollapsed ? <CaretUp className="size-3.5" /> : <CaretDown className="size-3.5" />}
              </button>

              {/* Close/Hide Box */}
              <button
                type="button"
                onClick={() => setIsTranscriptVisible(false)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                title="Hide transcript box (can reopen anytime from control bar)"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body: Shows user, text, and divider with complete scroll inside */}
          {!isTranscriptCollapsed && (
            <div
              ref={transcriptScrollRef}
              className="mt-2.5 max-h-52 overflow-y-auto pr-2 scroll-smooth space-y-2.5 sm:max-h-60"
            >
              {transcripts.length === 0 && !interimTranscript && (
                <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-neutral-400">
                  <ChatText className="size-6 text-neutral-300 mb-1" />
                  <span>Waiting for speech... Speak into your mic to see live transcripts.</span>
                </div>
              )}

              {transcripts.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <hr className="border-t border-[#E5EFFF] my-2" />}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0668E1] text-[10px] font-bold text-white shadow-xs">
                          {item.user.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-[#0668E1]">{item.user}</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">{item.time}</span>
                    </div>
                    <p className="pl-6.5 text-xs sm:text-sm text-[#1B1C17] leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </React.Fragment>
              ))}

              {/* Real-time active interim speech indicator */}
              {interimTranscript && (
                <>
                  {transcripts.length > 0 && <hr className="border-t border-[#E5EFFF] my-2" />}
                  <div className="flex flex-col gap-0.5 rounded-lg bg-[#F8FBFF] p-2 border border-[#E5EFFF]">
                    <div className="flex items-center gap-1.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-xs">
                        {interimTranscript.user.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        {interimTranscript.user}
                      </span>
                      <span className="text-[10px] text-emerald-500 font-medium animate-pulse">
                        (speaking...)
                      </span>
                    </div>
                    <p className="pl-6.5 text-xs sm:text-sm text-neutral-700 italic leading-relaxed">
                      {interimTranscript.text}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Subcomponent for individual human participant tile
function ParticipantTile({
  participant,
  localParticipant,
  userEmail,
  cameraTracks,
  getParticipantRole,
}: {
  participant: Participant;
  localParticipant: Participant;
  userEmail: string;
  cameraTracks: any[];
  getParticipantRole: (p: Participant) => string;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const isLocal = participant.identity === localParticipant.identity;
  const displayName = participant.name || participant.identity || (isLocal ? userEmail : 'Participant');
  const role = getParticipantRole(participant);

  // Find camera track
  const camTrack = cameraTracks.find(
    (t) => t.participant.identity === participant.identity && !t.publication.isMuted
  );
  const hasVideo = !!camTrack && participant.isCameraEnabled;
  const isMicMuted = !participant.isMicrophoneEnabled;
  

  const initials =
    displayName
      .split('@')[0]
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .slice(0, 2)
      .toUpperCase() || 'U';

  const avatarColor =
    role === 'Candidate'
      ? 'bg-emerald-600'
      : role === 'Panel'
        ? 'bg-amber-600'
        : 'bg-[#0668E1]';

  const roleIcon =
    role === 'Candidate' ? (
      <GraduationCap weight="bold" className="size-3 text-emerald-300" />
    ) : role === 'Recruiter' ? (
      <Briefcase weight="bold" className="size-3 text-[#B2D0F6]" />
    ) : role === 'Panel' ? (
      <UsersThree weight="bold" className="size-3 text-amber-300" />
    ) : (
      <User weight="bold" className="size-3 text-white" />
    );

  return (
    <div
      className={`group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border bg-neutral-900 shadow-md transition-all ${
        isSpeaking
          ? 'border-[#0668E1] ring-2 ring-[#0668E1] shadow-[0_0_20px_rgba(6,104,225,0.4)]'
          : 'border-[#DCEBFF]'
      }`}
    >
      {/* Video Track or Avatar Fallback */}
      {hasVideo ? (
        <div className="relative h-full w-full overflow-hidden bg-black">
          <VideoTrack
            trackRef={camTrack}
            className={`h-full w-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
          />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-4">
          <div className="relative flex items-center justify-center">
            {/* Speaking Halo Animation */}
            {isSpeaking && (
              <span className="absolute size-24 sm:size-28 animate-ping rounded-full bg-[#0668E1] opacity-35" />
            )}
            <div
              className={`flex size-20 sm:size-24 items-center justify-center rounded-full text-2xl sm:text-3xl font-bold text-white shadow-xl ring-4 ring-white/10 ${avatarColor}`}
            >
              {initials}
            </div>
          </div>
          <span className="mt-3 text-xs font-semibold text-neutral-300">{role}</span>
        </div>
      )}

      {/* Top-left Role Badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-100 backdrop-blur-md">
        {roleIcon}
        <span>{role}</span>
      </div>

      {/* Bottom Tile Bar: Participant Name + Mic Icon */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-6 text-xs text-white">
        <span className="truncate font-semibold drop-shadow-sm flex items-center gap-1.5">
          <span>{displayName}</span>
          {isLocal && <span className="text-neutral-400 font-normal">(You)</span>}
        </span>

        <div
          className={`flex size-6 items-center justify-center rounded-full backdrop-blur-md ${
            isMicMuted ? 'bg-[#EA4335] text-white' : 'bg-black/50 text-emerald-400'
          }`}
          title={isMicMuted ? 'Microphone is off' : 'Microphone is on'}
        >
          {isMicMuted ? (
            <MicrophoneSlash weight="fill" className="size-3.5" />
          ) : (
            <Microphone weight="bold" className="size-3.5" />
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent for AI Transcriber Agent Tile
function AiAgentTile({ isConnected }: { isConnected: boolean }) {
  return (
    <div
      className="group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border bg-neutral-900 shadow-md transition-all border-purple-500 ring-2 ring-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
    >
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-4">
        <div className="relative flex items-center justify-center">
          <div
            className={`flex size-20 sm:size-24 items-center justify-center rounded-full text-white shadow-xl ring-4 ${
              isConnected
                ? 'bg-gradient-to-tr from-[#0668E1] via-indigo-600 to-purple-600 ring-purple-400'
                : 'bg-neutral-800 ring-neutral-700 text-neutral-400'
            }`}
          >
            <Robot weight="bold" className="size-10 text-white" />
          </div>
        </div>

        <span className="mt-3 text-xs font-semibold text-neutral-200">
          Connect Ec AI
        </span>
      </div>

      {/* Top-left Role Badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-950/80 px-2.5 py-0.5 text-[10px] font-semibold text-purple-200 backdrop-blur-md">
        <Robot weight="bold" className="size-3 text-purple-300" />
        <span>AI Agent</span>
      </div>

      {/* Bottom Bar: Name */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-6 text-xs text-white">
        <span className="truncate font-semibold flex items-center gap-1 text-purple-200">
          <Sparkle className="size-3.5 text-purple-400" weight="fill" />
          <span>Connect EC AI Assistant</span>
        </span>
      </div>
    </div>
  );
}

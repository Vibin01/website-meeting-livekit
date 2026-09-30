'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LiveKitRoom } from '@livekit/components-react';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { MeetingRoom } from '@/components/room/meeting-room';
import { WelcomeView } from '@/components/room/welcome-view';

interface RoomClientProps {
  tokenId: string;
}

interface ConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}

export function RoomClient({ tokenId }: RoomClientProps) {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('Candidate');
  const [connDetails, setConnDetails] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-join vs In-Call state
  const [hasJoined, setHasJoined] = useState(false);
  const [initialCameraEnabled, setInitialCameraEnabled] = useState(true);
  const [initialMicEnabled, setInitialMicEnabled] = useState(true);

  useEffect(() => {
    // 1. Retrieve user's mail ID and role from localStorage or cookies
    let email = localStorage.getItem('user_contact');
    let role = localStorage.getItem('user_role') || 'Candidate';

    if (!email && typeof document !== 'undefined') {
      const matchContact = document.cookie.match(/(?:^|;\s*)user_contact=([^;]+)/);
      if (matchContact) email = decodeURIComponent(matchContact[1]);
      const matchRole = document.cookie.match(/(?:^|;\s*)user_role=([^;]+)/);
      if (matchRole) role = decodeURIComponent(matchRole[1]);
    }

    // 2. If user is not logged in, redirect to login with callback URL
    if (!email) {
      router.push(`/login?callbackUrl=/room/${encodeURIComponent(tokenId)}`);
      return;
    }

    setUserEmail(email);
    setUserRole(role);

    let isMounted = true;

    // 3. Create/Fetch token from /api/token with user's mail ID
    async function fetchToken() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const res = await fetch(
          `/api/token?room=${encodeURIComponent(tokenId)}&name=${encodeURIComponent(
            email as string
          )}&role=${encodeURIComponent(role)}`
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch token: HTTP ${res.status}`);
        }

        const data: ConnectionDetails = await res.json();
        if (isMounted) {
          setConnDetails(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error connecting to meeting room';
          setErrorMessage(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchToken();

    return () => {
      isMounted = false;
    };
  }, [tokenId, router]);

  // Handle Join click from Welcome View
  const handleJoinFromWelcome = (choices: { cameraEnabled: boolean; micEnabled: boolean }) => {
    setInitialCameraEnabled(choices.cameraEnabled);
    setInitialMicEnabled(choices.micEnabled);
    setHasJoined(true);
  };

  // Connect EC Styled Loading Screen
  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-b from-[#F2F8FF] via-white to-[#F2F8FF] text-[#1B1C17]">
        <div className="flex flex-col items-center rounded-3xl border border-[#DCEBFF] bg-white p-8 shadow-xl">
          <CircleNotch className="size-12 animate-spin text-[#0668E1]" />
          <h2 className="mt-4 text-base font-bold text-[#1B1C17]">Connecting to Connect EC Meeting...</h2>
          <p className="mt-1 font-mono text-xs text-[#4B5563]">{tokenId}</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !connDetails) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-b from-[#F2F8FF] via-white to-[#F2F8FF] p-6 text-[#1B1C17]">
        <div className="flex max-w-md flex-col items-center rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <WarningCircle weight="fill" className="size-12 text-[#EA4335]" />
          <h2 className="mt-3 text-lg font-bold text-red-600">Connection Failed</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#4B5563]">
            {errorMessage || 'Unable to establish connection to LiveKit meeting.'}
          </p>

          {errorMessage?.includes('environment variables') && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-[11px] text-amber-800 leading-relaxed">
              Please paste your <strong>LIVEKIT_URL</strong>, <strong>LIVEKIT_API_KEY</strong>, and{' '}
              <strong>LIVEKIT_API_SECRET</strong> into the <code>.env.local</code> file in your project root, then restart or refresh.
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-[#DCEBFF] bg-[#F2F8FF] px-4 py-2.5 text-xs font-semibold text-[#0668E1] hover:bg-[#E5F0FF] transition-all"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="rounded-xl bg-[#0668E1] px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#0668E1]/20 hover:bg-[#005FCC] transition-all"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1.  Welcome View (Pre-join Lobby) first with static authenticated inputs & media preview
  if (!hasJoined) {
    return (
      <WelcomeView
        tokenId={tokenId}
        userEmail={userEmail || 'guest@example.com'}
        userRole={userRole}
        onJoin={handleJoinFromWelcome}
      />
    );
  }

  // 2. Connect to LiveKit Room once "Join Meeting" is clicked
  return (
    <LiveKitRoom
      serverUrl={connDetails.serverUrl}
      token={connDetails.participantToken}
      connect={true}
      video={initialCameraEnabled}
      audio={initialMicEnabled}
      onError={(err) => {
        // Log gracefully instead of allowing unhandled throw
        console.warn('[LiveKitRoom] Signal/Connection event:', err?.message || err);
      }}
      onDisconnected={() => {
        console.log('[LiveKitRoom] Disconnected cleanly');
      }}
      className="h-full w-full"
    >
      <MeetingRoom
        tokenId={tokenId}
        userEmail={userEmail || 'guest@example.com'}
        userRole={userRole}
        initialCameraEnabled={initialCameraEnabled}
        initialMicEnabled={initialMicEnabled}
      />
    </LiveKitRoom>
  );
}

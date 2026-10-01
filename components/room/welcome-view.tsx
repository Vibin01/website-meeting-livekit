'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Microphone,
  MicrophoneSlash,
  ShieldCheck,
  Sparkle,
  VideoCamera,
  VideoCameraSlash,
} from '@phosphor-icons/react';
import type { RoomInfo } from '@/app/actions/auth';

interface WelcomeViewProps {
  tokenId: string;
  userEmail: string;
  userRole: string;
  onJoin: (choices: { cameraEnabled: boolean; micEnabled: boolean }) => void;
  roomInfo?: RoomInfo | null;
  onBack?: () => void;
}

export function WelcomeView({ tokenId, userEmail, userRole, onJoin, roomInfo, onBack }: WelcomeViewProps) {
  // Local media preview state
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Request camera stream for pre-join preview
  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (!cameraEnabled) {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Camera preview not accessible:', err);
        setCameraEnabled(false);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraEnabled]);

  // Handle Join click
  const handleJoinClick = () => {
    // Stop local preview tracks so LiveKit can take over hardware cleanly
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    onJoin({
      cameraEnabled,
      micEnabled,
    });
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const initials = userEmail
    .split('@')[0]
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-[#F2F8FF] via-white to-[#F2F8FF] p-4 text-neutral-900 sm:p-8 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 dark:text-neutral-100">
      <div className="w-full max-w-4xl rounded-3xl border border-[#DCEBFF] bg-white p-6 shadow-xl transition-all sm:p-10 dark:border-neutral-800 dark:bg-neutral-900">
        {/* Top Header */}
        <div className="flex flex-col justify-between gap-3 border-b border-[#D1E5FF] pb-5 sm:flex-row sm:items-center dark:border-neutral-800">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to code entry"
                className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-600 transition-all hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {roomInfo?.room_name || 'Meeting Lobby'}
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                 Preview your audio & video before entering the room
              </p>
            </div>
          </div>

          {/* Authenticated user badge */}
          <div className="flex items-center gap-2 rounded-full border border-[#DCEBFF] bg-[#F2F8FF] px-3.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{userEmail}</span>
            <span className="rounded-full bg-[#0668E1] px-2 py-0.5 text-[10px] font-semibold text-white">
              {userRole}
            </span>
          </div>
        </div>

        {/* Content: Camera Preview (Left)  Authenticated Details (Right) */}
        <div className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* Left: Camera Preview */}
          <div className="flex flex-col items-center lg:col-span-7">
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-md">
              {cameraEnabled ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                  <div className="mb-3 flex size-20 items-center justify-center rounded-full bg-[#0668E1] text-2xl font-bold text-white shadow-lg ring-4 ring-white/10">
                    {initials}
                  </div>
                  <p className="text-sm font-medium text-neutral-300">Camera is off</p>
                  
                </div>
              )}

              {/* Bottom Quick Toggles over preview */}
              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setMicEnabled(!micEnabled)}
                  title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  className={`flex size-11 cursor-pointer items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
                    micEnabled
                      ? 'border border-white/20 bg-neutral-800 text-white hover:bg-neutral-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {micEnabled ? (
                    <Microphone weight="bold" className="size-5" />
                  ) : (
                    <MicrophoneSlash weight="fill" className="size-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setCameraEnabled(!cameraEnabled)}
                  title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                  className={`flex size-11 cursor-pointer items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
                    cameraEnabled
                      ? 'border border-white/20 bg-neutral-800 text-white hover:bg-neutral-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {cameraEnabled ? (
                    <VideoCamera weight="bold" className="size-5" />
                  ) : (
                    <VideoCameraSlash weight="fill" className="size-5" />
                  )}
                </button>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-neutral-500">
              Check your mic and camera before joining
            </p>
          </div>

          {/* Right: Authenticated Inputs & Join Button */}
          <div className="flex flex-col space-y-4 lg:col-span-5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Ready to join?
              </h2>
              
            </div>

            {/* Field 1: Email ID */}
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-semibold tracking-wider text-neutral-600 uppercase dark:text-neutral-400">
                <span>Email ID</span>
               
              </label>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-100/80 px-3.5 py-2.5 text-sm font-medium text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200">
                <span className="truncate">{userEmail}</span>
                
              </div>
            </div>

            {/*  Field 2: Role */}
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-semibold tracking-wider text-neutral-600 uppercase dark:text-neutral-400">
                <span>Your Role</span>
                
              </label>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-100/80 px-3.5 py-2.5 text-sm font-medium text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200">
                <span>{userRole}</span>
                
              </div>
            </div>

            {/* Field 3: Room Code / Token ID */}
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-semibold tracking-wider text-neutral-600 uppercase dark:text-neutral-400">
                <span>Room Code</span>
                
              </label>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-100/80 px-3.5 py-2.5 font-mono text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200">
                <span>{roomInfo?.room_code || tokenId}</span>
                <span className="text-[11px] font-sans font-medium text-emerald-600 dark:text-emerald-400">
                  Verified
                </span>
              </div>
            </div>

            {/* Join Action Button */}
            <div className="pt-2">
              <button
                type="button"
                id="join-meeting-btn"
                onClick={handleJoinClick}
                className="w-full cursor-pointer rounded-xl bg-[#0668E1] py-3.5 text-base font-semibold text-white shadow-lg shadow-[#0668E1]/25 transition-all hover:bg-[#005FCC] active:scale-[0.98]"
              >
                Join Meeting
              </button>
            </div>
            {/* Copy Meeting Link */}

            {(userRole.toLowerCase() === 'panel' || userRole.toLowerCase() === 'recruiter') && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex cursor-pointer items-center justify-center gap-2 py-1 text-xs font-medium text-[#0668E1] hover:underline"
            >
              {copiedLink ? (
                <>
                  <span className="font-semibold text-emerald-600">Meeting Link Copied!</span>
                </>
              ) : (
                <>
                  <span>Copy shareable meeting link</span>
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

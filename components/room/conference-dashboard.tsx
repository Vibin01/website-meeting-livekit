'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LiveKitRoom } from '@livekit/components-react';
import {
  ArrowRight,
  CalendarCheck,
  CaretDown,
  CircleNotch,
  Key,
  ShieldCheck,
  SignOut,
  Sparkle,
  User,
  VideoCamera,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  verifyMeetingCode,
  getScheduledMeeting,
  logout,
  type RoomInfo,
  type VerifyCodeResult,
} from '@/app/actions/auth';
import { WelcomeView } from '@/components/room/welcome-view';
import { MeetingRoom } from '@/components/room/meeting-room';

interface ScheduledMeetingDetails {
  room_code: string;
  room_name?: string;
  context_type?: string;
  starts_at?: string;
  expires_at?: string;
  meeting_phase_type?: string;
}

export function ConferenceDashboard() {
  const router = useRouter();

  // User state
  const [userEmail, setUserEmail] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('Candidate');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Meeting code & verification state
  const [meetingCode, setMeetingCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verified meeting session
  const [verifiedSession, setVerifiedSession] = useState<{
    room_access_token: string;
    room_info: RoomInfo;
  } | null>(null);

  // Scheduled meeting preview (from GET /api/meeting/schedule?context_type=job_application)
  const [scheduledMeeting, setScheduledMeeting] = useState<ScheduledMeetingDetails | null>(null);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);

  // In-call state
  const [hasJoinedCall, setHasJoinedCall] = useState(false);
  const [initialCameraEnabled, setInitialCameraEnabled] = useState(true);
  const [initialMicEnabled, setInitialMicEnabled] = useState(true);

  // 1. Initialize user from cookies or localStorage
  useEffect(() => {
    let email = '';
    let role = 'Candidate';

    if (typeof window !== 'undefined') {
      email = localStorage.getItem('user_contact') || '';
      role = localStorage.getItem('user_role') || 'Candidate';

      if (!email && typeof document !== 'undefined') {
        const matchContact = document.cookie.match(/(?:^|;\s*)user_contact=([^;]+)/);
        if (matchContact) email = decodeURIComponent(matchContact[1]);
        const matchRole = document.cookie.match(/(?:^|;\s*)user_role=([^;]+)/);
        if (matchRole) role = decodeURIComponent(matchRole[1]);
      }
    }

    if (!email) {
      router.push('/login');
      return;
    }

    setUserEmail(email);
    setUserRole(role);

    // Fetch scheduled meeting if any
    async function loadScheduled() {
      try {
        setIsLoadingScheduled(true);
        const res = await getScheduledMeeting('job_application');
        if (res?.status === 'success' && res?.data?.meeting_details) {
          setScheduledMeeting(res.data.meeting_details);
        }
      } catch (err) {
        console.warn('Could not load scheduled meetings:', err);
      } finally {
        setIsLoadingScheduled(false);
      }
    }

    loadScheduled();
  }, [router]);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. Handle Verification via Elixir API
  const handleVerifyAndJoin = async (codeToVerify?: string) => {
    const targetCode = (codeToVerify || meetingCode).trim();
    if (!targetCode) {
      setErrorMessage('Please enter a valid meeting code or link.');
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);

    try {
      const result: VerifyCodeResult = await verifyMeetingCode(targetCode);

      if (result.success && result.data) {
        setVerifiedSession({
          room_access_token: result.data.room_access_token,
          room_info: result.data.room_info,
        });
      } else {
        setErrorMessage(result.message || 'The meeting code has expired or is invalid.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error verifying meeting code.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 3. Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user_contact');
        localStorage.removeItem('user_role');
        document.cookie = 'user_contact=; path=/; max-age=0';
        document.cookie = 'user_role=; path=/; max-age=0';
        document.cookie = '_connect_ec_backend_key=; path=/; max-age=0';
      }
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  // 4. Handle Join from Welcome View
  const handleJoinFromWelcome = (choices: { cameraEnabled: boolean; micEnabled: boolean }) => {
    setInitialCameraEnabled(choices.cameraEnabled);
    setInitialMicEnabled(choices.micEnabled);
    setHasJoinedCall(true);
  };

  const initials =
    userEmail
      .split('@')[0]
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .slice(0, 2)
      .toUpperCase() || 'U';

  const livekitServerUrl =
    process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://testing-l62y21m7.livekit.cloud';

  // STAGE 4: Connected in LiveKit Room
  if (hasJoinedCall && verifiedSession) {
    return (
      <LiveKitRoom
        serverUrl={livekitServerUrl}
        token={verifiedSession.room_access_token}
        connect={true}
        video={initialCameraEnabled}
        audio={initialMicEnabled}
        data-lk-theme="default"
        className="h-screen w-screen overflow-hidden bg-[#1B1C17]"
        onDisconnected={() => {
          setHasJoinedCall(false);
          setVerifiedSession(null);
        }}
      >
        <MeetingRoom
          tokenId={verifiedSession.room_info.room_code}
          userEmail={userEmail}
          userRole={userRole}
          initialCameraEnabled={initialCameraEnabled}
          initialMicEnabled={initialMicEnabled}
        />
      </LiveKitRoom>
    );
  }

  // STAGE 3: Welcome View (Pre-join lobby after code is verified)
  if (verifiedSession && !hasJoinedCall) {
    return (
      <WelcomeView
        tokenId={verifiedSession.room_info.room_code}
        userEmail={userEmail}
        userRole={userRole}
        roomInfo={verifiedSession.room_info}
        onJoin={handleJoinFromWelcome}
        onBack={() => setVerifiedSession(null)}
      />
    );
  }

  // STAGE 2: ConnectEC Meet Conference Dashboard (Matches User Architecture Diagram)
  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-[#F4F9FF] via-white to-[#F2F8FF] text-neutral-900 select-none dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 dark:text-neutral-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-[#D8E9FF]/80 bg-white/80 px-6 backdrop-blur-md sm:px-12 dark:border-neutral-800 dark:bg-neutral-900/80">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0668E1] to-[#0052B3] text-white shadow-md shadow-[#0668E1]/20">
            <VideoCamera weight="fill" className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#0668E1] sm:text-xl dark:text-[#3B82F6]">
              CONNECTEC MEET
            </h1>
            <p className="text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
              Meet Conference App
            </p>
          </div>
        </div>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            id="user-profile-avatar-btn"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
            aria-label="User Profile"
            className="flex cursor-pointer items-center gap-2.5 rounded-full border border-[#DCEBFF] bg-[#F2F8FF] p-1.5 pr-3 shadow-sm transition-all hover:bg-[#E5F0FF] active:scale-95 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-[#0668E1] text-xs font-bold text-white shadow">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[120px] truncate text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {userEmail ? userEmail.split('@')[0] : 'User'}
              </p>
              <p className="text-[10px] font-medium text-neutral-500 capitalize dark:text-neutral-400">
                {userRole}
              </p>
            </div>
            <CaretDown className="size-3.5 text-neutral-400" />
          </button>

          {/* User Profile Dropdown Box (As in User Diagram) */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-[#DCEBFF] bg-white p-4 shadow-2xl transition-all animate-in fade-in-50 zoom-in-95 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0668E1] text-sm font-bold text-white shadow-md">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">
                    {userEmail || 'John Doe'}
                  </p>
                  <span className="inline-block mt-0.5 rounded-md bg-[#0668E1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0668E1] capitalize dark:bg-[#0668E1]/20 dark:text-[#3B82F6]">
                    {userRole}
                  </span>
                </div>
              </div>

              <div className="py-2 text-xs text-neutral-500 dark:text-neutral-400">
                <p className="truncate">Contact: {userEmail}</p>
                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ● Authenticated with Connect EC
                </p>
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  id="logout-btn"
                  onClick={handleLogout}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/80 py-2.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 active:scale-[0.99] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
                >
                  <SignOut className="size-4" />
                  <span>LOGOUT</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-2xl text-center">
          {/* Hero Title */}
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#DCEBFF] bg-[#F2F8FF] px-4 py-1.5 text-xs font-semibold text-[#0668E1] shadow-sm dark:border-neutral-800 dark:bg-neutral-800 dark:text-[#3B82F6]">
              <Sparkle weight="fill" className="size-3.5 text-amber-500" />
              <span>ConnectEC Meeting Verification</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
              Connect to your conference room
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
              Enter your meeting code or invitation link to verify access and enter the meeting lobby.
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-600 shadow-sm dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              <WarningCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="font-semibold">Access Not Allowed</p>
                <p className="text-xs leading-relaxed text-red-700/90 dark:text-red-300">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* THE CENTERPIECE: Enter Code or Link + JOIN (Matches User Diagram) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyAndJoin();
            }}
            className="group relative mx-auto flex w-full max-w-xl items-center rounded-2xl border-2 border-[#BCD8FF] bg-white p-2 shadow-xl shadow-[#0668E1]/10 transition-all focus-within:border-[#0668E1] focus-within:ring-4 focus-within:ring-[#0668E1]/15 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-none"
          >
            <div className="flex items-center pl-3 text-neutral-400 group-focus-within:text-[#0668E1]">
              <Key weight="bold" className="size-5" />
            </div>

            <input
              type="text"
              id="meeting-code-input"
              value={meetingCode}
              onChange={(e) => {
                setMeetingCode(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter the code or link"
              className="flex-1 bg-transparent px-3 py-2 text-base font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white"
            />

            <button
              type="submit"
              id="join-code-btn"
              disabled={isVerifying || !meetingCode.trim()}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0668E1] px-7 py-3 text-sm font-bold tracking-wide text-white shadow-md shadow-[#0668E1]/25 transition-all hover:bg-[#005FCC] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  <span>VERIFYING...</span>
                </>
              ) : (
                <span>JOIN</span>
              )}
            </button>
          </form>

          {/* Scheduled Meeting Helper (if backend has scheduled meeting) */}
          {scheduledMeeting && (
            <div className="mt-8 mx-auto max-w-xl rounded-2xl border border-[#DCEBFF] bg-white/90 p-4 text-left shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#F2F8FF] text-[#0668E1] dark:bg-neutral-800 dark:text-[#3B82F6]">
                    <CalendarCheck className="size-5" weight="bold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {scheduledMeeting.room_name || 'Scheduled Meeting'}
                    </h3>
                    <p className="font-mono text-xs text-neutral-500">
                      Code: <span className="font-bold text-[#0668E1]">{scheduledMeeting.room_code}</span>
                      {scheduledMeeting.meeting_phase_type && (
                        <span> • {scheduledMeeting.meeting_phase_type}</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMeetingCode(scheduledMeeting.room_code);
                    handleVerifyAndJoin(scheduledMeeting.room_code);
                  }}
                  disabled={isVerifying}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0668E1] bg-[#F2F8FF] px-4 py-2 text-xs font-bold text-[#0668E1] transition-all hover:bg-[#0668E1] hover:text-white dark:bg-neutral-800 dark:text-[#3B82F6] dark:hover:bg-[#0668E1] dark:hover:text-white"
                >
                  <span>Quick Join</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick instructions / tips */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-[#0668E1]" weight="bold" />
              Verified via ConnectEC Elixir API
            </span>
            <span>•</span>
            <span>AI Real-time Transcription Supported</span>
            <span>•</span>
            <span>30-minute Timer Active</span>
          </div>
        </div>
      </main>
    </div>
  );
}

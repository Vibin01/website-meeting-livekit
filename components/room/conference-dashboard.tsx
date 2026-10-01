'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  CalendarBlank,
  CaretDown,
  Clock,
  Key,
  SignOut,
  VideoCamera,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import {
  getScheduledMeeting,
  logout,
} from '@/app/actions/auth';

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

  // Meeting code & scheduled meeting state
  const [meetingCode, setMeetingCode] = useState('');
  const [scheduledMeeting, setScheduledMeeting] = useState<ScheduledMeetingDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guard to ensure scheduled meeting API is only called once
  const hasLoadedScheduledRef = useRef(false);

  // Testing Fetch All data
  interface Meeting { room_code: string; expired: boolean; }

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); useEffect(() => { const fetchMeetings = async () => { try { setLoading(true); setError(''); const response = await fetch('/api/meeting/list-all', { method: 'GET', credentials: 'include', cache: 'no-store', }); const result = await response.json(); console.log('Meetings API response:', result); if (!response.ok) { throw new Error(result.message || 'Failed to fetch meetings'); } setMeetings(result.data || []); } catch (error) { console.error('Failed to load meetings:', error); setError(error instanceof Error ? error.message : 'Failed to load meetings'); } finally { setLoading(false); } }; fetchMeetings(); }, []);


  // 1. Initialize user from localStorage & load scheduled meeting
  useEffect(() => {
    let email = '';
    let role = 'Candidate';

    if (typeof window !== 'undefined') {
      email = localStorage.getItem('user_contact') || '';
      role = localStorage.getItem('user_role') || 'Candidate';
    }

    if (!email) {
      router.push('/login');
      return;
    }

    setUserEmail(email);
    setUserRole(role);

    if (hasLoadedScheduledRef.current) return;
    hasLoadedScheduledRef.current = true;

    async function loadScheduled() {
      try {

        const res = await getScheduledMeeting('job_application');
        console.log('Scheduled meeting response:', res);

        if (res?.status === 'fail') {
          if (res?.message?.toLowerCase().includes('unauthorized')) {
            router.push('/login');
          }
          return;
        }

        if (res?.status === 'success' && res?.data?.meeting_details) {
          const details: ScheduledMeetingDetails = res.data.meeting_details;
          setScheduledMeeting(details);
          if (details.room_code) {
            setMeetingCode(details.room_code);
          }
        }
      } catch (err) {
        console.warn('Could not load scheduled meetings:', err);
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

  // 2. Handle Routing to /room/[token_id]
  const handleJoin = (codeToJoin?: string) => {
    let code = (codeToJoin || meetingCode || '').trim();
    if (!code) {
      setErrorMessage('Please enter a valid meeting code or link.');
      return;
    }

    // If user pasted a full URL like https://meet.mydomain.app/klq-yyt-qgq or /room/klq-yyt-qgq
    if (code.includes('/')) {
      const parts = code.split('/').filter(Boolean);
      code = parts[parts.length - 1] || code;
    }
    // Clean query parameters and hashes
    code = code.split('?')[0].split('#')[0].trim();

    if (!code) {
      setErrorMessage('Please enter a valid meeting code.');
      return;
    }

    setErrorMessage(null);
    // Route to /room/[token_id] which displays WelcomeView
    router.push(`/room/${encodeURIComponent(code)}`);
  };

  // 3. Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user_contact');
        localStorage.removeItem('user_role');
        document.cookie = '_connect_ec_backend_key=; path=/; max-age=0';
      }
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  const initials =
    userEmail
      .split('@')[0]
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .slice(0, 2)
      .toUpperCase() || 'U';



  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-[#F4F9FF] via-white to-[#F2F8FF] text-neutral-900 select-none dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 dark:text-neutral-100">
      {/* Fixed Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-20 w-full items-center justify-between border-b border-[#D8E9FF]/80 bg-white/85 px-6 backdrop-blur-md sm:px-12 dark:border-neutral-800 dark:bg-neutral-900/85">
        {/* Left Side: Connect EC Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center transition-opacity hover:opacity-90">
            <Image
              src="/connect_ec_logo.svg"
              alt="Connect EC Logo"
              width={190}
              height={38}
              priority
              className="h-9 w-auto object-contain dark:brightness-0 dark:invert"
            />
          </Link>
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

          {/* User Profile Dropdown Box */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-[#DCEBFF] bg-white p-4 shadow-2xl transition-all animate-in fade-in-50 zoom-in-95 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0668E1] text-sm font-bold text-white shadow-md">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">
                    {userEmail || 'User'}
                  </p>
                  <span className="inline-block mt-0.5 rounded-md bg-[#0668E1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0668E1] capitalize dark:bg-[#0668E1]/20 dark:text-[#3B82F6]">
                    {userRole}
                  </span>
                </div>
              </div>

              <div className="py-2 text-xs text-neutral-500 dark:text-neutral-400">
                <p className="truncate">Contact: {userEmail}</p>
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
      <main className="flex flex-1 flex-col items-center justify-start px-4 pt-28 pb-12 sm:px-6">
        <div className="w-full max-w-2xl text-center">
          {/* Hero Title */}
          <div className="mb-8">
            <p className="text-[30px] font-bold text-neutral-900 dark:text-white">ConnectEC Meeting</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
              Enter your meeting code or paste your invite link to join
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-600 shadow-sm dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              <WarningCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="font-semibold">Notice</p>
                <p className="text-xs leading-relaxed text-red-700/90 dark:text-red-300">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* THE CENTERPIECE: Enter Code or Link + JOIN */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
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

            {meetingCode && (
              <button
                type="button"
                onClick={() => {
                  setMeetingCode('');
                  if (errorMessage) setErrorMessage(null);
                }}
                className="mr-2 flex size-6 cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                title="Clear code"
              >
                <X className="size-3.5" weight="bold" />
              </button>
            )}

            <button
              type="submit"
              id="join-code-btn"
              disabled={!meetingCode.trim()}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0668E1] px-7 py-3 text-sm font-bold tracking-wide text-white shadow-md shadow-[#0668E1]/25 transition-all hover:bg-[#005FCC] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>JOIN</span>
            </button>
          </form>

          <div className="mt-8 rounded-2xl border border-[#DCEBFF] bg-white p-6 text-left shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Meetings</h2>
              {!loading && meetings.length > 0 && (
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {meetings.filter((m) => !m.expired).length} Active • Total: {meetings.length}
                </span>
              )}
            </div>

            {/* Loading */}
            {loading && <p className="py-6 text-center text-sm text-neutral-500">Loading meetings...</p>}

            {/* Error */}
            {!loading && error && <p className="py-4 text-center text-sm text-red-500">{error}</p>}

            {/* No meetings */}
            {!loading && !error && meetings.length === 0 && (
              <p className="py-6 text-center text-sm text-neutral-500">No meetings found.</p>
            )}

            {/* Meeting list - Active sorted to top */}
            {!loading && !error && meetings.length > 0 && (
              <div className="max-h-96 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                {[...meetings]
                  .sort((a, b) => (a.expired === b.expired ? 0 : a.expired ? 1 : -1))
                  .map((meeting, index) => (
                    <div
                      key={`${meeting.room_code}-${index}`}
                      onClick={() => {
                        setMeetingCode(meeting.room_code);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      className="flex cursor-pointer items-center justify-between border-b border-neutral-100 p-4 transition-colors hover:bg-[#F2F8FF]/70 last:border-b-0 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
                      title="Click to select room code"
                    >
                      <div>
                        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Room Code</p>
                        <p className="font-mono text-base font-bold text-neutral-900 dark:text-white">
                          {meeting.room_code}
                        </p>
                      </div>
                      <div>
                        {meeting.expired ? (
                          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700">
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

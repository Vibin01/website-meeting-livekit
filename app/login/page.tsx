'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { CircleNotch, Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
import { type UserType, login } from '@/app/actions/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get('callbackUrl') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('Recruiter');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prefill saved email or role if available, and clear legacy cookies
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('user_contact');
      const savedRole = localStorage.getItem('user_role') as UserType | null;
      if (savedEmail) setEmail(savedEmail);
      if (savedRole) setUserType(savedRole);

    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {

      // Authenticate with server action (auth.ts is untouched)
      const result = await login({
        contact: email.trim(),
        password,
        user_type: userType,
      });

      if (result.success) {
        // Save user email & role to localStorage for seamless room join
        if (typeof document !== 'undefined') {

          localStorage.setItem('user_contact', email.trim());
          localStorage.setItem('user_role', userType);
        }

        if (callbackUrl && callbackUrl.startsWith('/room/')) {
          router.push(callbackUrl);
        } else {
          router.push('/');
        }
      } else {
        setErrorMessage(result.error || 'Login failed. Please verify your credentials.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] rounded-2xl border border-[#DCEBFF]/90 bg-white p-8 shadow-xl transition-all sm:p-10 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-[#0668E1] sm:text-3xl">Login</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Login
        </p>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
          <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-red-500" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Email ID
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="name@company.com"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:border-[#0668E1] focus:ring-2 focus:ring-[#0668E1]/20 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="••••••••"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:border-[#0668E1] focus:ring-2 focus:ring-[#0668E1]/20 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <button
              type="button"
              id="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              {showPassword ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* User Type Selection */}
        <div>
          <label
            htmlFor="login-user-type"
            className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            User Type / Role
          </label>
          <div className="relative">
            <select
              id="login-user-type"
              value={userType}
              onChange={(e) => {
                setUserType(e.target.value as UserType);
                setErrorMessage(null);
              }}
              className="w-full cursor-pointer appearance-none rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-medium text-neutral-900 transition-all focus:border-[#0668E1] focus:ring-2 focus:ring-[#0668E1]/20 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <option value="Candidate">Candidate</option>
              <option value="Recruiter">Recruiter</option>
              <option value="Panel">Panel</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-neutral-400">
              <ChevronDown className="size-4" />
            </div>
          </div>
        </div>

        {/* Room / Token ID Input */}
        {/* <div>
          <label
            htmlFor="login-room-id"
            className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Room Name / Token ID
          </label>
          <input
            id="login-room-id"
            type="text"
            required
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="interview-meeting-room"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:border-[#0668E1] focus:ring-2 focus:ring-[#0668E1]/20 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            All participants with this room ID will join together
          </p>
        </div> */}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            id="login-submit-btn"
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0668E1] py-3 text-base font-semibold text-white shadow-md shadow-[#0668E1]/20 transition-all hover:bg-[#005FCC] active:scale-[0.99] disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <CircleNotch className="size-5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <span>Join Room</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-screen flex flex-col bg-gradient-to-br from-[#F2F8FF] via-white to-[#F2F8FF] dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      {/* Fixed Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-20 w-full items-center justify-between border-b border-[#D8E9FF]/80 bg-white/85 px-6 backdrop-blur-md sm:px-12 dark:border-neutral-800 dark:bg-neutral-900/85">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-90">
          <Image
            src="/Connect_EC_Logo.svg"
            alt="Connect EC Logo"
            width={190}
            height={38}
            priority
            className="h-9 w-auto object-contain dark:brightness-0 dark:invert"
          />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 pt-24">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-[#0668E1]">
              <CircleNotch className="size-5 animate-spin" />
              <span>Loading...</span>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}

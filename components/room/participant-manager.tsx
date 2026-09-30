'use client';

import React, { useState } from 'react';
import { Participant } from 'livekit-client';
import {
  useLocalParticipant,
  useRemoteParticipants,
  
} from '@livekit/components-react';
import {
  Clock,
  Copy,
  Check,
  Microphone,
  MicrophoneSlash,
  Robot,
  SignIn,
  SignOut,
  Trash,
  Users,
  VideoCamera,
  VideoCameraSlash,
  X,
} from '@phosphor-icons/react';

/**
 * Interface representing a single Join or Leave event.
 * Each time someone enters or exits the meeting, an object of this type is created.
 */
export interface ActivityLog {
  id: string;
  email: string;
  role: string;
  action: 'joined' | 'left';
  time: string;
}

interface ParticipantManagerProps {
  /** Whether the sidebar/drawer is visible */
  isOpen: boolean;
  /** Function to close the sidebar */
  onClose: () => void;
  /** Current logged-in user's email */
  userEmail: string;
  /** Current logged-in user's role (Recruiter, Candidate, Panel) */
  userRole: string;
  /** List of join/leave events stored in React state */
  activityLogs: ActivityLog[];
  /** Optional function to clear the activity logs */
  onClearLogs?: () => void;
  /** Helper function to get role string for any participant */
  getParticipantRole: (p: Participant) => string;
  /** Whether the AI transcriber agent is connected to the room */
  isAgentConnected?: boolean;
}

/**
 * ParticipantManager Component
 * 
 * Responsibilities:
 * 1. Shows who is currently active in the room (Local user, AI Agent, Remote users).
 * 2. Shows real-time mic and camera states for each participant.
 * 3. Shows the complete chronological history of who JOINED and who LEFT with exact timestamps.
 * 4. Allows copying or clearing activity history.
 */
export function ParticipantManager({
  isOpen,
  onClose,
  userEmail,
  userRole,
  activityLogs,
  onClearLogs,
  getParticipantRole,
  isAgentConnected = false,
}: ParticipantManagerProps) {
  // Active tab: 'active' shows current participants; 'history' shows who joined/left
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [copiedHistory, setCopiedHistory] = useState(false);

  // LiveKit hooks to get currently connected participants
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // Filter out background agent workers from human list
  const humanRemoteParticipants = remoteParticipants.filter(
    (p) => !p.isAgent && !p.identity.toLowerCase().startsWith('agent-')
  );

  // Total count includes: local user + remote human participants + AI agent if connected
  const totalCount = 1 + humanRemoteParticipants.length + (isAgentConnected ? 1 : 0);

  if (!isOpen) return null;


  return (
    <aside className="relative z-30 flex h-full w-80 shrink-0 flex-col border-l border-[#D1E5FF] bg-white text-[#1B1C17] shadow-2xl duration-200 animate-in slide-in-from-right sm:w-96 select-none">
      {/* 1. Header */}
      <div className="flex items-center justify-between border-b border-[#D1E5FF] p-4 pb-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[#0668E1]" weight="bold" />
          <h3 className="text-base font-bold text-[#1B1C17]">
            Participants & Activity
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:bg-[#F2F8FF] hover:text-[#1B1C17] transition-colors"
          title="Close drawer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 2. Navigation Tabs: Active In Call vs Join/Leave History */}
      <div className="flex border-b border-[#D1E5FF] bg-[#F2F8FF]/60 p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-white text-[#0668E1] shadow-xs border border-[#DCEBFF]'
              : 'text-[#4B5563] hover:text-[#1B1C17] hover:bg-white/50'
          }`}
        >
          <Users className="size-3.5" weight={activeTab === 'active' ? 'bold' : 'regular'} />
          <span>In Call ({totalCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white text-[#0668E1] shadow-xs border border-[#DCEBFF]'
              : 'text-[#4B5563] hover:text-[#1B1C17] hover:bg-white/50'
          }`}
        >
          <Clock className="size-3.5" weight={activeTab === 'history' ? 'bold' : 'regular'} />
          <span>Join / Left ({activityLogs.length})</span>
        </button>
      </div>

      {/* 3. Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* ================= TAB 1: CURRENTLY IN CALL ================= */}
        {activeTab === 'active' && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold tracking-wider text-[#4B5563] uppercase">
              Connected Members ({totalCount})
            </div>

            {/* A. Local Participant (You) */}
            <div className="flex items-center justify-between rounded-xl border border-[#DCEBFF] bg-white p-2.5 shadow-2xs transition-colors hover:bg-[#F8FBFF]">
              <div className="flex items-center gap-2.5 truncate">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0668E1] text-xs font-bold text-white shadow-xs">
                  {userEmail.slice(0, 2).toUpperCase()}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#1B1C17]">
                    <span className="truncate">{userEmail}</span>
                    <span className="text-[10px] text-[#6B7280] font-normal">(You)</span>
                  </div>
                  <span className="inline-block mt-0.5 rounded-full border border-[#B2D0F6] bg-[#F2F8FF] px-2 py-0 text-[10px] font-semibold text-[#0668E1]">
                    {userRole}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isMicrophoneEnabled ? (
                  <Microphone className="size-4 text-emerald-500" />
                ) : (
                  <MicrophoneSlash className="size-4 text-red-500" />
                )}
                {isCameraEnabled ? (
                  <VideoCamera className="size-4 text-[#0668E1]" />
                ) : (
                  <VideoCameraSlash className="size-4 text-neutral-400" />
                )}
              </div>
            </div>

            {/* B. AI Transcriber Agent Card */}
            {isAgentConnected && (
              <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/60 p-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#0668E1] to-purple-600 text-xs font-bold text-white shadow-xs">
                    <Robot className="size-5 text-white" weight="bold" />
                  </div>
                  <div className="truncate">
                    <span className="truncate text-xs font-semibold text-[#1B1C17] block">
                      Connect EC AI Assistant
                    </span>
                    <span className="inline-block mt-0.5 rounded-full border border-purple-300 bg-purple-100 px-2 py-0 text-[10px] font-semibold text-purple-700">
                      AI Agent
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Listening</span>
                </div>
              </div>
            )}

            {/* C. Remote Human Participants */}
            {humanRemoteParticipants.map((p) => {
              const displayName = p.name || p.identity || 'Participant';
              const role = getParticipantRole(p);
              const isMicMuted = !p.isMicrophoneEnabled;
              const isCamMuted = !p.isCameraEnabled;

              const roleBadgeStyle =
                role === 'Candidate'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : role === 'Panel'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-[#B2D0F6] bg-[#F2F8FF] text-[#0668E1]';

              return (
                <div
                  key={p.identity}
                  className="flex items-center justify-between rounded-xl border border-[#DCEBFF] bg-white p-2.5 shadow-2xs transition-colors hover:bg-[#F8FBFF]"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0668E1] text-xs font-bold text-white shadow-xs">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="truncate text-xs font-semibold text-[#1B1C17] block">
                        {displayName}
                      </span>
                      <span
                        className={`inline-block mt-0.5 rounded-full border px-2 py-0 text-[10px] font-semibold ${roleBadgeStyle}`}
                      >
                        {role}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isMicMuted ? (
                      <MicrophoneSlash className="size-4 text-red-500" />
                    ) : (
                      <Microphone className="size-4 text-emerald-500" />
                    )}
                    {isCamMuted ? (
                      <VideoCameraSlash className="size-4 text-neutral-400" />
                    ) : (
                      <VideoCamera className="size-4 text-[#0668E1]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= TAB 2: JOIN / LEFT ACTIVITY HISTORY ================= */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {/* Header info with Action buttons */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-[#4B5563] uppercase">
                Activity Timeline ({activityLogs.length})
              </span>
              
            </div>

            {/* List of activity cards (latest first) */}
            <div className="space-y-2">
              {activityLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D1E5FF] p-6 text-center text-xs text-[#6B7280]">
                  No join or leave events recorded yet.
                </div>
              ) : (
                [...activityLogs].reverse().map((log) => {
                  const isJoin = log.action === 'joined';
                  return (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between rounded-xl border p-2.5 transition-all ${
                        isJoin
                          ? 'border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50'
                          : 'border-red-100 bg-red-50/40 hover:bg-red-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                            isJoin
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {isJoin ? (
                            <SignIn className="size-4" weight="bold" />
                          ) : (
                            <SignOut className="size-4" weight="bold" />
                          )}
                        </div>

                        <div className="truncate">
                          <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#1B1C17]">
                            <span className="truncate">{log.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                            <span
                              className={`font-semibold ${
                                isJoin ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {isJoin ? 'Joined' : 'Left'}
                            </span>
                            <span className="text-neutral-400">•</span>
                            <span className="text-[#6B7280]">{log.role}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2 text-right">
                        <span className="font-mono text-[10px] font-medium text-[#6B7280]">
                          {log.time}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

     
    </aside>
  );
}

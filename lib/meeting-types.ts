export type MeetingRole = 'Candidate' | 'Recruiter' | 'Panel' | 'Agent';

export interface ParticipantMetadata {
  role?: MeetingRole;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface MeetingActivityEvent {
  id: string;
  type: 'join' | 'leave';
  participantIdentity: string;
  participantName: string;
  role: MeetingRole;
  timestamp: Date;
}

export interface RoleConfig {
  label: MeetingRole;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  ringColor: string;
  avatarBg: string;
}

export const ROLE_CONFIGS: Record<MeetingRole, RoleConfig> = {
  Candidate: {
    label: 'Candidate',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    ringColor: 'ring-emerald-500',
    avatarBg: 'bg-emerald-600',
  },
  Recruiter: {
    label: 'Recruiter',
    badgeBg: 'bg-[#F2F8FF] dark:bg-blue-950/40',
    badgeText: 'text-[#0668E1] dark:text-blue-400',
    badgeBorder: 'border-[#B2D0F6] dark:border-blue-800',
    ringColor: 'ring-[#0668E1]',
    avatarBg: 'bg-[#0668E1]',
  },
  Panel: {
    label: 'Panel',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    ringColor: 'ring-amber-500',
    avatarBg: 'bg-amber-600',
  },
  Agent: {
    label: 'Agent',
    badgeBg: 'bg-[#F2F8FF] dark:bg-sky-950/40',
    badgeText: 'text-[#0668E1] dark:text-sky-300',
    badgeBorder: 'border-[#B2D0F6] dark:border-sky-800',
    ringColor: 'ring-[#0668E1]',
    avatarBg: 'bg-[#0668E1]',
  },
};

export function parseParticipantRole(metadataStr?: string, isAgent?: boolean): MeetingRole {
  if (isAgent) return 'Agent';
  if (!metadataStr) return 'Candidate';

  try {
    const parsed = JSON.parse(metadataStr);
    const role = (parsed?.role || parsed?.user_type || '').toLowerCase();
    if (role === 'recruiter') return 'Recruiter';
    if (role === 'panel') return 'Panel';
    if (role === 'agent') return 'Agent';
    return 'Candidate';
  } catch {
    const lower = metadataStr.toLowerCase();
    if (lower.includes('recruiter')) return 'Recruiter';
    if (lower.includes('panel')) return 'Panel';
    if (lower.includes('agent')) return 'Agent';
    return 'Candidate';
  }
}

export function getRoleBadgeStyle(role: MeetingRole): RoleConfig {
  return ROLE_CONFIGS[role] || ROLE_CONFIGS.Candidate;
}

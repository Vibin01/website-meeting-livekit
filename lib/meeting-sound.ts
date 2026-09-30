/**
 * Web Audio API synthesized chimes for Google Meet-style join/leave audio feedback.
 * No external sound files or asset downloads required.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a welcoming Google Meet-like ascending dual-tone chime when a participant joins.
 */
export function playJoinChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.12, now);
  masterGain.connect(ctx.destination);

  // Tone 1: 523.25 Hz (C5)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523.25, now);
  gain1.gain.setValueAtTime(0.01, now);
  gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.36);

  // Tone 2: 783.99 Hz (G5) - slightly delayed
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(783.99, now + 0.12);
  gain2.gain.setValueAtTime(0.01, now + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.4, now + 0.16);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.56);
}

/**
 * Play a gentle Google Meet-like descending tone when a participant leaves.
 */
export function playLeaveChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.12, now);
  masterGain.connect(ctx.destination);

  // Tone 1: 659.25 Hz (E5)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0.01, now);
  gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.31);

  // Tone 2: 440 Hz (A4) - lower tone descending
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(440, now + 0.1);
  gain2.gain.setValueAtTime(0.01, now + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.14);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.49);
}

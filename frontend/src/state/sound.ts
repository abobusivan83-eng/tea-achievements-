import { create } from "zustand";

type SoundKind = "click" | "tab" | "hover";
type SoundState = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  play: (kind?: SoundKind) => void;
};

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function playTone(kind: SoundKind) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  if (kind === "tab") osc.frequency.setValueAtTime(560, now);
  else if (kind === "hover") osc.frequency.setValueAtTime(420, now);
  else osc.frequency.setValueAtTime(320, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.018, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

export const useSound = create<SoundState>((set, get) => ({
  enabled: typeof window !== "undefined" ? localStorage.getItem("steam_sound_enabled") !== "0" : true,
  setEnabled(v) {
    if (typeof window !== "undefined") localStorage.setItem("steam_sound_enabled", v ? "1" : "0");
    set({ enabled: v });
  },
  play(kind = "click") {
    if (!get().enabled) return;
    playTone(kind);
  },
}));

import { create } from 'zustand';
import type { MatchResult } from './kioskApi';

export type KioskMode = 'camera' | 'manual';

export interface KioskState {
  mode: KioskMode;
  matchResult: MatchResult | null;
  isProcessing: boolean;
  lastError: string | null;
  autoCheckInCountdown: number | null;
  faceServiceOnline: boolean;

  setMode: (mode: KioskMode) => void;
  setMatchResult: (result: MatchResult | null) => void;
  setProcessing: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setAutoCheckInCountdown: (v: number | null) => void;
  setFaceServiceOnline: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  mode: 'camera' as KioskMode,
  matchResult: null as MatchResult | null,
  isProcessing: false,
  lastError: null as string | null,
  autoCheckInCountdown: null as number | null,
  faceServiceOnline: true,
};

export const useKioskStore = create<KioskState>()((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),
  setMatchResult: (result) => set({ matchResult: result }),
  setProcessing: (v) => set({ isProcessing: v }),
  setError: (msg) => set({ lastError: msg }),
  setAutoCheckInCountdown: (v) => set({ autoCheckInCountdown: v }),
  setFaceServiceOnline: (v) => set({ faceServiceOnline: v }),
  reset: () => set({ ...initialState }),
}));

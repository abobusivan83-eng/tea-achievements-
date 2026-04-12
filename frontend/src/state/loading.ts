import { create } from "zustand";

type LoadingState = {
  active: number;
  start: () => void;
  end: () => void;
  reset: () => void;
};

export const useLoading = create<LoadingState>((set) => ({
  active: 0,
  start() {
    set((s) => ({ active: s.active + 1 }));
  },
  end() {
    set((s) => ({ active: Math.max(0, s.active - 1) }));
  },
  reset() {
    set({ active: 0 });
  },
}));


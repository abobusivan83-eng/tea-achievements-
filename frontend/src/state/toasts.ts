import { create } from "zustand";

export type Toast = {
  id: string;
  kind: "success" | "error" | "info";
  title: string;
  message?: string;
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(t) {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3500);
  },
  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
  clear() {
    set({ toasts: [] });
  },
}));


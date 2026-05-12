type Listener = () => void;

const listeners = new Set<Listener>();

/** Вызывается после logout / принудительного сброса сессии (в т.ч. 401 interceptor). */
export function subscribeAuthCleared(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAuthCleared(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

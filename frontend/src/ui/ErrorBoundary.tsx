import type { ReactNode } from "react";
import React from "react";

export class ErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("UI crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen p-6">
        <div className="steam-card glow mx-auto max-w-3xl p-4">
          <div className="text-lg font-semibold">App crashed</div>
          <div className="mt-2 text-sm text-steam-muted">
            A runtime error happened. Please copy the details below and send them here.
          </div>
          <pre className="mt-3 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
            {String(this.state.error.stack || this.state.error.message)}
          </pre>
        </div>
      </div>
    );
  }
}


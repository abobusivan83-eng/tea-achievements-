import clsx from "clsx";
import type { Rarity } from "../../lib/types";
import { FiLock } from "react-icons/fi";

function formatCountdown(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export type ScheduleLockOverlayMode = "achievement" | "task";

export function ScheduleLockOverlay(props: {
  mode: ScheduleLockOverlayMode;
  rarity: Rarity;
  headline: string;
  showTimer: boolean;
  countdownMs: number;
  detail: string;
  /** achievement: rounded-[inherit], task: rounded-[12px] */
  roundedClassName: string;
  stopPointerOnOverlay?: boolean;
}) {
  const { mode, rarity, headline, showTimer, countdownMs, detail, roundedClassName, stopPointerOnOverlay } = props;

  return (
    <div
      className={clsx(
        "schedule-mask absolute inset-0 z-[40] overflow-hidden",
        roundedClassName,
        mode === "achievement" ? "schedule-mask--achievement" : "schedule-mask--task",
      )}
      data-rarity={mode === "achievement" ? rarity : undefined}
      onClick={stopPointerOnOverlay ? (e) => e.stopPropagation() : undefined}
      role="presentation"
    >
      <div className="relative flex h-full min-h-0 flex-col px-2 pb-2 pt-3">
        <div className="flex min-h-0 flex-col items-center gap-1.5 text-center">
          <div className="schedule-mask-lock flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-black/35 shadow-md">
            <FiLock className="h-4 w-4" aria-hidden />
          </div>
          <div className="max-w-full pt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-steam-muted/95 sm:text-[10px] sm:tracking-[0.2em]">
            {headline}
          </div>
          {showTimer ? (
            <div className="schedule-mask-timer w-full max-w-[14.5rem] rounded-md border px-2 py-1.5 shadow-inner">
              <div className="text-center font-mono text-sm font-black tabular-nums tracking-[0.06em] text-cyan-50 sm:text-base">
                {formatCountdown(countdownMs)}
              </div>
            </div>
          ) : null}
          <p className="max-w-full break-words text-[10px] font-semibold leading-snug text-steam-text/95 [overflow-wrap:anywhere] sm:text-[11px] sm:leading-snug">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import type { Achievement } from "../../lib/types";
import { rarityGlowClass } from "../../ui/rarityStyles";
import { AchievementIcon } from "./AchievementIcon";
import { FiLock, FiZoomIn } from "react-icons/fi";

function formatCountdown(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatUpcomingLine(startsAt: string | null, nowMs: number) {
  if (!startsAt) return "Ожидайте начала";
  const startMs = new Date(startsAt).getTime();
  const delta = startMs - nowMs;
  if (!Number.isFinite(delta) || delta <= 0) return `Старт: ${new Date(startsAt).toLocaleString()}`;
  const totalSeconds = Math.floor(delta / 1000);
  const days = Math.floor(totalSeconds / 86400);
  if (days > 0) return `Откроется: ${new Date(startsAt).toLocaleString()}`;
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `Откроется через: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AchievementCard(props: {
  a: Achievement;
  isNew?: boolean;
  onSeenNew?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  onOpenIcon?: () => void;
}) {
  const glow = rarityGlowClass(props.a.rarity, props.a.earned);
  const reduce = useReducedMotion();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const scheduleLocked = Boolean(props.a.scheduleLocked && props.a.taskStartsAt && !props.a.earned);
  const eventEnded = Boolean(props.a.eventEnded && !props.a.earned);
  const showScheduleOverlay = scheduleLocked || eventEnded;

  useEffect(() => {
    if (!showScheduleOverlay || reduce) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [showScheduleOverlay, reduce]);

  const startsAtMs = props.a.taskStartsAt ? new Date(props.a.taskStartsAt).getTime() : null;
  const upcomingRemainingMs =
    startsAtMs !== null && Number.isFinite(startsAtMs) ? Math.max(0, startsAtMs - nowMs) : 0;

  const rarityClass =
    props.a.rarity === "EXCLUSIVE"
      ? "rarity-exclusive"
      : props.a.rarity === "SECRET"
        ? "rarity-secret"
        : props.a.rarity === "LEGENDARY"
          ? "rarity-legendary"
          : props.a.rarity === "EPIC"
            ? "rarity-epic"
            : props.a.rarity === "RARE"
              ? "rarity-rare"
              : "rarity-common";

  const unlockedAt = props.a.awardedAt ? new Date(props.a.awardedAt).toLocaleString() : null;
  const hoverLift = props.a.earned ? -5 : -2;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      whileHover={reduce ? undefined : { y: hoverLift, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={clsx(
        "achievement-card group isolate",
        rarityClass,
        !props.a.earned && "is-locked",
        glow,
      )}
    >
      <div className={clsx("ach-icon-box", `ach-icon-box--${props.a.rarity.toLowerCase()}`)}>
        <AchievementIcon
          iconUrl={props.a.iconUrl}
          alt={props.a.title}
          sizeClassName="ach-icon"
          className="border-[2px] border-[rgba(61,68,80,0.85)] bg-[rgba(0,0,0,0.35)]"
        />
        {props.onOpenIcon ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!props.a.iconUrl) return;
              props.onOpenIcon?.();
            }}
            disabled={!props.a.iconUrl}
            className={clsx(
              "absolute bottom-1 right-1 z-20 inline-flex h-7 w-7 items-center justify-center rounded-md border text-white/90 backdrop-blur",
              props.a.iconUrl
                ? "border-white/15 bg-black/70 hover:border-steam-accent/45 hover:bg-steam-accent/20"
                : "cursor-not-allowed border-white/10 bg-black/40 opacity-50",
            )}
            title="Открыть иконку"
            aria-label="Открыть иконку"
          >
            <FiZoomIn className="h-4 w-4" />
          </button>
        ) : null}
        {props.a.earned ? <div className="ach-check">✓</div> : null}
      </div>

      <div className="ach-content">
        <div className="ach-title">{props.a.title}</div>
        <div className="ach-desc">{props.a.description}</div>
        <div className="ach-footer">
          <div className="ach-reward">+{props.a.points} XP</div>
          <div className="ach-date">
          {props.a.earned
            ? (unlockedAt ?? "Unlocked")
            : scheduleLocked
              ? "Скоро"
              : eventEnded
                ? "Окно закрыто"
                : "Locked"}
        </div>
        </div>
        {props.actionLabel && props.onAction ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={props.onAction}
              className="inline-flex items-center rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-semibold text-steam-text transition hover:border-steam-accent/35 hover:bg-steam-accent/10 hover:text-white"
            >
              {props.actionLabel}
            </button>
          </div>
        ) : null}
      </div>

      {!reduce && props.a.earned && props.a.rarity === "EXCLUSIVE" ? (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -inset-[50%] bg-[conic-gradient(from_0deg,rgba(255,60,120,0.12),rgba(255,200,80,0.14),rgba(80,255,220,0.12),rgba(120,140,255,0.14),rgba(255,60,120,0.12))] opacity-70 animate-[exclusiveAura_10s_linear_infinite]" />
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute -inset-[40%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)] [transform:translateX(-65%)_rotate(18deg)] animate-[shine_2s_ease-in-out_infinite]" />
          </div>
        </div>
      ) : null}

      {!reduce &&
      props.a.earned &&
      (props.a.rarity === "RARE" ||
        props.a.rarity === "EPIC" ||
        props.a.rarity === "LEGENDARY" ||
        props.a.rarity === "SECRET") ? (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
          <div className="absolute -inset-[40%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] [transform:translateX(-65%)_rotate(18deg)] animate-[shine_2.2s_ease-in-out_infinite]" />
        </div>
      ) : null}

      {showScheduleOverlay ? (
        <div className="absolute inset-0 z-30 overflow-hidden rounded-[inherit] bg-[#020817]/90 backdrop-blur-xl">
          <div className="flex h-full max-h-full min-h-0 flex-col items-center justify-center overflow-y-auto overscroll-contain px-3 py-2 text-center [scrollbar-width:thin]">
            <div className="flex w-full min-w-0 max-w-[min(100%,17rem)] shrink-0 flex-col items-center justify-center gap-2 sm:gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-[#020817]/95 text-steam-accent shadow-[0_0_24px_rgba(102,192,244,0.22)] sm:h-12 sm:w-12">
                <FiLock className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="max-w-full text-[10px] font-black uppercase tracking-[0.2em] text-steam-muted/85 sm:text-[11px] sm:tracking-[0.26em]">
                {eventEnded ? "Недоступно" : "Открытие достижения"}
              </div>
              {scheduleLocked && props.a.taskStartsAt ? (
                <div className="w-full max-w-full rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 shadow-[0_0_20px_rgba(34,211,238,0.12)] sm:rounded-2xl sm:px-4 sm:py-2.5">
                  <div className="font-mono text-lg font-black tracking-[0.12em] text-cyan-100 tabular-nums sm:text-xl sm:tracking-[0.18em] md:text-2xl md:tracking-[0.2em]">
                    {formatCountdown(upcomingRemainingMs)}
                  </div>
                </div>
              ) : null}
              <p className="max-w-full break-words text-xs font-semibold leading-snug text-steam-text/92 [overflow-wrap:anywhere] sm:text-sm sm:leading-relaxed">
                {eventEnded
                  ? "Окно задания по времени завершено — следите за новыми ивентами."
                  : formatUpcomingLine(props.a.taskStartsAt ?? null, nowMs)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {props.isNew && props.a.earned ? (
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => props.onSeenNew?.()}
          >
            <motion.div
              className="absolute inset-y-0 left-0 w-[55%]"
              initial={reduce ? { opacity: 0 } : { x: "-120%", opacity: 0 }}
              animate={reduce ? { opacity: 0.9 } : { x: "220%", opacity: 0.95 }}
              transition={reduce ? { duration: 0.18 } : { duration: 0.85, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)",
                transform: "skewX(-18deg)",
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}


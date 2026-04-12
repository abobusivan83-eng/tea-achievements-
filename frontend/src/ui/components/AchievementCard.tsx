import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import type { Achievement } from "../../lib/types";
import { rarityGlowClass } from "../../ui/rarityStyles";
import { AchievementIcon } from "./AchievementIcon";

export function AchievementCard(props: {
  a: Achievement;
  isNew?: boolean;
  onSeenNew?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const glow = rarityGlowClass(props.a.rarity, props.a.earned);
  const reduce = useReducedMotion();

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
        "achievement-card group",
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
        {props.a.earned ? <div className="ach-check">✓</div> : null}
      </div>

      <div className="ach-content">
        <div className="ach-title">{props.a.title}</div>
        <div className="ach-desc">{props.a.description}</div>
        <div className="ach-footer">
          <div className="ach-reward">+{props.a.points} XP</div>
          <div className="ach-date">{props.a.earned ? (unlockedAt ?? "Unlocked") : "Locked"}</div>
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


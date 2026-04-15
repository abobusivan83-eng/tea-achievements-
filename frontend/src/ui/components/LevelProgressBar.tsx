import { motion } from "framer-motion";
import clsx from "clsx";
import { calculateLevelColor } from "../../lib/levelColor";

export function LevelProgressBar(props: {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.min(1, props.xpForNext ? props.xpIntoLevel / props.xpForNext : 0);
  const levelColor = calculateLevelColor(props.level);
  const tier = props.level >= 75 ? "gold" : props.level >= 50 ? "pink" : props.level >= 25 ? "purple" : props.level >= 10 ? "blue" : "white";
  const bar = tier === "gold" ? "bg-yellow-300" : tier === "pink" ? "bg-pink-400" : tier === "purple" ? "bg-purple-400" : tier === "blue" ? "bg-steam-accent" : "bg-white/80";
  const glowClass = tier === "gold" ? "rarity-glow--legendary" : tier === "pink" || tier === "purple" ? "rarity-glow--epic" : tier === "blue" ? "rarity-glow--rare" : "rarity-glow--common";

  return (
    <div className={clsx("grid gap-2", props.className)}>
      {props.showLabel ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-steam-muted">Level</span>
          <span className="font-semibold" style={{ color: levelColor }}>{props.level}</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={clsx("h-full rounded-full rarity-glow", bar, glowClass)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(pct * 100)}%` }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
      </div>
      {props.showLabel ? (
        <div className="text-[11px] text-steam-muted">
          XP {props.xpIntoLevel} / {props.xpForNext}
        </div>
      ) : null}
    </div>
  );
}


import { motion } from "framer-motion";
import clsx from "clsx";
import type { LeaderboardRow } from "../../lib/types";
import { resolveAvatarUrl } from "../../lib/media";
import { Tooltip } from "./Tooltip";
import { AvatarFrame } from "./AvatarFrame";
import { Button } from "./Button";

const DESKTOP_GRID = "xl:grid-cols-[84px_minmax(0,2.3fr)_148px_148px_148px_128px]";

export function RatingList(props: {
  rows: LeaderboardRow[];
  onSelect: (r: LeaderboardRow) => void;
  onOpenProfile?: (r: LeaderboardRow) => void;
}) {
  return (
    <div className="grid gap-3">
      <div
        className={clsx(
          "hidden items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-steam-muted xl:grid",
          DESKTOP_GRID,
        )}
      >
        <div>#</div>
        <div>Игрок</div>
        <div className="text-center">Достижения</div>
        <div className="text-center">Уровень</div>
        <div className="text-center">Рейтинг</div>
        <div className="text-right">Профиль</div>
      </div>

      {props.rows.map((row, idx) => {
        const level = row.level ?? 1;
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
        const accentClass =
          idx === 0
            ? "border-amber-300/35 bg-[linear-gradient(135deg,rgba(255,215,0,0.16),rgba(255,215,0,0.04)_50%,rgba(255,255,255,0.02))]"
            : idx === 1
              ? "border-sky-300/25 bg-[linear-gradient(135deg,rgba(120,180,255,0.14),rgba(120,180,255,0.03)_50%,rgba(255,255,255,0.02))]"
              : idx === 2
                ? "border-orange-300/25 bg-[linear-gradient(135deg,rgba(255,166,77,0.14),rgba(255,166,77,0.03)_50%,rgba(255,255,255,0.02))]"
                : "border-white/10 bg-[linear-gradient(135deg,rgba(27,40,56,0.94),rgba(21,30,43,0.98))]";

        return (
          <Tooltip
            key={row.id}
            content={
              <div className="grid gap-1.5">
                <div className="text-xs">
                  <span className="text-steam-muted">Игрок:</span> {row.nickname}
                </div>
                <div className="text-xs">
                  <span className="text-steam-muted">Достижения:</span> {row.achievementCount}
                </div>
                <div className="text-xs">
                  <span className="text-steam-muted">Уровень:</span> {level}
                </div>
                <div className="text-xs">
                  <span className="text-steam-muted">Рейтинг:</span> {row.totalPoints}
                </div>
                <div className="text-xs text-steam-muted">
                  Рейтинг начисляется за полученные достижения и их редкость.
                </div>
              </div>
            }
          >
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.004 }}
              whileTap={{ scale: 0.995 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              className={clsx(
                "group relative overflow-hidden rounded-[24px] border px-4 py-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.24)] transition-all duration-300 hover:border-white/15 hover:shadow-[0_18px_36px_rgba(0,0,0,0.32)]",
                accentClass,
              )}
              onClick={() => props.onSelect(row)}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.06),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className={clsx("grid gap-4 xl:items-center", DESKTOP_GRID)}>
                <div className="flex items-center gap-3 xl:justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-lg font-semibold text-steam-text">
                    {medal ?? idx + 1}
                  </div>
                  <div className="text-xs uppercase tracking-[0.16em] text-steam-muted xl:hidden">Место</div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 rounded-2xl border border-white/10 bg-black/25 p-1">
                      <AvatarFrame
                        frameKey={row.frameKey ?? null}
                        size={44}
                        src={resolveAvatarUrl(row.avatarUrl)}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">{row.nickname}</div>
                      <div className="truncate font-mono text-[11px] text-steam-muted">
                        #{row.publicId ?? "—"} • {row.id}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:contents">
                  <MetricCard label="Достижения" value={String(row.achievementCount)} sublabel="выполнено" />
                  <MetricCard label="Уровень" value={String(level)} sublabel="текущий lvl" emphasize="level" />
                  <MetricCard label="Рейтинг" value={String(row.totalPoints)} sublabel="за достижения" emphasize="points" />
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-w-[112px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      (props.onOpenProfile ?? props.onSelect)(row);
                    }}
                  >
                    Профиль
                  </Button>
                </div>
              </div>
            </motion.button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  sublabel: string;
  emphasize?: "level" | "points";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-center xl:rounded-none xl:border-0 xl:bg-transparent xl:px-0 xl:py-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-steam-muted xl:hidden">{props.label}</div>
      {props.emphasize === "level" ? (
        <div className="inline-flex min-w-[48px] justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-lg font-semibold">
          {props.value}
        </div>
      ) : (
        <div className={clsx("text-lg font-semibold", props.emphasize === "points" && "text-steam-accent")}>
          {props.value}
        </div>
      )}
      <div className="mt-1 text-[11px] text-steam-muted">{props.sublabel}</div>
    </div>
  );
}

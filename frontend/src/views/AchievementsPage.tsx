import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import type { Achievement, Rarity } from "../lib/types";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "../ui/components/Button";
import { FiFilter, FiSearch } from "react-icons/fi";
import { AchievementCard } from "../ui/components/AchievementCard";
import { Reveal } from "../ui/components/Reveal";
import { Skeleton } from "../ui/components/Skeleton";

export function AchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rarity, setRarity] = useState<Rarity | "">("");
  const [only, setOnly] = useState<"all" | "earned" | "locked">("all");
  const [sort, setSort] = useState<"new" | "rarity" | "points">("new");
  const [q, setQ] = useState("");
  const [burstKey, setBurstKey] = useState(0);
  const [page, setPage] = useState(1);
  const [seenNew, setSeenNew] = useState<Record<string, true>>(() => {
    try {
      return JSON.parse(localStorage.getItem("seen_achievements") || "{}") || {};
    } catch {
      return {};
    }
  });
  const reduce = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (rarity) params.set("rarity", rarity);
        if (q.trim()) params.set("q", q.trim());
        params.set("only", only);
        params.set("sort", sort);
        const data = await apiFetch<Achievement[]>(`/api/achievements?${params.toString()}`);
        if (!mounted) return;
        setItems(data);

        // Confetti for newly unlocked rare+ achievements
        const newlyUnlocked = data.filter((a) => a.earned && a.awardedAt && !seenNew[a.id]);
        const hasRare = newlyUnlocked.some(
          (a) =>
            a.rarity === "RARE" ||
            a.rarity === "EPIC" ||
            a.rarity === "LEGENDARY" ||
            a.rarity === "EXCLUSIVE" ||
            a.rarity === "SECRET",
        );
        if (hasRare) setBurstKey((x) => x + 1);
      } catch (e: any) {
        setError(e?.message ?? "Ошибка загрузки достижений");
      } finally {
        setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [rarity, only, sort, q]);

  useEffect(() => {
    setPage(1);
  }, [rarity, only, sort, q]);

  const counts = useMemo(() => {
    const earned = items.filter((x) => x.earned).length;
    return { earned, total: items.length };
  }, [items]);

  const pageSize = 24;
  const visible = useMemo(() => items.slice(0, page * pageSize), [items, page]);

  return (
    <div className="grid gap-5">
      <Reveal className="steam-card steam-card--hover p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <div className="text-lg font-semibold">Достижения</div>
            <div className="text-sm text-steam-muted">
              Открыто: <span className="text-steam-text">{counts.earned}</span> / {counts.total}
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted" />
            <input
              className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm outline-none focus:border-steam-accent"
              placeholder="Search achievements…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <Button variant="ghost" size="sm" leftIcon={<FiFilter />} onClick={() => setOnly(only === "all" ? "locked" : "all")}>
            {only === "all" ? "Filter" : "Clear"}
          </Button>

          <select
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            value={only}
            onChange={(e) => setOnly(e.target.value as any)}
          >
            <option value="all">Все</option>
            <option value="earned">Открытые</option>
            <option value="locked">Закрытые</option>
          </select>

          <select
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            value={rarity}
            onChange={(e) => setRarity(e.target.value as any)}
          >
            <option value="">Любая редкость</option>
            <option value="COMMON">COMMON</option>
            <option value="RARE">RARE</option>
            <option value="EPIC">EPIC</option>
            <option value="LEGENDARY">LEGENDARY</option>
            <option value="EXCLUSIVE">EXCLUSIVE</option>
            <option value="SECRET">SECRET</option>
          </select>

          <select
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="new">Сначала новые</option>
            <option value="rarity">По редкости</option>
            <option value="points">По очкам</option>
          </select>
        </div>
      </Reveal>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="steam-card p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <div className="mt-2 flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-md" />
                    <Skeleton className="h-6 w-16 rounded-md" />
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <div className="steam-card p-4">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {visible.map((a, idx) => (
            <motion.div
              key={a.id}
              layout="position"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.18 + Math.min(0.02 * idx, 0.14), ease: "easeOut" }}
            >
              <AchievementCard
                a={a}
                isNew={Boolean(a.earned && a.awardedAt && !seenNew[a.id])}
                onSeenNew={() => {
                  setSeenNew((prev) => {
                    const next = { ...prev, [a.id]: true as const };
                    localStorage.setItem("seen_achievements", JSON.stringify(next));
                    return next;
                  });
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {visible.length < items.length ? (
        <div className="flex justify-center pt-2">
          <Button variant="ghost" onClick={() => setPage((p) => p + 1)}>
            Показать ещё ({visible.length} / {items.length})
          </Button>
        </div>
      ) : null}

      <ConfettiBurst burstKey={burstKey} />
    </div>
  );
}

function ConfettiBurst(props: { burstKey: number }) {
  return (
    <AnimatePresence>
      {props.burstKey > 0 ? (
        <motion.div
          key={props.burstKey}
          className="pointer-events-none fixed inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-24 h-2 w-2 rounded-sm bg-steam-accent"
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
              animate={{
                x: (Math.random() * 2 - 1) * 260,
                y: Math.random() * 220 + 60,
                rotate: Math.random() * 560,
                opacity: 0,
                scale: 0.6,
              }}
              transition={{ duration: 0.95 + Math.random() * 0.35, ease: "easeOut" }}
              style={{
                background:
                  i % 3 === 0 ? "rgba(102,192,244,0.95)" : i % 3 === 1 ? "rgba(170,90,240,0.9)" : "rgba(255,190,70,0.9)",
              }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}


import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { LeaderboardRow } from "../lib/types";
import { Modal } from "../ui/components/Modal";
import { Button } from "../ui/components/Button";
import { FiAward, FiSearch, FiX } from "react-icons/fi";
import { RatingList } from "../ui/components/RatingList";
import { Reveal } from "../ui/components/Reveal";
import { Skeleton } from "../ui/components/Skeleton";
import { AvatarFrame } from "../ui/components/AvatarFrame";
import { resolveAvatarUrl } from "../lib/media";

export function LeaderboardPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"points" | "achievements" | "level">("points");

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<LeaderboardRow[]>("/api/leaderboard");
        if (!mounted) return;
        setRows(data);
      } catch (e: any) {
        setError(e?.message ?? "Ошибка загрузки рейтинга");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    const id = setInterval(run, 8000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = !query
      ? rows
      : rows.filter((r) => r.nickname.toLowerCase().includes(query) || r.id.toLowerCase().includes(query));
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sort === "achievements") return b.achievementCount - a.achievementCount;
      if (sort === "level") return (b.level ?? 1) - (a.level ?? 1);
      return b.totalPoints - a.totalPoints;
    });
    return sorted;
  }, [rows, q, sort]);

  const leaderboardStats = useMemo(() => {
    if (!rows.length) return { players: 0, achievements: 0, points: 0 };
    return {
      players: rows.length,
      achievements: rows.reduce((sum, r) => sum + r.achievementCount, 0),
      points: rows.reduce((sum, r) => sum + r.totalPoints, 0),
    };
  }, [rows]);

  return (
    <div className="grid gap-5">
      <Reveal className="steam-card steam-card--hover p-4">
        <div className="text-lg font-semibold">Рейтинг клана</div>
        <div className="text-sm text-steam-muted">
          Топ участников по рейтингу. Рейтинг начисляется за полученные достижения и зависит от их редкости и ценности.
        </div>
      </Reveal>

      {loading ? (
        <div className="grid gap-3">
          <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-steam-muted xl:grid xl:grid-cols-[84px_minmax(0,2.3fr)_148px_148px_148px_128px]">
            <div>#</div>
            <div>Игрок</div>
            <div className="text-center">Достижения</div>
            <div className="text-center">Уровень</div>
            <div className="text-center">Рейтинг</div>
            <div className="text-right">Профиль</div>
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(27,40,56,0.94),rgba(21,30,43,0.98))] px-4 py-4">
              <div className="grid gap-4 xl:grid-cols-[84px_minmax(0,2.3fr)_148px_148px_148px_128px] xl:items-center">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="grid gap-2">
                  <Skeleton className="h-5 w-44 rounded-md" />
                  <Skeleton className="h-3 w-56 rounded-md" />
                </div>
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-10 w-[112px] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <div className="steam-card p-4">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="steam-card p-4">
          <div className="text-xs text-steam-muted">Игроков</div>
          <div className="mt-1 text-2xl font-bold">{leaderboardStats.players}</div>
        </div>
        <div className="steam-card p-4">
          <div className="text-xs text-steam-muted">Выполнено достижений</div>
          <div className="mt-1 text-2xl font-bold">{leaderboardStats.achievements}</div>
        </div>
        <div className="steam-card p-4">
          <div className="text-xs text-steam-muted">Общий рейтинг</div>
          <div className="mt-1 text-2xl font-bold text-steam-accent">{leaderboardStats.points}</div>
        </div>
      </div>

      <div className="steam-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-80">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted" />
            <input
              className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm outline-none focus:border-steam-accent"
              placeholder="Поиск по игроку или ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            value={sort}
            onChange={(e) => setSort(e.target.value as "points" | "achievements" | "level")}
          >
            <option value="points">Сортировка: по рейтингу</option>
            <option value="achievements">Сортировка: по достижениям</option>
            <option value="level">Сортировка: по уровню</option>
          </select>
        </div>
      </div>

      <RatingList rows={filtered} onSelect={setSelected} onOpenProfile={(r) => nav(`/profile/${r.id}`)} />

      <Modal
        open={Boolean(selected)}
        title={selected ? `Игрок: ${selected.nickname}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <AvatarFrame
                frameKey={selected.frameKey}
                size={48}
                src={resolveAvatarUrl(selected.avatarUrl)}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{selected.nickname}</div>
                <div className="truncate font-mono text-[11px] text-steam-muted">{selected.id}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-steam-muted">Достижения</div>
                <div className="mt-1 text-lg font-semibold">{selected.achievementCount}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-steam-muted">Рейтинг</div>
                <div className="mt-1 text-lg font-semibold text-steam-accent">{selected.totalPoints}</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-steam-muted">
              <div className="inline-flex items-center gap-2 text-steam-text">
                <FiAward />
                <span className="font-semibold">Что влияет на рейтинг</span>
              </div>
              <div className="mt-2">
                Рейтинг растет за счет полученных достижений. Чем выше редкость достижения, тем больше рейтинга получает участник.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="primary" onClick={() => nav(`/profile/${selected.id}`)}>
                Открыть профиль
              </Button>
              <Button variant="ghost" leftIcon={<FiX />} onClick={() => setSelected(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

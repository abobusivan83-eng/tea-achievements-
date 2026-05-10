import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { LeaderboardRow } from "../lib/types";
import { Modal } from "../ui/components/Modal";
import { Button } from "../ui/components/Button";
import { FiAward, FiSearch, FiTrendingUp, FiX } from "react-icons/fi";
import { RatingList } from "../ui/components/RatingList";
import { Reveal } from "../ui/components/Reveal";
import { Skeleton } from "../ui/components/Skeleton";
import { AvatarFrame } from "../ui/components/AvatarFrame";
import { resolveAvatarUrl } from "../lib/media";
import { leaderboardQueryKey } from "../lib/queryKeys";

export function LeaderboardPage() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"points" | "achievements" | "level">("points");

  const leaderboardQuery = useQuery({
    queryKey: leaderboardQueryKey,
    queryFn: () => apiFetch<LeaderboardRow[]>("/api/leaderboard"),
    staleTime: 55_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const rows = leaderboardQuery.data ?? [];
  const loading = leaderboardQuery.isLoading;
  const error =
    leaderboardQuery.isError && leaderboardQuery.error instanceof Error
      ? leaderboardQuery.error.message
      : leaderboardQuery.isError
        ? "Ошибка загрузки рейтинга"
        : null;

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

  const handleOpenProfile = useCallback(
    (r: LeaderboardRow) => {
      nav(`/profile/${r.id}`);
    },
    [nav],
  );

  return (
    <div className="grid gap-6">
      <Reveal className="steam-card steam-card--hover shop-hero overflow-hidden p-5 md:p-6">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-steam-accent/25 bg-steam-accent/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-steam-accent">
              <FiTrendingUp className="h-3.5 w-3.5" aria-hidden />
              Топ клана
            </div>
            <div className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">Рейтинг</div>
            <div className="mt-2 max-w-xl text-sm text-steam-muted md:text-base">
              Сводка по участникам: очки за достижения с учётом редкости, количество открытых ачивок и уровень. Данные обновляются автоматически.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[min(100%,420px)] lg:max-w-xl lg:grid-cols-3">
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Игроков</div>
              <div className="shop-stat-card__value">{loading ? "—" : leaderboardStats.players}</div>
            </div>
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Достижений всего</div>
              <div className="shop-stat-card__value">{loading ? "—" : leaderboardStats.achievements}</div>
            </div>
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Сумма рейтинга</div>
              <div className="shop-stat-card__value text-steam-accent">{loading ? "—" : leaderboardStats.points}</div>
            </div>
          </div>
        </div>
      </Reveal>

      {error ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}

      <Reveal className="steam-card steam-card--hover overflow-hidden p-0">
        <div className="border-b border-white/10 bg-black/15 p-4 md:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-semibold text-steam-text">Таблица лидеров</div>
              <div className="mt-1 text-sm text-steam-muted">Поиск и сортировка применяются к загруженному списку.</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[min(100%,20rem)] flex-1 md:max-w-md">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steam-muted" aria-hidden />
              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-3 text-sm text-steam-text outline-none transition focus:border-steam-accent"
                placeholder="Поиск по нику или ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Поиск по таблице лидеров"
              />
            </div>
            <select
              className="steam-select min-w-[13rem]"
              aria-label="Сортировка таблицы лидеров"
              value={sort}
              onChange={(e) => setSort(e.target.value as "points" | "achievements" | "level")}
            >
              <option value="points">Сортировка: по рейтингу</option>
              <option value="achievements">Сортировка: по достижениям</option>
              <option value="level">Сортировка: по уровню</option>
            </select>
          </div>
        </div>
        <div className="border-t border-white/10 bg-black/20 p-4 md:p-5">
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
                <div
                  key={i}
                  className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(27,40,56,0.94),rgba(21,30,43,0.98))] px-4 py-4"
                >
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
          ) : (
            <RatingList rows={filtered} onSelect={setSelected} onOpenProfile={handleOpenProfile} />
          )}
        </div>
      </Reveal>

      <Modal
        open={Boolean(selected)}
        title={selected ? `Игрок: ${selected.nickname}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(27,40,56,0.5),rgba(15,23,42,0.65))] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-steam-muted">Достижения</div>
                <div className="mt-1 text-xl font-semibold text-steam-text">{selected.achievementCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(27,40,56,0.5),rgba(15,23,42,0.65))] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-steam-muted">Рейтинг</div>
                <div className="mt-1 text-xl font-semibold text-steam-accent">{selected.totalPoints}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-steam-muted">
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

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "../lib/api";
import type { GiftInboxItem, GiftOutboxItem, LeaderboardRow } from "../lib/types";
import { Reveal } from "../ui/components/Reveal";
import { Button } from "../ui/components/Button";
import { FiGift, FiInbox, FiSend, FiZap } from "react-icons/fi";
import { useAuth } from "../state/auth";
import { Skeleton } from "../ui/components/Skeleton";
import { giftsPackQueryKey, leaderboardQueryKey, shopMeQueryKey } from "../lib/queryKeys";

export function GiftsPage() {
  const me = useAuth((s) => s.me);
  const queryClient = useQueryClient();
  const [toUserId, setToUserId] = useState<string>("");
  const [xpAmount, setXpAmount] = useState<number>(100);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const markedViewedRef = useRef(false);

  const giftsQuery = useQuery({
    queryKey: giftsPackQueryKey(me?.id),
    queryFn: async () => {
      const [i, o, meShop] = await Promise.all([
        apiFetch<GiftInboxItem[]>("/api/gifts/inbox"),
        apiFetch<GiftOutboxItem[]>("/api/gifts/outbox"),
        apiFetch<{ coins: number }>("/api/shop/me"),
      ]);
      return { inbox: i, outbox: o, coins: meShop.coins ?? 0 };
    },
    enabled: Boolean(me?.id),
    staleTime: 25_000,
  });

  const leaderboardQuery = useQuery({
    queryKey: leaderboardQueryKey,
    queryFn: () => apiFetch<LeaderboardRow[]>("/api/leaderboard"),
    staleTime: 55_000,
    enabled: Boolean(me?.id),
  });

  const users = leaderboardQuery.data ?? [];
  const inbox = giftsQuery.data?.inbox ?? [];
  const outbox = giftsQuery.data?.outbox ?? [];
  const coins = giftsQuery.data?.coins ?? 0;
  const loading = giftsQuery.isLoading || leaderboardQuery.isLoading;
  const fetchError =
    (giftsQuery.error instanceof Error ? giftsQuery.error.message : null) ??
    (leaderboardQuery.error instanceof Error ? leaderboardQuery.error.message : null);
  const displayError = error ?? fetchError;

  useEffect(() => {
    if (!users.length || toUserId) return;
    setToUserId(users.find((x) => x.id !== me?.id)?.id ?? "");
  }, [users, me?.id, toUserId]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: giftsPackQueryKey(me?.id) }),
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
      queryClient.invalidateQueries({ queryKey: shopMeQueryKey }),
    ]);
  }, [me?.id, queryClient]);

  useEffect(() => {
    if (!giftsQuery.isSuccess || markedViewedRef.current) return;
    const hasUnread = inbox.some((g) => !g.isRead);
    if (!hasUnread) return;
    markedViewedRef.current = true;
    apiJson("/api/gifts/read", { markAll: true }, "POST").finally(() => {
      void refresh();
    });
  }, [giftsQuery.isSuccess, inbox, refresh]);

  const unreadInbox = inbox.filter((g) => !g.isRead).length;

  return (
    <div className="grid gap-6">
      <Reveal className="steam-card steam-card--hover shop-hero overflow-hidden p-5 md:p-6">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-amber-100">
              <FiZap className="h-3.5 w-3.5" aria-hidden />
              Clan gifts
            </div>
            <div className="mt-4 flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <FiGift className="h-7 w-7 shrink-0 text-amber-200/90" aria-hidden />
              Подарки
            </div>
            <div className="mt-2 max-w-xl text-sm text-steam-muted md:text-base">
              Подарки — быстрая и безопасная передача монет между участниками клана. Отправляй валюту друзьям в один
              клик без риска двойных списаний.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[min(100%,480px)] lg:max-w-2xl lg:grid-cols-3">
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Баланс</div>
              <div className="shop-stat-card__value text-amber-100">{loading ? "—" : coins}</div>
            </div>
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Входящих</div>
              <div className="shop-stat-card__value">{loading ? "—" : inbox.length}</div>
            </div>
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Новых</div>
              <div className="shop-stat-card__value text-steam-accent">{loading ? "—" : unreadInbox}</div>
            </div>
          </div>
        </div>
      </Reveal>

      {displayError ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{displayError}</div>
      ) : null}

      <Reveal className="steam-card steam-card--hover overflow-hidden p-0">
        {loading ? (
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
              <div className="grid gap-3">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </div>
            <div className="bg-black/15 p-5">
              <div className="grid gap-3">
                <Skeleton className="h-4 w-28 rounded-md" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(27,40,56,0.88),rgba(15,23,42,0.95))] p-4">
                    <div className="grid gap-2">
                      <Skeleton className="h-4 w-2/3 rounded-md" />
                      <Skeleton className="h-3 w-full rounded-md" />
                      <Skeleton className="h-3 w-1/2 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r md:border-white/10">
              <div className="flex items-center gap-2 text-lg font-semibold text-steam-text">
                <FiSend className="h-5 w-5 text-steam-accent/90" aria-hidden />
                Отправить подарок
              </div>
              <p className="mt-1 text-sm text-steam-muted">Выберите получателя и сумму в монетах клана.</p>
              <div className="mt-4 grid gap-3 text-sm">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-steam-muted">Кому</span>
                  <select
                    className="steam-select w-full"
                    aria-label="Получатель подарка"
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                  >
                    <option value="" disabled>
                      Выберите игрока
                    </option>
                    {users
                      .filter((u) => u.id !== me?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nickname}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-steam-muted">Сумма в монетах</span>
                  <input
                    type="number"
                    min={1}
                    max={5000000}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-steam-text outline-none transition focus:border-steam-accent"
                    value={xpAmount}
                    onChange={(e) => setXpAmount(Number(e.target.value))}
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-steam-muted">Сообщение (необязательно)</span>
                  <input
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-steam-text outline-none transition focus:border-steam-accent"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Например: за помощь в рейде"
                  />
                </label>

                <div className="flex justify-end pt-1">
                  <Button
                    variant="primary"
                    loading={sendBusy}
                    disabled={!toUserId || xpAmount < 1 || sendBusy}
                    leftIcon={<FiGift className="h-4 w-4" />}
                    onClick={async () => {
                      if (!toUserId) {
                        setError("Выберите получателя подарка");
                        return;
                      }
                      setError(null);
                      setSendBusy(true);
                      try {
                        const idem = crypto.randomUUID();
                        await apiJson(
                          "/api/gifts/send",
                          { toUserId, xpAmount, message },
                          "POST",
                          { "Idempotency-Key": idem },
                        );
                        setMessage("");
                        await refresh();
                      } catch (e: any) {
                        setError(e?.message ?? "Не удалось отправить подарок");
                      } finally {
                        setSendBusy(false);
                      }
                    }}
                  >
                    Отправить
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-black/15 p-5">
              <div className="flex items-center gap-2 text-lg font-semibold text-steam-text">
                <FiInbox className="h-5 w-5 text-steam-green/90" aria-hidden />
                Входящие
              </div>
              <p className="mt-1 text-sm text-steam-muted">Подарки от других игроков клана.</p>
              <div className="mt-4 grid max-h-[min(70vh,520px)] gap-2 overflow-y-auto pr-1">
                {inbox.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(27,40,56,0.92),rgba(15,23,42,0.96))] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:border-white/18"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-steam-text">
                          <span className="text-amber-200/95">+{g.xpAmount}</span>{" "}
                          <span className="text-steam-muted">🪙 от</span> {g.fromUser.nickname}
                        </div>
                        <div className="truncate font-mono text-[10px] text-steam-muted/80">Отправитель: {g.fromUser.id}</div>
                        <div className="mt-1 truncate text-xs text-steam-muted">{g.message ?? "Без сообщения"}</div>
                      </div>
                      <span
                        className={
                          g.isRead
                            ? "shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-steam-muted"
                            : "shrink-0 rounded-full border border-steam-accent/35 bg-steam-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-steam-accent"
                        }
                      >
                        {g.isRead ? "Просмотрено" : "Новое"}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-steam-muted/90">{new Date(g.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {!inbox.length ? <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-steam-muted">Пока нет входящих подарков.</div> : null}
              </div>
            </div>
          </div>
        )}
      </Reveal>

      <Reveal className="steam-card steam-card--hover overflow-hidden p-0">
        <div className="border-b border-white/10 bg-black/15 px-5 py-4">
          <div className="text-lg font-semibold text-steam-text">Исходящие</div>
          <div className="mt-1 text-sm text-steam-muted">История отправленных вами переводов.</div>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="mt-2 h-3 w-1/2 rounded-md" />
                  <Skeleton className="mt-3 h-3 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {outbox.map((g) => (
                <div
                  key={g.id}
                  className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(27,40,56,0.88),rgba(15,23,42,0.95))] p-4 shadow-[0_10px_26px_rgba(0,0,0,0.2)] transition hover:border-white/16"
                >
                  <div className="truncate text-sm font-semibold text-steam-text">
                    <span className="text-amber-200/95">−{g.xpAmount}</span> <span className="text-steam-muted">🪙 →</span> {g.toUser.nickname}
                  </div>
                  <div className="truncate font-mono text-[10px] text-steam-muted/80">Получатель: {g.toUser.id}</div>
                  <div className="mt-1 truncate text-xs text-steam-muted">{g.message ?? "Без сообщения"}</div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-steam-muted">
                    <span>{new Date(g.createdAt).toLocaleString()}</span>
                    <span className="rounded-full border border-steam-green/30 bg-steam-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-steam-green">
                      Доставлено
                    </span>
                  </div>
                </div>
              ))}
              {!outbox.length ? (
                <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-steam-muted">
                  Пока ничего не отправляли.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

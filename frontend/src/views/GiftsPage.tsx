import { useEffect, useRef, useState } from "react";
import { apiFetch, apiJson } from "../lib/api";
import type { GiftInboxItem, GiftOutboxItem, LeaderboardRow } from "../lib/types";
import { Reveal } from "../ui/components/Reveal";
import { Button } from "../ui/components/Button";
import { FiGift } from "react-icons/fi";
import { useAuth } from "../state/auth";
import { Skeleton } from "../ui/components/Skeleton";

export function GiftsPage() {
  const me = useAuth((s) => s.me);
  const [users, setUsers] = useState<LeaderboardRow[]>([]);
  const [toUserId, setToUserId] = useState<string>("");
  const [xpAmount, setXpAmount] = useState<number>(100);
  const [coins, setCoins] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [inbox, setInbox] = useState<GiftInboxItem[]>([]);
  const [outbox, setOutbox] = useState<GiftOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const markedViewedRef = useRef(false);

  async function refresh() {
    const [u, i, o, meShop] = await Promise.all([
      apiFetch<LeaderboardRow[]>("/api/leaderboard"),
      apiFetch<GiftInboxItem[]>("/api/gifts/inbox"),
      apiFetch<GiftOutboxItem[]>("/api/gifts/outbox"),
      apiFetch<{ coins: number }>("/api/shop/me"),
    ]);
    setUsers(u);
    setInbox(i);
    setOutbox(o);
    setCoins(meShop.coins ?? 0);
    if (!toUserId) setToUserId(u.find((x) => x.id !== me?.id)?.id ?? "");
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Ошибка загрузки подарков");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || markedViewedRef.current) return;
    const hasUnread = inbox.some((g) => !g.isRead);
    if (!hasUnread) return;
    markedViewedRef.current = true;
    apiJson("/api/gifts/read", { markAll: true }, "POST").finally(() => {
      refresh().catch(() => undefined);
    });
  }, [loading, inbox]);

  return (
    <div className="grid gap-5">
      <Reveal className="steam-card steam-card--hover p-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <FiGift className="opacity-90" />
          Подарки
        </div>
        <div className="mt-1 text-sm text-steam-muted">
          Монеты списываются у отправителя и сразу зачисляются получателю. Повторная отправка с тем же Idempotency-Key не
          спишет баланс дважды.
        </div>
        <div className="mt-2 inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-steam-text">
          Баланс: {coins} монет
        </div>
      </Reveal>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="steam-card p-4">
            <div className="grid gap-3">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
          <div className="steam-card p-4">
            <div className="grid gap-3">
              <Skeleton className="h-4 w-28 rounded-md" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
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
      ) : null}
      {error ? <div className="steam-card p-4">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="steam-card p-4">
          <div className="text-sm font-semibold">Отправить подарок</div>
          <div className="mt-3 grid gap-3 text-sm">
            <label className="grid gap-1">
              <span className="text-steam-muted">Кому</span>
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
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

            <label className="grid gap-1">
              <span className="text-steam-muted">Сколько монет</span>
              <input
                type="number"
                min={1}
                max={5000000}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                value={xpAmount}
                onChange={(e) => setXpAmount(Number(e.target.value))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-steam-muted">Сообщение (необязательно)</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Например: за помощь в рейде"
              />
            </label>

            <div className="flex justify-end">
              <Button
                variant="primary"
                loading={sendBusy}
                disabled={!toUserId || xpAmount < 1 || sendBusy}
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
                🎁 Отправить
              </Button>
            </div>
          </div>
        </div>

        <div className="steam-card p-4">
          <div className="text-sm font-semibold">Входящие</div>
          <div className="mt-3 grid gap-2">
            {inbox.map((g) => (
              <div key={g.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      🎁 {g.xpAmount} 🪙 <span className="text-steam-muted">от</span> {g.fromUser.nickname}
                    </div>
                    <div className="truncate font-mono text-[10px] text-steam-muted/80">ID отправителя: {g.fromUser.id}</div>
                    <div className="truncate text-xs text-steam-muted">{g.message ?? "—"}</div>
                  </div>
                  <div className="shrink-0 text-xs text-steam-muted">{g.isRead ? "Просмотрено" : "Новое"}</div>
                </div>
                <div className="mt-2 text-[11px] text-steam-muted">{new Date(g.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {!inbox.length && !loading ? <div className="text-sm text-steam-muted">Пока нет подарков.</div> : null}
          </div>
        </div>
      </div>

      <div className="steam-card p-4">
        <div className="text-sm font-semibold">Исходящие</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {outbox.map((g) => (
            <div key={g.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="truncate text-sm font-semibold">
                🎁 {g.xpAmount} 🪙 <span className="text-steam-muted">→</span> {g.toUser.nickname}
              </div>
              <div className="truncate font-mono text-[10px] text-steam-muted/80">ID получателя: {g.toUser.id}</div>
              <div className="truncate text-xs text-steam-muted">{g.message ?? "—"}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-steam-muted">
                <span>{new Date(g.createdAt).toLocaleString()}</span>
                <span>✅ Доставлено</span>
              </div>
            </div>
          ))}
          {!outbox.length && !loading ? <div className="text-sm text-steam-muted">Пока ничего не отправляли.</div> : null}
        </div>
      </div>
    </div>
  );
}

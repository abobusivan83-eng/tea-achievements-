import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiJson } from "../lib/api";
import type { Rarity, ShopItem } from "../lib/types";
import { Reveal } from "../ui/components/Reveal";
import { Button } from "../ui/components/Button";
import { FiShoppingBag, FiStar, FiZap } from "react-icons/fi";
import clsx from "clsx";
import { AvatarFrame } from "../ui/components/AvatarFrame";

function rarityLabel(r: Rarity) {
  switch (r) {
    case "COMMON":
      return "Обычная";
    case "RARE":
      return "Редкая";
    case "EPIC":
      return "Эпическая";
    case "LEGENDARY":
      return "Легендарная";
    case "SECRET":
      return "Секретная";
    case "EXCLUSIVE":
      return "Эксклюзив";
    default:
      return "Обычная";
  }
}

function isImageIcon(icon: string | null | undefined) {
  if (!icon) return false;
  const v = icon.trim().toLowerCase();
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/") || v.startsWith("data:image/");
}

function ShopItemIcon(props: { icon: string | null; name: string }) {
  if (!props.icon) return <span className="text-lg">🎁</span>;
  if (isImageIcon(props.icon)) {
    return <img src={props.icon} alt={props.name} className="h-8 w-8 rounded-md border border-white/10 object-cover" />;
  }
  return <span className="text-lg">{props.icon}</span>;
}

function ProductCard(props: { item: ShopItem; owned: boolean; onBuy: () => Promise<void> }) {
  const { item, owned, onBuy } = props;
  const isFrame = item.type === "FRAME";
  const isStatus = item.type === "BADGE" && item.key.startsWith("status:");
  const rarityKey = String(item.rarity ?? "COMMON").toLowerCase();
  const typeLabel = isStatus ? "STATUS" : item.type;

  return (
    <div
      className={clsx(
        "shop-product-card rounded-2xl border border-white/10 p-4",
        `shop-product-card--${rarityKey}`,
        owned && "shop-product-card--owned",
      )}
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shop-product-card__media shrink-0">
            {isFrame ? (
              <AvatarFrame frameKey={item.key} size={52} src="https://placehold.co/96x96/png?text=A" />
            ) : (
              <div
                className={clsx(
                  "shop-item-icon inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/30",
                  isStatus && "shop-item-icon--status",
                  `shop-item-icon--${rarityKey}`,
                )}
              >
                <ShopItemIcon icon={item.icon} name={item.name} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{item.name}</div>
            <div className="mt-1 line-clamp-2 text-xs text-steam-muted">{item.description ?? item.key}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 uppercase tracking-[0.18em] text-steam-muted">
                {typeLabel}
              </span>
              <span className={clsx("shop-rarity-chip", `shop-rarity-chip--${rarityKey}`)}>{rarityLabel(item.rarity)}</span>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">
                {item.price} 🪙
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-[132px] shrink-0 gap-2 md:justify-items-end">
          {!isFrame ? (
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 md:justify-self-end">
              <ShopItemIcon icon={item.icon} name={item.name} />
            </div>
          ) : null}
          <Button
            size="sm"
            variant={owned ? "ghost" : "primary"}
            disabled={owned}
            className={clsx("shop-buy-button w-full md:w-[132px]", owned && "shop-buy-button--owned")}
            onClick={onBuy}
          >
            {owned ? "Куплено" : "Купить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [itemsResp, meResp] = await Promise.all([
          apiFetch<ShopItem[]>("/api/shop/items"),
          apiFetch<{ purchasedItemIds: string[]; coins: number }>("/api/shop/me"),
        ]);
        if (!mounted) return;
        setItems(itemsResp);
        setPurchasedIds(new Set(meResp.purchasedItemIds));
        setCoins(meResp.coins ?? 0);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Ошибка загрузки магазина");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const frames = useMemo(() => items.filter((i) => i.type === "FRAME"), [items]);
  const statusEmojis = useMemo(
    () => items.filter((i) => i.type === "BADGE" && i.key.startsWith("status:")),
    [items],
  );
  const badges = useMemo(
    () => items.filter((i) => i.type === "BADGE" && !i.key.startsWith("status:")),
    [items],
  );

  async function handleBuy(item: ShopItem) {
    await apiJson("/api/shop/buy", { itemId: item.id });
    setPurchasedIds((prev) => new Set(prev).add(item.id));
    setCoins((x) => Math.max(0, x - item.price));
  }

  return (
    <div className="grid gap-6">
      <Reveal className="steam-card steam-card--hover shop-hero overflow-hidden p-5 md:p-6">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-100">
              <FiZap />
              Clan Store
            </div>
            <div className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">Магазин трофеев и профиля</div>
            <div className="mt-2 max-w-xl text-sm text-steam-muted md:text-base">
              Покупай редкие рамки и значки за заработанные монеты. Витрина теперь адаптирована под любые названия, цены и размеры экрана.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px] lg:grid-cols-4">
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Баланс</div>
              <div className="shop-stat-card__value text-amber-100">{coins}</div>
            </div>
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Рамки</div>
              <div className="shop-stat-card__value">{frames.length}</div>
            </div>
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Значки</div>
              <div className="shop-stat-card__value">{badges.length}</div>
            </div>
            <div className="shop-stat-card">
              <div className="shop-stat-card__label">Статусы</div>
              <div className="shop-stat-card__value">{statusEmojis.length}</div>
            </div>
          </div>
        </div>
      </Reveal>

      {loading ? <div className="steam-card p-4">Загрузка…</div> : null}
      {error ? <div className="steam-card p-4">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.15fr]">
        <section className="steam-card shop-panel p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <FiStar className="text-amber-200" />
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">Рамки</div>
          </div>
          <div className="grid gap-3">
            {frames.map((item) => (
              <ProductCard key={item.id} item={item} owned={purchasedIds.has(item.id)} onBuy={() => handleBuy(item)} />
            ))}
            {!frames.length && !loading ? <div className="text-sm text-steam-muted">Рамки пока не добавлены.</div> : null}
          </div>
        </section>

        <section className="steam-card shop-panel shop-panel--badges p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <FiShoppingBag className="text-amber-200" />
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">Значки</div>
          </div>
          <div className="grid gap-3">
            {badges.map((item) => (
              <ProductCard key={item.id} item={item} owned={purchasedIds.has(item.id)} onBuy={() => handleBuy(item)} />
            ))}
            {!badges.length && !loading ? <div className="text-sm text-steam-muted">Значки пока не добавлены.</div> : null}
          </div>
        </section>
      </div>

      <section className="steam-card shop-panel shop-panel--badges p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <FiZap className="text-amber-200" />
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">Статусы</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {statusEmojis.map((item) => (
            <ProductCard key={item.id} item={item} owned={purchasedIds.has(item.id)} onBuy={() => handleBuy(item)} />
          ))}
          {!statusEmojis.length && !loading ? <div className="text-sm text-steam-muted">Статусы пока не добавлены.</div> : null}
        </div>
      </section>
    </div>
  );
}

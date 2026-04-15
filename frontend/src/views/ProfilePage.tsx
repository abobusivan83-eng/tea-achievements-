import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiJson, apiUpload } from "../lib/api";
import { useAuth } from "../state/auth";
import { badgeCatalog, creatorFrames, frames, getFrame, statusEmojiCatalog } from "../lib/cosmetics";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../ui/components/Button";
import { Modal } from "../ui/components/Modal";
import { Tabs } from "../ui/components/Tabs";
import { Tooltip } from "../ui/components/Tooltip";
import { FiAward, FiImage, FiLock, FiSave, FiStar, FiTrendingUp, FiUser, FiVolume2, FiVolumeX } from "react-icons/fi";
import { Reveal } from "../ui/components/Reveal";
import { Skeleton } from "../ui/components/Skeleton";
import { AchievementIcon } from "../ui/components/AchievementIcon";
import { AvatarFrame, canUseFrame } from "../ui/components/AvatarFrame";
import { useToasts } from "../state/toasts";
import type { Achievement, Me, Rarity } from "../lib/types";
import { useSound } from "../state/sound";
import { AchievementCard } from "../ui/components/AchievementCard";
import { DEFAULT_BANNER_URL, resolveAvatarUrl, resolveBannerUrl } from "../lib/media";
import { calculateLevelColor } from "../lib/levelColor";

type ProfileResp = {
  user: {
    id: string;
    publicId?: number;
    nickname: string;
    role: "USER" | "ADMIN" | "CREATOR";
    blocked: boolean;
    level?: number;
    xp?: number;
    avatarUrl: string | null;
    bannerUrl: string | null;
    frameKey: string | null;
    badges: string[];
    statusEmoji?: string | null;
    createdAt: string;
  };
  achievements: {
    earned: Array<{
      id: string;
      title: string;
      description: string;
      rarity: string;
      points: number;
      iconUrl: string | null;
      frameKey: string | null;
      awardedAt: string;
      ownerPct?: number;
    }>;
    locked: Array<{
      id: string;
      title: string;
      description: string;
      rarity: string;
      points: number;
      iconUrl: string | null;
      frameKey: string | null;
    }>;
  };
};

export function ProfilePage() {
  const me = useAuth((s) => s.me);
  const hydrate = useAuth((s) => s.hydrate);
  const nav = useNavigate();
  const params = useParams<{ id?: string }>();
  const toast = useToasts((s) => s.push);
  const soundEnabled = useSound((s) => s.enabled);
  const setSoundEnabled = useSound((s) => s.setEnabled);
  const [profile, setProfile] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [frameKey, setFrameKey] = useState<string | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [burstKey, setBurstKey] = useState(0);
  const [tab, setTab] = useState<"main" | "achievements" | "leaderboard" | "settings">("main");
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const [ownedShopKeys, setOwnedShopKeys] = useState<Set<string> | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<(Achievement & { ownerPct?: number }) | null>(null);
  const [lbPos, setLbPos] = useState<{ pos: number | null; totalPoints: number; achievementCount: number } | null>(
    null,
  );
  const [bannerRemoteBroken, setBannerRemoteBroken] = useState(false);

  const profileUserId = params.id ?? me?.id;
  const isOwnProfile = Boolean(me?.id && profileUserId && me.id === profileUserId);
  const isOtherUserProfile = Boolean(me?.id && profileUserId && me.id !== profileUserId);

  useEffect(() => {
    let isMounted = true;
    async function run() {
      if (!profileUserId) {
        if (isMounted) setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<ProfileResp>(`/api/users/${profileUserId}`);
        if (!isMounted) return;
        setProfile(data);
        setNickname(data.user.nickname);
        setFrameKey(data.user.frameKey);
        setBadges(data.user.badges);
        setStatusEmoji(data.user.statusEmoji ?? null);
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message ?? "Ошибка загрузки профиля");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    run();
    return () => {
      isMounted = false;
    };
  }, [profileUserId]);

  // Чужой профиль: периодически подтягиваем данные с сервера (аватар/баннер видны всем без перезагрузки).
  useEffect(() => {
    if (!profileUserId || !isOtherUserProfile) return;
    let cancelled = false;
    async function refresh() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const data = await apiFetch<ProfileResp>(`/api/users/${profileUserId}`, { silent: true });
        if (!cancelled) setProfile(data);
      } catch {
        /* оставляем предыдущее состояние */
      }
    }
    const interval = window.setInterval(refresh, 12_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [profileUserId, isOtherUserProfile]);

  useEffect(() => {
    setBannerRemoteBroken(false);
    const url = profile?.user.bannerUrl;
    if (!url) return;
    const img = new Image();
    img.onerror = () => setBannerRemoteBroken(true);
    img.src = url;
  }, [profile?.user.bannerUrl]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const rows = await apiFetch<Array<{ id: string; totalPoints: number; achievementCount: number }>>(
          "/api/leaderboard",
        );
        if (!mounted || !profileUserId) return;
        const idx = rows.findIndex((r) => r.id === profileUserId);
        if (idx >= 0) setLbPos({ pos: idx + 1, totalPoints: rows[idx]!.totalPoints, achievementCount: rows[idx]!.achievementCount });
        else setLbPos({ pos: null, totalPoints: 0, achievementCount: 0 });
      } catch {
        if (mounted) setLbPos(null);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [profileUserId]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!isOwnProfile) {
        if (mounted) setOwnedShopKeys(null);
        return;
      }
      try {
        const data = await apiFetch<{ purchasedItems: Array<{ key: string; type: string }> }>("/api/shop/me");
        if (!mounted) return;
        setOwnedShopKeys(new Set((data.purchasedItems ?? []).map((x) => x.key)));
      } catch {
        if (!mounted) return;
        setOwnedShopKeys(new Set());
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [isOwnProfile, me?.id]);

  useEffect(() => {
    if (!isOwnProfile && tab === "settings") setTab("main");
  }, [isOwnProfile, tab]);

  const frameClass = useMemo(() => {
    const f = getFrame(frameKey);
    const fx = f?.className ?? "frame--common";
    const shape = f?.shape === "square" ? "frame--shape-square" : f?.shape === "squircle" ? "frame--shape-squircle" : "";
    return `${fx} ${shape}`.trim();
  }, [frameKey]);

  const isAdmin = me?.role === "ADMIN";
  const isCreator = me?.role === "CREATOR";
  const isStaff = isAdmin || isCreator;
  const unlockedFramesList = me?.unlockedFrames ?? [];
  const allPickerFrames = useMemo(
    () => [...frames, ...(isCreator ? creatorFrames : [])],
    [isCreator],
  );

  if (loading)
    return (
      <div className="grid gap-6">
        <div className="steam-card overflow-hidden">
          <div className="relative h-48 bg-black/40">
            <div className="absolute bottom-4 left-4 flex items-end gap-4">
              <Skeleton className="h-[86px] w-[86px] rounded-full" />
              <div className="grid gap-2">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3 w-56 rounded-md" />
                <div className="mt-2 flex gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="p-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="steam-card p-4">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="mt-3 h-3 w-full rounded-md" />
                <Skeleton className="mt-2 h-3 w-5/6 rounded-md" />
              </div>
              <div className="steam-card p-4">
                <Skeleton className="h-4 w-36 rounded-md" />
                <div className="mt-3 grid gap-2">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  if (error) return <div className="steam-card p-4">{error}</div>;
  if (!profile) return null;

  const totalAchievements = profile.achievements.earned.length + profile.achievements.locked.length;
  const progress = totalAchievements ? profile.achievements.earned.length / totalAchievements : 0;
  const rarityCount = profile.achievements.earned.reduce(
    (acc, a) => {
      const key = String(a.rarity).toUpperCase();
      if (key === "EXCLUSIVE") acc.exclusive++;
      else if (key === "SECRET") acc.secret++;
      else if (key === "LEGENDARY") acc.legendary++;
      else if (key === "EPIC") acc.epic++;
      else if (key === "RARE") acc.rare++;
      else acc.common++;
      return acc;
    },
    { exclusive: 0, secret: 0, legendary: 0, epic: 0, rare: 0, common: 0 },
  );
  const recentAchievementCards = profile.achievements.earned
    .slice()
    .sort((a, b) => +new Date(b.awardedAt) - +new Date(a.awardedAt))
    .slice(0, 6)
    .map((a) => toAchievementCardModel(a, false));
  const earnedAchievementCards = profile.achievements.earned.map((a) => toAchievementCardModel(a, false));
  const lockedAchievementCards = profile.achievements.locked.map((a) => toAchievementCardModel(a, true));

  const level = Math.min(100, Math.max(1, profile.user.level ?? 1));
  const xp = profile.user.xp ?? 0;
  const xpBase = Math.floor(80 * level + 25 * level * level);
  const xpNext = level >= 100 ? xpBase + 1 : Math.floor(80 * (level + 1) + 25 * (level + 1) * (level + 1));
  const xpInto = Math.max(0, xp - xpBase);
  const xpForNext = Math.max(1, xpNext - xpBase);
  const xpPct = Math.min(1, xpInto / xpForNext);
  const statusTier = getLevelTier(level);
  const levelColor = calculateLevelColor(level);
  const presenceOnline = me?.id === profile.user.id ? true : !profile.user.blocked;
  const bannerBgUrl = bannerRemoteBroken ? DEFAULT_BANNER_URL : resolveBannerUrl(profile.user.bannerUrl);

  return (
    <div className="grid gap-6">
      <Reveal className="steam-card steam-card--hover overflow-hidden">
        <motion.div
          className="relative h-[240px] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{
            backgroundImage: `url(${bannerBgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(102,192,244,0.12),transparent_55%),radial-gradient(circle_at_80%_40%,rgba(170,90,240,0.10),transparent_55%)]" />
          <div className="absolute inset-0 backdrop-blur-[1px]" />

          <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-4 md:flex-row md:flex-nowrap md:items-end md:justify-between">
            <div className="flex items-end gap-5">
            <motion.div
              className={clsx("relative")}
              initial={{ scale: 0.9, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.05 }}
            >
              <AvatarFrame
                frameKey={frameKey}
                size={116}
                src={resolveAvatarUrl(profile.user.avatarUrl)}
                alt="avatar"
                className="drop-shadow-[0_0_24px_rgba(170,90,240,0.45)]"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl font-semibold tracking-tight">{profile.user.nickname}</div>
                <span
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] backdrop-blur",
                    profile.user.role === "ADMIN" || profile.user.role === "CREATOR" ? "glow--hover text-steam-text" : "text-steam-muted",
                  )}
                  title="Role"
                >
                  <span
                    className={clsx(
                      "h-1.5 w-1.5 rounded-full",
                      profile.user.role === "ADMIN" || profile.user.role === "CREATOR" ? "bg-steam-accent" : "bg-white/20",
                    )}
                  />
                  {profile.user.role === "ADMIN" ? "ADMIN" : profile.user.role === "CREATOR" ? "CREATOR" : "USER"}
                </span>
                {profile.user.statusEmoji ? (
                  <Tooltip content="Status">
                    <span className={clsx("badge text-xs", statusTier === "gold" ? "status--legendary" : statusTier === "blue" || statusTier === "purple" || statusTier === "pink" ? "status--rare" : "status--common")}>
                      {profile.user.statusEmoji}
                    </span>
                  </Tooltip>
                ) : null}
              </div>
              <div className="text-xs text-steam-muted">
                ID: <span className="font-mono">#{profile.user.publicId ?? "—"}</span>
              </div>
              <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] text-steam-text">
                <span className={clsx("h-2 w-2 rounded-full", presenceOnline ? "bg-steam-green shadow-[0_0_10px_rgba(92,219,149,0.8)]" : "bg-white/30")} />
                {presenceOnline ? "В сети" : "Не в сети"}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile.user.badges.slice(0, 6).map((b) => (
                  <motion.span
                    key={b}
                    whileHover={{ y: -1, scale: 1.03 }}
                    className="badge text-xs"
                    title={b}
                  >
                    <FiStar className="opacity-80" />
                    {b}
                  </motion.span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isOwnProfile ? (
                  <Button variant="primary" size="sm" onClick={() => setTab("settings")} leftIcon={<FiSave />}>
                    Настроить профиль
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => nav("/leaderboard")} leftIcon={<FiTrendingUp />}>
                    К рейтингу
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setTab("achievements")} leftIcon={<FiAward />}>
                  Все достижения
                </Button>
              </div>
            </motion.div>
          </div>

            </div>

            <div className="w-full md:ml-auto md:w-[360px]">
              <div className={clsx("rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur", "glow--base")}>
                <div className="flex items-center gap-4">
                  <LevelRing level={level} xpPct={xpPct} tier={statusTier} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-steam-muted">Уровень</span>
                      <span className="font-semibold" style={{ color: levelColor }}>{level}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={clsx(
                          "h-full rounded-full",
                          statusTier === "gold" ? "bg-yellow-300" : statusTier === "pink" ? "bg-pink-400" : statusTier === "purple" ? "bg-purple-400" : statusTier === "blue" ? "bg-steam-accent" : "bg-white/80",
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(xpPct * 100)}%` }}
                        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-steam-muted">
                      XP {xpInto} / {xpForNext}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-steam-muted">Достижения</span>
                    <span className="font-semibold text-steam-text">
                      {profile.achievements.earned.length} / {totalAchievements}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-steam-accent rarity-glow rarity-glow--rare"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(progress * 100)}%` }}
                      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-steam-muted">Открыто: {Math.round(progress * 100)}%</div>
                </div>
              </div>
            </div>
        </motion.div>

        <div className="p-4">
          <Tabs
            items={[
              { key: "main", label: "Основное", icon: <FiUser /> },
              { key: "achievements", label: "Достижения", icon: <FiAward /> },
              { key: "leaderboard", label: "Рейтинг", icon: <FiTrendingUp /> },
              ...(isOwnProfile ? [{ key: "settings" as const, label: "Настройки", icon: <FiSave /> }] : []),
            ]}
            value={tab}
            onChange={setTab}
          />

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-4"
          >
            {tab === "main" ? (
              <div className="grid gap-4">
                <div className="steam-card p-4">
                  <div className="text-sm font-semibold">Последние достижения</div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {profile.achievements.earned
                      .slice()
                      .sort((a, b) => +new Date(b.awardedAt) - +new Date(a.awardedAt))
                      .slice(0, 6)
                      .map((a, index) => (
                        <div key={a.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <AchievementCard
                            a={recentAchievementCards[index] ?? toAchievementCardModel(a, false)}
                            actionLabel="Подробности"
                            onAction={() => setSelectedAchievement(recentAchievementCards[index] ?? toAchievementCardModel(a, false))}
                          />
                          <div className="mt-2 text-xs text-steam-muted">
                            Есть у <span className="font-semibold text-steam-text">{a.ownerPct ?? 0}%</span> пользователей
                          </div>
                        </div>
                      ))}
                    {profile.achievements.earned.length === 0 ? (
                      <div className="text-sm text-steam-muted">Пока нет открытых достижений.</div>
                    ) : null}
                  </div>
                </div>

                <div className="progress-card">
                  <div className="progress-header">
                    <span>Прогресс достижений</span>
                    <span>{(progress * 100).toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar-large">
                    <div className="progress-fill" style={{ width: `${Math.round(progress * 1000) / 10}%` }} />
                  </div>
                  <div className="progress-stats">
                    <div className="stat-box">
                      <span className="stat-value">{profile.achievements.earned.length}</span>
                      <span className="stat-label">Получено</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-value">{profile.achievements.locked.length}</span>
                      <span className="stat-label">Заблокировано</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-value">{totalAchievements}</span>
                      <span className="stat-label">Всего</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs font-semibold text-steam-muted">По редкости</div>
                  <div className="rarity-breakdown">
                    {rarityCount.exclusive > 0 ? (
                      <span className="rarity-item exclusive">✦ {rarityCount.exclusive} Эксклюзив</span>
                    ) : null}
                    {rarityCount.secret > 0 ? (
                      <span className="rarity-item secret">✧ {rarityCount.secret} Секретных</span>
                    ) : null}
                    <span className="rarity-item legendary">🟡 {rarityCount.legendary} Легендарных</span>
                    <span className="rarity-item epic">🟣 {rarityCount.epic} Эпических</span>
                    <span className="rarity-item rare">🔵 {rarityCount.rare} Редких</span>
                    <span className="rarity-item common">⚪ {rarityCount.common} Обычных</span>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "achievements" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="steam-card p-4">
                  <div className="text-sm font-semibold">Открытые</div>
                  <div className="mt-3 grid gap-2">
                    {earnedAchievementCards.map((a) => (
                      <AchievementCard
                        key={a.id}
                        a={a}
                        actionLabel="Подробности"
                        onAction={() => setSelectedAchievement(a)}
                      />
                    ))}
                    {profile.achievements.earned.length === 0 ? (
                      <div className="text-sm text-steam-muted">Пока нет открытых достижений.</div>
                    ) : null}
                  </div>
                </div>
                <div className="steam-card p-4">
                  <div className="text-sm font-semibold">Закрытые</div>
                  <div className="mt-3 grid gap-2">
                    {lockedAchievementCards.map((a) => (
                      <AchievementCard
                        key={a.id}
                        a={a}
                        actionLabel="Подробности"
                        onAction={() => setSelectedAchievement(a)}
                      />
                    ))}
                    {profile.achievements.locked.length === 0 ? (
                      <div className="text-sm text-steam-muted">Все достижения открыты.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "leaderboard" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="steam-card p-4">
                  <div className="text-sm font-semibold">Рейтинг</div>
                  <div className="mt-2 text-sm text-steam-muted">Позиция и очки обновляются динамически.</div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                      <span className="text-steam-muted">Position</span>
                      <span className="font-semibold">{lbPos?.pos ? `#${lbPos.pos}` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                      <span className="text-steam-muted">Рейтинг</span>
                      <span className="font-semibold text-steam-accent">{lbPos?.totalPoints ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                      <span className="text-steam-muted">Achievements</span>
                      <span className="font-semibold">{lbPos?.achievementCount ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="steam-card p-4">
                  <div className="text-sm font-semibold">Совет</div>
                  <div className="mt-2 text-sm text-steam-muted">
                    Достижения дают XP и повышают уровень, а их редкость усиливает рейтинг в таблице участников. Монеты выдаются отдельно за задания.
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "settings" && isOwnProfile ? (
              <div className="grid gap-4 md:grid-cols-2">
                <section className="grid gap-3">
                  <div className="text-sm font-semibold">Настройки профиля</div>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Никнейм</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </label>

            <div className="grid gap-2 text-sm">
              <div className="text-steam-muted">Статус-эмодзи</div>
              <CatalogStatusPicker
                value={statusEmoji}
                onChange={setStatusEmoji}
                me={me}
                onLocked={() => {
                  toast({ kind: "info", title: "Нужна покупка", message: "Откройте магазин и купите статус." });
                  nav("/shop");
                }}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <div className="text-steam-muted">Рамка аватарки</div>
              <div className="flex flex-wrap gap-2">
                {allPickerFrames.map((f) => {
                  const allowed = canUseFrame({
                    frameKey: f.key,
                    isAdmin,
                    isCreator,
                    unlockedFrames: unlockedFramesList,
                  });
                  return (
                    <motion.button
                      key={f.key}
                      type="button"
                      whileHover={{ y: allowed ? -1 : 0 }}
                      whileTap={{ scale: allowed ? 0.98 : 1 }}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                        frameKey === f.key
                          ? "border-steam-accent bg-white/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                        !allowed && "cursor-not-allowed opacity-45 hover:bg-white/5",
                      )}
                      onClick={() => {
                        if (!allowed) {
                          toast({ kind: "info", title: "Нужна покупка", message: "Откройте магазин и купите рамку." });
                          nav("/shop");
                          return;
                        }
                        setFrameKey(f.key);
                      }}
                      title={
                        f.creatorOnly
                          ? "Только для создателя платформы"
                          : f.adminOnly && !isStaff
                            ? "Только для админов"
                            : !allowed
                              ? "Купить в магазине"
                              : f.animated
                                ? "Анимированная"
                                : "Статичная"
                      }
                    >
                      {!allowed ? <FiLock className="shrink-0 opacity-70" /> : null}
                      <AvatarFrame
                        frameKey={f.key}
                        size={26}
                        src={resolveAvatarUrl(profile.user.avatarUrl)}
                      />
                      <span className="truncate">{f.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="text-steam-muted">Статусные значки</div>
              <div className="flex flex-wrap gap-2">
                {badgeCatalog.map((b) => {
                  const active = badges.includes(b.key);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      className={clsx(
                        "badge text-xs",
                        active ? "border-steam-accent/40 bg-steam-accent/10" : "hover:bg-white/10",
                      )}
                      onClick={() => {
                        setBadges((prev) => (prev.includes(b.key) ? prev.filter((x) => x !== b.key) : [...prev, b.key]));
                      }}
                    >
                      <span className={clsx("h-2 w-2 rounded-full", active ? "bg-steam-green" : "bg-white/20")} />
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="text-steam-muted">Интерфейсный звук</div>
              <button
                type="button"
                className={clsx(
                  "inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  soundEnabled ? "border-steam-accent/40 bg-steam-accent/10" : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <FiVolume2 /> : <FiVolumeX />}
                {soundEnabled ? "Звук включён" : "Звук выключен"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <UploadImageButton
                label="Загрузить аватар"
                icon={<FiImage />}
                onUploadError={(msg) => toast({ kind: "error", title: "Аватар", message: msg })}
                onPick={async (file) => {
                  await apiUpload<{ avatarUrl: string }>("/api/users/me/avatar", file);
                  await hydrate();
                  const data = await apiFetch<ProfileResp>(`/api/users/${profile.user.id}`);
                  setProfile(data);
                  toast({ kind: "success", title: "Аватар обновлён" });
                }}
              />
              <UploadImageButton
                label="Загрузить баннер"
                icon={<FiImage />}
                onUploadError={(msg) => toast({ kind: "error", title: "Баннер", message: msg })}
                onPick={async (file) => {
                  await apiUpload<{ bannerUrl: string }>("/api/users/me/banner", file);
                  await hydrate();
                  const data = await apiFetch<ProfileResp>(`/api/users/${profile.user.id}`);
                  setProfile(data);
                  toast({ kind: "success", title: "Баннер обновлён" });
                }}
              />

              <Button
                loading={saving}
                leftIcon={<FiSave />}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  try {
                    await apiJson("/api/users/me", { nickname, frameKey, badges, statusEmoji }, "PATCH");
                    const data = await apiFetch<ProfileResp>(`/api/users/${profile.user.id}`);
                    setProfile(data);
                    await hydrate();
                    setBurstKey((x) => x + 1);
                    setTab("main");
                    toast({ kind: "success", title: "Профиль обновлён" });
                  } catch (e: any) {
                    setError(e?.message ?? "Не удалось сохранить");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Сохранить
              </Button>
            </div>
                </section>

                <section className="grid gap-3">
                  <div className="text-sm font-semibold">Preview</div>
                  <div className="steam-card p-4">
                    <div className="text-xs text-steam-muted">How your profile looks</div>
                    <div className="mt-3 flex items-center gap-3">
                      <AvatarFrame frameKey={frameKey} size={48} src={resolveAvatarUrl(profile.user.avatarUrl)} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {nickname} {statusEmoji ? <span className="ml-2">{statusEmoji}</span> : null}
                        </div>
                        <div className="text-xs text-steam-muted">Frame: {frameKey ?? "default"}</div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </motion.div>
        </div>
      </Reveal>

      <ConfettiBurst burstKey={burstKey} />

      <Modal
        open={Boolean(selectedAchievement)}
        title={selectedAchievement ? `Достижение: ${selectedAchievement.title}` : "Достижение"}
        onClose={() => setSelectedAchievement(null)}
      >
        {selectedAchievement ? (
          <div className="grid gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={clsx(
                "relative overflow-hidden rounded-[22px] border p-3",
                rarityPanelClass(selectedAchievement.rarity),
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_85%_100%,rgba(102,192,244,0.12),transparent_34%)]" />
              <div className="relative">
                <AchievementCard a={selectedAchievement} />
              </div>
            </motion.div>

            <div className="flex flex-wrap gap-2">
              <span className="badge text-xs">{rarityLabel(selectedAchievement.rarity)}</span>
              <span className="badge text-xs">+{selectedAchievement.points} XP</span>
              <span className="badge text-xs">{selectedAchievement.earned ? "Открыто" : "Заблокировано"}</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-steam-muted">Описание</div>
              <div className="mt-2 text-sm leading-7 text-steam-text">{selectedAchievement.description}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-steam-muted">Статус</div>
                <div className="mt-2 text-sm text-white">
                  {selectedAchievement.earned ? "Достижение уже получено и добавлено в профиль." : "Достижение еще не открыто."}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-steam-muted">Когда получено</div>
                <div className="mt-2 text-sm text-white">
                  {selectedAchievement.awardedAt ? new Date(selectedAchievement.awardedAt).toLocaleString() : "Еще не получено"}
                </div>
              </div>
            </div>

            {selectedAchievement.ownerPct !== undefined ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-steam-text">
                Это достижение есть примерно у <span className="font-semibold text-white">{selectedAchievement.ownerPct}%</span> пользователей.
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSelectedAchievement(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="grid gap-3 md:grid-cols-2">
        <Reveal className="steam-card p-4">
          <div className="text-sm font-semibold">Чайные достижения</div>
          <div className="mt-2 text-sm text-steam-muted">
            Это внутренняя клановая система, где администрация создаёт достижения для участников, а игроки выполняют их
            внутри жизни клана. Сайт нужен, чтобы подогревать интерес к активностям, фиксировать прогресс и превращать
            участие в клане в понятную игру с наградами, уровнями и рейтингом.
          </div>
        </Reveal>

        <Reveal className="steam-card p-4" delay={0.04}>
          <div className="text-sm font-semibold">Почему это полезно</div>
          <div className="mt-2 text-sm text-steam-muted">
            Участники получают понятные цели, дополнительную мотивацию и красивую витрину прогресса. Администрация
            получает инструмент для проведения клановых активностей, событий и челленджей, а весь клан видит, кто
            действительно вовлечён и развивается.
          </div>
        </Reveal>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Reveal className="steam-card p-4">
          <div className="text-sm font-semibold">Как начать</div>
          <div className="mt-2 text-sm text-steam-muted">
            Открой профиль, посмотри список доступных достижений и следи за уведомлениями. Если администрация добавит
            новые задания или ответит на предложение, это сразу отобразится в системе.
          </div>
        </Reveal>

        <Reveal className="steam-card p-4" delay={0.03}>
          <div className="text-sm font-semibold">Что даёт прогресс</div>
          <div className="mt-2 text-sm text-steam-muted">
            Выполнение достижений приносит XP, повышает уровень и продвигает в рейтинге. Монеты для магазина начисляются за задания и одобренные активности.
            Чем реже и сложнее достижение, тем заметнее оно усиливает профиль и положение в топе.
          </div>
        </Reveal>

        <Reveal className="steam-card p-4" delay={0.06}>
          <div className="text-sm font-semibold">Обратная связь</div>
          <div className="mt-2 text-sm text-steam-muted">
            Отправляйте предложения и жалобы через меню в шапке. Так администрация быстрее улучшает баланс, задания и
            стабильность платформы для всего клана.
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function getLevelTier(level: number): "white" | "blue" | "purple" | "pink" | "gold" {
  if (level >= 75) return "gold";
  if (level >= 50) return "pink";
  if (level >= 25) return "purple";
  if (level >= 10) return "blue";
  return "white";
}

function LevelRing(props: { level: number; xpPct: number; tier: "white" | "blue" | "purple" | "pink" | "gold" }) {
  const size = 78;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, props.xpPct)) * circumference;
  const color =
    props.tier === "gold" ? "#ffd76a" : props.tier === "pink" ? "#f472b6" : props.tier === "purple" ? "#c084fc" : props.tier === "blue" ? "#66c0f4" : "#f3f4f6";
  return (
    <div className="relative h-[78px] w-[78px] shrink-0 rounded-full bg-black/35 ring-1 ring-white/10">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference - dash}` }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-lg font-bold" style={{ color: calculateLevelColor(props.level) }}>
        {props.level}
      </div>
    </div>
  );
}

function AchievementRow(props: { title: string; desc: string; iconUrl: string | null; locked: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3",
        props.locked ? "opacity-60" : "opacity-100",
      )}
    >
      <AchievementIcon iconUrl={props.iconUrl} alt={props.title} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{props.title}</div>
        <div className="truncate text-xs text-steam-muted">{props.desc}</div>
      </div>
      {props.locked ? <div className="ml-auto text-xs text-steam-muted">Закрыто</div> : <div className="ml-auto text-xs text-steam-green">Открыто</div>}
    </motion.div>
  );
}

function toAchievementCardModel(
  item:
    | ProfileResp["achievements"]["earned"][number]
    | ProfileResp["achievements"]["locked"][number],
  locked: boolean,
): Achievement & { ownerPct?: number } {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    rarity: String(item.rarity).toUpperCase() as Rarity,
    points: item.points,
    iconUrl: item.iconUrl,
    frameKey: item.frameKey,
    isPublic: true,
    createdAt: new Date().toISOString(),
    earned: !locked,
    awardedAt: locked ? null : ("awardedAt" in item ? item.awardedAt : null),
    ownerPct: "ownerPct" in item ? item.ownerPct : undefined,
  };
}

function rarityLabel(rarity: Rarity): string {
  switch (rarity) {
    case "RARE":
      return "Редкое";
    case "EPIC":
      return "Эпическое";
    case "LEGENDARY":
      return "Легендарное";
    case "SECRET":
      return "Секретное";
    case "EXCLUSIVE":
      return "Эксклюзивное";
    default:
      return "Обычное";
  }
}

function rarityPanelClass(rarity: Rarity): string {
  switch (rarity) {
    case "RARE":
      return "border-blue-400/35 bg-[linear-gradient(135deg,rgba(30,58,138,0.28),rgba(8,12,20,0.92))] shadow-[0_0_40px_rgba(59,130,246,0.10)]";
    case "EPIC":
      return "border-violet-400/35 bg-[linear-gradient(135deg,rgba(88,28,135,0.30),rgba(8,12,20,0.92))] shadow-[0_0_42px_rgba(168,85,247,0.12)]";
    case "LEGENDARY":
      return "border-amber-300/35 bg-[linear-gradient(135deg,rgba(120,53,15,0.30),rgba(10,12,18,0.92))] shadow-[0_0_46px_rgba(251,191,36,0.12)]";
    case "SECRET":
      return "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(6,78,59,0.28),rgba(7,10,18,0.92))] shadow-[0_0_46px_rgba(45,212,191,0.12)]";
    case "EXCLUSIVE":
      return "border-pink-300/35 bg-[linear-gradient(135deg,rgba(131,24,67,0.28),rgba(12,10,20,0.92))] shadow-[0_0_52px_rgba(244,114,182,0.14)]";
    default:
      return "border-white/10 bg-[linear-gradient(135deg,rgba(30,41,59,0.45),rgba(8,12,20,0.92))] shadow-[0_0_34px_rgba(148,163,184,0.08)]";
  }
}

function UploadImageButton(props: {
  label: string;
  icon?: React.ReactNode;
  onPick: (file: File) => Promise<void>;
  onUploadError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label
      className={clsx(
        "cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10",
        busy && "opacity-60",
      )}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            await props.onPick(file);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Не удалось загрузить файл";
            props.onUploadError?.(msg);
          } finally {
            setBusy(false);
            e.currentTarget.value = "";
          }
        }}
        disabled={busy}
      />
      <span className="inline-flex items-center gap-2">
        {props.icon ? <span className="text-base opacity-80">{props.icon}</span> : null}
        {busy ? "Загрузка…" : props.label}
      </span>
    </label>
  );
}

function CatalogStatusPicker(props: {
  value: string | null;
  onChange: (v: string | null) => void;
  me: Me | null;
  onLocked: () => void;
}) {
  const unlocked = props.me?.unlockedStatuses ?? [];
  const admin = props.me?.role === "ADMIN" || props.me?.role === "CREATOR";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={clsx(
          "badge text-xs",
          !props.value ? "border-steam-accent/40 bg-steam-accent/10" : "hover:bg-white/10",
        )}
        onClick={() => props.onChange(null)}
        title="Без статуса"
      >
        —
      </button>
      {statusEmojiCatalog.map((s) => {
        const allowed = s.adminOnly ? admin : admin || unlocked.includes(s.key);
        const active = props.value === s.emoji;
        return (
          <motion.button
            key={s.key}
            type="button"
            whileHover={allowed ? { y: -1, scale: 1.05 } : undefined}
            whileTap={{ scale: allowed ? 0.98 : 1 }}
            className={clsx(
              "badge text-xs",
              active ? "border-steam-accent/40 bg-steam-accent/10" : "hover:bg-white/10",
              !allowed && "opacity-45",
            )}
            title={allowed ? s.label : "Купить в магазине"}
            onClick={() => {
              if (!allowed) {
                props.onLocked();
                return;
              }
              props.onChange(s.emoji);
            }}
          >
            {!allowed ? <FiLock className="mr-1 inline opacity-70" /> : null}
            {s.emoji}
          </motion.button>
        );
      })}
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
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-20 h-2 w-2 rounded-sm bg-steam-accent"
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
              animate={{
                x: (Math.random() * 2 - 1) * 240,
                y: Math.random() * 220 + 60,
                rotate: Math.random() * 540,
                opacity: 0,
                scale: 0.6,
              }}
              transition={{ duration: 0.9 + Math.random() * 0.35, ease: "easeOut" }}
              style={{
                background:
                  i % 3 === 0 ? "rgba(102,192,244,0.95)" : i % 3 === 1 ? "rgba(92,219,149,0.9)" : "rgba(255,190,70,0.9)",
              }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}


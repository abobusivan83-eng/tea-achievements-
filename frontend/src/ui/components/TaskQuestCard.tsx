import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import type { Rarity, SupportStatus, TaskItem } from "../../lib/types";
import { rarityGlowClass } from "../rarityStyles";
import { Button } from "./Button";
import { AchievementIcon } from "./AchievementIcon";
import { FiAward, FiChevronDown, FiClock, FiLock, FiUpload } from "react-icons/fi";

function statusLabel(s: SupportStatus) {
  switch (s) {
    case "PENDING":
      return "На проверке";
    case "REVIEWED":
      return "Рассмотрено";
    case "RESOLVED":
      return "Принято";
    case "REJECTED":
      return "Отклонено";
    default:
      return s;
  }
}

function rarityClassFrom(r: Rarity | undefined) {
  if (!r) return "rarity-common";
  switch (r) {
    case "EXCLUSIVE":
      return "rarity-exclusive";
    case "SECRET":
      return "rarity-secret";
    case "LEGENDARY":
      return "rarity-legendary";
    case "EPIC":
      return "rarity-epic";
    case "RARE":
      return "rarity-rare";
    default:
      return "rarity-common";
  }
}

function rarityShortRu(r: Rarity | undefined) {
  if (!r) return "";
  switch (r) {
    case "COMMON":
      return "Обычное";
    case "RARE":
      return "Редкое";
    case "EPIC":
      return "Эпическое";
    case "LEGENDARY":
      return "Легендарное";
    case "EXCLUSIVE":
      return "Эксклюзив";
    case "SECRET":
      return "Секретное";
    default:
      return r;
  }
}

type TaskKind = "event" | "timed" | "permanent";
type TaskScheduleStatus = "UPCOMING" | "ACTIVE" | "EXPIRED";
export type TaskQuestCardVariant = "available" | "completed";

function taskKind(t: TaskItem): TaskKind {
  if (t.isEvent) return "event";
  if (t.startsAt && t.endsAt) return "timed";
  return "permanent";
}

function kindLabel(k: TaskKind) {
  switch (k) {
    case "event":
      return "Ивентовое";
    case "timed":
      return "Временное";
    case "permanent":
      return "Постоянное";
  }
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return "00:00";
  const total = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatCountdown(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function scheduleStatusFromTime(startsAt: string | null, endsAt: string | null, nowMs: number): TaskScheduleStatus {
  const s = startsAt ? new Date(startsAt).getTime() : null;
  const e = endsAt ? new Date(endsAt).getTime() : null;
  if (s !== null && nowMs < s) return "UPCOMING";
  if (e !== null && nowMs > e) return "EXPIRED";
  return "ACTIVE";
}

function formatUpcomingText(startsAt: string | null, nowMs: number) {
  if (!startsAt) return "Ожидайте начала";
  const startMs = new Date(startsAt).getTime();
  const delta = startMs - nowMs;
  if (!Number.isFinite(delta) || delta <= 0) return `Старт: ${new Date(startsAt).toLocaleString()}`;
  const totalSeconds = Math.floor(delta / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `Откроется: ${new Date(startsAt).toLocaleString()}`;
  return `Откроется через: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TaskQuestCard(props: {
  task: TaskItem;
  variant?: TaskQuestCardVariant;
  expanded: boolean;
  showForm: boolean;
  nowMs: number;
  onToggleExpand: () => void;
  onOpenForm: () => void;
  message: string;
  onMessageChange: (v: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  submitting: boolean;
  uploadProgress: number;
  uploadStatus: string | null;
  onSubmit: () => void;
}) {
  const variant = props.variant ?? "available";
  const reduce = useReducedMotion();
  const [syncedNowMs, setSyncedNowMs] = useState(props.nowMs);
  const [videoDurationByUrl, setVideoDurationByUrl] = useState<Record<string, number>>({});

  const t = props.task;
  const sub = t.mySubmission;
  const ach = t.achievement;
  const resolved = sub?.status === "RESOLVED";
  const rarity = ach?.rarity;
  const rClass = rarityClassFrom(rarity);
  const glow = rarityGlowClass(rarity ?? "COMMON", resolved);
  const kind = taskKind(t);
  const scheduleStatus = scheduleStatusFromTime(t.startsAt, t.endsAt, syncedNowMs);
  const scheduleLocked = scheduleStatus !== "ACTIVE";
  const overlayAllowed = variant === "available" && scheduleLocked && !resolved;
  const startsAtMs = t.startsAt ? new Date(t.startsAt).getTime() : null;
  const upcomingRemainingMs = startsAtMs !== null ? Math.max(0, startsAtMs - syncedNowMs) : 0;
  const scheduleLockText =
    scheduleStatus === "UPCOMING"
      ? formatUpcomingText(t.startsAt, syncedNowMs)
      : scheduleStatus === "EXPIRED"
        ? "Ивент завершен"
        : "";
  const canSubmit =
    variant === "available" &&
    scheduleStatus === "ACTIVE" &&
    (!sub || sub.status === "REJECTED" || (sub.status !== "PENDING" && sub.status !== "REVIEWED" && sub.status !== "RESOLVED"));

  const hoverLift = resolved ? -5 : kind === "event" ? -4 : -2;
  const previewItems = useMemo(
    () =>
      props.files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: /^video\//.test(file.type),
      })),
    [props.files],
  );

  useEffect(() => {
    return () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previewItems]);

  useEffect(() => {
    setSyncedNowMs(props.nowMs);
    const localStart = Date.now();
    const intervalId = window.setInterval(() => {
      setSyncedNowMs(props.nowMs + (Date.now() - localStart));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [props.nowMs]);

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      whileHover={reduce ? undefined : { y: hoverLift, scale: 1.012 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={clsx(
        "achievement-card task-card group relative overflow-hidden",
        rClass,
        overlayAllowed && "is-locked",
        glow,
        kind === "event" && "task-card--event",
        kind === "timed" && "task-card--timed",
        kind === "permanent" && "task-card--permanent",
      )}
    >
      {kind === "event" ? <div className="task-card__event-halo" aria-hidden /> : null}

      {!reduce && kind === "event" ? (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
          <div className="absolute -inset-[45%] bg-[linear-gradient(90deg,transparent,rgba(253,224,71,0.12),transparent)] [transform:translateX(-60%)_rotate(16deg)] animate-[shine_2.4s_ease-in-out_infinite]" />
        </div>
      ) : null}

      <button type="button" className="task-card__header relative z-0" onClick={() => props.onToggleExpand()}>
        <div className="ach-icon-box">
          <AchievementIcon
            iconUrl={ach?.iconUrl}
            alt={ach?.title ?? t.title}
            sizeClassName="ach-icon"
            className="border-[2px] border-[rgba(61,68,80,0.85)] bg-[rgba(0,0,0,0.35)]"
          />
          {resolved ? <div className="ach-check">✓</div> : null}
        </div>

        <div className="ach-content min-w-0">
          <div className="ach-title">{t.title}</div>
          <div className="ach-desc">{t.description}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "task-kind-badge",
                kind === "event" && "task-kind-badge--event",
                kind === "timed" && "task-kind-badge--timed",
                kind === "permanent" && "task-kind-badge--permanent",
              )}
            >
              {kindLabel(kind)}
            </span>
            {t.styleTag ? (
              <span className="task-kind-badge border-white/15 bg-white/[0.06] text-steam-muted normal-case tracking-normal">
                {t.styleTag}
              </span>
            ) : null}
            {ach ? (
              <span className="ach-reward">
                +{ach.points} XP
                {typeof t.rewardCoins === "number" && t.rewardCoins > 0 ? ` · ${t.rewardCoins} мон.` : ""}
              </span>
            ) : null}
            {sub ? (
              <span
                className={clsx(
                  "ml-auto shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  sub.status === "RESOLVED"
                    ? "border-steam-green/45 bg-steam-green/12 text-steam-green"
                    : sub.status === "REJECTED"
                      ? "border-red-400/40 bg-red-500/12 text-red-200"
                      : "border-white/15 bg-white/5 text-steam-muted",
                )}
              >
                {statusLabel(sub.status)}
              </span>
            ) : null}
          </div>
        </div>

        <FiChevronDown className={clsx("task-card__chevron h-5 w-5", props.expanded && "task-card__chevron--open")} />
      </button>

      <AnimatePresence initial={false}>
        {props.expanded ? (
          <motion.div
            key="body"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="task-card__body relative z-0 mt-3 border-t border-white/10 pt-3"
          >
            <div className="task-conditions-block">
              <div className="task-conditions-block__label">Условия выполнения</div>
              <div className="whitespace-pre-line">{t.conditions}</div>
            </div>

            {(t.startsAt || t.endsAt) && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/22 px-3 py-2 text-[12px] text-steam-muted">
                <FiClock className="h-4 w-4 shrink-0 text-steam-accent opacity-80" />
                {t.startsAt ? <span>Старт: {new Date(t.startsAt).toLocaleString()}</span> : null}
                {t.endsAt ? <span>Окончание: {new Date(t.endsAt).toLocaleString()}</span> : null}
              </div>
            )}

            {ach ? (
              <div className="task-reward-panel">
                <div className="task-reward-panel__title">Награда</div>
                <div className="task-reward-row">
                  <div className="task-reward-ach">
                    <AchievementIcon iconUrl={ach.iconUrl} alt={ach.title} className="task-reward-ach__icon" />
                    <div className="task-reward-ach__meta min-w-0">
                      <div className="flex items-center gap-1.5">
                        <FiAward className="h-3.5 w-3.5 shrink-0 text-emerald-300/90" />
                        <span className="task-reward-ach__name truncate">{ach.title}</span>
                      </div>
                      <div className="task-reward-ach__sub">
                        Достижение · {rarityShortRu(ach.rarity)} · +{ach.points} очков
                      </div>
                    </div>
                  </div>
                  {typeof t.rewardCoins === "number" && t.rewardCoins > 0 ? (
                    <div className="task-reward-coins shrink-0">+{t.rewardCoins} монет</div>
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-steam-muted">
                      Монеты не начисляются
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {sub?.adminResponse ? (
              <div className="rounded-lg border border-steam-accent/30 bg-steam-accent/10 p-3 text-sm">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-steam-muted">Ответ администрации</div>
                <div className="mt-1.5 whitespace-pre-line text-steam-text">{sub.adminResponse}</div>
              </div>
            ) : null}

            {variant === "completed" && resolved && sub ? (
              <div className="rounded-lg border border-steam-green/35 bg-steam-green/10 px-3 py-2.5 text-sm text-steam-text">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-steam-green">Выполнено вами</div>
                <div className="mt-1 text-[13px] text-steam-muted">
                  Принято модерацией: <span className="font-semibold text-steam-text">{new Date(sub.reviewedAt ?? sub.createdAt).toLocaleString()}</span>
                </div>
                {sub.reviewedByNickname ? (
                  <div className="mt-1 text-[13px] text-steam-muted">
                    Администратор, выдавший награду: <span className="font-semibold text-steam-text">{sub.reviewedByNickname}</span>
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-steam-muted">
                  Задание остаётся доступным для остальных участников; награда привязана к вашему профилю.
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {variant === "completed" ? null : canSubmit ? (
                <Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); props.onOpenForm(); }}>
                  {props.showForm ? "Скрыть форму" : sub ? "Отправить снова" : "Отправить доказательства"}
                </Button>
              ) : scheduleStatus === "UPCOMING" ? (
                <span className="text-xs text-steam-muted">{scheduleLockText}</span>
              ) : scheduleStatus === "EXPIRED" ? (
                <span className="text-xs text-steam-muted">Ивент завершен</span>
              ) : (
                <span className="text-xs text-steam-muted">Ожидайте решения по текущей отправке.</span>
              )}
            </div>

            <AnimatePresence initial={false}>
              {variant === "available" && props.showForm && canSubmit ? (
                <motion.div
                  key="form"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid gap-3 border-t border-white/10 pt-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-steam-muted">Комментарий (мин. 10 символов)</span>
                      <textarea
                        className="min-h-[100px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                        value={props.message}
                        onChange={(e) => props.onMessageChange(e.target.value)}
                        placeholder="Опишите выполнение задания"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-steam-muted">Фото или видео (до 8 файлов, до 100 МБ на файл)</span>
                      <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">
                        <FiUpload />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                          multiple
                          className="hidden"
                          onChange={(e) => props.onFilesChange(Array.from(e.target.files ?? []).slice(0, 8))}
                        />
                        Выбрать файлы
                      </span>
                      {props.files.length ? <span className="text-xs text-steam-muted">Выбрано: {props.files.length}</span> : null}
                      {previewItems.length ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {previewItems.map((item) => (
                            <div key={item.url} className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                              <div className="relative">
                                {item.isVideo ? (
                                  <video
                                    src={item.url}
                                    className="h-28 w-full bg-black object-cover"
                                    muted
                                    preload="metadata"
                                    onLoadedMetadata={(e) => {
                                      const duration = e.currentTarget.duration;
                                      setVideoDurationByUrl((prev) => ({ ...prev, [item.url]: duration }));
                                    }}
                                  />
                                ) : (
                                  <img src={item.url} alt={item.file.name} loading="lazy" decoding="async" className="h-28 w-full object-cover" />
                                )}
                                <div className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                                  {item.isVideo ? "Видео" : "Фото"}
                                </div>
                                {item.isVideo ? (
                                  <div className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                                    {formatDuration(videoDurationByUrl[item.url])}
                                  </div>
                                ) : null}
                              </div>
                              <div className="truncate px-2 py-1.5 text-[11px] text-steam-muted" title={item.file.name}>
                                {item.file.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {props.uploadStatus ? <span className="text-xs text-steam-muted">{props.uploadStatus}</span> : null}
                      {props.submitting ? (
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-steam-accent transition-[width] duration-150"
                            style={{ width: `${Math.max(2, props.uploadProgress)}%` }}
                          />
                        </div>
                      ) : null}
                    </label>
                    <div className="flex justify-end">
                      <Button
                        loading={props.submitting}
                        variant="primary"
                        onClick={() => props.onSubmit()}
                        disabled={props.message.trim().length < 10 || props.submitting}
                      >
                        Отправить
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {overlayAllowed ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[12px] bg-[#020817]/88 backdrop-blur-2xl">
          <div className="flex max-w-[88%] flex-col items-center justify-center px-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/25 bg-[#020817]/95 text-steam-accent shadow-[0_0_28px_rgba(102,192,244,0.24)]">
              <FiLock className="h-7 w-7" />
            </div>
            <div className="mt-4 text-[11px] font-black uppercase tracking-[0.28em] text-steam-muted/80">
              {scheduleStatus === "UPCOMING" ? "Открытие задания" : "Доступ закрыт"}
            </div>
            {scheduleStatus === "UPCOMING" ? (
              <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-5 py-3 shadow-[0_0_24px_rgba(34,211,238,0.14)]">
                <div className="font-mono text-2xl font-black tracking-[0.22em] text-cyan-100">
                  {formatCountdown(upcomingRemainingMs)}
                </div>
              </div>
            ) : null}
            <div className="mt-4 max-w-[280px] text-sm font-bold leading-relaxed text-steam-text/92 drop-shadow-lg">
              {scheduleStatus === "UPCOMING" ? "Задание автоматически откроется, когда таймер дойдёт до нуля." : scheduleLockText}
            </div>
          </div>
        </div>
      ) : null}

      {!reduce &&
      resolved &&
      ach &&
      (ach.rarity === "RARE" ||
        ach.rarity === "EPIC" ||
        ach.rarity === "LEGENDARY" ||
        ach.rarity === "EXCLUSIVE" ||
        ach.rarity === "SECRET") ? (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
          <div className="absolute -inset-[40%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] [transform:translateX(-65%)_rotate(18deg)] animate-[shine_2.2s_ease-in-out_infinite]" />
        </div>
      ) : null}
    </motion.div>
  );
}

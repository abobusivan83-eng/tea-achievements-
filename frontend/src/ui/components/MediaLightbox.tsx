import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { isEvidenceVideoUrl } from "../../lib/media";
import { FiPause, FiPlay, FiX, FiChevronLeft, FiChevronRight, FiMinus, FiPlus } from "react-icons/fi";

type MediaLightboxProps = {
  open: boolean;
  onClose: () => void;
  items: readonly string[];
  initialIndex?: number;
};

function preloadImage(url: string) {
  if (!url || isEvidenceVideoUrl(url)) return;
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  } catch {
    /* noop */
  }
}

export function MediaLightbox(props: MediaLightboxProps) {
  const { open, onClose, items, initialIndex = 0 } = props;
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mediaError, setMediaError] = useState(false);
  /** Только чтобы обновить кнопку play/pause */
  const [videoPlayingUi, setVideoPlayingUi] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const count = items.length;
  const current = count > 0 ? items[Math.min(index, count - 1)]! : "";
  const isVideo = Boolean(current && isEvidenceVideoUrl(current));

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setZoom(1);
      setIndex((i) => {
        const n = i + delta;
        if (n < 0) return count - 1;
        if (n >= count) return 0;
        return n;
      });
    },
    [count],
  );

  useEffect(() => {
    if (!open) return;
    const clamped = count > 0 ? Math.min(Math.max(0, initialIndex), count - 1) : 0;
    setIndex(clamped);
    setZoom(1);
    setMediaError(false);
  }, [open, initialIndex, count]);

  useEffect(() => {
    setMediaError(false);
    const v = videoRef.current;
    if (v && isVideo) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        /* noop */
      }
      setVideoPlayingUi(false);
    }

    const next = items[index + 1];
    const prev = items[index - 1];
    if (prev) preloadImage(prev);
    if (next) preloadImage(next);
  }, [index, items, isVideo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === " " && videoRef.current) {
        e.preventDefault();
        const v = videoRef.current;
        if (v.paused) void v.play().catch(() => undefined);
        else v.pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || count === 0) return null;

  const label = `${Math.min(index + 1, count)} из ${count}`;

  return (
    <AnimatePresence mode="sync">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Просмотр вложений, ${label}`}
        initial={reduced ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? undefined : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className="fixed inset-0 z-[10050] flex flex-col bg-black/92 backdrop-blur-md"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0 text-sm font-bold tracking-wide text-white/90">{label}</div>
          <div className="flex shrink-0 items-center gap-2">
            {!isVideo ? (
              <>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20"
                  onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                  aria-label="Уменьшить"
                >
                  <FiMinus className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  aria-label="Увеличить"
                >
                  <FiPlus className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) void v.play().catch(() => undefined);
                  else v.pause();
                }}
                aria-label="Воспроизвести или пауза"
              >
                <span className="inline-flex items-center gap-1">
                  {videoPlayingUi ? (
                    <>
                      <FiPause className="h-4 w-4" aria-hidden /> Пауза
                    </>
                  ) : (
                    <>
                      <FiPlay className="h-4 w-4" aria-hidden /> Играть
                    </>
                  )}
                </span>
              </button>
            )}
            <button
              type="button"
              className="rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/22"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <FiX className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-x items-center justify-center overflow-hidden px-2 pb-28 pt-4 sm:px-6"
          onWheel={(e) => {
            if (isVideo) return;
            e.preventDefault();
            setZoom((z) => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.1 : -0.1))));
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 1) swipeRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
          }}
          onTouchEnd={(e) => {
            if (!swipeRef.current || count <= 1 || zoom > 1) {
              swipeRef.current = null;
              return;
            }
            const t = e.changedTouches[0];
            if (!t) {
              swipeRef.current = null;
              return;
            }
            const dx = t.clientX - swipeRef.current.x;
            const dy = Math.abs(t.clientY - swipeRef.current.y);
            swipeRef.current = null;
            if (Math.abs(dx) < 54 || dy > 90) return;
            if (dx > 0) go(-1);
            else go(1);
          }}
        >
          {count > 1 ? (
            <button
              type="button"
              className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-3 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 sm:flex"
              aria-label="Предыдущее"
              onClick={() => go(-1)}
            >
              <FiChevronLeft className="h-7 w-7" aria-hidden />
            </button>
          ) : null}
          {count > 1 ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-3 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 sm:flex"
              aria-label="Следующее"
              onClick={() => go(1)}
            >
              <FiChevronRight className="h-7 w-7" aria-hidden />
            </button>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={reduced ? undefined : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -10 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
              className="flex max-h-[min(76vh,calc(100vh-220px))] max-w-[min(96vw,1200px)] items-center justify-center"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {mediaError ? (
                <div className="max-w-md rounded-xl border border-amber-500/35 bg-black/65 px-6 py-4 text-center text-sm text-amber-100">
                  Не удалось загрузить медиа.
                  <div className="mt-2 text-xs text-white/55">
                    Если файл был удалён с сервера, откройте заявку повторно позже или запросите повторную отправку.
                  </div>
                </div>
              ) : isVideo ? (
                <video
                  ref={videoRef}
                  src={current}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[min(76vh,calc(100vh-220px))] max-w-full rounded-xl object-contain shadow-2xl"
                  onPlaying={() => setVideoPlayingUi(true)}
                  onPause={() => setVideoPlayingUi(false)}
                  onEnded={() => setVideoPlayingUi(false)}
                  onError={() => setMediaError(true)}
                />
              ) : (
                <img
                  role="presentation"
                  src={current}
                  alt=""
                  decoding="async"
                  loading="eager"
                  draggable={false}
                  className="max-h-[min(76vh,calc(100vh-220px))] max-w-[min(96vw,1200px)] object-contain shadow-2xl transition-transform duration-150"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                    cursor: zoom > 1 ? "grab" : "zoom-in",
                  }}
                  onDoubleClick={(ev) => {
                    ev.preventDefault();
                    setZoom((z) => (z <= 1 ? 2 : 1));
                  }}
                  onError={() => setMediaError(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {count > 1 ? (
            <div className="absolute inset-x-0 bottom-14 flex justify-center gap-28 sm:hidden">
              <button
                type="button"
                className="rounded-full border border-white/20 bg-black/50 p-3 text-white shadow-md"
                aria-label="Предыдущее"
                onClick={() => go(-1)}
              >
                <FiChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                className="rounded-full border border-white/20 bg-black/50 p-3 text-white shadow-md"
                aria-label="Следующее"
                onClick={() => go(1)}
              >
                <FiChevronRight className="h-6 w-6" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>

        {count > 1 ? (
          <div className="shrink-0 border-t border-white/10 bg-black/75 px-2 py-2 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto pb-1">
              {items.map((u, i) => (
                <button
                  type="button"
                  key={`${u}-${i}`}
                  className={clsx(
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                    i === index ? "border-steam-accent shadow-md shadow-steam-accent/35" : "border-transparent opacity-55 hover:opacity-100",
                  )}
                  onClick={() => {
                    setZoom(1);
                    setIndex(i);
                  }}
                  aria-current={i === index}
                  aria-label={`Вложение ${i + 1}`}
                >
                  {isEvidenceVideoUrl(u) ? (
                    <span className="flex h-full w-full items-center justify-center bg-neutral-900 text-[9px] font-semibold uppercase text-white">
                      Видео
                    </span>
                  ) : (
                    <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

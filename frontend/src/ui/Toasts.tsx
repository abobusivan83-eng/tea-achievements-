import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useToasts } from "../state/toasts";
import clsx from "clsx";

export function Toasts() {
  const { toasts, remove } = useToasts();
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] grid gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            className={clsx(
              "pointer-events-auto w-[340px] text-left",
              "steam-card steam-card--hover glow--hover rounded-xl border border-white/10 bg-black/35 p-3",
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 10, y: -6, scale: 0.985, filter: "blur(6px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 10, y: -6, scale: 0.985, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            onClick={() => remove(t.id)}
          >
            <div className="flex items-start gap-2">
              <span
                className={clsx(
                  "mt-0.5 inline-block h-2.5 w-2.5 rounded-full",
                  t.kind === "success" && "bg-steam-green",
                  t.kind === "error" && "bg-red-400",
                  t.kind === "info" && "bg-steam-accent",
                )}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                {t.message ? <div className="mt-1 text-xs text-steam-muted">{t.message}</div> : null}
              </div>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}


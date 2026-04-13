import { AnimatePresence, motion } from "framer-motion";
import { useLoading } from "../../state/loading";

export function LoadingOverlay() {
  const active = useLoading((s) => s.active);

  return (
    <AnimatePresence>
      {active > 0 ? (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[2100] grid place-items-center bg-black/35 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="pointer-events-none flex items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-2xl shadow-black/60">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-steam-accent" />
            <span className="text-sm text-steam-text">Загрузка…</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}


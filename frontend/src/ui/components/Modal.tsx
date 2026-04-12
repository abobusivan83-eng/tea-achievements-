import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function Modal(props: { open: boolean; title?: string; children: ReactNode; onClose: () => void }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
            aria-label="Close modal overlay"
            onClick={props.onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="steam-card glow--active relative w-full max-w-xl overflow-hidden"
            initial={reduce ? { opacity: 0 } : { y: 18, scale: 0.985, opacity: 0, filter: "blur(8px)" }}
            animate={reduce ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { y: 18, scale: 0.985, opacity: 0, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
          >
            {props.title ? (
              <div className="border-b border-white/10 bg-black/25 px-4 py-3">
                <div className="text-sm font-semibold">{props.title}</div>
              </div>
            ) : null}
            <div className="p-4">{props.children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}


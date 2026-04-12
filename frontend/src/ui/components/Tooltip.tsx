import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

export function Tooltip(props: { content: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {props.children}
      <AnimatePresence>
        {open ? (
          <motion.span
            className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-max -translate-x-1/2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-steam-text shadow-steam backdrop-blur glow--base"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985, filter: "blur(6px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985, filter: "blur(6px)" }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {props.content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}


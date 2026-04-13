import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function PageTransition(props: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.992 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.992 }}
      transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ willChange: reduce ? undefined : "transform, opacity" }}
    >
      {props.children}
    </motion.div>
  );
}


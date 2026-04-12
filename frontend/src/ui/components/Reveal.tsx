import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";

export function Reveal(props: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={clsx(props.className)}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.30, ease: [0.2, 0.8, 0.2, 1], delay: props.delay ?? 0 }}
    >
      {props.children}
    </motion.div>
  );
}


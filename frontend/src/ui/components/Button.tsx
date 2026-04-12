import { motion, type HTMLMotionProps, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useSound } from "../../state/sound";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...rest
}: Omit<HTMLMotionProps<"button">, "children"> & {
  children?: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}) {
  const isDisabled = disabled || loading;
  const reduce = useReducedMotion();
  const play = useSound((s) => s.play);

  return (
    <motion.button
      whileHover={reduce || isDisabled ? undefined : { y: -1, scale: 1.015 }}
      whileTap={reduce || isDisabled ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm outline-none",
        "transition-[transform,filter,box-shadow,background-color,border-color] duration-200 ease-out",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" &&
          "border-transparent bg-steam-accent font-semibold text-black hover:brightness-110 focus:ring-2 focus:ring-steam-accent/40 shadow-[0_10px_30px_rgba(102,192,244,0.18)] hover:shadow-[0_14px_40px_rgba(102,192,244,0.26)]",
        variant === "ghost" &&
          "border-white/10 bg-white/5 hover:bg-white/10 focus:ring-2 focus:ring-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.45)]",
        variant === "danger" &&
          "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15 focus:ring-2 focus:ring-red-500/20",
        isDisabled && "cursor-not-allowed opacity-60",
        className,
      )}
      disabled={isDisabled}
      {...rest}
      onMouseEnter={(e) => {
        rest.onMouseEnter?.(e);
        if (!isDisabled) play("hover");
      }}
      onClick={(e) => {
        rest.onClick?.(e);
        if (!isDisabled && !e.defaultPrevented) play("click");
      }}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          <span>{children}</span>
        </span>
      ) : (
        <>
          {leftIcon ? <span className="text-base">{leftIcon}</span> : null}
          <span>{children}</span>
          {rightIcon ? <span className="text-base">{rightIcon}</span> : null}
        </>
      )}
    </motion.button>
  );
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-black/40 border-t-black/90"
      aria-label="loading"
    />
  );
}


import { motion } from "framer-motion";
import clsx from "clsx";
import { useSound } from "../../state/sound";

export type TabItem<T extends string> = { key: T; label: string; icon?: React.ReactNode };

export function Tabs<T extends string>(props: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (v: T) => void;
}) {
  const play = useSound((s) => s.play);
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/20 p-2 glow--base">
      {props.items.map((t) => {
        const active = t.key === props.value;
        return (
          <button
            key={t.key}
            type="button"
            className={clsx(
              "relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              "transition-[transform,background-color,color,box-shadow] duration-200 ease-out",
              "hover:scale-[1.02] active:scale-[0.98]",
              active ? "text-steam-text" : "text-steam-muted hover:bg-white/5 hover:text-steam-text",
            )}
            onMouseEnter={() => play("hover")}
            onClick={() => {
              play("tab");
              props.onChange(t.key);
            }}
          >
            {active ? (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg border border-white/10 bg-white/5 glow--hover"
                transition={{ type: "spring", stiffness: 560, damping: 40 }}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-2">
              {t.icon ? <span className="text-base opacity-90">{t.icon}</span> : null}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}


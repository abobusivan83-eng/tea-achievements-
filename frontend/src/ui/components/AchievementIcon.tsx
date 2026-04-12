import clsx from "clsx";

export function AchievementIcon(props: {
  iconUrl?: string | null;
  alt?: string;
  sizeClassName?: string;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        props.sizeClassName ?? "h-10 w-10",
        props.className,
      )}
    >
      {props.iconUrl ? (
        <img
          className={clsx(
            "absolute inset-0 h-full w-full object-cover object-center",
            props.imageClassName,
          )}
          src={props.iconUrl}
          alt={props.alt ?? ""}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-[4px] rounded-md border border-dashed border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_65%)]" />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

function normalizeAchievementImageSrc(src?: string | null): string | null {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function AchievementIcon(props: {
  iconUrl?: string | null;
  alt?: string;
  sizeClassName?: string;
  className?: string;
  imageClassName?: string;
}) {
  const normalizedSrc = useMemo(() => normalizeAchievementImageSrc(props.iconUrl), [props.iconUrl]);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedSrc]);

  const showImage = normalizedSrc !== null && !imageFailed;

  return (
    <div
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        props.sizeClassName ?? "h-10 w-10",
        props.className,
      )}
    >
      {showImage ? (
        <img
          className={clsx(
            "absolute inset-0 h-full w-full object-cover object-center",
            props.imageClassName,
          )}
          src={normalizedSrc}
          alt={props.alt ?? ""}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(133,188,255,0.18),transparent_58%),linear-gradient(145deg,rgba(24,32,46,0.98),rgba(10,14,21,0.98))]">
          <div className="absolute inset-[4px] rounded-md border border-dashed border-white/10" />
          <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            className="absolute inset-[18%] h-[64%] w-[64%] text-white/25"
            fill="none"
          >
            <rect x="10" y="12" width="44" height="40" rx="8" stroke="currentColor" strokeWidth="3" />
            <circle cx="24" cy="26" r="4" fill="currentColor" />
            <path
              d="M16 44l10-10 8 8 6-6 8 8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

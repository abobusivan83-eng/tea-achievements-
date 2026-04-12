import clsx from "clsx";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { getFrame, type FrameOverlayId, type FrameShape } from "../../lib/cosmetics";
import { DEFAULT_AVATAR_URL } from "../../lib/media";

export function canUseFrame(opts: {
  frameKey: string | null;
  isAdmin?: boolean;
  isCreator?: boolean;
  unlockedFrames?: readonly string[];
}) {
  const f = getFrame(opts.frameKey);
  if (!f) return true;
  if (f.creatorOnly) return Boolean(opts.isCreator);
  if (f.adminOnly) return Boolean(opts.isAdmin);
  if (opts.isAdmin) return true;
  return Boolean(opts.unlockedFrames?.includes(f.key));
}

export function AvatarFrame(props: {
  frameKey: string | null;
  src: string;
  alt?: string;
  size: number;
  className?: string;
  imgClassName?: string;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  useEffect(() => {
    setImgBroken(false);
  }, [props.src]);
  const f = getFrame(props.frameKey);
  const reduce = useReducedMotion();
  const imgSrc = imgBroken ? DEFAULT_AVATAR_URL : props.src;

  const shape: FrameShape = f?.shape ?? "circle";
  const fxClass = f?.className ?? "frame--common";
  const overlayId: FrameOverlayId = f?.overlayId ?? "none";
  const shapeClass = shape === "square" ? "frame--shape-square" : shape === "squircle" ? "frame--shape-squircle" : "";

  const innerRadius = shape === "circle" ? "rounded-full" : shape === "square" ? "rounded-xl" : "rounded-2xl";

  return (
    <div
      className={clsx("frame", fxClass, shapeClass, "inline-grid place-items-center", props.className)}
      style={{ width: props.size + 12, height: props.size + 12 }}
    >
      <img
        className={clsx(
          "relative z-10 border border-white/10 bg-black/30 object-cover",
          innerRadius,
          props.imgClassName,
        )}
        style={{ width: props.size, height: props.size }}
        src={imgSrc}
        alt={props.alt ?? ""}
        loading="lazy"
        decoding="async"
        onError={() => setImgBroken(true)}
      />

      {overlayId !== "none" ? (
        <span
          className={clsx(
            "avatar-frame",
            `avatar-frame--${overlayId}`,
            shape === "circle" ? "avatar-frame--circle" : shape === "square" ? "avatar-frame--square" : "avatar-frame--squircle",
            Boolean(f?.animated) && !reduce && "avatar-frame--animated",
          )}
        />
      ) : null}
    </div>
  );
}

function FrameOverlay(props: { overlayId: FrameOverlayId; shape: FrameShape; animated: boolean }) {
  const rx = props.shape === "square" ? 18 : props.shape === "squircle" ? 26 : 999;
  const baseClass = clsx(
    "pointer-events-none absolute inset-0 z-20",
    props.animated && "frame-overlay--animated",
  );

  // A modern gaming-style frame: beveled border + corner brackets + subtle scanline/shine.
  const FrameRect = (p: {
    stroke: string;
    stroke2?: string;
    glow?: string;
    corner?: string;
    accent?: string;
    width?: number;
  }) => {
    const w = p.width ?? 8;
    const corner = p.corner ?? "rgba(255,255,255,0.14)";
    const accent = p.accent ?? "rgba(102,192,244,0.35)";
    const glow = p.glow ?? "rgba(102,192,244,0.16)";
    const stroke2 = p.stroke2 ?? "rgba(255,255,255,0.08)";
    return (
      <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="fGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor={glow} />
            <feDropShadow dx="0" dy="2" stdDeviation="1.2" floodColor="rgba(0,0,0,0.70)" />
          </filter>
          <linearGradient id="bevel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.stroke} />
            <stop offset="1" stopColor={stroke2} />
          </linearGradient>
          <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.00)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
          </linearGradient>
        </defs>

        <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#bevel)" strokeWidth={w} filter="url(#fGlow)" />
        <rect x="8.5" y="8.5" width="83" height="83" rx={Math.max(1, rx - 6)} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
        <rect x="9" y="9" width="82" height="82" rx={Math.max(1, rx - 7)} fill="url(#scan)" opacity="0.75" />

        {/* corner brackets */}
        <path d="M10 24 V10 H24" fill="none" stroke={corner} strokeWidth="3" />
        <path d="M76 10 H90 V24" fill="none" stroke={corner} strokeWidth="3" />
        <path d="M10 76 V90 H24" fill="none" stroke={corner} strokeWidth="3" />
        <path d="M76 90 H90 V76" fill="none" stroke={corner} strokeWidth="3" />

        {/* small accent ticks */}
        <path d="M50 6 V12" stroke={accent} strokeWidth="2" />
        <path d="M50 88 V94" stroke={accent} strokeWidth="2" />
      </svg>
    );
  };

  switch (props.overlayId) {
    case "metal-steel":
      return (
        <FrameRect
          stroke="rgba(235,245,255,0.88)"
          stroke2="rgba(120,145,165,0.42)"
          glow="rgba(255,255,255,0.10)"
          corner="rgba(255,255,255,0.18)"
          accent="rgba(102,192,244,0.18)"
          width={9}
        />
      );
    case "metal-bronze":
      return (
        <FrameRect
          stroke="rgba(255,220,170,0.72)"
          stroke2="rgba(180,105,60,0.44)"
          glow="rgba(255,190,70,0.10)"
          corner="rgba(255,210,160,0.16)"
          accent="rgba(255,190,70,0.20)"
          width={9}
        />
      );
    case "metal-gold":
      return (
        <FrameRect
          stroke="rgba(255,245,200,0.92)"
          stroke2="rgba(255,190,70,0.58)"
          glow="rgba(255,190,70,0.16)"
          corner="rgba(255,235,170,0.20)"
          accent="rgba(255,190,70,0.35)"
          width={10}
        />
      );
    case "minimal-blue":
      return (
        <FrameRect
          stroke="rgba(102,192,244,0.68)"
          stroke2="rgba(102,192,244,0.22)"
          glow="rgba(102,192,244,0.14)"
          corner="rgba(102,192,244,0.18)"
          accent="rgba(102,192,244,0.30)"
          width={7}
        />
      );
    case "minimal-green":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="5" y="5" width="90" height="90" rx={rx} fill="none" stroke="rgba(92,219,149,0.55)" strokeWidth="5" />
          <rect x="8" y="8" width="84" height="84" rx={Math.max(1, rx - 5)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
        </svg>
      );
    case "minimal-purple":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="5" y="5" width="90" height="90" rx={rx} fill="none" stroke="rgba(170,90,240,0.55)" strokeWidth="5" />
          <path d="M12 50 H88" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        </svg>
      );
    case "carbon-grid":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 0 H8 M0 0 V8" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
          <rect x="9" y="9" width="82" height="82" rx={Math.max(1, rx - 6)} fill="none" stroke="url(#grid)" strokeWidth="4" />
        </svg>
      );
    case "tech-circuit":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(102,192,244,0.65)" />
              <stop offset="1" stopColor="rgba(92,219,149,0.25)" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#c)" strokeWidth="7" />
          <path d="M18 14 H40 M60 86 H82 M14 30 V42 M86 58 V70" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
          <circle cx="18" cy="14" r="2" fill="rgba(255,255,255,0.16)" />
          <circle cx="82" cy="86" r="2" fill="rgba(255,255,255,0.16)" />
        </svg>
      );
    case "arcane-runes":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="r" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(130,210,255,0.6)" />
              <stop offset="1" stopColor="rgba(102,192,244,0.2)" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#r)" strokeWidth="8" />
          <path d="M18 18 L30 18 L30 30 L18 30 Z" fill="rgba(255,255,255,0.07)" />
          <path d="M70 18 L82 18 L82 30 L70 30 Z" fill="rgba(255,255,255,0.07)" />
          <path d="M18 70 L30 70 L30 82 L18 82 Z" fill="rgba(255,255,255,0.07)" />
          <path d="M70 70 L82 70 L82 82 L70 82 Z" fill="rgba(255,255,255,0.07)" />
        </svg>
      );
    case "royal-crown":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="cr" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,235,170,0.95)" />
              <stop offset="0.5" stopColor="rgba(255,190,70,0.75)" />
              <stop offset="1" stopColor="rgba(120,70,10,0.30)" />
            </linearGradient>
          </defs>
          <rect x="4" y="8" width="92" height="88" rx={rx} fill="none" stroke="url(#cr)" strokeWidth="8" />
          <path d="M30 10 L50 4 L70 10" fill="none" stroke="rgba(255,190,70,0.75)" strokeWidth="3" />
          <circle cx="50" cy="6" r="2.2" fill="rgba(255,255,255,0.18)" />
        </svg>
      );
    case "neon-edges":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="neon" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(102,192,244,0.85)" />
              <stop offset="0.5" stopColor="rgba(255,70,200,0.55)" />
              <stop offset="1" stopColor="rgba(92,219,149,0.55)" />
            </linearGradient>
            <filter id="ng">
              <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="rgba(102,192,244,0.22)" />
              <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="rgba(255,70,200,0.10)" />
            </filter>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#neon)" strokeWidth="7" filter="url(#ng)" />
          <path d="M10 50 H22 M78 50 H90" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
        </svg>
      );
    case "retro-pixel":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" shapeRendering="crispEdges">
          <rect x="6" y="6" width="88" height="88" rx={0} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="6" />
          <path d="M10 10 H26 V16 H10 Z" fill="rgba(102,192,244,0.25)" />
          <path d="M74 10 H90 V16 H74 Z" fill="rgba(170,90,240,0.22)" />
          <path d="M10 84 H26 V90 H10 Z" fill="rgba(92,219,149,0.20)" />
          <path d="M74 84 H90 V90 H74 Z" fill="rgba(255,190,70,0.18)" />
        </svg>
      );
    case "ember-flame":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ember" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,90,40,0.70)" />
              <stop offset="0.55" stopColor="rgba(255,190,70,0.55)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.10)" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#ember)" strokeWidth="9" />
          <path d="M16 92 C26 80, 18 72, 30 62" fill="none" stroke="rgba(255,190,70,0.22)" strokeWidth="3" />
          <path d="M84 8 C74 20, 82 28, 70 38" fill="none" stroke="rgba(255,90,40,0.18)" strokeWidth="3" />
        </svg>
      );
    case "glacier-crystal":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ice" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(180,240,255,0.70)" />
              <stop offset="1" stopColor="rgba(102,192,244,0.20)" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#ice)" strokeWidth="8" />
          <path d="M12 22 L22 12 L30 22 L22 30 Z" fill="rgba(255,255,255,0.08)" />
          <path d="M70 78 L78 70 L88 78 L78 88 Z" fill="rgba(255,255,255,0.06)" />
        </svg>
      );
    case "void-aura":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <radialGradient id="voidg" cx="50%" cy="50%" r="60%">
              <stop offset="0" stopColor="rgba(170,90,240,0.18)" />
              <stop offset="0.6" stopColor="rgba(102,192,244,0.12)" />
              <stop offset="1" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="rgba(170,90,240,0.45)" strokeWidth="8" />
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="url(#voidg)" opacity="0.9" />
        </svg>
      );
    case "radioactive":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="rg">
              <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="rgba(60,255,120,0.22)" />
            </filter>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="rgba(60,255,120,0.55)" strokeWidth="8" filter="url(#rg)" />
          <path d="M50 16 L56 28 L70 30 L58 40 L61 54 L50 46 L39 54 L42 40 L30 30 L44 28 Z" fill="rgba(60,255,120,0.10)" />
        </svg>
      );
    case "sigil":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(170,90,240,0.70)" />
              <stop offset="1" stopColor="rgba(15,24,34,0.20)" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#sg)" strokeWidth="8" />
          <path d="M50 12 L62 26 L78 30 L66 42 L70 60 L50 52 L30 60 L34 42 L22 30 L38 26 Z" fill="rgba(255,255,255,0.05)" />
        </svg>
      );
    case "holo-prism":
      return (
        <svg className={baseClass} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hp" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(92,219,149,0.35)" />
              <stop offset="0.5" stopColor="rgba(102,192,244,0.55)" />
              <stop offset="1" stopColor="rgba(255,190,70,0.28)" />
            </linearGradient>
            <filter id="hpGlow">
              <feDropShadow dx="0" dy="0" stdDeviation="2.0" floodColor="rgba(102,192,244,0.20)" />
              <feDropShadow dx="0" dy="0" stdDeviation="5.0" floodColor="rgba(170,90,240,0.10)" />
            </filter>
          </defs>
          <rect x="4" y="4" width="92" height="92" rx={rx} fill="none" stroke="url(#hp)" strokeWidth="8" filter="url(#hpGlow)" />
          <path d="M20 80 C40 66, 60 66, 80 80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        </svg>
      );
    default:
      return null;
  }
}


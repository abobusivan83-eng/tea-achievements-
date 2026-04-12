import { useEffect } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";

export type SceneId = "profile" | "achievements" | "leaderboard" | "admin" | "auth" | "shop" | "gifts" | "default";

export function Scene(props: { id: SceneId; children: ReactNode; className?: string }) {
  useEffect(() => {
    document.documentElement.dataset.scene = props.id;
    return () => {
      // leave last scene as-is to avoid flicker during transitions
    };
  }, [props.id]);

  return <div className={clsx("scene", `scene--${props.id}`, props.className)}>{props.children}</div>;
}


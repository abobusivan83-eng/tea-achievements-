import { useEffect, useState } from "react";

/**
 * Нижний «зазор» от клавиатуры (iOS/Android) — подставлять как padding-bottom у формы,
 * чтобы кнопки не оказывались под клавиатурой.
 */
export function useVisualViewportKeyboardInset(): number {
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function sync() {
      const v = window.visualViewport;
      if (!v) return;
      const gap = window.innerHeight - v.offsetTop - v.height;
      setBottom(Math.max(0, Math.round(gap)));
    }

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    sync();

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return bottom;
}

import { useRef, useState, useEffect } from "react";

/** Measures the parent container and returns the scale factor to fit the frame
 *  without overflow. Also returns a ref to attach to the fill-div inside the frame. */
export function useDeviceScale(frameW: number, frameH: number, padding = 40) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const availW = el.clientWidth  - padding;
      const availH = el.clientHeight - padding;
      const s = Math.min(availW / frameW, availH / frameH, 1);
      setScale(Math.max(s, 0.15));
    };

    const obs = new ResizeObserver(update);
    obs.observe(el);
    update();
    return () => obs.disconnect();
  }, [frameW, frameH, padding]);

  return { containerRef, scale };
}

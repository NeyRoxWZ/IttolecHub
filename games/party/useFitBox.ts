'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The largest box of a given ratio that fits inside an element: drawings and
 * gauges take all the room they have, on any screen, without ever overflowing.
 */
export function useFitBox(ratio: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (width: number, height: number) => {
      const w = Math.max(0, Math.floor(Math.min(width, height * ratio)));
      setSize((prev) => (prev.w === w ? prev : { w, h: Math.floor(w / ratio) }));
    };
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    measure(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, [ratio]);
  return { ref, size };
}

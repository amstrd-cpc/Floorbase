'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export function useFitScale(input: {
  width: number;
  height: number;
  maxScale?: number;
  minScale?: number;
}) {
  const { width, maxScale = 1, minScale = 0.25 } = input;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(width);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setContainerWidth(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!containerWidth || !width) return 1;
    const raw = containerWidth / width;
    return Math.max(minScale, Math.min(maxScale, raw));
  }, [containerWidth, width, minScale, maxScale]);

  return { containerRef, scale };
}

import { useState, useCallback, useEffect } from 'react';

interface UseResizableProps {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  edge: 'left' | 'right';
  leftOffset?: number; // For left sidebar, compensates for things like ActivityBar width
}

export const useResizable = ({ 
  initialWidth, 
  minWidth, 
  maxWidth, 
  edge, 
  leftOffset = 0 
}: UseResizableProps) => {
  const [width, setWidthState] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  // 宽度必须落在整数像素上，否则分隔线会骑在半个设备像素上被摊成两条。
  const setWidth = useCallback(
    (next: number) =>
      setWidthState(Math.min(maxWidth, Math.max(minWidth, Math.round(next)))),
    [minWidth, maxWidth]
  );

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }

    let rafId = 0;

    const resize = (e: MouseEvent) => {
      const nextRaw =
        edge === 'left'
          ? e.clientX - leftOffset
          : document.body.clientWidth - e.clientX;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setWidth(nextRaw);
      });
    };

    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, edge, leftOffset, setWidth, stopResizing]);

  return { width, setWidth, isResizing, startResizing };
};
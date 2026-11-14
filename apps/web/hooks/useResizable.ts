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
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        let newWidth = width;
        
        if (edge === 'left') {
          // Resizing element on the left (e.g. Sidebar)
          // Calculate width based on mouse position minus offset (e.g. ActivityBar)
          newWidth = e.clientX - leftOffset;
        } else {
          // Resizing element on the right (e.g. PropertyPanel)
          // Calculate width based on window width minus mouse position
          newWidth = document.body.clientWidth - e.clientX;
        }

        // Clamp value
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setWidth(newWidth);
        }
      }
    },
    [isResizing, edge, leftOffset, minWidth, maxWidth, width]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resize, stopResizing]);

  return { width, isResizing, startResizing };
};
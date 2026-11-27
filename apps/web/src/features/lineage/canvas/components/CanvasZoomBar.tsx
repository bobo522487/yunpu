import React from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

interface CanvasZoomBarProps {
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const CanvasZoomBar: React.FC<CanvasZoomBarProps> = ({
  zoom,
  minZoom = 0.2,
  maxZoom = 2.8,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  return (
    <div
      data-no-print="true"
      className="flex items-center gap-0.5 bg-card/95 backdrop-blur-md border border-border rounded-lg p-1 shadow-[var(--shadow-card-hover)] text-[13px] shrink-0"
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= minZoom + 0.001}
        title="缩小"
        aria-label="缩小"
        className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-[var(--surface-active)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
      >
        <Minus size={14} />
      </button>
      <span className="px-1.5 text-[12px] font-semibold tabular-nums text-foreground min-w-[46px] text-center select-none">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= maxZoom - 0.001}
        title="放大"
        aria-label="放大"
        className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-[var(--surface-active)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        onClick={onResetZoom}
        title="重置缩放"
        aria-label="重置缩放"
        className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-[var(--surface-active)] cursor-pointer transition-colors"
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
};

export default CanvasZoomBar;

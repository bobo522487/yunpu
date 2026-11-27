import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CatalogBlockedModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export const CatalogBlockedModal: React.FC<CatalogBlockedModalProps> = ({
  open,
  message,
  onClose,
}) => {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <AlertTriangle size={17} className="text-primary shrink-0" />
          <span>操作提示</span>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {message}
        </p>
        <div className="mt-5 flex justify-end">
          <Button size="sm" onClick={onClose}>
            我知道了
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[500px]',
  lg: 'max-w-[580px]',
  xl: 'max-w-[680px]',
  '2xl': 'max-w-[780px]',
};

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  zIndexClass?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  'data-testid'?: string;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  children,
  size = 'md',
  zIndexClass = 'z-[90]',
  ariaLabel,
  ariaLabelledBy,
  closeOnBackdrop = true,
  closeOnEsc = true,
  className,
  'data-testid': testId,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      const helpPopover = document.querySelector('[data-help-popover="true"]');
      if (helpPopover) return;
      const openDialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (
        openDialogs.length > 0 &&
        dialogRef.current &&
        openDialogs[openDialogs.length - 1] !== dialogRef.current
      ) {
        return;
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEsc, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center p-4 overflow-y-auto',
        zIndexClass
      )}
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-testid={testId}
        className={cn(
          'relative z-10 w-full flex flex-col max-h-[90vh] rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-popover)] overflow-hidden',
          SIZE_CLASSES[size],
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  titleId?: string;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  icon,
  onClose,
  closeDisabled = false,
  titleId,
  className,
}) => (
  <div
    className={cn(
      'flex items-start justify-between gap-3 px-6 py-4 border-b border-border bg-card shrink-0',
      className
    )}
  >
    <div className="flex items-start gap-3 min-w-0 flex-1">
      {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h2
          id={titleId}
          className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-foreground truncate"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        disabled={closeDisabled}
        aria-label="关闭弹窗"
        className="w-8 h-8 -mr-1.5 -mt-0.5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
      >
        <X size={16} />
      </button>
    )}
  </div>
);

export const ModalBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn('px-6 py-5 overflow-y-auto flex-1 min-h-0', className)}>
    {children}
  </div>
);

export const ModalFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div
    className={cn(
      'px-6 py-3.5 border-t border-border bg-[var(--surface-subtle)] flex items-center justify-end gap-2.5 shrink-0',
      className
    )}
  >
    {children}
  </div>
);

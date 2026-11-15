import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/button';

type Props = {
  open: boolean;
  title: string;
  /** 后果说明：破坏性操作必须让用户知道会发生什么（spec FR-011）。 */
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 破坏性/不可逆操作的确认弹窗（删除项目、移除成员、归档组织、撤销邀请、转移所有权）。 */
const ConfirmDialog: React.FC<Props> = ({
  open,
  title,
  description,
  confirmLabel = '确认',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmDialog;

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';

type Props = {
  open: boolean;
  title: string;
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
}) => (
  <ModalShell
    open={open}
    onClose={onCancel}
    size="sm"
    zIndexClass="z-[95]"
    ariaLabel={title}
  >
    <ModalHeader title={title} onClose={onCancel} />
    <ModalBody>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </ModalBody>
    <ModalFooter>
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
    </ModalFooter>
  </ModalShell>
);

export default ConfirmDialog;

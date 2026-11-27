import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';

type Props = {
  inviteUrl: string;
  onClose: () => void;
};

/**
 * 邀请链接弹窗：明文 token 只在这里出现一次（DM-INV-01 / spec US3 场景 8），
 * 关闭后待处理列表只展示邮箱、角色与状态。
 */
const InviteLinkDialog: React.FC<Props> = ({ inviteUrl, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时用户可手动选中复制，输入框已预选。
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      size="md"
      zIndexClass="z-[95]"
      ariaLabel="邀请链接"
    >
      <ModalHeader title="邀请链接已生成" onClose={onClose} />
      <ModalBody className="space-y-3">
        <p className="text-[14px] text-muted-foreground">
          该链接仅显示这一次，请立即复制并发送给受邀者。
        </p>
        <Input
          value={inviteUrl}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          aria-label="邀请链接"
          className="font-mono text-[13px]"
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          关闭
        </Button>
        <Button size="sm" onClick={() => void copy()}>
          {copied ? (
            <>
              <Check size={14} className="mr-1.5" />
              已复制
            </>
          ) : (
            <>
              <Copy size={14} className="mr-1.5" />
              复制链接
            </>
          )}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};

export default InviteLinkDialog;

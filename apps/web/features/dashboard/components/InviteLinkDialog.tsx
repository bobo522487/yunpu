import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="邀请链接"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">邀请链接已生成</h2>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          该链接仅显示这一次，请立即复制并发送给受邀者。
        </p>
        <input
          className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] text-foreground"
          value={inviteUrl}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          aria-label="邀请链接"
        />
        <div className="mt-4 flex justify-end gap-2">
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
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default InviteLinkDialog;

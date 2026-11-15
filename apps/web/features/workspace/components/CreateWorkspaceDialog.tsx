import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { errorMessage } from '../../../lib/api';

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 创建组织：成功后由调用方完成切换（spec FR-016）。失败抛错，弹窗内展示。 */
  onCreate: (name: string) => Promise<void>;
  /** 建议组织名（基于显示名 / 邮箱前缀），点击即可填入。 */
  suggestions: string[];
}

const CreateWorkspaceDialog: React.FC<CreateWorkspaceDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  suggestions,
}) => {
  const [name, setName] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  if (!isMounted || !isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setError(null);
    setSaving(true);
    try {
      await onCreate(name.trim());
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[460px] bg-background rounded-xl shadow-2xl flex flex-col overflow-hidden border border-border">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground">新建组织</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 rounded-full"
          >
            <X size={14} />
          </Button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">组织名称</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的谱牒工作室"
              autoFocus
              className="h-10"
              maxLength={120}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setName(suggestion)}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[12px] text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} size="sm">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || saving}>
              {saving ? '创建中…' : '创建组织'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default CreateWorkspaceDialog;

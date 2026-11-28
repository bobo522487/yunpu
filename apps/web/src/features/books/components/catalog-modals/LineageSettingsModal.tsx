import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CatalogLineageNode, LineageSubTableConfig } from '../../types';

interface LineageSettingsModalProps {
  open: boolean;
  node: CatalogLineageNode | null;
  onClose: () => void;
  onSave: (
    updates: Pick<
      CatalogLineageNode,
      'indexConfig' | 'diaoxianConfig' | 'shixiConfig'
    >,
  ) => void;
}

export const LineageSettingsModal: React.FC<LineageSettingsModalProps> = ({
  open,
  node,
  onClose,
  onSave,
}) => {
  const [indexCfg, setIndexCfg] = useState<LineageSubTableConfig>({
    enabled: true,
    inToc: true,
    tocTitle: '族丁检索表',
  });
  const [diaoxianCfg, setDiaoxianCfg] = useState<LineageSubTableConfig>({
    enabled: true,
    inToc: true,
    tocTitle: '吊线图',
  });
  const [shixiCfg, setShixiCfg] = useState<LineageSubTableConfig>({
    enabled: true,
    inToc: true,
    tocTitle: '谱系表',
  });

  useEffect(() => {
    if (!open || !node) return;
    setIndexCfg({ ...node.indexConfig });
    setDiaoxianCfg({ ...node.diaoxianConfig });
    setShixiCfg({ ...node.shixiConfig });
  }, [open, node]);

  if (!open || !node) return null;

  const rows: Array<{
    key: string;
    label: string;
    desc: string;
    cfg: LineageSubTableConfig;
    setCfg: React.Dispatch<React.SetStateAction<LineageSubTableConfig>>;
  }> = [
    {
      key: 'index',
      label: '族丁检索表',
      desc: '按世次与谱名索引本支族丁所在页码，方便翻阅查找。',
      cfg: indexCfg,
      setCfg: setIndexCfg,
    },
    {
      key: 'diaoxian',
      label: '吊线图',
      desc: '以树状连线展示先祖与后裔的直系承传脉络。',
      cfg: diaoxianCfg,
      setCfg: setDiaoxianCfg,
    },
    {
      key: 'shixi',
      label: '谱系表',
      desc: '按所选欧式/苏式/双栏版式排版输出完整谱系与行传。',
      cfg: shixiCfg,
      setCfg: setShixiCfg,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[540px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground truncate">
              谱系详细设置 · {node.eyebrowTitle}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onClose}
          >
            <X size={15} />
          </Button>
        </div>

        <div className="p-5 space-y-3">
          {rows.map((r) => (
            <div
              key={r.key}
              className="rounded-xl border border-border bg-background p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.cfg.enabled}
                    onChange={(e) =>
                      r.setCfg((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                    className="accent-[var(--primary)]"
                  />
                  <span>生成 {r.label}</span>
                </label>

                <label
                  className={`flex items-center gap-1.5 text-[12px] ${
                    r.cfg.enabled
                      ? 'text-foreground cursor-pointer'
                      : 'text-muted-foreground opacity-50 pointer-events-none'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!r.cfg.enabled}
                    checked={r.cfg.inToc}
                    onChange={(e) =>
                      r.setCfg((prev) => ({ ...prev, inToc: e.target.checked }))
                    }
                    className="accent-[var(--primary)]"
                  />
                  <span>列入目录</span>
                </label>
              </div>
              <p className="text-[12px] text-muted-foreground">{r.desc}</p>
              {r.cfg.enabled && r.cfg.inToc && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[12px] text-muted-foreground shrink-0">
                    目录标题：
                  </span>
                  <Input
                    value={r.cfg.tocTitle}
                    onChange={(e) =>
                      r.setCfg((prev) => ({
                        ...prev,
                        tocTitle: e.target.value,
                      }))
                    }
                    className="h-8 text-[12px]"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border bg-[var(--surface-subtle)] flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onSave({
                indexConfig: indexCfg,
                diaoxianConfig: diaoxianCfg,
                shixiConfig: shixiCfg,
              })
            }
          >
            保存设置
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

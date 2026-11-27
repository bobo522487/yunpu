import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

export type HelpTipKey =
  | 'book-name'
  | 'book-header'
  | 'book-hall'
  | 'book-volume'
  | 'book-catalog'
  | 'book-layout'
  | 'book-editions'
  | 'chapter-name'
  | 'lineage-total-title'
  | 'lineage-eyebrow'
  | 'book-member-count';

const HELP_TIPS: Record<HelpTipKey, { title: string; content: string }> = {
  'book-name': {
    title: '谱书名称',
    content: '将显示在谱书封面题签与谱书总目首页，建议包含族姓与谱名，如「清河张氏宗谱」。',
  },
  'book-header': {
    title: '谱眉名称',
    content: '印制在正文每页版心正上方页眉处，用于标明本卷谱书总题。',
  },
  'book-hall': {
    title: '堂号',
    content: '家族或房支的传统堂号（如「敦睦堂」「百忍堂」），开启显示后将列于每页版心边栏。',
  },
  'book-volume': {
    title: '卷号',
    content: '限 5 个字符以内（如「卷一」「上卷」「首卷」），显示于封面左侧及侧边栏谱书列表。',
  },
  'book-catalog': {
    title: '第一步 · 目录编排',
    content:
      '按「卷首 → 正文 → 世系 → 附录」组织全书结构，支持添加章节、引用谱文、配置世系范围与调整章节顺序。',
  },
  'book-layout': {
    title: '第二步 · 设置版式',
    content:
      '配置装帧体例（古籍线装/现代精装）、世系排法（欧式/苏式/现代双栏）、纸张开本、鱼尾及页码样式。',
  },
  'book-editions': {
    title: '第三步 · 查看谱例',
    content:
      '每次生成谱例均会固化当前目录内容与版式快照，支持在线翻页阅读、下载校对稿与生成高清印刷版。',
  },
  'chapter-name': {
    title: '章节名称',
    content: '用于在谱书目录中归类多篇谱文或世系分支，可随时重命名、调整排序或迁出其中内容。',
  },
  'lineage-total-title': {
    title: '总谱 / 分谱标题',
    content: '显示于世系起首页面的总题位置（如「清河张氏五修宗谱」），留空则沿用谱书名称。',
  },
  'lineage-eyebrow': {
    title: '世系谱眉名',
    content: '将印在对应世系页眉边栏及全书总目录中，建议明确标出房支或世派名称。',
  },
  'book-member-count': {
    title: '世系人数统计',
    content: '按当前谱例所纳入的全部世系章节去重统计实际入谱族丁人数（不含重复引用的先祖）。',
  },
};

interface HelpTipButtonProps {
  tipKey: HelpTipKey;
  className?: string;
}

export const HelpTipButton: React.FC<HelpTipButtonProps> = ({
  tipKey,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tip = HELP_TIPS[tipKey];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex items-center ${className}`}
    >
      <button
        type="button"
        aria-label={tip.title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-primary transition-colors cursor-pointer"
      >
        <HelpCircle size={13} />
      </button>

      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-60 rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-lg text-left"
        >
          <div className="text-[12px] font-semibold text-foreground mb-1">
            {tip.title}
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground font-normal">
            {tip.content}
          </p>
        </div>
      )}
    </span>
  );
};

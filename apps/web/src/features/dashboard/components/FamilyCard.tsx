import React from 'react';
import {
  BookOpen,
  Download,
  GitFork,
  MapPin,
  Pencil,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import type { ProjectRecord, ProjectStatus } from '../api';

export interface FamilyCardMetrics {
  lineageCount: number;
  personCount: number;
  articleCount: number;
  bookCount: number;
}

interface FamilyCardProps {
  project: ProjectRecord;
  isCurrent: boolean;
  metrics: FamilyCardMetrics;
  maintainerName: string;
  zibeiWords: string[];
  canEdit: boolean;
  canDelete: boolean;
  onOpen: (project: ProjectRecord, subPath?: '' | '/lineage' | '/articles' | '/books') => void;
  onExport: (project: ProjectRecord) => void;
  onEdit: (project: ProjectRecord) => void;
  onDelete: (project: ProjectRecord) => void;
  onManageZibei: (project: ProjectRecord) => void;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
};

export const FamilyCard: React.FC<FamilyCardProps> = ({
  project,
  isCurrent,
  metrics,
  maintainerName,
  zibeiWords,
  canEdit,
  canDelete,
  onOpen,
  onExport,
  onEdit,
  onDelete,
  onManageZibei,
}) => {
  const surnameChar = (
    project.surname?.trim() ||
    project.name.trim().slice(0, 1) ||
    '谱'
  ).slice(0, 1);

  const zibeiPreview =
    zibeiWords.length > 0
      ? `${zibeiWords.slice(0, 8).join(' ')}${zibeiWords.length > 8 ? '…' : ''}`
      : '待设置字辈';

  return (
    <article
      data-family-id={project.id}
      data-family-name={project.name}
      data-lineage-count={metrics.lineageCount}
      data-document-count={metrics.articleCount}
      data-book-count={metrics.bookCount}
      data-is-current={String(isCurrent)}
      className={`family-card group relative rounded-xl p-6 bg-card transition-all duration-150 overflow-hidden flex flex-col justify-between ${
        isCurrent
          ? 'border border-primary shadow-[var(--shadow-card-hover)]'
          : 'border border-border hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)]'
      }`}
    >
      <div>
        {/* Top Row: Surname Seal + Action Icons */}
        <div className="flex justify-between items-start gap-3 mb-4">
          <button
            type="button"
            onClick={() => onOpen(project, '')}
            title={`进入「${project.name}」工作台`}
            className={`w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isCurrent
                ? 'bg-[var(--surface-active)] border-primary/30 text-primary'
                : 'bg-[var(--surface-subtle)] border-border text-muted-foreground group-hover:text-primary group-hover:border-primary/40'
            }`}
          >
            <span className="font-serif text-[22px] font-bold select-none leading-none">
              {surnameChar}
            </span>
          </button>

          <div className="family-card__actions flex items-center gap-1">
            <button
              type="button"
              onClick={() => onExport(project)}
              title="导出备份家族"
              aria-label="导出备份家族"
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-[var(--surface-hover)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download size={15} />
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(project)}
                title="修改家族"
                aria-label="修改家族"
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-[var(--surface-hover)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil size={15} />
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(project)}
                title="删除家族"
                aria-label="删除家族"
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Title & Clean Unboxed Status Metadata Line */}
        <div className="mb-3.5">
          <button
            type="button"
            onClick={() => onOpen(project, '')}
            className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <h3 className="yp-h2 text-foreground truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
          </button>
          <div className="text-[12px] leading-4 text-muted-foreground mt-1 truncate tabular-nums">
            {isCurrent && (
              <span className="font-semibold text-primary">当前家族 · </span>
            )}
            {project.hallName && project.hallName !== project.name
              ? `${project.hallName} · `
              : ''}
            {STATUS_LABELS[project.status]} · 更新于{' '}
            {new Date(project.updatedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Structured Metadata Lines */}
        <div className="space-y-2 mb-4 text-[13px] text-muted-foreground">
          <p className="flex items-center gap-2 min-w-0">
            <MapPin size={15} className="shrink-0 text-muted-foreground/80" />
            <span className="truncate">
              {project.originText || '未设置地区'}
            </span>
          </p>

          <p className="flex items-center gap-2 tabular-nums">
            <Users size={15} className="shrink-0 text-muted-foreground/80" />
            <span>族丁总数：{metrics.personCount} 人</span>
          </p>

          <p className="flex items-center gap-2 tabular-nums">
            <GitFork size={15} className="shrink-0 text-muted-foreground/80" />
            <span className="truncate">
              谱系 {metrics.lineageCount} · 谱文 {metrics.articleCount} · 谱书 {metrics.bookCount}
            </span>
          </p>

          <p className="flex items-center gap-2 min-w-0">
            <User size={15} className="shrink-0 text-muted-foreground/80" />
            <span className="truncate">
              {project.ancestor
                ? `始迁祖：${project.ancestor} · ${maintainerName}`
                : `编修：${maintainerName}`}
            </span>
          </p>
        </div>

        {/* Zibei Row */}
        <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-border/70 text-[12px]">
          <span
            className={`truncate ${
              zibeiWords.length > 0
                ? 'text-foreground/85 font-serif text-[13px]'
                : 'text-muted-foreground/80'
            }`}
            title={zibeiWords.join(' ')}
          >
            字辈：{zibeiPreview}
          </span>
          <button
            type="button"
            onClick={() => onManageZibei(project)}
            className="text-[12px] font-medium text-primary hover:underline cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            设置字辈
          </button>
        </div>
      </div>

      {/* Clear Single Primary CTA + 3 Quiet Secondary Links */}
      <div className="family-card__footer flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpen(project, '/lineage')}
          className="h-9 flex-1 px-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium shadow-[var(--shadow-control)] hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          进入谱系
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpen(project, '')}
            className="h-9 px-2.5 rounded-lg border border-border bg-card text-foreground/85 text-[13px] font-medium hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            概览
          </button>
          <button
            type="button"
            onClick={() => onOpen(project, '/articles')}
            className="h-9 px-2.5 rounded-lg border border-border bg-card text-foreground/85 text-[13px] font-medium hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            谱文
          </button>
          <button
            type="button"
            onClick={() => onOpen(project, '/books')}
            className="h-9 px-2.5 rounded-lg border border-border bg-card text-foreground/85 text-[13px] font-medium hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookOpen size={13} className="shrink-0 text-muted-foreground" />
            <span>谱书</span>
          </button>
        </div>
      </div>
    </article>
  );
};

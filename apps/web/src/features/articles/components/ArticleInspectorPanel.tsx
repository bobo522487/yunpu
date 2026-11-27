import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, History, ListTree, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../../auth/useAuthStore';
import { useArticleStore } from '../../../store/useArticleStore';
import { useBookStore } from '../../../store/useBookStore';
import { findBooksReferencingArticle } from '../../books/domain/bookArticleAudit';
import { STATUS_LABELS } from '../articleLabels';
import type { ArticleHeading } from '../domain/articleMetrics';
import { createEntityId } from '../../../lib/id';
import type { ArticleCitation, ArticleDocument, ArticleStatus } from '../types';
import { ArticleRevisionModal } from './ArticleRevisionModal';

const CITATION_SOURCE_LABELS: Record<ArticleCitation['sourceType'], string> = {
  old_genealogy: '旧谱',
  stele: '碑刻',
  gazetteer: '方志',
  oral: '口述',
  archive: '档案',
};

export interface ArticleInspectorPanelProps {
  projectId: string;
  article: ArticleDocument;
  headings: ArticleHeading[];
  wordCount: number;
  paragraphCount: number;
  readingLabel: string;
  citations: ArticleCitation[];
  collapsed: boolean;
  onToggle: () => void;
  onHeadingClick?: (index: number) => void;
  onUpdateArticle: (
    updates: Partial<
      Pick<ArticleDocument, 'citations' | 'status'>
    >,
  ) => void;
  onFlushPendingSave?: () => void;
}

export const ArticleInspectorPanel: React.FC<ArticleInspectorPanelProps> = ({
  projectId,
  article,
  headings,
  citations,
  collapsed,
  onToggle,
  onHeadingClick,
  onUpdateArticle,
  onFlushPendingSave,
  wordCount: _wordCount,
  paragraphCount: _paragraphCount,
  readingLabel: _readingLabel,
}) => {
  const navigate = useNavigate();
  const recordRevision = useArticleStore((s) => s.recordRevision);
  const booksByProject = useBookStore((s) => s.booksByProject);
  const selectBook = useBookStore((s) => s.selectBook);
  const bookRefs = useMemo(
    () => findBooksReferencingArticle(article.id, booksByProject[projectId] || []),
    [article.id, booksByProject, projectId],
  );
  const [revisionSummary, setRevisionSummary] = useState('');
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);

  const revisionAuthor =
    useAuthStore.getState().user?.name || '家族编委会';

  const updateCitations = (next: ArticleCitation[]) => {
    onUpdateArticle({ citations: next });
  };

  const handleStatusChange = (status: ArticleStatus) => {
    onFlushPendingSave?.();
    onUpdateArticle({ status });
    recordRevision(
      projectId,
      article.id,
      `状态改为${STATUS_LABELS[status]}`,
      revisionAuthor,
    );
  };

  const handleRecordRevision = () => {
    onFlushPendingSave?.();
    const summary = revisionSummary.trim() || '手动记入修订';
    recordRevision(projectId, article.id, summary, revisionAuthor);
    setRevisionSummary('');
  };

  const patchCitation = (id: string, patch: Partial<ArticleCitation>) => {
    updateCitations(
      citations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const addCitation = () => {
    updateCitations([
      ...citations,
      {
        id: createEntityId('citation'),
        label: '',
        sourceType: 'old_genealogy',
        detail: '',
      },
    ]);
  };

  const removeCitation = (id: string) => {
    updateCitations(citations.filter((c) => c.id !== id));
  };

  if (collapsed) {
    return (
      <div
        className="shrink-0 flex flex-col items-center border-l border-border bg-background"
        style={{ width: 36 }}
      >
        <button
          type="button"
          onClick={onToggle}
          title="展开大纲"
          aria-label="展开大纲"
          className="w-full h-9 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
        </button>
        <div
          className="flex-1 flex items-center justify-center writing-mode-vertical text-[11px] text-muted-foreground tracking-wide py-2"
          style={{ writingMode: 'vertical-rl' }}
        >
          <ListTree size={12} className="mb-1" />
          大纲
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 flex flex-col border-l border-border bg-background overflow-hidden"
      style={{ width: 280 }}
      data-testid="article-inspector-panel"
    >
      <div className="h-9 px-3 flex items-center justify-between gap-2 border-b border-border shrink-0">
        <span className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
          <ListTree size={13} className="text-primary" />
          大纲
        </span>
        <button
          type="button"
          onClick={onToggle}
          title="折叠大纲"
          aria-label="折叠大纲"
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-4">
        <section>
          {headings.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-2 py-3">
              正文里还没有标题
            </p>
          ) : (
            <ul className="space-y-0.5">
              {headings.map((heading, index) => (
                <li key={`${index}-${heading.text}`}>
                  <button
                    type="button"
                    onClick={() => onHeadingClick?.(index)}
                    className="w-full text-left text-[12px] text-foreground/85 hover:text-primary hover:bg-muted/60 rounded px-2 py-1.5 truncate transition-colors cursor-pointer"
                    style={{ paddingLeft: 8 + (heading.level - 1) * 12 }}
                    title={heading.text}
                  >
                    <span className="text-muted-foreground font-mono text-[10px] mr-1.5">
                      H{heading.level}
                    </span>
                    {heading.text || '（空标题）'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-border pt-3 px-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-foreground">
              审校与修订
            </span>
            <button
              type="button"
              onClick={() => setRevisionModalOpen(true)}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
            >
              <History size={12} />
              修订历史
            </button>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="articleInspectorStatus"
              className="text-[11px] text-muted-foreground"
            >
              审校状态
            </label>
            <select
              id="articleInspectorStatus"
              value={article.status}
              onChange={(e) =>
                handleStatusChange(e.target.value as ArticleStatus)
              }
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-[12px]"
            >
              {(Object.keys(STATUS_LABELS) as ArticleStatus[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="articleRevisionSummary"
              className="text-[11px] text-muted-foreground"
            >
              修订说明
            </label>
            <div className="flex gap-1.5">
              <input
                id="articleRevisionSummary"
                type="text"
                value={revisionSummary}
                onChange={(e) => setRevisionSummary(e.target.value)}
                placeholder="例如：谱序字句校订"
                className="flex-1 min-w-0 h-8 rounded-md border border-input bg-background px-2 text-[12px]"
              />
              <button
                type="button"
                onClick={handleRecordRevision}
                className="shrink-0 h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 cursor-pointer"
              >
                记入修订
              </button>
            </div>
          </div>
        </section>

        <ArticleRevisionModal
          open={revisionModalOpen}
          onClose={() => setRevisionModalOpen(false)}
          projectId={projectId}
          article={article}
          onFlushPendingSave={onFlushPendingSave}
        />

        {bookRefs.length > 0 && (
          <section className="border-t border-border pt-3 px-1 space-y-2">
            <span className="text-[12px] font-semibold text-foreground">
              收录于谱书
            </span>
            <ul className="space-y-1.5">
              {bookRefs.map((ref) => (
                <li key={ref.bookId}>
                  <button
                    type="button"
                    onClick={() => {
                      selectBook(projectId, ref.bookId);
                      void navigate({
                        to: '/projects/$projectId/books',
                        params: { projectId },
                      });
                    }}
                    className="w-full text-left text-[12px] text-primary hover:underline cursor-pointer px-1 py-1 rounded hover:bg-muted/50"
                  >
                    {`已被收录至：《${ref.bookName} · ${ref.volumeNo}》`}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="border-t border-border pt-3 px-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[12px] font-semibold text-foreground">
              资料出处
            </span>
            <button
              type="button"
              onClick={addCitation}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
            >
              <Plus size={12} />
              新增
            </button>
          </div>
          {citations.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-1 py-2">
              尚未登记引用来源
            </p>
          ) : (
            <ul className="space-y-3">
              {citations.map((citation) => (
                <li
                  key={citation.id}
                  className="rounded-lg border border-border p-2 space-y-2 bg-[var(--surface-subtle)]/40"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      placeholder="出处名称"
                      value={citation.label}
                      onChange={(e) =>
                        patchCitation(citation.id, { label: e.target.value })
                      }
                      className="flex-1 min-w-0 h-8 rounded-md border border-input bg-background px-2 text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeCitation(citation.id)}
                      title="删除出处"
                      aria-label="删除出处"
                      className="shrink-0 w-7 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <select
                    value={citation.sourceType}
                    onChange={(e) =>
                      patchCitation(citation.id, {
                        sourceType: e.target
                          .value as ArticleCitation['sourceType'],
                      })
                    }
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[12px]"
                  >
                    {(
                      Object.keys(CITATION_SOURCE_LABELS) as Array<
                        ArticleCitation['sourceType']
                      >
                    ).map((key) => (
                      <option key={key} value={key}>
                        {CITATION_SOURCE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder="版本、页码或收藏地说明"
                    value={citation.detail ?? ''}
                    onChange={(e) =>
                      patchCitation(citation.id, {
                        detail: e.target.value || undefined,
                      })
                    }
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-[12px] resize-none"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
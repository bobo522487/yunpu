import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ListTree,
  Palette,
  Plus,
  Save,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { useEnsureBookInitialized } from '../../../hooks/useEnsureBookInitialized';
import { useArticleStore } from '../../../store/useArticleStore';
import { useBookStore } from '../../../store/useBookStore';
import { useLineageStore } from '../../../store/useLineageStore';
import { auditBookArticles } from '../domain/bookArticleAudit';
import type { BookStep } from '../types';
import { BookCatalogStep } from './BookCatalogStep';
import { BookEditionsStep } from './BookEditionsStep';
import { BookLayoutStep } from './BookLayoutStep';
import { BookMetaModal } from './BookMetaModal';
import { HelpTipButton, type HelpTipKey } from './HelpTipButton';

const STEPS: Array<{
  id: BookStep;
  stepNum: string;
  label: string;
  tipKey: HelpTipKey;
  icon: React.FC<{ size?: number; className?: string }>;
}> = [
  {
    id: 'catalog',
    stepNum: '第一步',
    label: '目录编排',
    tipKey: 'book-catalog',
    icon: ListTree,
  },
  {
    id: 'layout',
    stepNum: '第二步',
    label: '设置版式',
    tipKey: 'book-layout',
    icon: Palette,
  },
  {
    id: 'editions',
    stepNum: '第三步',
    label: '查看谱例',
    tipKey: 'book-editions',
    icon: BookOpen,
  },
];

export const BookWorkspace: React.FC = () => {
  const {
    projectId: activeProjectId,
    project: activeProject,
    surname: projectSurname,
  } = useActiveProject();

  useEnsureBookInitialized();

  const articlesByKey = useArticleStore((s) => s.articlesByKey);
  const lineageTreesByProject = useLineageStore((s) => s.treesByProject);
  const personsByChart = useLineageStore((s) => s.personsByChart);

  const booksByProject = useBookStore((s) => s.booksByProject);
  const selectedBookIdByProject = useBookStore(
    (s) => s.selectedBookIdByProject
  );
  const activeStepByBook = useBookStore((s) => s.activeStepByBook);
  const setActiveStep = useBookStore((s) => s.setActiveStep);
  const touchBookSaved = useBookStore((s) => s.touchBookSaved);
  const generateEdition = useBookStore((s) => s.generateEdition);
  const createBook = useBookStore((s) => s.createBook);

  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const books = useMemo(
    () => booksByProject[activeProjectId] || [],
    [booksByProject, activeProjectId]
  );

  const selectedBookId =
    selectedBookIdByProject[activeProjectId] || books[0]?.id || '';

  const activeBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) || books[0] || null,
    [books, selectedBookId]
  );

  const activeStep: BookStep = activeBook
    ? activeStepByBook[activeBook.id] || 'catalog'
    : 'catalog';

  const catalogAuditIssues = useMemo(() => {
    if (!activeBook) return [];
    return auditBookArticles(activeProjectId, activeBook, articlesByKey);
  }, [activeProjectId, activeBook, articlesByKey]);

  const handleSave = () => {
    if (!activeBook) return;
    touchBookSaved(activeProjectId, activeBook.id);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleGenerateEdition = () => {
    if (!activeBook) return;
    const lineageTree = lineageTreesByProject[activeProjectId] ?? [];
    generateEdition(activeProjectId, activeBook.id, {
      articlesByKey,
      lineageTree,
      personsByChart,
      projectSurname: projectSurname || undefined,
    });
    setActiveStep(activeBook.id, 'editions');
  };

  if (!activeBook) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-subtle)] border border-border mx-auto flex items-center justify-center text-primary">
            <BookOpen size={22} />
          </div>
          <div className="space-y-1.5">
            <h2 className="yp-h2 text-foreground">
              暂无谱书项目
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              创建一部谱书后，即可按「目录编排 → 设置版式 → 查看谱例」三步流程汇编家族世系与谱文。
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1.5"
          >
            <Plus size={14} />
            <span>创建首部谱书</span>
          </Button>
        </div>

        <BookMetaModal
          open={isCreateModalOpen}
          mode="create"
          initialValue={{
            bookName: activeProject?.name
              ? `${activeProject.name}族谱`
              : '家族宗谱',
            headerName: projectSurname
              ? `${projectSurname}氏宗谱`
              : '家族宗谱',
            hallName: activeProject?.hallName || '敦睦堂',
            volumeNo: '卷一',
            editor: '家族编委会',
            compilationDate: new Date().toISOString().slice(0, 10),
          }}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(values) => {
            createBook(activeProjectId, values);
            setIsCreateModalOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
      {/* Top Stepper & Action Toolbar */}
      <div className="border-b border-border bg-card px-4 md:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Three-step Stepper */}
        <nav
          aria-label="三步成书流程"
          className="flex flex-wrap items-center gap-1.5"
        >
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <React.Fragment key={step.id}>
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveStep(activeBook.id, step.id)}
                    className={`h-8 px-3 rounded-lg flex items-center gap-2 text-[13px] transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-primary/[0.1] text-primary font-semibold border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium border border-transparent'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span>
                      {step.stepNum} {step.label}
                    </span>
                  </button>
                  <HelpTipButton tipKey={step.tipKey} />
                </div>
                {idx < STEPS.length - 1 && (
                  <ArrowRight
                    size={13}
                    className="text-muted-foreground/50 mx-0.5 hidden sm:inline shrink-0"
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Contextual Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeStep !== 'editions' && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="h-8 gap-1.5 text-[12px] whitespace-nowrap"
              >
                {savedFeedback ? (
                  <>
                    <Check size={13} className="text-emerald-600" />
                    <span>已保存</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>保存</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateEdition}
                className="h-8 gap-1.5 text-[12px] whitespace-nowrap"
              >
                <Sparkles size={13} />
                <span>生成谱例</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveStep(activeBook.id, 'editions')}
                className="h-8 gap-1.5 text-[12px] whitespace-nowrap"
              >
                <BookOpen size={13} />
                <span>返回谱例列表</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Step Body */}
      {activeStep === 'catalog' && (
        <BookCatalogStep book={activeBook} auditIssues={catalogAuditIssues} />
      )}
      {activeStep === 'layout' && (
        <BookLayoutStep
          book={activeBook}
          onSaveAndGenerate={handleGenerateEdition}
        />
      )}
      {activeStep === 'editions' && (
        <BookEditionsStep
          book={activeBook}
          auditIssues={catalogAuditIssues}
          onGenerateNewEdition={handleGenerateEdition}
        />
      )}
    </div>
  );
};

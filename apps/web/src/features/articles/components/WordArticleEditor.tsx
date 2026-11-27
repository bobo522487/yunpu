import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { Check, Minus, Plus } from 'lucide-react';
import '../styles/puwen-prose.css';
import { ArticleInspectorPanel } from './ArticleInspectorPanel';
import { WordToolbar } from './WordToolbar';
import type { ArticleDocument } from '../types';
import { createArticleExtensions } from '../extensions/createArticleExtensions';
import { createPersonMentionView } from './PersonMentionView';
import type { MentionCandidate } from '../domain/personMention';
import { useProjectId } from '../../../hooks/useProjectId';
import { useProjectLineageSnapshot } from '../../lineage/queries';
import { contentJsonToHtml, htmlToContentJson } from '../domain/htmlProjection';
import { createArticleSaveQueue } from '../domain/articleSaveQueue';
import { uploadArticleAssetRequest } from '../api';
import { useArticleActions } from '../queries';
import {
  nextArticleTheme,
  type ArticleTheme,
} from '../domain/articleTheme';
import {
  extractArticleMetrics,
  readingTimeLabel,
} from '../domain/articleMetrics';

function rewriteArticleAssetIds(
  node: JSONContent,
  keyMap: Map<string, string>,
): JSONContent {
  const nextAttrs =
    node.attrs &&
    typeof node.attrs.assetId === 'string' &&
    keyMap.has(node.attrs.assetId)
      ? { ...node.attrs, assetId: keyMap.get(node.attrs.assetId) }
      : node.attrs;
  const nextContent = Array.isArray(node.content)
    ? node.content.map((child) => rewriteArticleAssetIds(child, keyMap))
    : node.content;
  return {
    ...node,
    ...(nextAttrs !== undefined ? { attrs: nextAttrs } : {}),
    ...(nextContent !== undefined ? { content: nextContent } : {}),
  };
}

interface WordArticleEditorProps {
  article: ArticleDocument;
  familyName?: string;
  hallName?: string;
  onUpdateArticle: (
    updates: Partial<
      Pick<
        ArticleDocument,
        'title' | 'subtitle' | 'author' | 'contentJson' | 'citations' | 'status'
      >
    >
  ) => void;
}

const ZOOM_LEVELS = [0.75, 0.9, 1, 1.15, 1.25];

function flattenMentionCandidates(
  projectId: string | undefined,
  personsByChart: Record<string, { id: string; name?: string; generation: number }[]>,
): MentionCandidate[] {
  if (!projectId) return [];
  const prefix = `${projectId}::`;
  const result: MentionCandidate[] = [];
  for (const [key, persons] of Object.entries(personsByChart)) {
    if (!key.startsWith(prefix)) continue;
    const chartId = key.slice(prefix.length);
    for (const person of persons) {
      result.push({
        personId: person.id,
        chartId,
        name: person.name || '未命名',
        generation: person.generation,
      });
    }
  }
  return result;
}

export const WordArticleEditor: React.FC<WordArticleEditorProps> = ({
  article,
  familyName,
  hallName,
  onUpdateArticle,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [isPreview, setIsPreview] = useState(false);
  const [theme, setTheme] = useState<ArticleTheme>('modern');
  const [selectionTick, setSelectionTick] = useState(0);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [wordIoError, setWordIoError] = useState<string | null>(null);
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  const onUpdateRef = useRef(onUpdateArticle);
  onUpdateRef.current = onUpdateArticle;

  const activeProjectId = useProjectId();
  const activeScopeKey = `${activeProjectId || ''}::${article.id}`;
  const activeScopeKeyRef = useRef(activeScopeKey);
  const activeArticleIdRef = useRef(article.id);
  const isSyncingContentRef = useRef(false);

  const { personsByChart } = useProjectLineageSnapshot(activeProjectId ?? '');
  const { updateArticleContent } = useArticleActions(activeProjectId ?? '');
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;
  const updateArticleContentRef = useRef(updateArticleContent);
  updateArticleContentRef.current = updateArticleContent;

  const mentionPeopleRef = useRef<MentionCandidate[]>([]);
  mentionPeopleRef.current = flattenMentionCandidates(
    activeProjectId,
    personsByChart,
  );

  const extensions = useMemo(
    () =>
      createArticleExtensions({
        withFigureView: true,
        getPeople: () => mentionPeopleRef.current,
        mentionView: createPersonMentionView(() =>
          mentionPeopleRef.current.map((p) => ({
            id: p.personId,
            name: p.name,
          })),
        ),
      }),
    [],
  );

  const saveQueueRef = useRef<ReturnType<typeof createArticleSaveQueue> | null>(
    null
  );
  if (!saveQueueRef.current) {
    saveQueueRef.current = createArticleSaveQueue({
      delayMs: 800,
      schedule: (fn, ms) => window.setTimeout(fn, ms),
      cancel: (handle) => window.clearTimeout(handle),
      projectHtml: contentJsonToHtml,
      onCommit: (commit) => {
        const projectId = commit.projectId ?? activeProjectIdRef.current;
        if (!projectId) return;
        updateArticleContentRef.current(commit.articleId, {
          contentJson: commit.contentJson,
        });
        setSaveState('saved');
      },
    });
  }

  const editor = useEditor(
    {
    extensions,
    content: article.contentJson ?? (article.contentHtml || '<p></p>'),
    editable: !isPreview,
    editorProps: {
      attributes: {
        class: 'article-word-prose min-h-[720px]',
        'data-theme': theme,
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isSyncingContentRef.current) return;
      setSaveState('saving');
      saveQueueRef.current?.noteEdit(
        activeArticleIdRef.current,
        () => ed.getJSON(),
        activeProjectIdRef.current,
      );
    },
    onSelectionUpdate: () => {
      setSelectionTick((t) => t + 1);
    },
    onTransaction: () => {
      setSelectionTick((t) => t + 1);
    },
    },
    [extensions],
  );

  const flushPendingSave = useCallback(() => {
    saveQueueRef.current?.flush();
  }, []);

  // Switch document content cleanly when user switches article OR project
  useLayoutEffect(() => {
    if (!editor) return;
    if (activeScopeKeyRef.current !== activeScopeKey) {
      saveQueueRef.current?.flush();
      activeArticleIdRef.current = article.id;
      activeScopeKeyRef.current = activeScopeKey;
      isSyncingContentRef.current = true;
      const content: ArticleDocument['contentJson'] | string =
        article.contentJson ?? (article.contentHtml || '<p></p>');
      editor.commands.setContent(content, false);
      isSyncingContentRef.current = false;
      setSaveState('saved');
    }
  }, [activeScopeKey, article.id, article.contentHtml, article.contentJson, editor]);

  // Reload editor when store content changes externally (e.g. revision restore) without switching article
  useEffect(() => {
    if (!editor) return;
    if (activeScopeKeyRef.current !== activeScopeKey) return;
    if (!article.contentJson) return;
    if (saveQueueRef.current?.hasPending()) return;

    const editorJson = editor.getJSON();
    if (JSON.stringify(editorJson) === JSON.stringify(article.contentJson)) return;

    isSyncingContentRef.current = true;
    editor.commands.setContent(article.contentJson, false);
    isSyncingContentRef.current = false;
    setSaveState('saved');
  }, [activeScopeKey, article.contentJson, editor]);

  // Lazily persist contentJson from HTML as soon as the editor is ready (first open or after switch)
  useEffect(() => {
    if (!editor) return;
    if (activeScopeKeyRef.current !== activeScopeKey) return;
    if (article.contentJson) return;

    const contentJson = htmlToContentJson(article.contentHtml || '<p></p>');
    onUpdateRef.current({ contentJson });
  }, [editor, activeScopeKey, article.contentHtml, article.contentJson]);

  // Keep editable flag synced with preview mode
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isPreview);
  }, [editor, isPreview]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute('data-theme', theme);
  }, [editor, theme]);

  useEffect(() => {
    if (!editor) return;
    const tr = editor.state.tr.setMeta('personMentionRefresh', Date.now());
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }, [editor, personsByChart]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (saveStateRef.current === 'saving') {
        saveQueueRef.current?.flush();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      saveQueueRef.current?.flush();
      saveQueueRef.current?.dispose();
    };
  }, []);

  const liveMetrics = (() => {
    void selectionTick;
    if (editor) {
      return extractArticleMetrics(editor.getJSON());
    }
    if (article.contentJson) {
      return extractArticleMetrics(article.contentJson);
    }
    const html = article.contentHtml || '';
    const matches = html.match(/<(p|h1|h2|h3|li|blockquote)\b/gi);
    return {
      wordCount: article.wordCount,
      paragraphCount: matches ? matches.length : 1,
      readingMinutes: 0,
      headings: [] as ReturnType<typeof extractArticleMetrics>['headings'],
      linkedPersonIds: [],
      linkedChartIds: [],
    };
  })();

  const paragraphCount = liveMetrics.paragraphCount;
  const readingLabel = readingTimeLabel(
    editor ? liveMetrics.wordCount : article.wordCount
  );

  const handleExportWord = async () => {
    try {
      saveQueueRef.current?.flush();
      const contentJson =
        editor?.getJSON() ??
        article.contentJson ??
        htmlToContentJson(article.contentHtml || '<p></p>');
      const [{ Packer }, { sanitizeArticleFileName, tiptapJsonToDocx }] =
        await Promise.all([import('docx'), import('../domain/docxCodec')]);
      const doc = tiptapJsonToDocx(
        {
          title: article.title,
          subtitle: article.subtitle,
          author: article.author,
          contentJson,
        },
        {
          hallName,
          mentionContext: activeProjectId
            ? { projectId: activeProjectId, personsByChart }
            : undefined,
        },
      );
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sanitizeArticleFileName(article.title);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setWordIoError(null);
    } catch {
      setWordIoError('导出 Word 失败，请重试');
    }
  };

  const handleImportWord = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { importDocxArrayBuffer } = await import('../domain/docxCodec');
      const { contentJson, images } = await importDocxArrayBuffer(arrayBuffer);
      let resolvedJson = contentJson;
      if (images.length > 0 && activeProjectId) {
        const uploadedPairs = await Promise.all(
          images.map(async (img) => {
            const blob = new Blob([new Uint8Array(img.bytes)], {
              type: img.contentType || 'image/png',
            });
            const uploaded = await uploadArticleAssetRequest(
              activeProjectId,
              blob,
              img.contentType || 'image/png',
            );
            return [img.assetId, uploaded.key] as const;
          }),
        );
        resolvedJson = rewriteArticleAssetIds(
          contentJson,
          new Map(uploadedPairs),
        );
      }
      saveQueueRef.current?.flush();
      isSyncingContentRef.current = true;
      onUpdateArticle({ contentJson: resolvedJson });
      editor?.commands.setContent(resolvedJson, false);
      isSyncingContentRef.current = false;
      setSaveState('saved');
      setWordIoError(null);
    } catch {
      setWordIoError('导入 Word 失败，请检查文件后重试');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleTogglePreview = () => {
    if (!isPreview) {
      saveQueueRef.current?.flush();
    }
    setIsPreview((v) => !v);
  };

  const stepZoom = (dir: -1 | 1) => {
    const idx = ZOOM_LEVELS.findIndex((z) => z === zoom);
    if (idx < 0) {
      setZoom(1);
      return;
    }
    const nextIdx = Math.min(
      ZOOM_LEVELS.length - 1,
      Math.max(0, idx + dir)
    );
    setZoom(ZOOM_LEVELS[nextIdx]);
  };

  const headerRunningTitle =
    hallName || familyName || '云谱数字修谱';

  return (
    <div
      className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background"
      data-testid="word-article-editor"
    >
      {/* Top Word Formatting Toolbar */}
      <WordToolbar
        editor={editor}
        isPreview={isPreview}
        onTogglePreview={handleTogglePreview}
        onExportWord={handleExportWord}
        onImportWord={handleImportWord}
        onPrint={handlePrint}
      />

      {isPreview && (
        <div
          data-no-print="true"
          className="h-9 px-4 border-b border-border bg-background flex items-center gap-2 shrink-0"
        >
          <span className="text-[12px] text-muted-foreground">版面主题</span>
          <button
            type="button"
            aria-pressed={theme === 'modern'}
            onClick={() => {
              if (theme !== 'modern') {
                setTheme(nextArticleTheme(theme));
              }
            }}
            className={`h-7 px-2.5 rounded-md border text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              theme === 'modern'
                ? 'border-primary bg-primary/12 text-primary'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            现代
          </button>
          <button
            type="button"
            aria-pressed={theme === 'classic'}
            onClick={() => {
              if (theme !== 'classic') {
                setTheme(nextArticleTheme(theme));
              }
            }}
            className={`h-7 px-2.5 rounded-md border text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              theme === 'classic'
                ? 'border-primary bg-primary/12 text-primary'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            仿古
          </button>
        </div>
      )}

      {/* Centered Paper Desk Canvas + outline inspector */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0 overflow-auto bg-[var(--surface-subtle)] py-7 px-4 sm:px-8 flex flex-col items-center">
        <div
          style={{
            width: `${Math.round(794 * zoom)}px`,
            maxWidth: '100%',
          }}
          className="transition-[width] duration-150 shrink-0"
        >
          <article
            data-article-paper="true"
            data-theme={theme}
            style={{
              zoom: zoom,
            }}
            className="w-[794px] max-w-full min-h-[1060px] mx-auto bg-card border border-border rounded-sm shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.45)] flex flex-col"
          >
            {/* Paper Running Header */}
            <div className="px-10 sm:px-16 pt-8 pb-3 flex items-center justify-between gap-4 border-b border-border/60 text-[12px] text-muted-foreground select-none">
              <span className="truncate">{headerRunningTitle}</span>
              <span className="truncate">{article.subtitle || '谱文正稿'}</span>
            </div>

            {/* Paper Body Margin Container */}
            <div className="flex-1 px-10 sm:px-16 pt-9 pb-14 flex flex-col">
              {/* Editable Document Title & Byline */}
              <div className="text-center space-y-2.5 pb-6 mb-6 border-b border-border">
                {isPreview ? (
                  <h1
                    className="text-[26px] sm:text-[28px] font-bold text-foreground tracking-tight text-balance"
                    style={{
                      fontFamily:
                        "'Noto Serif SC', 'Songti SC', 'SimSun', serif",
                    }}
                  >
                    {article.title || '未命名谱文'}
                  </h1>
                ) : (
                  <input
                    type="text"
                    value={article.title}
                    onChange={(e) =>
                      onUpdateArticle({ title: e.target.value })
                    }
                    placeholder="输入谱文标题..."
                    aria-label="谱文标题"
                    style={{
                      fontFamily:
                        "'Noto Serif SC', 'Songti SC', 'SimSun', serif",
                    }}
                    className="w-full text-center text-[26px] sm:text-[28px] font-bold text-foreground bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground/45 tracking-tight"
                  />
                )}

                <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted-foreground">
                  {isPreview ? (
                    <>
                      {article.subtitle && <span>{article.subtitle}</span>}
                      {article.subtitle && article.author && (
                        <span aria-hidden="true">·</span>
                      )}
                      {article.author && <span>{article.author}</span>}
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={article.subtitle || ''}
                        onChange={(e) =>
                          onUpdateArticle({ subtitle: e.target.value })
                        }
                        placeholder="添加卷次或副标题"
                        aria-label="副标题"
                        className="w-44 sm:w-52 text-right bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none text-[13px] text-muted-foreground placeholder:text-muted-foreground/45"
                      />
                      <span aria-hidden="true">·</span>
                      <input
                        type="text"
                        value={article.author || ''}
                        onChange={(e) =>
                          onUpdateArticle({ author: e.target.value })
                        }
                        placeholder="撰稿 / 编修落款"
                        aria-label="撰稿落款"
                        className="w-36 sm:w-44 text-left bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none text-[13px] text-muted-foreground placeholder:text-muted-foreground/45"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* TipTap Rich Text Canvas */}
              <div
                className="flex-1 cursor-text"
                onClick={() => {
                  if (!isPreview && editor && !editor.isFocused) {
                    editor.commands.focus();
                  }
                }}
              >
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Paper Running Footer */}
            <div className="px-10 sm:px-16 py-4 border-t border-border/50 flex items-center justify-between text-[12px] text-muted-foreground font-mono tabular-nums select-none">
              <span>{article.title || '谱文'}</span>
              <span>
                {article.wordCount} 字 · {paragraphCount} 段 ·{' '}
                {readingTimeLabel(article.wordCount)}
              </span>
            </div>
          </article>
        </div>
        </div>
        <ArticleInspectorPanel
          projectId={activeProjectId ?? ''}
          article={article}
          headings={liveMetrics.headings}
          wordCount={liveMetrics.wordCount}
          paragraphCount={liveMetrics.paragraphCount}
          readingLabel={readingLabel}
          citations={article.citations}
          collapsed={inspectorCollapsed}
          onToggle={() => setInspectorCollapsed((v) => !v)}
          onUpdateArticle={onUpdateArticle}
          onFlushPendingSave={flushPendingSave}
        />
      </div>

      {/* Bottom Word Status Bar */}
      <div
        data-no-print="true"
        className="h-8 px-4 border-t border-border bg-background flex items-center justify-between gap-4 text-[12px] text-muted-foreground shrink-0 select-none"
      >
        <div className="flex items-center gap-3 min-w-0 tabular-nums">
          <span className="whitespace-nowrap">
            字数：{article.wordCount.toLocaleString()} 字
          </span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap hidden sm:inline">
            段落：{paragraphCount} 段
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="whitespace-nowrap hidden md:inline">
            {readingTimeLabel(article.wordCount)}
          </span>
          <span aria-hidden="true" className="hidden md:inline">
            ·
          </span>
          {wordIoError ? (
            <span className="text-destructive whitespace-nowrap">{wordIoError}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-foreground/75 whitespace-nowrap">
              <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
              {saveState === 'saving'
                ? '保存中...'
                : `已自动保存 (${article.updatedAt})`}
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0 tabular-nums">
          <button
            type="button"
            onClick={() => stepZoom(-1)}
            disabled={zoom <= ZOOM_LEVELS[0]}
            title="缩小视图"
            aria-label="缩小视图"
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="重置为 100%"
            className="px-1.5 h-6 rounded hover:bg-muted text-[12px] font-medium font-mono text-foreground cursor-pointer"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            title="放大视图"
            aria-label="放大视图"
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
import { useCallback } from 'react';
import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  BookLayoutConfigInput,
  BookSectionsInput,
  CreateBookEditionInput,
} from '@yunpu/shared';
import type { TreeItem } from '../../components/common/Tree/types';
import { createEntityId } from '../../lib/id';
import { useBookStore } from '../../store/useBookStore';
import type { ArticleDocument } from '../articles/types';
import type { PersonRecord } from '../lineage/types';
import {
  createBookEditionRequest,
  createBookRequest,
  deleteBookEditionRequest,
  deleteBookRequest,
  duplicateBookRequest,
  fetchBookEditions,
  fetchBooks,
  finalizeBookEditionPrintRequest,
  reorderBooksRequest,
  updateBookRequest,
} from './api';
import {
  compileBookEdition,
  formatTimestampNow,
  sanitizeVolumeNo,
} from './bookCompiler';
import { createEmptySections, DEFAULT_BOOK_LAYOUT } from './bookDefaults';
import type {
  BookEdition,
  BookLayoutConfig,
  BookMetaInput,
  BookRecord,
  CatalogChapterNode,
  CatalogLeafNode,
  CatalogLineageNode,
  CatalogNode,
  CatalogSectionCode,
  CatalogSectionState,
} from './types';

export const booksKeys = {
  all: ['books'] as const,
  list: (projectId: string) => ['books', 'list', projectId] as const,
  editions: (projectId: string, bookId: string) =>
    ['books', 'editions', projectId, bookId] as const,
};

const SECTION_CODES: CatalogSectionCode[] = [
  'preface',
  'body',
  'lineage',
  'appendix',
];

const bookWriteChains = new Map<string, Promise<unknown>>();

function enqueueBookMutation<T>(
  bookKey: string,
  task: () => Promise<T>,
): Promise<T> {
  const prev = bookWriteChains.get(bookKey) ?? Promise.resolve();
  const next = prev.then(task, task);
  bookWriteChains.set(
    bookKey,
    next.catch(() => undefined),
  );
  return next;
}

export function useBooksQuery(projectId: string) {
  return useQuery<BookRecord[]>({
    queryKey: booksKeys.list(projectId),
    queryFn: async () => {
      const data = await fetchBooks(projectId);
      return data.books;
    },
    enabled: Boolean(projectId),
  });
}

export function useBookEditionsQuery(projectId: string, bookId: string) {
  return useQuery<BookEdition[]>({
    queryKey: booksKeys.editions(projectId, bookId),
    queryFn: async () => {
      const data = await fetchBookEditions(projectId, bookId);
      return data.editions;
    },
    enabled: Boolean(projectId && bookId),
  });
}

export async function invalidateBooksList(
  queryClient: QueryClient,
  projectId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: booksKeys.list(projectId),
  });
}

export async function invalidateBookEditions(
  queryClient: QueryClient,
  projectId: string,
  bookId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: booksKeys.editions(projectId, bookId),
  });
}

function mapBookSections(
  sections: Record<CatalogSectionCode, CatalogSectionState>,
  transform: (section: CatalogSectionState) => CatalogNode[],
): Record<CatalogSectionCode, CatalogSectionState> {
  const next = { ...sections };
  for (const code of SECTION_CODES) {
    next[code] = { ...next[code], items: transform(next[code]) };
  }
  return next;
}

function mapSectionLeafNodes(
  nodes: CatalogNode[],
  patchLeaf: (leaf: CatalogLeafNode) => CatalogLeafNode,
): CatalogNode[] {
  return nodes.map((node) =>
    node.nodeType === 'chapter'
      ? { ...node, children: node.children.map(patchLeaf) }
      : patchLeaf(node),
  );
}

function appendNodesToSection(
  sections: Record<CatalogSectionCode, CatalogSectionState>,
  sectionCode: CatalogSectionCode,
  chapterId: string | undefined,
  newNodes: CatalogNode[],
): Record<CatalogSectionCode, CatalogSectionState> {
  const sec = sections[sectionCode];
  const nextItems = chapterId
    ? sec.items.map((n) =>
        n.id === chapterId && n.nodeType === 'chapter'
          ? {
              ...n,
              collapsed: false,
              children: [
                ...n.children,
                ...(newNodes.filter(
                  (x) => x.nodeType !== 'chapter',
                ) as CatalogLeafNode[]),
              ],
            }
          : n,
      )
    : [...sec.items, ...newNodes];

  return {
    ...sections,
    [sectionCode]: { ...sec, collapsed: false, items: nextItems },
  };
}

function removeNodeFromList(
  nodes: CatalogNode[],
  nodeId: string,
): { nextNodes: CatalogNode[]; removed: CatalogNode | null } {
  let removed: CatalogNode | null = null;
  const nextNodes: CatalogNode[] = [];

  for (const node of nodes) {
    if (node.id === nodeId) {
      removed = node;
      continue;
    }
    if (node.nodeType === 'chapter') {
      const childIdx = node.children.findIndex((c) => c.id === nodeId);
      if (childIdx >= 0) {
        removed = node.children[childIdx];
        const nextChildren = [...node.children];
        nextChildren.splice(childIdx, 1);
        nextNodes.push({ ...node, children: nextChildren });
        continue;
      }
    }
    nextNodes.push(node);
  }

  return { nextNodes, removed };
}

function reorderInList<T extends { id: string }>(
  list: T[],
  id: string,
  direction: 'up' | 'down',
): T[] {
  const idx = list.findIndex((item) => item.id === id);
  if (idx < 0) return list;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= list.length) return list;
  const copy = [...list];
  const [moved] = copy.splice(idx, 1);
  copy.splice(targetIdx, 0, moved);
  return copy;
}

export function useBookActions(projectId: string) {
  const queryClient = useQueryClient();
  const selectBook = useBookStore((s) => s.selectBook);
  const setActiveStep = useBookStore((s) => s.setActiveStep);

  const patchBook = useCallback(
    async (
      bookId: string,
      buildPatch: (current: BookRecord) => {
        bookName?: string;
        headerName?: string;
        hallName?: string;
        volumeNo?: string;
        editor?: string;
        compilationDate?: string;
        sections?: Record<CatalogSectionCode, CatalogSectionState>;
        layoutConfig?: BookLayoutConfig;
      },
    ): Promise<BookRecord | null> => {
      if (!projectId) return null;
      return enqueueBookMutation(`${projectId}::${bookId}`, async () => {
        const list =
          queryClient.getQueryData<BookRecord[]>(booksKeys.list(projectId)) ??
          [];
        const current = list.find((b) => b.id === bookId);
        if (!current) return null;
        const patch = buildPatch(current);
        const optimistic: BookRecord = {
          ...current,
          ...patch,
          updatedAt: formatTimestampNow(),
        };
        queryClient.setQueryData<BookRecord[]>(
          booksKeys.list(projectId),
          (prev) =>
            (prev ?? []).map((b) => (b.id === bookId ? optimistic : b)),
        );

        try {
          const { book } = await updateBookRequest(projectId, bookId, {
            version: current.version ?? 1,
            ...(patch.bookName !== undefined
              ? { bookName: patch.bookName }
              : {}),
            ...(patch.headerName !== undefined
              ? { headerName: patch.headerName }
              : {}),
            ...(patch.hallName !== undefined
              ? { hallName: patch.hallName }
              : {}),
            ...(patch.volumeNo !== undefined
              ? { volumeNo: patch.volumeNo }
              : {}),
            ...(patch.editor !== undefined ? { editor: patch.editor } : {}),
            ...(patch.compilationDate !== undefined
              ? { compilationDate: patch.compilationDate }
              : {}),
            ...(patch.sections !== undefined
              ? { sections: patch.sections as BookSectionsInput }
              : {}),
            ...(patch.layoutConfig !== undefined
              ? { layoutConfig: patch.layoutConfig as BookLayoutConfigInput }
              : {}),
          });
          queryClient.setQueryData<BookRecord[]>(
            booksKeys.list(projectId),
            (prev) => (prev ?? []).map((b) => (b.id === bookId ? book : b)),
          );
          return book;
        } catch (error) {
          await invalidateBooksList(queryClient, projectId);
          throw error;
        }
      });
    },
    [projectId, queryClient],
  );

  const createBook = useCallback(
    async (meta: BookMetaInput) => {
      if (!projectId) return null;
      const list =
        queryClient.getQueryData<BookRecord[]>(booksKeys.list(projectId)) ?? [];
      const bookName = meta.bookName.trim() || '新建谱书';
      const { book } = await createBookRequest(projectId, {
        bookName,
        headerName: meta.headerName.trim() || bookName || '谱书',
        hallName: meta.hallName.trim(),
        volumeNo: sanitizeVolumeNo(meta.volumeNo),
        editor: meta.editor.trim(),
        compilationDate:
          meta.compilationDate || new Date().toISOString().slice(0, 10),
        sections: createEmptySections() as BookSectionsInput,
        layoutConfig: { ...DEFAULT_BOOK_LAYOUT },
        seq: list.length,
      });
      await invalidateBooksList(queryClient, projectId);
      selectBook(projectId, book.id);
      setActiveStep(book.id, 'catalog');
      return book.id;
    },
    [projectId, queryClient, selectBook, setActiveStep],
  );

  const updateBookMeta = useCallback(
    (bookId: string, meta: BookMetaInput) =>
      patchBook(bookId, (b) => ({
        bookName: meta.bookName.trim() || b.bookName,
        headerName: meta.headerName.trim() || b.headerName,
        hallName: meta.hallName.trim(),
        volumeNo: sanitizeVolumeNo(meta.volumeNo),
        editor: meta.editor.trim(),
        compilationDate: meta.compilationDate || b.compilationDate,
      })),
    [patchBook],
  );

  const duplicateBook = useCallback(
    async (bookId: string) => {
      if (!projectId) return;
      const { book } = await duplicateBookRequest(projectId, bookId);
      await invalidateBooksList(queryClient, projectId);
      selectBook(projectId, book.id);
      setActiveStep(book.id, 'catalog');
    },
    [projectId, queryClient, selectBook, setActiveStep],
  );

  const deleteBook = useCallback(
    async (bookId: string) => {
      if (!projectId) return;
      const list =
        queryClient.getQueryData<BookRecord[]>(booksKeys.list(projectId)) ?? [];
      const idx = list.findIndex((b) => b.id === bookId);
      await deleteBookRequest(projectId, bookId);
      await invalidateBooksList(queryClient, projectId);
      const remaining = list.filter((b) => b.id !== bookId);
      const selected = useBookStore.getState().selectedBookIdByProject[projectId];
      if (selected === bookId) {
        const fallback =
          remaining[Math.min(idx, remaining.length - 1)]?.id ?? '';
        selectBook(projectId, fallback);
      }
    },
    [projectId, queryClient, selectBook],
  );

  const moveBook = useCallback(
    async (bookId: string, direction: -1 | 1) => {
      if (!projectId) return;
      const list =
        queryClient.getQueryData<BookRecord[]>(booksKeys.list(projectId)) ?? [];
      const idx = list.findIndex((b) => b.id === bookId);
      if (idx < 0) return;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= list.length) return;
      const nextList = [...list];
      const [moved] = nextList.splice(idx, 1);
      nextList.splice(targetIdx, 0, moved);
      queryClient.setQueryData<BookRecord[]>(
        booksKeys.list(projectId),
        nextList,
      );
      const { books } = await reorderBooksRequest(
        projectId,
        nextList.map((b) => b.id),
      );
      queryClient.setQueryData<BookRecord[]>(booksKeys.list(projectId), books);
    },
    [projectId, queryClient],
  );

  const toggleSectionCollapsed = useCallback(
    (bookId: string, sectionCode: CatalogSectionCode) =>
      patchBook(bookId, (b) => ({
        sections: {
          ...b.sections,
          [sectionCode]: {
            ...b.sections[sectionCode],
            collapsed: !b.sections[sectionCode].collapsed,
          },
        },
      })),
    [patchBook],
  );

  const toggleChapterCollapsed = useCallback(
    (bookId: string, sectionCode: CatalogSectionCode, chapterId: string) =>
      patchBook(bookId, (b) => ({
        sections: {
          ...b.sections,
          [sectionCode]: {
            ...b.sections[sectionCode],
            items: b.sections[sectionCode].items.map((n) =>
              n.id === chapterId && n.nodeType === 'chapter'
                ? { ...n, collapsed: !n.collapsed }
                : n,
            ),
          },
        },
      })),
    [patchBook],
  );

  const addChapter = useCallback(
    async (
      bookId: string,
      sectionCode: CatalogSectionCode,
      title: string,
    ): Promise<string> => {
      const chapterId = createEntityId('cat-ch');
      const newChapter: CatalogChapterNode = {
        id: chapterId,
        nodeType: 'chapter',
        title: title.trim() || '新建章节',
        collapsed: false,
        children: [],
      };
      await patchBook(bookId, (b) => ({
        sections: appendNodesToSection(b.sections, sectionCode, undefined, [
          newChapter,
        ]),
      }));
      return chapterId;
    },
    [patchBook],
  );

  const renameChapter = useCallback(
    (bookId: string, chapterId: string, title: string) => {
      const clean = title.trim();
      if (!clean) return Promise.resolve(null);
      return patchBook(bookId, (b) => ({
        sections: mapBookSections(b.sections, (sec) =>
          sec.items.map((n) =>
            n.id === chapterId && n.nodeType === 'chapter'
              ? { ...n, title: clean }
              : n,
          ),
        ),
      }));
    },
    [patchBook],
  );

  const addArticleRefs = useCallback(
    (
      bookId: string,
      sectionCode: CatalogSectionCode,
      chapterId: string | undefined,
      articles: Array<{ sourceArticleId: string; sourceTitle: string }>,
    ) => {
      if (!articles.length) return Promise.resolve(null);
      const newNodes: CatalogLeafNode[] = articles.map((a) => ({
        id: createEntityId('cat-art'),
        nodeType: 'article',
        sourceArticleId: a.sourceArticleId,
        sourceTitle: a.sourceTitle,
        displayTitle: a.sourceTitle,
      }));
      return patchBook(bookId, (b) => ({
        sections: appendNodesToSection(
          b.sections,
          sectionCode,
          chapterId,
          newNodes,
        ),
      }));
    },
    [patchBook],
  );

  const updateArticleRef = useCallback(
    (
      bookId: string,
      nodeId: string,
      updates: {
        displayTitle: string;
        sourceArticleId: string;
        sourceTitle: string;
      },
    ) =>
      patchBook(bookId, (b) => ({
        sections: mapBookSections(b.sections, (sec) =>
          mapSectionLeafNodes(sec.items, (node) =>
            node.id === nodeId && node.nodeType === 'article'
              ? {
                  ...node,
                  displayTitle:
                    updates.displayTitle.trim() || node.displayTitle,
                  sourceArticleId: updates.sourceArticleId,
                  sourceTitle: updates.sourceTitle,
                }
              : node,
          ),
        ),
      })),
    [patchBook],
  );

  const addLineageRef = useCallback(
    (
      bookId: string,
      sectionCode: CatalogSectionCode,
      chapterId: string | undefined,
      payload: Omit<CatalogLineageNode, 'id' | 'nodeType'>,
    ) => {
      const newNode: CatalogLineageNode = {
        ...payload,
        id: createEntityId('cat-lin'),
        nodeType: 'lineage',
      };
      return patchBook(bookId, (b) => ({
        sections: appendNodesToSection(b.sections, sectionCode, chapterId, [
          newNode,
        ]),
      }));
    },
    [patchBook],
  );

  const updateLineageRefSettings = useCallback(
    (
      bookId: string,
      nodeId: string,
      updates: Pick<
        CatalogLineageNode,
        'indexConfig' | 'diaoxianConfig' | 'shixiConfig'
      >,
    ) =>
      patchBook(bookId, (b) => ({
        sections: mapBookSections(b.sections, (sec) =>
          mapSectionLeafNodes(sec.items, (node) =>
            node.id === nodeId && node.nodeType === 'lineage'
              ? { ...node, ...updates }
              : node,
          ),
        ),
      })),
    [patchBook],
  );

  const removeCatalogNode = useCallback(
    (
      bookId: string,
      nodeId: string,
    ): { blocked: boolean; reason?: string } => {
      const list =
        queryClient.getQueryData<BookRecord[]>(booksKeys.list(projectId)) ?? [];
      const book = list.find((b) => b.id === bookId);
      if (!book) return { blocked: false };

      for (const code of SECTION_CODES) {
        const hit = book.sections[code].items.find((n) => n.id === nodeId);
        if (hit && hit.nodeType === 'chapter' && hit.children.length > 0) {
          return {
            blocked: true,
            reason: '该目录下已有内容，请先迁出或删除内容后再删除目录。',
          };
        }
      }

      void patchBook(bookId, (b) => ({
        sections: mapBookSections(
          b.sections,
          (sec) => removeNodeFromList(sec.items, nodeId).nextNodes,
        ),
      }));

      return { blocked: false };
    },
    [patchBook, projectId, queryClient],
  );

  const moveCatalogNodeOrder = useCallback(
    (
      bookId: string,
      sectionCode: CatalogSectionCode,
      parentChapterId: string | undefined,
      nodeId: string,
      direction: 'up' | 'down',
    ) =>
      patchBook(bookId, (b) => {
        const sec = b.sections[sectionCode];
        const nextItems = parentChapterId
          ? sec.items.map((n) =>
              n.id === parentChapterId && n.nodeType === 'chapter'
                ? {
                    ...n,
                    children: reorderInList(n.children, nodeId, direction),
                  }
                : n,
            )
          : reorderInList(sec.items, nodeId, direction);
        return {
          sections: {
            ...b.sections,
            [sectionCode]: { ...sec, items: nextItems },
          },
        };
      }),
    [patchBook],
  );

  const transferCatalogNode = useCallback(
    (
      bookId: string,
      sourceNodeId: string,
      targetSectionCode: CatalogSectionCode,
      targetChapterId?: string,
    ) =>
      patchBook(bookId, (b) => {
        let extracted: CatalogNode | null = null;
        const nextSections = mapBookSections(b.sections, (sec) => {
          if (extracted) return sec.items;
          const { nextNodes, removed } = removeNodeFromList(
            sec.items,
            sourceNodeId,
          );
          if (removed) extracted = removed;
          return nextNodes;
        });

        if (!extracted) return {};
        const movedNode = extracted as CatalogNode;
        return {
          sections: appendNodesToSection(
            nextSections,
            targetSectionCode,
            movedNode.nodeType !== 'chapter' ? targetChapterId : undefined,
            [movedNode],
          ),
        };
      }),
    [patchBook],
  );

  const touchBookSaved = useCallback(
    (bookId: string) =>
      patchBook(bookId, (b) => ({
        bookName: b.bookName,
      })),
    [patchBook],
  );

  const updateLayoutConfig = useCallback(
    (bookId: string, updates: Partial<BookLayoutConfig>) =>
      patchBook(bookId, (b) => ({
        layoutConfig: { ...b.layoutConfig, ...updates },
      })),
    [patchBook],
  );

  const generateEdition = useCallback(
    async (
      bookId: string,
      ctx: {
        articlesByKey: Record<string, ArticleDocument>;
        lineageTree: TreeItem[];
        personsByChart: Record<string, PersonRecord[]>;
        projectSurname?: string;
      },
    ): Promise<BookEdition | null> => {
      if (!projectId) return null;
      const list =
        queryClient.getQueryData<BookRecord[]>(booksKeys.list(projectId)) ?? [];
      const book = list.find((b) => b.id === bookId);
      if (!book) return null;

      const compiled = compileBookEdition({
        projectId,
        book,
        articlesByKey: ctx.articlesByKey,
        lineageTree: ctx.lineageTree,
        personsByChart: ctx.personsByChart,
        projectSurname: ctx.projectSurname,
      });

      const { edition } = await createBookEditionRequest(projectId, bookId, {
        bindingStyle: compiled.bindingStyle,
        lineageStyle: compiled.lineageStyle,
        paperSize: compiled.paperSize,
        pageCount: compiled.pageCount,
        memberCount: compiled.memberCount,
        wordCount: compiled.wordCount,
        layoutSnapshot: compiled.layoutSnapshot,
        pages: compiled.pages as CreateBookEditionInput['pages'],
      });
      await invalidateBookEditions(queryClient, projectId, bookId);
      return edition;
    },
    [projectId, queryClient],
  );

  const deleteEdition = useCallback(
    async (bookId: string, editionId: string) => {
      if (!projectId) return;
      await deleteBookEditionRequest(projectId, bookId, editionId);
      await invalidateBookEditions(queryClient, projectId, bookId);
    },
    [projectId, queryClient],
  );

  const finalizeEditionPrint = useCallback(
    async (bookId: string, editionId: string) => {
      if (!projectId) return;
      await finalizeBookEditionPrintRequest(projectId, bookId, editionId);
      await invalidateBookEditions(queryClient, projectId, bookId);
    },
    [projectId, queryClient],
  );

  return {
    createBook,
    updateBookMeta,
    duplicateBook,
    deleteBook,
    moveBook,
    toggleSectionCollapsed,
    toggleChapterCollapsed,
    addChapter,
    renameChapter,
    addArticleRefs,
    updateArticleRef,
    addLineageRef,
    updateLineageRefSettings,
    removeCatalogNode,
    moveCatalogNodeOrder,
    transferCatalogNode,
    touchBookSaved,
    updateLayoutConfig,
    generateEdition,
    deleteEdition,
    finalizeEditionPrint,
  };
}

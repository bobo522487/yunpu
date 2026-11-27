import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TreeItem } from '../components/common/Tree/types';
import { createEntityId } from '../lib/id';
import {
  collectTreeNodesByType,
  findFirstTreeNodeByType,
} from '../lib/treeOps';
import { shouldInitializeProjectSeed } from './hydrationGate';
import { createAsyncEntityStorage } from './storageAdapter';
import { useBookEditionStore } from './useBookEditionStore';
import {
  compileBookEdition,
  formatTimestampNow,
  resolveChartPersons,
  sanitizeVolumeNo,
} from '../features/books/bookCompiler';
import type {
  BookEdition,
  BookLayoutConfig,
  BookMetaInput,
  BookRecord,
  BookStep,
  CatalogChapterNode,
  CatalogLeafNode,
  CatalogLineageNode,
  CatalogNode,
  CatalogSectionCode,
  CatalogSectionState,
} from '../features/books/types';
import type { ArticleDocument } from '../features/articles/types';
import type { PersonRecord } from '../features/lineage/types';

export const DEFAULT_BOOK_LAYOUT: BookLayoutConfig = {
  bindingStyle: 'thread',
  lineageStyle: 'euler',
  paperSize: 'thread_185x290',
  borderStyle: 'double',
  fontFamily: 'song',
  density: 'standard',
  fishtailStyle: 'black',
  showHallName: true,
  showHeaderName: true,
  pageNumberStyle: 'chinese',
};

const SECTION_CODES: CatalogSectionCode[] = [
  'preface',
  'body',
  'lineage',
  'appendix',
];

export function createEmptySections(): Record<
  CatalogSectionCode,
  CatalogSectionState
> {
  return {
    preface: {
      code: 'preface',
      label: '卷首',
      hint: '(显示在目录之前的内容)',
      collapsed: false,
      items: [],
    },
    body: {
      code: 'body',
      label: '正文',
      hint: '(建议放源流、字辈、碑文等)',
      collapsed: false,
      items: [],
    },
    lineage: {
      code: 'lineage',
      label: '世系',
      hint: '(族丁检索表、吊线图、世系表)',
      collapsed: false,
      items: [],
    },
    appendix: {
      code: 'appendix',
      label: '附录',
      hint: '',
      collapsed: false,
      items: [],
    },
  };
}

export interface BookSeedContext {
  familyName?: string;
  surname?: string;
  hallName?: string;
  editor?: string;
  articleTree: TreeItem[];
  lineageTree: TreeItem[];
  personsByChart: Record<string, PersonRecord[]>;
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
                ...(newNodes.filter((x) => x.nodeType !== 'chapter') as CatalogLeafNode[]),
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

interface BookState {
  _hasHydrated: boolean;
  _setHasHydrated: (hydrated: boolean) => void;
  booksByProject: Record<string, BookRecord[]>;
  selectedBookIdByProject: Record<string, string>;
  activeStepByBook: Record<string, BookStep>;

  ensureProjectInitialized: (projectId: string, ctx: BookSeedContext) => void;
  selectBook: (projectId: string, bookId: string) => void;
  setActiveStep: (bookId: string, step: BookStep) => void;

  createBook: (projectId: string, meta: BookMetaInput) => string;
  updateBookMeta: (projectId: string, bookId: string, meta: BookMetaInput) => void;
  duplicateBook: (projectId: string, bookId: string) => void;
  deleteBook: (projectId: string, bookId: string) => void;
  moveBook: (projectId: string, bookId: string, direction: -1 | 1) => void;

  toggleSectionCollapsed: (
    projectId: string,
    bookId: string,
    sectionCode: CatalogSectionCode,
  ) => void;
  toggleChapterCollapsed: (
    projectId: string,
    bookId: string,
    sectionCode: CatalogSectionCode,
    chapterId: string,
  ) => void;
  addChapter: (
    projectId: string,
    bookId: string,
    sectionCode: CatalogSectionCode,
    title: string,
  ) => string;
  renameChapter: (
    projectId: string,
    bookId: string,
    chapterId: string,
    title: string,
  ) => void;
  addArticleRefs: (
    projectId: string,
    bookId: string,
    sectionCode: CatalogSectionCode,
    chapterId: string | undefined,
    articles: Array<{ sourceArticleId: string; sourceTitle: string }>,
  ) => void;
  updateArticleRef: (
    projectId: string,
    bookId: string,
    nodeId: string,
    updates: {
      displayTitle: string;
      sourceArticleId: string;
      sourceTitle: string;
    },
  ) => void;
  addLineageRef: (
    projectId: string,
    bookId: string,
    sectionCode: CatalogSectionCode,
    chapterId: string | undefined,
    payload: Omit<CatalogLineageNode, 'id' | 'nodeType'>,
  ) => void;
  updateLineageRefSettings: (
    projectId: string,
    bookId: string,
    nodeId: string,
    updates: Pick<
      CatalogLineageNode,
      'indexConfig' | 'diaoxianConfig' | 'shixiConfig'
    >,
  ) => void;
  removeCatalogNode: (
    projectId: string,
    bookId: string,
    nodeId: string,
  ) => { blocked: boolean; reason?: string };
  moveCatalogNodeOrder: (
    projectId: string,
    bookId: string,
    sectionCode: CatalogSectionCode,
    parentChapterId: string | undefined,
    nodeId: string,
    direction: 'up' | 'down',
  ) => void;
  transferCatalogNode: (
    projectId: string,
    bookId: string,
    sourceNodeId: string,
    targetSectionCode: CatalogSectionCode,
    targetChapterId?: string,
  ) => void;
  touchBookSaved: (projectId: string, bookId: string) => void;

  updateLayoutConfig: (
    projectId: string,
    bookId: string,
    updates: Partial<BookLayoutConfig>,
  ) => void;
  generateEdition: (
    projectId: string,
    bookId: string,
    ctx: {
      articlesByKey: Record<string, ArticleDocument>;
      lineageTree: TreeItem[];
      personsByChart: Record<string, PersonRecord[]>;
      projectSurname?: string;
    },
  ) => BookEdition | null;
  deleteEdition: (projectId: string, bookId: string, editionId: string) => void;
  finalizeEditionPrint: (
    projectId: string,
    bookId: string,
    editionId: string,
  ) => void;
}

function updateBookInProject(
  state: BookState,
  projectId: string,
  bookId: string,
  updater: (book: BookRecord) => BookRecord,
): Record<string, BookRecord[]> {
  const list = state.booksByProject[projectId] || [];
  return {
    ...state.booksByProject,
    [projectId]: list.map((b) => (b.id === bookId ? updater(b) : b)),
  };
}

export const useBookStore = create<BookState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      _setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      booksByProject: {},
      selectedBookIdByProject: {},
      activeStepByBook: {},

      ensureProjectInitialized: (projectId, ctx) => {
        const current = get();
        if (
          !shouldInitializeProjectSeed({
            hasHydrated: current._hasHydrated,
            projectId,
            existingEntry: current.booksByProject[projectId],
          })
        ) {
          return;
        }

        const cleanFamily = ctx.familyName?.trim() || '本族';
        const surname = ctx.surname?.trim() || '';
        const bookName = cleanFamily.includes('谱')
          ? cleanFamily
          : `${cleanFamily}族谱`;
        const headerName = surname ? `${surname}氏宗谱` : bookName;
        const hallName =
          ctx.hallName?.trim() || (surname ? `${surname}氏宗堂` : '敦睦堂');
        const today = new Date().toISOString().slice(0, 10);

        const sections = createEmptySections();
        const availableArticles = collectTreeNodesByType(
          ctx.articleTree,
          'article',
        ).map((node) => ({
          id: String(node.id),
          title: node.data?.name || '谱文',
        }));

        if (availableArticles.length > 0) {
          sections.preface.items.push({
            id: createEntityId('cat-ch-preface'),
            nodeType: 'chapter',
            title: '谱序凡例',
            collapsed: false,
            children: [
              {
                id: createEntityId('cat-art'),
                nodeType: 'article',
                sourceArticleId: availableArticles[0].id,
                sourceTitle: availableArticles[0].title,
                displayTitle: availableArticles[0].title,
              },
            ],
          });
          if (availableArticles[1]) {
            sections.body.items.push({
              id: createEntityId('cat-art'),
              nodeType: 'article',
              sourceArticleId: availableArticles[1].id,
              sourceTitle: availableArticles[1].title,
              displayTitle: availableArticles[1].title,
            });
          }
        }

        const firstChart = findFirstTreeNodeByType(ctx.lineageTree, 'chart');
        if (firstChart) {
          const { chartName, persons } = resolveChartPersons(
            projectId,
            String(firstChart.id),
            ctx.lineageTree,
            ctx.personsByChart,
            surname,
          );
          const rootPerson =
            persons.find((p) => p.generation === 1 && !p.fatherId) || persons[0];
          if (rootPerson) {
            sections.lineage.items.push({
              id: createEntityId('cat-lin'),
              nodeType: 'lineage',
              totalTitle: bookName,
              eyebrowTitle: `${chartName}世系`,
              chartId: String(firstChart.id),
              chartName,
              startMemberId: rootPerson.id,
              startMemberName: rootPerson.name,
              descendantScope: 'all',
              indexConfig: { enabled: true, inToc: true, tocTitle: '族丁检索表' },
              diaoxianConfig: { enabled: true, inToc: true, tocTitle: '吊线图' },
              shixiConfig: { enabled: true, inToc: true, tocTitle: '世系表' },
            });
          }
        }

        const bookId = createEntityId('book');
        const draftBook: BookRecord = {
          id: bookId,
          bookName,
          headerName,
          hallName,
          volumeNo: '卷一',
          editor: ctx.editor || `${hallName}编委会`,
          compilationDate: today,
          sections,
          layoutConfig: { ...DEFAULT_BOOK_LAYOUT },
          editions: [],
          updatedAt: formatTimestampNow(),
        };

        set((state) => {
          if (state.booksByProject[projectId] !== undefined) return state;
          return {
            booksByProject: { ...state.booksByProject, [projectId]: [draftBook] },
            selectedBookIdByProject: {
              ...state.selectedBookIdByProject,
              [projectId]: bookId,
            },
            activeStepByBook: { ...state.activeStepByBook, [bookId]: 'catalog' },
          };
        });
      },

      selectBook: (projectId, bookId) =>
        set((state) => ({
          selectedBookIdByProject: {
            ...state.selectedBookIdByProject,
            [projectId]: bookId,
          },
        })),

      setActiveStep: (bookId, step) =>
        set((state) => ({
          activeStepByBook: { ...state.activeStepByBook, [bookId]: step },
        })),

      createBook: (projectId, meta) => {
        const id = createEntityId('book');
        const newBook: BookRecord = {
          id,
          bookName: meta.bookName.trim() || '新建谱书',
          headerName: meta.headerName.trim() || meta.bookName.trim() || '谱书',
          hallName: meta.hallName.trim(),
          volumeNo: sanitizeVolumeNo(meta.volumeNo),
          editor: meta.editor.trim(),
          compilationDate:
            meta.compilationDate || new Date().toISOString().slice(0, 10),
          sections: createEmptySections(),
          layoutConfig: { ...DEFAULT_BOOK_LAYOUT },
          editions: [],
          updatedAt: formatTimestampNow(),
        };
        set((state) => ({
          booksByProject: {
            ...state.booksByProject,
            [projectId]: [...(state.booksByProject[projectId] || []), newBook],
          },
          selectedBookIdByProject: {
            ...state.selectedBookIdByProject,
            [projectId]: id,
          },
          activeStepByBook: { ...state.activeStepByBook, [id]: 'catalog' },
        }));
        return id;
      },

      updateBookMeta: (projectId, bookId, meta) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            bookName: meta.bookName.trim() || b.bookName,
            headerName: meta.headerName.trim() || b.headerName,
            hallName: meta.hallName.trim(),
            volumeNo: sanitizeVolumeNo(meta.volumeNo),
            editor: meta.editor.trim(),
            compilationDate: meta.compilationDate || b.compilationDate,
            updatedAt: formatTimestampNow(),
          })),
        })),

      duplicateBook: (projectId, bookId) => {
        const list = get().booksByProject[projectId] || [];
        const idx = list.findIndex((b) => b.id === bookId);
        if (idx < 0) return;
        const src = list[idx];
        const copyId = createEntityId('book');
        const cloned: BookRecord = {
          ...structuredClone(src),
          id: copyId,
          bookName: `${src.bookName} (副本)`,
          editions: [],
          updatedAt: formatTimestampNow(),
        };
        set((state) => {
          const curList = state.booksByProject[projectId] || [];
          const nextList = [...curList];
          const curIdx = curList.findIndex((b) => b.id === bookId);
          nextList.splice(curIdx >= 0 ? curIdx + 1 : curList.length, 0, cloned);
          return {
            booksByProject: { ...state.booksByProject, [projectId]: nextList },
            selectedBookIdByProject: {
              ...state.selectedBookIdByProject,
              [projectId]: copyId,
            },
            activeStepByBook: { ...state.activeStepByBook, [copyId]: 'catalog' },
          };
        });
        useBookEditionStore.getState().duplicateBookEditions(bookId, copyId);
      },

      deleteBook: (projectId, bookId) => {
        set((state) => {
          const list = state.booksByProject[projectId] || [];
          const idx = list.findIndex((b) => b.id === bookId);
          const nextList = list.filter((b) => b.id !== bookId);
          const currentSelected = state.selectedBookIdByProject[projectId];
          const nextSelected =
            currentSelected === bookId
              ? nextList[Math.min(idx, nextList.length - 1)]?.id || ''
              : currentSelected;
          return {
            booksByProject: { ...state.booksByProject, [projectId]: nextList },
            selectedBookIdByProject: {
              ...state.selectedBookIdByProject,
              [projectId]: nextSelected,
            },
          };
        });
        useBookEditionStore.getState().removeBookEditions(bookId);
      },

      moveBook: (projectId, bookId, direction) =>
        set((state) => {
          const list = state.booksByProject[projectId] || [];
          const idx = list.findIndex((b) => b.id === bookId);
          if (idx < 0) return state;
          const targetIdx = idx + direction;
          if (targetIdx < 0 || targetIdx >= list.length) return state;
          const nextList = [...list];
          const [moved] = nextList.splice(idx, 1);
          nextList.splice(targetIdx, 0, moved);
          return {
            booksByProject: { ...state.booksByProject, [projectId]: nextList },
          };
        }),

      toggleSectionCollapsed: (projectId, bookId, sectionCode) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            sections: {
              ...b.sections,
              [sectionCode]: {
                ...b.sections[sectionCode],
                collapsed: !b.sections[sectionCode].collapsed,
              },
            },
          })),
        })),

      toggleChapterCollapsed: (projectId, bookId, sectionCode, chapterId) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
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
        })),

      addChapter: (projectId, bookId, sectionCode, title) => {
        const chapterId = createEntityId('cat-ch');
        const newChapter: CatalogChapterNode = {
          id: chapterId,
          nodeType: 'chapter',
          title: title.trim() || '新建章节',
          collapsed: false,
          children: [],
        };
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            sections: appendNodesToSection(b.sections, sectionCode, undefined, [
              newChapter,
            ]),
            updatedAt: formatTimestampNow(),
          })),
        }));
        return chapterId;
      },

      renameChapter: (projectId, bookId, chapterId, title) =>
        set((state) => {
          const clean = title.trim();
          if (!clean) return state;
          return {
            booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
              ...b,
              sections: mapBookSections(b.sections, (sec) =>
                sec.items.map((n) =>
                  n.id === chapterId && n.nodeType === 'chapter'
                    ? { ...n, title: clean }
                    : n,
                ),
              ),
              updatedAt: formatTimestampNow(),
            })),
          };
        }),

      addArticleRefs: (projectId, bookId, sectionCode, chapterId, articles) =>
        set((state) => {
          if (!articles.length) return state;
          const newNodes: CatalogLeafNode[] = articles.map((a) => ({
            id: createEntityId('cat-art'),
            nodeType: 'article',
            sourceArticleId: a.sourceArticleId,
            sourceTitle: a.sourceTitle,
            displayTitle: a.sourceTitle,
          }));
          return {
            booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
              ...b,
              sections: appendNodesToSection(
                b.sections,
                sectionCode,
                chapterId,
                newNodes,
              ),
              updatedAt: formatTimestampNow(),
            })),
          };
        }),

      updateArticleRef: (projectId, bookId, nodeId, updates) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
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
            updatedAt: formatTimestampNow(),
          })),
        })),

      addLineageRef: (projectId, bookId, sectionCode, chapterId, payload) =>
        set((state) => {
          const newNode: CatalogLineageNode = {
            ...payload,
            id: createEntityId('cat-lin'),
            nodeType: 'lineage',
          };
          return {
            booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
              ...b,
              sections: appendNodesToSection(b.sections, sectionCode, chapterId, [
                newNode,
              ]),
              updatedAt: formatTimestampNow(),
            })),
          };
        }),

      updateLineageRefSettings: (projectId, bookId, nodeId, updates) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            sections: mapBookSections(b.sections, (sec) =>
              mapSectionLeafNodes(sec.items, (node) =>
                node.id === nodeId && node.nodeType === 'lineage'
                  ? { ...node, ...updates }
                  : node,
              ),
            ),
            updatedAt: formatTimestampNow(),
          })),
        })),

      removeCatalogNode: (projectId, bookId, nodeId) => {
        const list = get().booksByProject[projectId] || [];
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

        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            sections: mapBookSections(
              b.sections,
              (sec) => removeNodeFromList(sec.items, nodeId).nextNodes,
            ),
            updatedAt: formatTimestampNow(),
          })),
        }));

        return { blocked: false };
      },

      moveCatalogNodeOrder: (
        projectId,
        bookId,
        sectionCode,
        parentChapterId,
        nodeId,
        direction,
      ) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => {
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
              ...b,
              sections: {
                ...b.sections,
                [sectionCode]: { ...sec, items: nextItems },
              },
              updatedAt: formatTimestampNow(),
            };
          }),
        })),

      transferCatalogNode: (
        projectId,
        bookId,
        sourceNodeId,
        targetSectionCode,
        targetChapterId,
      ) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => {
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

            if (!extracted) return b;
            const movedNode = extracted as CatalogNode;
            return {
              ...b,
              sections: appendNodesToSection(
                nextSections,
                targetSectionCode,
                movedNode.nodeType !== 'chapter' ? targetChapterId : undefined,
                [movedNode],
              ),
              updatedAt: formatTimestampNow(),
            };
          }),
        })),

      touchBookSaved: (projectId, bookId) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            updatedAt: formatTimestampNow(),
          })),
        })),

      updateLayoutConfig: (projectId, bookId, updates) =>
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            layoutConfig: { ...b.layoutConfig, ...updates },
            updatedAt: formatTimestampNow(),
          })),
        })),

      generateEdition: (projectId, bookId, ctx) => {
        const list = get().booksByProject[projectId] || [];
        const book = list.find((b) => b.id === bookId);
        if (!book) return null;

        const edition = compileBookEdition({
          projectId,
          book,
          articlesByKey: ctx.articlesByKey,
          lineageTree: ctx.lineageTree,
          personsByChart: ctx.personsByChart,
          projectSurname: ctx.projectSurname,
        });

        useBookEditionStore.getState().addEdition(bookId, edition);
        set((state) => ({
          booksByProject: updateBookInProject(state, projectId, bookId, (b) => ({
            ...b,
            updatedAt: formatTimestampNow(),
          })),
        }));

        return edition;
      },

      deleteEdition: (_projectId, bookId, editionId) => {
        useBookEditionStore.getState().deleteEdition(bookId, editionId);
      },

      finalizeEditionPrint: (_projectId, bookId, editionId) => {
        useBookEditionStore.getState().finalizeEditionPrint(bookId, editionId);
      },
    }),
    {
      name: 'yunpu:books',
      version: 2,
      storage: createAsyncEntityStorage(),
      partialize: (state) => {
        // Keep book metadata & catalog hot; compiled edition snapshots live in yunpu:book-editions
        const slimBooksByProject: Record<string, BookRecord[]> = {};
        for (const [pid, books] of Object.entries(state.booksByProject)) {
          slimBooksByProject[pid] = books.map((b) =>
            b.editions?.length ? { ...b, editions: [] } : b,
          );
        }
        return {
          booksByProject: slimBooksByProject,
          selectedBookIdByProject: state.selectedBookIdByProject,
          activeStepByBook: state.activeStepByBook,
        };
      },
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const record = persisted as Record<string, unknown>;
        if (version < 2 && record.booksByProject && typeof record.booksByProject === 'object') {
          const legacyEditions: Record<string, BookEdition[]> = {};
          const nextBooksByProject: Record<string, BookRecord[]> = {};
          for (const [pid, books] of Object.entries(
            record.booksByProject as Record<string, BookRecord[]>,
          )) {
            if (!Array.isArray(books)) continue;
            nextBooksByProject[pid] = books.map((book) => {
              if (book.editions?.length) {
                legacyEditions[book.id] = book.editions;
                return { ...book, editions: [] };
              }
              return book;
            });
          }
          if (Object.keys(legacyEditions).length > 0) {
            useBookEditionStore.getState().importLegacyEditions(legacyEditions);
          }
          return { ...record, booksByProject: nextBooksByProject };
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    },
  ),
);

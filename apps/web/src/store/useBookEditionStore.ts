import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BookEdition } from '../features/books/types';
import { createAsyncEntityStorage } from './storageAdapter';

const MAX_EDITIONS_PER_BOOK = 9;

interface BookEditionState {
  editionsByBookId: Record<string, BookEdition[]>;
  addEdition: (bookId: string, edition: BookEdition) => void;
  deleteEdition: (bookId: string, editionId: string) => void;
  finalizeEditionPrint: (bookId: string, editionId: string) => void;
  duplicateBookEditions: (srcBookId: string, dstBookId: string) => void;
  removeBookEditions: (bookId: string) => void;
  importLegacyEditions: (editionsByBookId: Record<string, BookEdition[]>) => void;
}

export const useBookEditionStore = create<BookEditionState>()(
  persist(
    (set) => ({
      editionsByBookId: {},

      addEdition: (bookId, edition) =>
        set((state) => ({
          editionsByBookId: {
            ...state.editionsByBookId,
            [bookId]: [edition, ...(state.editionsByBookId[bookId] ?? [])].slice(
              0,
              MAX_EDITIONS_PER_BOOK,
            ),
          },
        })),

      deleteEdition: (bookId, editionId) =>
        set((state) => {
          const existing = state.editionsByBookId[bookId];
          if (!existing) return state;
          return {
            editionsByBookId: {
              ...state.editionsByBookId,
              [bookId]: existing.filter((ed) => ed.id !== editionId),
            },
          };
        }),

      finalizeEditionPrint: (bookId, editionId) =>
        set((state) => {
          const existing = state.editionsByBookId[bookId];
          if (!existing) return state;
          return {
            editionsByBookId: {
              ...state.editionsByBookId,
              [bookId]: existing.map((ed) =>
                ed.id === editionId ? { ...ed, printStatus: 'finalized' } : ed,
              ),
            },
          };
        }),

      duplicateBookEditions: (srcBookId, dstBookId) =>
        set((state) => {
          const srcEditions = state.editionsByBookId[srcBookId];
          if (!srcEditions?.length) return state;
          return {
            editionsByBookId: {
              ...state.editionsByBookId,
              [dstBookId]: structuredClone(srcEditions),
            },
          };
        }),

      removeBookEditions: (bookId) =>
        set((state) => {
          if (!(bookId in state.editionsByBookId)) return state;
          const next = { ...state.editionsByBookId };
          delete next[bookId];
          return { editionsByBookId: next };
        }),

      importLegacyEditions: (legacyMap) => {
        const entries = Object.entries(legacyMap);
        if (entries.length === 0) return;
        set((state) => {
          const next = { ...state.editionsByBookId };
          for (const [bookId, editions] of entries) {
            if (!Array.isArray(editions) || editions.length === 0) continue;
            if (!next[bookId]?.length) {
              next[bookId] = editions.slice(0, MAX_EDITIONS_PER_BOOK);
            }
          }
          return { editionsByBookId: next };
        });
      },
    }),
    {
      name: 'yunpu:book-editions',
      version: 1,
      storage: createAsyncEntityStorage(),
      partialize: (state) => ({
        editionsByBookId: state.editionsByBookId,
      }),
    },
  ),
);

import { create } from 'zustand';
import type { BookStep } from '../features/books/types';

export interface BookUiState {
  selectedBookIdByProject: Record<string, string>;
  activeStepByBook: Record<string, BookStep>;

  selectBook: (projectId: string, bookId: string) => void;
  setActiveStep: (bookId: string, step: BookStep) => void;
}

export const useBookStore = create<BookUiState>()((set) => ({
  selectedBookIdByProject: {},
  activeStepByBook: {},

  selectBook: (projectId, bookId) =>
    set((state) => ({
      selectedBookIdByProject: {
        ...state.selectedBookIdByProject,
        [projectId]: bookId,
      },
    })),

  setActiveStep: (bookId, step) =>
    set((state) => ({
      activeStepByBook: {
        ...state.activeStepByBook,
        [bookId]: step,
      },
    })),
}));

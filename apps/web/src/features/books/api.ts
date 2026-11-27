import type {
  CreateBookEditionInput,
  CreateBookInput,
  UpdateBookInput,
} from '@yunpu/shared';
import { apiRequest } from '../../lib/api';
import type { BookEdition, BookRecord } from './types';

export const fetchBooks = (projectId: string) =>
  apiRequest<{ books: BookRecord[] }>(`/api/v1/projects/${projectId}/books`);

export const createBookRequest = (projectId: string, payload: CreateBookInput) =>
  apiRequest<{ book: BookRecord }>(`/api/v1/projects/${projectId}/books`, {
    method: 'POST',
    body: payload,
  });

export const updateBookRequest = (
  projectId: string,
  bookId: string,
  payload: UpdateBookInput,
) =>
  apiRequest<{ book: BookRecord }>(
    `/api/v1/projects/${projectId}/books/${bookId}`,
    { method: 'PATCH', body: payload },
  );

export const duplicateBookRequest = (projectId: string, bookId: string) =>
  apiRequest<{ book: BookRecord }>(
    `/api/v1/projects/${projectId}/books/${bookId}/duplicate`,
    { method: 'POST' },
  );

export const reorderBooksRequest = (projectId: string, bookIds: string[]) =>
  apiRequest<{ books: BookRecord[] }>(
    `/api/v1/projects/${projectId}/books/reorder`,
    { method: 'PUT', body: { bookIds } },
  );

export const deleteBookRequest = (projectId: string, bookId: string) =>
  apiRequest<{ deleted: boolean }>(
    `/api/v1/projects/${projectId}/books/${bookId}`,
    { method: 'DELETE' },
  );

export const fetchBookEditions = (projectId: string, bookId: string) =>
  apiRequest<{ editions: BookEdition[] }>(
    `/api/v1/projects/${projectId}/books/${bookId}/editions`,
  );

export const createBookEditionRequest = (
  projectId: string,
  bookId: string,
  payload: CreateBookEditionInput,
) =>
  apiRequest<{ edition: BookEdition }>(
    `/api/v1/projects/${projectId}/books/${bookId}/editions`,
    { method: 'POST', body: payload },
  );

export const finalizeBookEditionPrintRequest = (
  projectId: string,
  bookId: string,
  editionId: string,
) =>
  apiRequest<{ edition: BookEdition }>(
    `/api/v1/projects/${projectId}/books/${bookId}/editions/${editionId}`,
    { method: 'PATCH', body: { printStatus: 'finalized' } },
  );

export const deleteBookEditionRequest = (
  projectId: string,
  bookId: string,
  editionId: string,
) =>
  apiRequest<{ deleted: boolean }>(
    `/api/v1/projects/${projectId}/books/${bookId}/editions/${editionId}`,
    { method: 'DELETE' },
  );

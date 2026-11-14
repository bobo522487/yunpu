import { createJSONStorage, StateStorage } from 'zustand/middleware';

export interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }
}

export const defaultStorageAdapter: StorageAdapter = new LocalStorageAdapter();

export const createAppStorage = <T>(adapter: StorageAdapter = defaultStorageAdapter) =>
  createJSONStorage<T>(() => adapter as StateStorage);

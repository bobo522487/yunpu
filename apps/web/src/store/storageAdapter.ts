import { createJSONStorage, type StateStorage } from 'zustand/middleware';

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

const IDB_NAME = 'yunpu_entity_cache';
const IDB_STORE = 'kv';
const DEFAULT_IDB_WRITE_DELAY_MS = 180;

export interface DebouncedEntityStoreBackend {
  get: (key: string) => Promise<string | null>;
  setBatch: (entries: Array<[string, string]>, deletes: string[]) => Promise<void>;
  clearAll?: () => Promise<void>;
}

export interface FlushableStateStorage extends StateStorage {
  flushPendingWrites: () => Promise<void>;
  clearAll: () => Promise<void>;
}

function createBrowserIdbBackend(): DebouncedEntityStoreBackend {
  let dbPromise: Promise<IDBDatabase | null> | null = null;

  const openDb = (): Promise<IDBDatabase | null> => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve(null);
    }
    if (!dbPromise) {
      dbPromise = new Promise((resolve) => {
        try {
          const req = window.indexedDB.open(IDB_NAME, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
              db.createObjectStore(IDB_STORE);
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return dbPromise;
  };

  return {
    async get(key: string): Promise<string | null> {
      const db = await openDb();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(key);
          req.onsuccess = () => {
            const val = req.result;
            resolve(typeof val === 'string' ? val : null);
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    },

    async setBatch(
      entries: Array<[string, string]>,
      deletes: string[]
    ): Promise<void> {
      if (entries.length === 0 && deletes.length === 0) return;
      const db = await openDb();
      if (!db) return;
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          for (const [k, v] of entries) {
            store.put(v, k);
          }
          for (const k of deletes) {
            store.delete(k);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    },

    async clearAll(): Promise<void> {
      const db = await openDb();
      if (!db) return;
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    },
  };
}

/**
 * Create a debounced, read-through cached async storage adapter backed by IndexedDB
 * (or a custom backend in tests). Avoids opening synchronous readwrite IDB transactions
 * on every keystroke while guaranteeing read-after-write consistency and unload flush.
 */
export function createDebouncedAsyncStorage(options?: {
  writeDelayMs?: number;
  backend?: DebouncedEntityStoreBackend;
}): FlushableStateStorage {
  const writeDelayMs = options?.writeDelayMs ?? DEFAULT_IDB_WRITE_DELAY_MS;
  const backend = options?.backend ?? createBrowserIdbBackend();

  const memoryCache = new Map<string, string>();
  const pendingWrites = new Map<string, string>();
  const pendingDeletes = new Set<string>();
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const flushKey = async (key: string): Promise<void> => {
    const timer = pendingTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      pendingTimers.delete(key);
    }

    const hasWrite = pendingWrites.has(key);
    const hasDelete = pendingDeletes.has(key);
    if (!hasWrite && !hasDelete) return;

    const entries: Array<[string, string]> = [];
    const deletes: string[] = [];

    if (hasWrite) {
      entries.push([key, pendingWrites.get(key)!]);
      pendingWrites.delete(key);
    } else if (hasDelete) {
      deletes.push(key);
      pendingDeletes.delete(key);
    }

    await backend.setBatch(entries, deletes);
  };

  const scheduleKeyFlush = (key: string): Promise<void> | void => {
    const prev = pendingTimers.get(key);
    if (prev !== undefined) {
      clearTimeout(prev);
      pendingTimers.delete(key);
    }

    if (writeDelayMs <= 0) {
      return flushKey(key);
    }

    const timer = setTimeout(() => {
      pendingTimers.delete(key);
      void flushKey(key);
    }, writeDelayMs);
    pendingTimers.set(key, timer);
  };

  const flushPendingWrites = async (): Promise<void> => {
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer);
    }
    pendingTimers.clear();

    if (pendingWrites.size === 0 && pendingDeletes.size === 0) return;

    const entries = Array.from(pendingWrites.entries());
    const deletes = Array.from(pendingDeletes.values());
    pendingWrites.clear();
    pendingDeletes.clear();

    await backend.setBatch(entries, deletes);
  };

  const clearAll = async (): Promise<void> => {
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer);
    }
    pendingTimers.clear();
    pendingWrites.clear();
    pendingDeletes.clear();
    memoryCache.clear();
    await backend.clearAll?.();
  };

  return {
    async getItem(key: string): Promise<string | null> {
      if (pendingDeletes.has(key)) return null;
      if (pendingWrites.has(key)) return pendingWrites.get(key)!;
      if (memoryCache.has(key)) return memoryCache.get(key)!;

      const persisted = await backend.get(key);
      if (typeof persisted === 'string') {
        memoryCache.set(key, persisted);
        return persisted;
      }
      return null;
    },

    async setItem(key: string, value: string): Promise<void> {
      memoryCache.set(key, value);
      pendingDeletes.delete(key);
      pendingWrites.set(key, value);
      await scheduleKeyFlush(key);
    },

    async removeItem(key: string): Promise<void> {
      memoryCache.delete(key);
      pendingWrites.delete(key);
      pendingDeletes.add(key);
      await scheduleKeyFlush(key);
    },

    flushPendingWrites,
    clearAll,
  };
}

const idbAdapter = createDebouncedAsyncStorage();

if (typeof window !== 'undefined') {
  const handleFlush = () => {
    void idbAdapter.flushPendingWrites();
  };
  window.addEventListener('pagehide', handleFlush);
  window.addEventListener('beforeunload', handleFlush);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void idbAdapter.flushPendingWrites();
      }
    });
  }
}

export const defaultStorageAdapter: StorageAdapter = new LocalStorageAdapter();
export const asyncEntityStorageAdapter: StateStorage = idbAdapter;
export const flushAsyncEntityStorage = () => idbAdapter.flushPendingWrites();
export const clearAsyncEntityStorage = () => idbAdapter.clearAll();

/** Fast synchronous storage for lightweight UI preferences & workspace metadata */
export const createAppStorage = <T>(
  adapter: StorageAdapter = defaultStorageAdapter
) => createJSONStorage<T>(() => adapter as StateStorage);

/** Non-blocking async IndexedDB storage for heavy domain entities (Lineage, Articles, Books) */
export const createAsyncEntityStorage = <T>() =>
  createJSONStorage<T>(() => asyncEntityStorageAdapter);

export interface ArticleAssetRecord {
  assetId: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ArticleAssetStore {
  put(record: ArticleAssetRecord): Promise<void>;
  get(assetId: string): Promise<ArticleAssetRecord | null>;
}

export function createMemoryArticleAssetStore(): ArticleAssetStore {
  const map = new Map<string, ArticleAssetRecord>();
  return {
    async put(record) {
      map.set(record.assetId, {
        assetId: record.assetId,
        contentType: record.contentType,
        bytes: new Uint8Array(record.bytes),
      });
    },
    async get(assetId) {
      return map.get(assetId) ?? null;
    },
  };
}

const DB_NAME = 'yunpu_article_assets';
const STORE = 'blobs';

export function createIndexedDbArticleAssetStore(): ArticleAssetStore {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  return {
    async put(record) {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(
          { contentType: record.contentType, bytes: record.bytes },
          record.assetId,
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async get(assetId) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(assetId);
        req.onsuccess = () => {
          const value = req.result as { contentType: string; bytes: Uint8Array } | undefined;
          resolve(value ? { assetId, contentType: value.contentType, bytes: value.bytes } : null);
        };
        req.onerror = () => reject(req.error);
      });
    },
  };
}
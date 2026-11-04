import type { OfflineMutation, PosStoreState } from '../types/pos';

const DB_NAME = 'mhs_pos_offline_db';
const DB_VERSION = 2;
const STORE_STATE = 'pos_snapshot';
const STORE_QUEUE = 'mutation_queue';

function openPosDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveStoreSnapshot(state: PosStoreState): Promise<void> {
  try {
    const db = await openPosDb();
    const key = `shop_${state.shopId || 'default'}`;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readwrite');
      tx.objectStore(STORE_STATE).put(state, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB snapshot save fallback:', err);
  }
}

export async function loadStoreSnapshot(shopId: string): Promise<PosStoreState | null> {
  try {
    const db = await openPosDb();
    const key = `shop_${shopId || 'default'}`;
    return await new Promise<PosStoreState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readonly');
      const req = tx.objectStore(STORE_STATE).get(key);
      req.onsuccess = () => resolve((req.result as PosStoreState) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function enqueueOfflineMutation(mutation: OfflineMutation): Promise<void> {
  try {
    const db = await openPosDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).put(mutation);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Offline queue write error:', err);
  }
}

export async function getPendingMutations(shopId?: string): Promise<OfflineMutation[]> {
  try {
    const db = await openPosDb();
    return await new Promise<OfflineMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => {
        const list = ((req.result as OfflineMutation[]) || []).filter(
          (m) => !shopId || !m.shopId || m.shopId === shopId
        );
        resolve(list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearOfflineQueue(shopId?: string): Promise<void> {
  try {
    const db = await openPosDb();
    if (!shopId) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        tx.objectStore(STORE_QUEUE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    }
    const items = await getPendingMutations(shopId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      for (const item of items) {
        store.delete(item.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Offline queue clear error:', err);
  }
}

export async function clearCachedStoreSnapshots(): Promise<void> {
  try {
    const pending = await getPendingMutations();
    if (pending.length > 0) {
      return;
    }
    const db = await openPosDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readwrite');
      tx.objectStore(STORE_STATE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IndexedDB cleanup errors
  }
}

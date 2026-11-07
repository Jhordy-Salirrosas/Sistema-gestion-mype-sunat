import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORE,
  type InvoiceIngestPayload,
  type OfflineQueueItem,
  type QueueItemStatus,
} from '../types/offlineQueue.types';

/** Acceso a la cola offline en IndexedDB: la unica capa que conoce idb. */

interface OfflineQueueSchema extends DBSchema {
  'invoice-queue': {
    key: string;
    value: OfflineQueueItem;
    indexes: {
      'by-status': QueueItemStatus;
      'by-created': string;
    };
  };
}

type OfflineDb = IDBPDatabase<OfflineQueueSchema>;

let dbPromise: Promise<OfflineDb> | null = null;

/** Abre la base una sola vez y reutiliza la conexion. */
function getDb(): Promise<OfflineDb> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineQueueSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db: IDBPDatabase<OfflineQueueSchema>) {
        const store = db.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-created', 'createdAt');
      },
    });
  }
  return dbPromise!;
}

/** Cierra la conexion. Solo se usa en las pruebas. */
export async function closeOfflineQueue(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/** Guarda un comprobante en la cola, en estado PENDIENTE. */
export async function enqueue(
  payload: InvoiceIngestPayload,
): Promise<OfflineQueueItem> {
  const now = new Date().toISOString();

  const item: OfflineQueueItem = {
    id: crypto.randomUUID(),
    payload,
    status: 'PENDIENTE',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  await db.add(OFFLINE_STORE, item);

  return item;
}

/** Devuelve la cola completa en orden de creacion (FIFO). */
export async function listAll(): Promise<OfflineQueueItem[]> {
  const db = await getDb();
  return db.getAllFromIndex(OFFLINE_STORE, 'by-created');
}

/** Devuelve los elementos en un estado, en orden FIFO. */
export async function listByStatus(
  status: QueueItemStatus,
): Promise<OfflineQueueItem[]> {
  const db = await getDb();
  const items = await db.getAllFromIndex(OFFLINE_STORE, 'by-status', status);

  return items.sort((a: OfflineQueueItem, b: OfflineQueueItem) => a.createdAt.localeCompare(b.createdAt));
}

/** Aplica cambios parciales a un elemento y actualiza updatedAt. */
export async function patch(
  id: string,
  changes: Partial<
    Pick<OfflineQueueItem, 'status' | 'attempts' | 'lastError' | 'syncedAt'>
  >,
): Promise<OfflineQueueItem | undefined> {
  const db = await getDb();
  const current = await db.get(OFFLINE_STORE, id);

  if (!current) {
    return undefined;
  }

  const updated: OfflineQueueItem = {
    ...current,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  await db.put(OFFLINE_STORE, updated);

  return updated;
}

/** Elimina un elemento de la cola. */
export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(OFFLINE_STORE, id);
}
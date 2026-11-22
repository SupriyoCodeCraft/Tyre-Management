import { DATABASE_NAME, DATABASE_STORES, DATABASE_VERSION } from './schema.js';

let databasePromise;
let persistenceRequested = false;

function createIndexes(store, indexes) {
  for (const definition of indexes) {
    const index = typeof definition === 'string' ? { name: definition } : definition;
    const indexName = index.name;
    const keyPath = index.keyPath ?? index.name;
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, keyPath, { unique: Boolean(index.unique) });
    }
  }
}

function requestPersistentStorage() {
  if (persistenceRequested) return;
  persistenceRequested = true;
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => false);
  }
}

export function openDatabase(name = DATABASE_NAME) {
  if (name === DATABASE_NAME && databasePromise) return databasePromise;

  const opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser storage is unavailable in this environment.'));
      return;
    }

    const request = indexedDB.open(name, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const [storeName, indexes] of Object.entries(DATABASE_STORES)) {
        const store = database.objectStoreNames.contains(storeName)
          ? request.transaction.objectStore(storeName)
          : database.createObjectStore(storeName, { keyPath: 'id' });
        createIndexes(store, indexes);
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      requestPersistentStorage();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
    request.onblocked = () => reject(new Error('Database upgrade is blocked by another open tab.'));
  });

  if (name === DATABASE_NAME) {
    databasePromise = opening;
    opening.catch(() => {
      if (databasePromise === opening) databasePromise = null;
    });
  }
  return opening;
}

export function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('A database request failed.'));
  });
}

export function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('The database transaction was aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('The database transaction failed.'));
  });
}

export function toStorageError(error) {
  if (error?.name === 'QuotaExceededError') {
    return new Error('This browser is out of storage space. Free some space and try again.');
  }
  if (error?.name === 'SecurityError' || error?.name === 'NotAllowedError') {
    return new Error('Browser storage is unavailable. Check your browser privacy settings and try again.');
  }
  if (error?.name === 'ConstraintError') {
    return new Error('A record with this tyre serial number already exists.');
  }
  return error instanceof Error ? error : new Error('The record could not be saved locally.');
}

export async function withTransaction(storeNames, mode, operation, name = DATABASE_NAME) {
  let transaction;
  let completion;
  try {
    const database = await openDatabase(name);
    transaction = database.transaction(storeNames, mode);
    completion = transactionResult(transaction);
    const result = await operation(transaction);
    await completion;
    return result;
  } catch (error) {
    try {
      transaction?.abort();
    } catch {
      // The transaction may already have completed or aborted.
    }
    if (completion) await completion.catch(() => {});
    throw toStorageError(error);
  }
}

export async function closeDatabase() {
  if (!databasePromise) return;
  try {
    const database = await databasePromise;
    database.close();
  } catch {
    // Nothing to close if initialization failed.
  }
  databasePromise = null;
}

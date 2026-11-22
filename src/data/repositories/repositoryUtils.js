import { requestResult, withTransaction } from '../database/database.js';

export function readById(storeName, id) {
  return withTransaction([storeName], 'readonly', (transaction) =>
    requestResult(transaction.objectStore(storeName).get(id)),
  );
}

export function readAll(storeName) {
  return withTransaction([storeName], 'readonly', (transaction) =>
    requestResult(transaction.objectStore(storeName).getAll()),
  );
}

export function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

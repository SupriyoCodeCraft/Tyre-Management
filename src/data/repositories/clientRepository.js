import { STORE_NAMES } from '../database/schema.js';
import { createId, nowIso } from '../database/recordUtils.js';
import { withTransaction, requestResult } from '../database/database.js';
import { readAll, readById, requireText } from './repositoryUtils.js';

export function createClient({ name, contactInformation = '' }) {
  const timestamp = nowIso();
  const record = {
    id: createId(),
    name: requireText(name, 'Client name'),
    contactInformation: String(contactInformation).trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return withTransaction([STORE_NAMES.clients], 'readwrite', async (transaction) => {
    await requestResult(transaction.objectStore(STORE_NAMES.clients).add(record));
    return record;
  });
}

export const getClient = (id) => readById(STORE_NAMES.clients, id);
export const listClients = () => readAll(STORE_NAMES.clients);

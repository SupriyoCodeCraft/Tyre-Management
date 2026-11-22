import { STORE_NAMES } from '../database/schema.js';
import { createId, nowIso } from '../database/recordUtils.js';
import { requestResult, withTransaction } from '../database/database.js';
import { readAll, readById, requireText } from './repositoryUtils.js';

export function createSite({ clientId, name, location = '' }) {
  return withTransaction([STORE_NAMES.clients, STORE_NAMES.sites], 'readwrite', async (transaction) => {
    const client = await requestResult(transaction.objectStore(STORE_NAMES.clients).get(clientId));
    if (!client) throw new Error('Select a valid client for this site.');
    const timestamp = nowIso();
    const record = {
      id: createId(),
      clientId,
      name: requireText(name, 'Site name'),
      location: String(location).trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await requestResult(transaction.objectStore(STORE_NAMES.sites).add(record));
    return record;
  });
}

export const getSite = (id) => readById(STORE_NAMES.sites, id);
export const listSites = () => readAll(STORE_NAMES.sites);

export function listSitesForClient(clientId) {
  return withTransaction([STORE_NAMES.sites], 'readonly', (transaction) =>
    requestResult(transaction.objectStore(STORE_NAMES.sites).index('clientId').getAll(clientId)),
  );
}

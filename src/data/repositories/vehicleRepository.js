import { STORE_NAMES } from '../database/schema.js';
import { createId, nowIso } from '../database/recordUtils.js';
import { requestResult, withTransaction } from '../database/database.js';
import { readAll, readById, requireText } from './repositoryUtils.js';

export function createVehicle({ clientId, siteId, registrationNumber, description = '' }) {
  return withTransaction(
    [STORE_NAMES.clients, STORE_NAMES.sites, STORE_NAMES.vehicles],
    'readwrite',
    async (transaction) => {
      const [client, site] = await Promise.all([
        requestResult(transaction.objectStore(STORE_NAMES.clients).get(clientId)),
        requestResult(transaction.objectStore(STORE_NAMES.sites).get(siteId)),
      ]);
      if (!client || !site || site.clientId !== clientId) {
        throw new Error('Select a valid site that belongs to the selected client.');
      }
      const timestamp = nowIso();
      const record = {
        id: createId(),
        clientId,
        siteId,
        registrationNumber: requireText(registrationNumber, 'Vehicle registration or identifier'),
        description: String(description).trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await requestResult(transaction.objectStore(STORE_NAMES.vehicles).add(record));
      return record;
    },
  );
}

export const getVehicle = (id) => readById(STORE_NAMES.vehicles, id);
export const listVehicles = () => readAll(STORE_NAMES.vehicles);

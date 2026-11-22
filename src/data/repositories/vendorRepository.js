import { STORE_NAMES } from '../database/schema.js';
import { createId, nowIso } from '../database/recordUtils.js';
import { requestResult, withTransaction } from '../database/database.js';
import { readAll, readById, requireText } from './repositoryUtils.js';

export function createVendor({ name, contactInformation = '' }) {
  const timestamp = nowIso();
  const record = {
    id: createId(),
    name: requireText(name, 'Vendor name'),
    contactInformation: String(contactInformation).trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return withTransaction([STORE_NAMES.vendors], 'readwrite', async (transaction) => {
    await requestResult(transaction.objectStore(STORE_NAMES.vendors).add(record));
    return record;
  });
}

export const getVendor = (id) => readById(STORE_NAMES.vendors, id);
export const listVendors = () => readAll(STORE_NAMES.vendors);

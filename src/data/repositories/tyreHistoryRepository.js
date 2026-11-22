import { STORE_NAMES } from '../database/schema.js';
import { requestResult, withTransaction } from '../database/database.js';

export function listTyreHistory(tyreId) {
  return withTransaction([STORE_NAMES.tyreHistoryEvents], 'readonly', async (transaction) => {
    const events = await requestResult(
      transaction.objectStore(STORE_NAMES.tyreHistoryEvents).index('tyreId').getAll(tyreId),
    );
    return events.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.createdAt.localeCompare(b.createdAt));
  });
}

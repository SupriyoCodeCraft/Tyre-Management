import { createId, nowIso, normalizeSerialNumber } from '../database/recordUtils.js';
import { STORE_NAMES } from '../database/schema.js';
import { requestResult, withTransaction } from '../database/database.js';
import { readById } from './repositoryUtils.js';

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('A scrap record database request failed.'));
  });
}

export function createScrapRecord(input) {
  const recordId = createId();
  const timestamp = nowIso();
  return withTransaction(
    [STORE_NAMES.tyres, STORE_NAMES.scrapRecords, STORE_NAMES.scrapPhotos, STORE_NAMES.tyreHistoryEvents],
    'readwrite',
    (transaction) => new Promise((resolve, reject) => {
      const tyreRequest = transaction.objectStore(STORE_NAMES.tyres)
        .index('serialNumberKey').get(normalizeSerialNumber(input.serialNumber));
      requestPromise(tyreRequest).then((tyre) => {
        if (!tyre) throw new Error(`Tyre ${input.serialNumber} is not registered.`);
        if (tyre.currentStatus === 'scrapped') throw new Error(`Tyre ${tyre.serialNumber} is already recorded as scrapped.`);

        const damagedPartPhoto = {
          id: createId(), scrapRecordId: recordId, category: 'damaged-part',
          blob: input.damagedPartPhoto.blob, fileName: input.damagedPartPhoto.fileName,
          mimeType: input.damagedPartPhoto.mimeType, byteLength: input.damagedPartPhoto.blob.size,
          createdAt: timestamp,
        };
        const completeTyrePhoto = {
          id: createId(), scrapRecordId: recordId, category: 'complete-tyre',
          blob: input.completeTyrePhoto.blob, fileName: input.completeTyrePhoto.fileName,
          mimeType: input.completeTyrePhoto.mimeType, byteLength: input.completeTyrePhoto.blob.size,
          createdAt: timestamp,
        };
        const record = {
          id: recordId,
          tyreId: tyre.id,
          serialNumber: tyre.serialNumber,
          brand: tyre.brand,
          model: tyre.model ?? '',
          scrapDate: input.scrapDate,
          reason: input.reason,
          remarks: input.remarks,
          clientId: tyre.currentClientId ?? null,
          siteId: tyre.currentSiteId ?? null,
          vehicleId: tyre.currentVehicleId ?? null,
          damagedPartPhotoId: damagedPartPhoto.id,
          completeTyrePhotoId: completeTyrePhoto.id,
          createdAt: timestamp,
        };
        const updatedTyre = { ...tyre, currentStatus: 'scrapped', updatedAt: timestamp };
        const event = {
          id: createId(),
          tyreId: tyre.id,
          eventType: 'SCRAP_RECORDED',
          eventDate: input.scrapDate,
          details: {
            scrapRecordId: record.id,
            reason: record.reason,
            remarks: record.remarks,
            clientId: record.clientId,
            siteId: record.siteId,
            vehicleId: record.vehicleId,
          },
          createdAt: timestamp,
        };
        const writes = [
          transaction.objectStore(STORE_NAMES.scrapRecords).add(record),
          transaction.objectStore(STORE_NAMES.scrapPhotos).add(damagedPartPhoto),
          transaction.objectStore(STORE_NAMES.scrapPhotos).add(completeTyrePhoto),
          transaction.objectStore(STORE_NAMES.tyres).put(updatedTyre),
          transaction.objectStore(STORE_NAMES.tyreHistoryEvents).add(event),
        ];
        Promise.all(writes.map(requestPromise)).then(() => resolve(record), reject);
      }).catch(reject);
    }),
  );
}

export function getScrapRecordByTyreId(tyreId) {
  return withTransaction([STORE_NAMES.scrapRecords], 'readonly', (transaction) =>
    requestResult(transaction.objectStore(STORE_NAMES.scrapRecords).index('tyreId').get(tyreId)),
  );
}

export function listScrapRecords() {
  return withTransaction(
    [STORE_NAMES.scrapRecords, STORE_NAMES.tyres, STORE_NAMES.clients, STORE_NAMES.sites, STORE_NAMES.vehicles],
    'readonly',
    (transaction) => Promise.all([
      requestResult(transaction.objectStore(STORE_NAMES.scrapRecords).getAll()),
      requestResult(transaction.objectStore(STORE_NAMES.tyres).getAll()),
      requestResult(transaction.objectStore(STORE_NAMES.clients).getAll()),
      requestResult(transaction.objectStore(STORE_NAMES.sites).getAll()),
      requestResult(transaction.objectStore(STORE_NAMES.vehicles).getAll()),
    ]).then(([records, tyres, clients, sites, vehicles]) => {
      const tyresById = new Map(tyres.map((tyre) => [tyre.id, tyre]));
      const clientsById = new Map(clients.map((client) => [client.id, client]));
      const sitesById = new Map(sites.map((site) => [site.id, site]));
      const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
      return records.map((record) => ({
        ...record,
        tyre: tyresById.get(record.tyreId) ?? null,
        client: clientsById.get(record.clientId) ?? null,
        site: sitesById.get(record.siteId) ?? null,
        vehicle: vehiclesById.get(record.vehicleId) ?? null,
      })).sort((a, b) => b.scrapDate.localeCompare(a.scrapDate) || b.createdAt.localeCompare(a.createdAt));
    }),
  );
}

export async function getScrapRecordDetails(recordId) {
  const record = await readById(STORE_NAMES.scrapRecords, recordId);
  if (!record) return null;
  return withTransaction(
    [STORE_NAMES.scrapPhotos, STORE_NAMES.tyres, STORE_NAMES.clients, STORE_NAMES.sites, STORE_NAMES.vehicles],
    'readonly',
    (transaction) => Promise.all([
      requestResult(transaction.objectStore(STORE_NAMES.scrapPhotos).index('scrapRecordId').getAll(recordId)),
      requestResult(transaction.objectStore(STORE_NAMES.tyres).get(record.tyreId)),
      record.clientId ? requestResult(transaction.objectStore(STORE_NAMES.clients).get(record.clientId)) : Promise.resolve(null),
      record.siteId ? requestResult(transaction.objectStore(STORE_NAMES.sites).get(record.siteId)) : Promise.resolve(null),
      record.vehicleId ? requestResult(transaction.objectStore(STORE_NAMES.vehicles).get(record.vehicleId)) : Promise.resolve(null),
    ]).then(([photos, tyre, client, site, vehicle]) => ({
      ...record,
      tyre: tyre ?? null,
      client: client ?? null,
      site: site ?? null,
      vehicle: vehicle ?? null,
      damagedPartPhoto: photos.find((photo) => photo.id === record.damagedPartPhotoId) ?? null,
      completeTyrePhoto: photos.find((photo) => photo.id === record.completeTyrePhotoId) ?? null,
    })),
  );
}

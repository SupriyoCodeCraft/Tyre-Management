import { createId, nowIso } from '../database/recordUtils.js';
import { STORE_NAMES } from '../database/schema.js';
import { requestResult, withTransaction } from '../database/database.js';

const INSPECTION_STORES = [
  STORE_NAMES.clients,
  STORE_NAMES.sites,
  STORE_NAMES.vehicles,
  STORE_NAMES.tyres,
  STORE_NAMES.inspectionSessions,
  STORE_NAMES.inspectionEntries,
  STORE_NAMES.inspectionPhotos,
  STORE_NAMES.tyreHistoryEvents,
];

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('An inspection database request failed.'));
  });
}

export function createInspection(input) {
  const timestamp = nowIso();
  const session = {
    id: input.id ?? createId(),
    clientId: input.clientId,
    siteId: input.siteId,
    vehicleId: input.vehicleId,
    inspectionDate: input.inspectionDate,
    createdAt: timestamp,
  };
  const entryRecords = input.entries.map((entry) => ({
    id: createId(),
    sessionId: session.id,
    tyreId: entry.tyreId,
    serialNumber: entry.serialNumber,
    brand: entry.brand,
    nsd: entry.nsd,
    createdAt: timestamp,
  }));
  const photos = input.entries.flatMap((entry, index) => entry.photos.map((photo) => ({
    id: createId(),
    sessionId: session.id,
    inspectionEntryId: entryRecords[index].id,
    blob: photo.blob,
    fileName: photo.fileName,
    mimeType: photo.mimeType,
    byteLength: photo.blob.size,
    createdAt: timestamp,
  })));
  const historyEvents = entryRecords.map((entry) => ({
    id: createId(),
    tyreId: entry.tyreId,
    eventType: 'INSPECTION_RECORDED',
    eventDate: session.inspectionDate,
    details: {
      inspectionId: session.id,
      inspectionEntryId: entry.id,
      vehicleId: session.vehicleId,
      serialNumber: entry.serialNumber,
      brand: entry.brand,
      nsd: entry.nsd,
    },
    createdAt: timestamp,
  }));

  return withTransaction(INSPECTION_STORES, 'readwrite', (transaction) => new Promise((resolve, reject) => {
    const requests = [
      requestPromise(transaction.objectStore(STORE_NAMES.clients).get(session.clientId)),
      requestPromise(transaction.objectStore(STORE_NAMES.sites).get(session.siteId)),
      requestPromise(transaction.objectStore(STORE_NAMES.vehicles).get(session.vehicleId)),
      ...entryRecords.map((entry) => requestPromise(transaction.objectStore(STORE_NAMES.tyres).get(entry.tyreId))),
    ];

    Promise.all(requests).then(([client, site, vehicle, ...tyres]) => {
      if (!client || !site || site.clientId !== client.id) {
        throw new Error('The selected client and site relationship is no longer valid.');
      }
      if (!vehicle || vehicle.clientId !== client.id || vehicle.siteId !== site.id) {
        throw new Error('The selected vehicle does not belong to the selected client and site.');
      }
      if (tyres.some((tyre, index) => !tyre || tyre.serialNumber !== entryRecords[index].serialNumber)) {
        throw new Error('One or more selected tyres could not be verified. Please check the serial numbers.');
      }
      if (tyres.some((tyre) => tyre.currentStatus === 'scrapped')) {
        throw new Error('A scrapped tyre cannot be added to a new inspection.');
      }

      const writes = [
        transaction.objectStore(STORE_NAMES.inspectionSessions).add(session),
        ...entryRecords.map((record) => transaction.objectStore(STORE_NAMES.inspectionEntries).add(record)),
        ...photos.map((record) => transaction.objectStore(STORE_NAMES.inspectionPhotos).add(record)),
        ...historyEvents.map((record) => transaction.objectStore(STORE_NAMES.tyreHistoryEvents).add(record)),
      ];
      Promise.all(writes.map(requestPromise)).then(() => resolve({ session, entries: entryRecords, photos }), reject);
    }).catch(reject);
  }));
}

export function listInspectionSessions(vehicleId = '') {
  return withTransaction(
    [STORE_NAMES.inspectionSessions, STORE_NAMES.inspectionEntries, STORE_NAMES.vehicles],
    'readonly',
    (transaction) => {
      const sessionsRequest = vehicleId
        ? transaction.objectStore(STORE_NAMES.inspectionSessions).index('vehicleId').getAll(vehicleId)
        : transaction.objectStore(STORE_NAMES.inspectionSessions).getAll();
      return Promise.all([
        requestResult(sessionsRequest),
        requestResult(transaction.objectStore(STORE_NAMES.inspectionEntries).getAll()),
        requestResult(transaction.objectStore(STORE_NAMES.vehicles).getAll()),
      ]).then(([sessions, entries, vehicles]) => {
        const counts = new Map();
        for (const entry of entries) counts.set(entry.sessionId, (counts.get(entry.sessionId) ?? 0) + 1);
        const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
        return sessions.map((session) => ({
          ...session,
          vehicle: vehicleById.get(session.vehicleId) ?? null,
          tyreCount: counts.get(session.id) ?? 0,
        })).sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate) || b.createdAt.localeCompare(a.createdAt));
      });
    },
  );
}

export function getInspectionDetails(sessionId) {
  return withTransaction(
    [STORE_NAMES.inspectionSessions, STORE_NAMES.inspectionEntries, STORE_NAMES.inspectionPhotos, STORE_NAMES.vehicles],
    'readonly',
    (transaction) => Promise.all([
      requestResult(transaction.objectStore(STORE_NAMES.inspectionSessions).get(sessionId)),
      requestResult(transaction.objectStore(STORE_NAMES.inspectionEntries).index('sessionId').getAll(sessionId)),
      requestResult(transaction.objectStore(STORE_NAMES.inspectionPhotos).index('sessionId').getAll(sessionId)),
      requestResult(transaction.objectStore(STORE_NAMES.vehicles).getAll()),
    ]).then(([session, entries, photos, vehicles]) => {
      if (!session) return null;
      const photosByEntry = new Map();
      for (const photo of photos) {
        const list = photosByEntry.get(photo.inspectionEntryId) ?? [];
        list.push(photo);
        photosByEntry.set(photo.inspectionEntryId, list);
      }
      return {
        ...session,
        vehicle: vehicles.find((vehicle) => vehicle.id === session.vehicleId) ?? null,
        entries: entries.map((entry) => ({ ...entry, photos: photosByEntry.get(entry.id) ?? [] })),
      };
    }),
  );
}

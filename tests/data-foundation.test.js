import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { closeDatabase, openDatabase, requestResult } from '../src/data/database/database.js';
import { DATABASE_NAME, DATABASE_VERSION, STORE_NAMES } from '../src/data/database/schema.js';
import { createClient, getClient } from '../src/data/repositories/clientRepository.js';
import { createSite, getSite } from '../src/data/repositories/siteRepository.js';
import { createVendor, getVendor, listVendors } from '../src/data/repositories/vendorRepository.js';
import { createVehicle, getVehicle } from '../src/data/repositories/vehicleRepository.js';
import { getPurchaseDetails, listPurchaseSummaries } from '../src/data/repositories/purchaseRepository.js';
import { findTyreBySerial, listTyres } from '../src/data/repositories/tyreRepository.js';
import { listTyreHistory } from '../src/data/repositories/tyreHistoryRepository.js';
import { createInspection, getInspectionDetails, listInspectionSessions } from '../src/data/repositories/inspectionRepository.js';
import { loadPurchases, savePurchase } from '../src/services/purchaseService.js';
import { registerExistingTyre, searchTyres, validateExistingTyreForm } from '../src/services/tyreService.js';
import { loadInspectionHistory, saveVehicleInspection } from '../src/services/inspectionService.js';

async function clearDatabase() {
  await closeDatabase();
  await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database deletion was blocked.'));
  });
}

const purchaseForm = (overrides = {}) => ({
  vendorId: '',
  newVendorName: 'Roadway Tyres',
  invoiceNumber: 'INV-1001',
  purchaseDate: '2026-11-20',
  price: '4800',
  brand: 'RoadGrip',
  model: 'RG-4',
  tyres: [
    { serialNumber: 'TR-1001', initialNsd: '8.5' },
    { serialNumber: 'TR-1002', initialNsd: '9' },
  ],
  ...overrides,
});

const existingTyreForm = (overrides = {}) => ({
  serialNumber: 'EX-2001',
  brand: 'RoadGrip',
  model: '',
  initialNsd: '7.5',
  registrationDate: '2026-11-20',
  ...overrides,
});

beforeEach(clearDatabase);
afterEach(closeDatabase);

test('initializes the declared versioned stores', async () => {
  const database = await openDatabase();
  assert.equal(database.version, DATABASE_VERSION);
  for (const storeName of Object.values(STORE_NAMES)) {
    assert.equal(database.objectStoreNames.contains(storeName), true);
  }
});

test('creates and retrieves clients, client-owned sites, vendors, and correctly associated vehicles', async () => {
  const client = await createClient({ name: 'Northstar Logistics', contactInformation: 'Office contact' });
  assert.equal((await getClient(client.id)).name, 'Northstar Logistics');

  const site = await createSite({ clientId: client.id, name: 'Central Depot', location: 'North yard' });
  assert.equal((await getSite(site.id)).clientId, client.id);
  await assert.rejects(createSite({ clientId: 'missing-client', name: 'Invalid site' }), /valid client/);

  const vendor = await createVendor({ name: 'Roadway Tyres' });
  assert.equal((await getVendor(vendor.id)).name, 'Roadway Tyres');
  assert.equal((await listVendors()).length, 1);

  const vehicle = await createVehicle({
    clientId: client.id,
    siteId: site.id,
    registrationNumber: 'WB-01-AB-1234',
    description: 'Delivery vehicle',
  });
  assert.equal((await getVehicle(vehicle.id)).siteId, site.id);
  await assert.rejects(
    createVehicle({ clientId: 'missing-client', siteId: site.id, registrationNumber: 'BAD-1' }),
    /valid site/,
  );
});

test('creates one purchase with multiple tyres and connected history, then reads its details', async () => {
  const created = await savePurchase(purchaseForm());
  assert.equal(created.tyres.length, 2);

  const purchase = await getPurchaseDetails(created.purchaseId);
  assert.equal(purchase.invoiceNumber, 'INV-1001');
  assert.equal(purchase.vendor.name, 'Roadway Tyres');
  assert.equal(purchase.tyres.length, 2);
  const firstTyre = purchase.tyres.find((tyre) => tyre.serialNumber === 'TR-1001');
  assert.equal(firstTyre.purchaseId, purchase.id);
  assert.equal(firstTyre.initialNsd, 8.5);

  const events = await listTyreHistory(firstTyre.id);
  assert.deepEqual(events.map(({ eventType }) => eventType).sort(), ['PURCHASE_ASSOCIATED', 'TYRE_REGISTERED']);
  assert.equal((await listPurchaseSummaries())[0].tyreCount, 2);
});

test('creates an existing tyre without a purchase and makes it searchable', async () => {
  const tyre = await registerExistingTyre(existingTyreForm());
  assert.equal(tyre.purchaseId, null);
  assert.equal((await findTyreBySerial('ex-2001')).id, tyre.id);
  assert.equal((await searchTyres('EX-20'))[0].id, tyre.id);
  assert.deepEqual((await listTyreHistory(tyre.id)).map(({ eventType }) => eventType), ['TYRE_REGISTERED']);
});

test('rejects duplicate serials within a purchase and across existing records', async () => {
  await registerExistingTyre(existingTyreForm());
  assert.throws(
    () => savePurchase(purchaseForm({ tyres: [
      { serialNumber: 'DUP-1', initialNsd: '8' },
      { serialNumber: ' dup-1 ', initialNsd: '7' },
    ] })),
    /repeated in this purchase/,
  );
  await assert.rejects(
    savePurchase(purchaseForm({ tyres: [{ serialNumber: ' ex-2001 ', initialNsd: '8' }] })),
    /already registered/,
  );
});

test('rejects invalid fields and does not leave partial purchase, vendor, tyre, or event records', async () => {
  assert.throws(() => validateExistingTyreForm(existingTyreForm({ initialNsd: '-1' })), /NSD/);
  assert.throws(() => savePurchase(purchaseForm({ price: '-10' })), /Price/);
  assert.throws(() => savePurchase(purchaseForm({ purchaseDate: '2026-02-31' })), /valid purchase date/);

  const prior = await registerExistingTyre(existingTyreForm());
  await assert.rejects(
    savePurchase(purchaseForm({ tyres: [{ serialNumber: prior.serialNumber, initialNsd: '8' }] })),
    /already registered/,
  );
  assert.equal((await loadPurchases()).length, 0);
  assert.equal((await listTyres()).length, 1);
  assert.equal((await listVendors()).length, 0);
  assert.equal((await listTyreHistory(prior.id)).length, 1);
});

test('retains records after closing and reopening the IndexedDB connection', async () => {
  const tyre = await registerExistingTyre(existingTyreForm());
  await closeDatabase();
  const reopened = await findTyreBySerial(tyre.serialNumber);
  assert.equal(reopened.id, tyre.id);
});

async function createInspectionFixture() {
  const client = await createClient({ name: 'Fleet Client' });
  const site = await createSite({ clientId: client.id, name: 'Main Site' });
  const vehicle = await createVehicle({ clientId: client.id, siteId: site.id, registrationNumber: 'VH-100' });
  const tyreA = await registerExistingTyre(existingTyreForm({ serialNumber: 'INSP-100', brand: 'RoadGrip' }));
  const tyreB = await registerExistingTyre(existingTyreForm({ serialNumber: 'INSP-200', brand: 'RoadGrip' }));
  return { client, site, vehicle, tyreA, tyreB };
}

test('upgrades a P3 version-1 database and retains its existing client and tyre records', async () => {
  const legacyStores = ['clients', 'sites', 'vendors', 'vehicles', 'tyres', 'purchases', 'tyreHistoryEvents'];
  const opening = globalThis.indexedDB.open(DATABASE_NAME, 1);
  opening.onupgradeneeded = () => {
    for (const storeName of legacyStores) opening.result.createObjectStore(storeName, { keyPath: 'id' });
  };
  const legacyDatabase = await new Promise((resolve, reject) => {
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
  const legacyTransaction = legacyDatabase.transaction(['clients', 'tyres'], 'readwrite');
  legacyTransaction.objectStore('clients').put({ id: 'old-client', name: 'Old client' });
  legacyTransaction.objectStore('tyres').put({ id: 'old-tyre', serialNumber: 'OLD-1', serialNumberKey: 'OLD-1' });
  await new Promise((resolve, reject) => {
    legacyTransaction.oncomplete = resolve;
    legacyTransaction.onabort = () => reject(legacyTransaction.error);
  });
  legacyDatabase.close();

  const upgraded = await openDatabase();
  assert.equal(upgraded.version, DATABASE_VERSION);
  assert.equal(upgraded.objectStoreNames.contains(STORE_NAMES.inspectionSessions), true);
  assert.equal((await getClient('old-client')).name, 'Old client');
  assert.equal((await findTyreBySerial('old-1')).id, 'old-tyre');
});

test('saves one vehicle inspection with multiple registered tyres and history events', async () => {
  const fixture = await createInspectionFixture();
  const result = await saveVehicleInspection({
    clientId: fixture.client.id,
    siteId: fixture.site.id,
    vehicleId: fixture.vehicle.id,
    inspectionDate: '2026-11-21',
    entries: [
      { serialNumber: fixture.tyreA.serialNumber, nsd: '5.5', photos: [] },
      { serialNumber: fixture.tyreB.serialNumber, nsd: '4', photos: [] },
    ],
  });

  assert.equal(result.session.vehicleId, fixture.vehicle.id);
  assert.equal(result.entries.length, 2);
  const details = await getInspectionDetails(result.session.id);
  assert.equal(details.vehicle.registrationNumber, 'VH-100');
  assert.equal(details.entries.length, 2);
  assert.equal(details.entries.find((entry) => entry.tyreId === fixture.tyreA.id).nsd, 5.5);
  const tyreEvents = await listTyreHistory(fixture.tyreA.id);
  const inspectionEvent = tyreEvents.find((event) => event.eventType === 'INSPECTION_RECORDED');
  assert.equal(inspectionEvent.details.inspectionId, result.session.id);
  assert.equal(inspectionEvent.details.vehicleId, fixture.vehicle.id);
  assert.deepEqual(tyreEvents.map((event) => event.eventType), ['TYRE_REGISTERED', 'INSPECTION_RECORDED']);
  assert.equal((await loadInspectionHistory(fixture.vehicle.id)).length, 1);
});

test('rejects unknown and repeated tyre serials in an inspection', async () => {
  const fixture = await createInspectionFixture();
  const base = { clientId: fixture.client.id, siteId: fixture.site.id, vehicleId: fixture.vehicle.id, inspectionDate: '2026-11-21' };
  await assert.rejects(saveVehicleInspection({ ...base, entries: [{ serialNumber: 'UNKNOWN-9', nsd: '4', photos: [] }] }), /Register it first from Purchase Register/);
  await assert.rejects(saveVehicleInspection({ ...base, entries: [
    { serialNumber: 'INSP-100', nsd: '4', photos: [] },
    { serialNumber: ' insp-100 ', nsd: '3', photos: [] },
  ] }), /repeated in this inspection/);
  await assert.rejects(saveVehicleInspection({ ...base, entries: [{ serialNumber: 'INSP-100', nsd: '-1', photos: [] }] }), /NSD/);
  await assert.rejects(saveVehicleInspection({ ...base, inspectionDate: '2026-02-31', entries: [{ serialNumber: 'INSP-100', nsd: '4', photos: [] }] }), /valid inspection date/);
  assert.equal((await listInspectionSessions()).length, 0);
});

test('rejects an invalid client, site and vehicle combination', async () => {
  const fixture = await createInspectionFixture();
  const otherClient = await createClient({ name: 'Other Client' });
  await assert.rejects(saveVehicleInspection({
    clientId: otherClient.id,
    siteId: fixture.site.id,
    vehicleId: fixture.vehicle.id,
    inspectionDate: '2026-11-21',
    entries: [{ serialNumber: fixture.tyreA.serialNumber, nsd: '5', photos: [] }],
  }), /client and site relationship|does not belong/);
  assert.equal((await listInspectionSessions()).length, 0);
});

test('stores inspection photo Blobs linked to their session entry and retrieves them', async () => {
  const fixture = await createInspectionFixture();
  const image = new globalThis.Blob(['inspection photo bytes'], { type: 'image/jpeg' });
  const result = await createInspection({
    clientId: fixture.client.id,
    siteId: fixture.site.id,
    vehicleId: fixture.vehicle.id,
    inspectionDate: '2026-11-21',
    entries: [{
      tyreId: fixture.tyreA.id,
      serialNumber: fixture.tyreA.serialNumber,
      brand: fixture.tyreA.brand,
      nsd: 5,
      photos: [{ blob: image, fileName: 'tyre.jpg', mimeType: 'image/jpeg' }],
    }],
  });
  const details = await getInspectionDetails(result.session.id);
  assert.equal(details.entries[0].photos.length, 1);
  assert.equal(details.entries[0].photos[0].blob.type, 'image/jpeg');
  assert.equal(details.entries[0].photos[0].inspectionEntryId, details.entries[0].id);
});

test('rolls back session, entries and history if adding an inspection photo fails', async () => {
  const fixture = await createInspectionFixture();
  await assert.rejects(createInspection({
    clientId: fixture.client.id,
    siteId: fixture.site.id,
    vehicleId: fixture.vehicle.id,
    inspectionDate: '2026-11-21',
    entries: [{
      tyreId: fixture.tyreA.id,
      serialNumber: fixture.tyreA.serialNumber,
      brand: fixture.tyreA.brand,
      nsd: 5,
      photos: [{ blob: () => 'not cloneable', fileName: 'bad.jpg', mimeType: 'image/jpeg' }],
    }],
  }));
  assert.equal((await listInspectionSessions()).length, 0);
  assert.equal((await getInspectionDetails('missing-session')), null);
  assert.equal((await listTyreHistory(fixture.tyreA.id)).filter((event) => event.eventType === 'INSPECTION_RECORDED').length, 0);
  const database = await openDatabase();
  const readTransaction = database.transaction([STORE_NAMES.inspectionEntries, STORE_NAMES.inspectionPhotos], 'readonly');
  const [entryCount, photoCount] = await Promise.all([
    requestResult(readTransaction.objectStore(STORE_NAMES.inspectionEntries).count()),
    requestResult(readTransaction.objectStore(STORE_NAMES.inspectionPhotos).count()),
  ]);
  assert.equal(entryCount, 0);
  assert.equal(photoCount, 0);
});

test('retains inspection sessions and photo Blobs after closing and reopening IndexedDB', async () => {
  const fixture = await createInspectionFixture();
  const result = await createInspection({
    clientId: fixture.client.id,
    siteId: fixture.site.id,
    vehicleId: fixture.vehicle.id,
    inspectionDate: '2026-11-21',
    entries: [{
      tyreId: fixture.tyreA.id,
      serialNumber: fixture.tyreA.serialNumber,
      brand: fixture.tyreA.brand,
      nsd: 5,
      photos: [{ blob: new globalThis.Blob(['saved'], { type: 'image/jpeg' }), fileName: 'saved.jpg', mimeType: 'image/jpeg' }],
    }],
  });
  await closeDatabase();
  const reopened = await getInspectionDetails(result.session.id);
  assert.equal(reopened.entries[0].photos[0].blob.size, 5);
  assert.equal((await listInspectionSessions(fixture.vehicle.id))[0].id, result.session.id);
});

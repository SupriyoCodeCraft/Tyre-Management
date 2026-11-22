import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { closeDatabase, openDatabase, requestResult } from '../src/data/database/database.js';
import { DATABASE_NAME, STORE_NAMES } from '../src/data/database/schema.js';
import { createClient } from '../src/data/repositories/clientRepository.js';
import { createSite } from '../src/data/repositories/siteRepository.js';
import { createVehicle } from '../src/data/repositories/vehicleRepository.js';
import { createInspection } from '../src/data/repositories/inspectionRepository.js';
import { listTyreHistory } from '../src/data/repositories/tyreHistoryRepository.js';
import { listScrapRecords } from '../src/data/repositories/scrapRepository.js';
import { getPurchaseDetails } from '../src/data/repositories/purchaseRepository.js';
import { findTyreBySerial, registerExistingTyre } from '../src/data/repositories/tyreRepository.js';
import { savePurchase } from '../src/services/purchaseService.js';
import { saveVehicleInspection } from '../src/services/inspectionService.js';
import { loadTyreLifecycleHistory, searchTyreHistory } from '../src/services/tyreHistoryService.js';
import { loadScrapAnalysis, loadScrapDetails, saveScrap } from '../src/services/scrapService.js';
import { validateInspectionImage } from '../src/services/inspectionImageService.js';

async function clearDatabase() {
  await closeDatabase();
  await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database deletion was blocked.'));
  });
}

const existingForm = (serialNumber, overrides = {}) => ({
  serialNumber,
  brand: 'RoadGrip',
  model: 'RG-1',
  initialNsd: '8',
  registrationDate: '2026-11-01',
  ...overrides,
});

async function createVehicleAndTyres() {
  const client = await createClient({ name: 'History Fleet' });
  const site = await createSite({ clientId: client.id, name: 'North Yard' });
  const vehicle = await createVehicle({ clientId: client.id, siteId: site.id, registrationNumber: 'HIST-01' });
  const purchaseResult = await savePurchase({
    newVendorName: 'History Vendor', invoiceNumber: 'HIST-INV', purchaseDate: '2026-11-01', price: '1000',
    brand: 'RoadGrip', model: 'RG-1', tyres: [{ serialNumber: 'PUR-100', initialNsd: '9' }],
  });
  const purchasedTyre = await findTyreBySerial('PUR-100');
  const existingTyre = await registerExistingTyre(existingForm('EX-100', {
    currentClientId: client.id, currentSiteId: site.id, currentVehicleId: vehicle.id,
  }));
  return { client, site, vehicle, purchasedTyre, purchaseId: purchaseResult.purchaseId, existingTyre };
}

function imageFile(name, type = 'image/jpeg', size = 12) {
  const file = new globalThis.Blob(['image bytes'], { type });
  Object.defineProperty(file, 'name', { value: name });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

async function withFakeImageProcessing(callback) {
  const previousBitmap = globalThis.createImageBitmap;
  const previousDocument = globalThis.document;
  globalThis.createImageBitmap = async () => ({ width: 2400, height: 1600, close() {} });
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob: (done, type) => done(new globalThis.Blob(['compressed image'], { type })),
    }),
  };
  try { return await callback(); }
  finally {
    if (previousBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = previousBitmap;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

beforeEach(clearDatabase);
afterEach(closeDatabase);

test('upgrades a P4 version-2 database without losing purchase, tyre and inspection-photo records', async () => {
  const version2Stores = [
    'clients', 'sites', 'vendors', 'vehicles', 'tyres', 'purchases', 'tyreHistoryEvents',
    'inspectionSessions', 'inspectionEntries', 'inspectionPhotos',
  ];
  const opening = globalThis.indexedDB.open(DATABASE_NAME, 2);
  opening.onupgradeneeded = () => version2Stores.forEach((name) => opening.result.createObjectStore(name, { keyPath: 'id' }));
  const oldDb = await new Promise((resolve, reject) => {
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
  const tx = oldDb.transaction(version2Stores, 'readwrite');
  tx.objectStore('clients').put({ id: 'c-old', name: 'Legacy Client' });
  tx.objectStore('sites').put({ id: 's-old', clientId: 'c-old', name: 'Legacy Site' });
  tx.objectStore('vehicles').put({ id: 'v-old', clientId: 'c-old', siteId: 's-old', registrationNumber: 'LEG-1' });
  tx.objectStore('vendors').put({ id: 'vendor-old', name: 'Legacy Vendor' });
  tx.objectStore('purchases').put({ id: 'p-old', vendorId: 'vendor-old', invoiceNumber: 'LEG-INV', tyreIds: ['t-old'] });
  tx.objectStore('tyres').put({ id: 't-old', serialNumber: 'LEG-TYRE', serialNumberKey: 'LEG-TYRE', purchaseId: 'p-old', currentStatus: 'registered' });
  tx.objectStore('inspectionSessions').put({ id: 'i-old', clientId: 'c-old', siteId: 's-old', vehicleId: 'v-old', inspectionDate: '2026-11-20' });
  tx.objectStore('inspectionEntries').put({ id: 'entry-old', sessionId: 'i-old', tyreId: 't-old', serialNumber: 'LEG-TYRE', brand: 'RoadGrip', nsd: 7 });
  tx.objectStore('inspectionPhotos').put({ id: 'photo-old', sessionId: 'i-old', inspectionEntryId: 'entry-old', blob: new globalThis.Blob(['prior p4 image'], { type: 'image/jpeg' }), fileName: 'prior.jpg' });
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
  oldDb.close();

  const upgraded = await openDatabase();
  assert.equal(upgraded.version, 3);
  assert.equal(upgraded.objectStoreNames.contains(STORE_NAMES.scrapRecords), true);
  assert.equal((await findTyreBySerial('leg-tyre')).purchaseId, 'p-old');
  assert.equal((await getPurchaseDetails('p-old')).vendor.name, 'Legacy Vendor');
  const photo = (await (await import('../src/data/repositories/inspectionRepository.js')).getInspectionDetails('i-old')).entries[0].photos[0];
  assert.equal(photo.blob.size, 14);
});

test('finds independently registered and purchase-linked tyres; unknown search returns no records', async () => {
  await createVehicleAndTyres();
  assert.equal((await searchTyreHistory('pur-10')).length, 1);
  assert.equal((await searchTyreHistory('EX-100'))[0].purchaseId, null);
  assert.deepEqual(await searchTyreHistory('unknown'), []);
  const purchaseLinked = await loadTyreLifecycleHistory('PUR-100');
  assert.equal(purchaseLinked.purchase.invoiceNumber, 'HIST-INV');
  assert.equal(purchaseLinked.purchase.vendor.name, 'History Vendor');
  const existing = await loadTyreLifecycleHistory('ex-100');
  assert.equal(existing.purchase, null);
  assert.equal(existing.timeline[0].eventType, 'TYRE_REGISTERED');
  assert.equal(await loadTyreLifecycleHistory('NO-SUCH-TYRE'), null);
  assert.equal((await getPurchaseDetails(purchaseLinked.purchase.id)).tyres[0].id, purchaseLinked.tyre.id);
});

test('combines multiple inspection readings and their photos without replacing prior NSD history', async () => {
  const fixture = await createVehicleAndTyres();
  for (const [inspectionDate, nsd] of [['2026-11-02', '7.5'], ['2026-11-08', '6']]) {
    await saveVehicleInspection({
      clientId: fixture.client.id, siteId: fixture.site.id, vehicleId: fixture.vehicle.id, inspectionDate,
      entries: [{ serialNumber: fixture.purchasedTyre.serialNumber, nsd, photos: [] }],
    });
  }
  await createInspection({
    clientId: fixture.client.id, siteId: fixture.site.id, vehicleId: fixture.vehicle.id, inspectionDate: '2026-11-10',
    entries: [{
      tyreId: fixture.purchasedTyre.id, serialNumber: fixture.purchasedTyre.serialNumber, brand: fixture.purchasedTyre.brand, nsd: 5,
      photos: [{ blob: new globalThis.Blob(['inspection'], { type: 'image/jpeg' }), fileName: 'reading.jpg', mimeType: 'image/jpeg' }],
    }],
  });
  const history = await loadTyreLifecycleHistory(fixture.purchasedTyre.serialNumber);
  const inspections = history.timeline.filter((event) => event.eventType === 'INSPECTION_RECORDED');
  assert.deepEqual(inspections.map((event) => event.entry.nsd), [7.5, 6, 5]);
  assert.equal(history.currentNsd, 5);
  assert.equal(inspections[2].entry.photos[0].fileName, 'reading.jpg');
  assert.equal(history.timeline.filter((event) => event.eventType === 'PURCHASE_ASSOCIATED').length, 1);
  assert.equal((await listTyreHistory(fixture.purchasedTyre.id)).filter((event) => event.eventType === 'INSPECTION_RECORDED').length, 3);
});

test('records scrap with both photos, updates status and history, and derives analysis from saved records', async () => {
  const fixture = await createVehicleAndTyres();
  await withFakeImageProcessing(async () => {
    const scrapRecord = await saveScrap({
      serialNumber: fixture.purchasedTyre.serialNumber,
      scrapDate: '2026-11-21', reason: 'Sidewall damage', remarks: 'Damage near shoulder',
      damagedPartPhoto: imageFile('damage.jpg'), completeTyrePhoto: imageFile('whole.jpg', 'image/png'),
    });
    assert.equal(scrapRecord.tyreId, fixture.purchasedTyre.id);
    const details = await loadScrapDetails(scrapRecord.id);
    assert.equal(details.damagedPartPhoto.blob.type, 'image/jpeg');
    assert.equal(details.completeTyrePhoto.blob.type, 'image/jpeg');
    assert.equal(details.damagedPartPhoto.category, 'damaged-part');
    assert.equal(details.completeTyrePhoto.category, 'complete-tyre');
    const updatedTyre = await findTyreBySerial(fixture.purchasedTyre.serialNumber);
    assert.equal(updatedTyre.currentStatus, 'scrapped');
    const events = await listTyreHistory(updatedTyre.id);
    assert.equal(events.filter((event) => event.eventType === 'SCRAP_RECORDED').length, 1);
    assert.equal(events.find((event) => event.eventType === 'SCRAP_RECORDED').details.scrapRecordId, scrapRecord.id);
    await assert.rejects(saveScrap({
      serialNumber: fixture.purchasedTyre.serialNumber, scrapDate: '2026-11-22', reason: 'Duplicate',
      damagedPartPhoto: imageFile('damage2.jpg'), completeTyrePhoto: imageFile('whole2.jpg'),
    }), /already recorded as scrapped/);
    await assert.rejects(saveVehicleInspection({
      clientId: fixture.client.id, siteId: fixture.site.id, vehicleId: fixture.vehicle.id, inspectionDate: '2026-11-22',
      entries: [{ serialNumber: fixture.purchasedTyre.serialNumber, nsd: '4', photos: [] }],
    }), /scrapped tyre cannot/);
    const analysis = await loadScrapAnalysis();
    assert.equal(analysis.total, 1);
    assert.deepEqual(analysis.byReason, [{ label: 'Sidewall damage', count: 1 }]);
    assert.deepEqual(analysis.byBrand, [{ label: 'RoadGrip', count: 1 }]);
    assert.deepEqual(analysis.byMonth, [{ label: '2026-11', count: 1 }]);
  });
});

test('requires registered tyre, reason, valid date, and both supported-size image files', async () => {
  await createVehicleAndTyres();
  const validFiles = { damagedPartPhoto: imageFile('damage.jpg'), completeTyrePhoto: imageFile('whole.jpg') };
  await assert.rejects(saveScrap({ serialNumber: 'UNKNOWN', scrapDate: '2026-11-21', reason: 'Damage', ...validFiles }), /not registered/);
  await assert.rejects(saveScrap({ serialNumber: 'EX-100', scrapDate: '2026-11-21', reason: '', ...validFiles }), /Scrap reason is required/);
  await assert.rejects(saveScrap({ serialNumber: 'EX-100', scrapDate: '2026-02-31', reason: 'Damage', ...validFiles }), /valid scrap date/);
  await assert.rejects(saveScrap({ serialNumber: 'EX-100', scrapDate: '2026-11-21', reason: 'Damage', damagedPartPhoto: null, completeTyrePhoto: validFiles.completeTyrePhoto }), /damaged-part photograph/);
  await assert.rejects(saveScrap({ serialNumber: 'EX-100', scrapDate: '2026-11-21', reason: 'Damage', damagedPartPhoto: validFiles.damagedPartPhoto, completeTyrePhoto: null }), /complete-tyre photograph/);
  assert.throws(() => validateInspectionImage(imageFile('bad.gif', 'image/gif')), /not a supported image/);
  assert.throws(() => validateInspectionImage(imageFile('large.jpg', 'image/jpeg', 16 * 1024 * 1024)), /larger than 15 MB/);
  assert.equal((await listScrapRecords()).length, 0);
});

test('scrap transaction rolls back metadata, photo Blobs, status and event when a Blob write fails', async () => {
  const fixture = await createVehicleAndTyres();
  const tyre = fixture.existingTyre;
  const { createScrapRecord } = await import('../src/data/repositories/scrapRepository.js');
  await assert.rejects(createScrapRecord({
    serialNumber: tyre.serialNumber, scrapDate: '2026-11-21', reason: 'Broken', remarks: '',
    damagedPartPhoto: { blob: new globalThis.Blob(['good'], { type: 'image/jpeg' }), fileName: 'good.jpg', mimeType: 'image/jpeg' },
    completeTyrePhoto: { blob: () => 'not cloneable', fileName: 'bad.jpg', mimeType: 'image/jpeg' },
  }));
  assert.equal((await findTyreBySerial(tyre.serialNumber)).currentStatus, 'registered');
  assert.equal((await listScrapRecords()).length, 0);
  assert.equal((await listTyreHistory(tyre.id)).filter((event) => event.eventType === 'SCRAP_RECORDED').length, 0);
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAMES.scrapPhotos, 'readonly');
  assert.equal(await requestResult(transaction.objectStore(STORE_NAMES.scrapPhotos).count()), 0);
});

test('scrap details preserve the linked tyre history and photos after reopening IndexedDB', async () => {
  const fixture = await createVehicleAndTyres();
  await saveVehicleInspection({
    clientId: fixture.client.id, siteId: fixture.site.id, vehicleId: fixture.vehicle.id, inspectionDate: '2026-11-08',
    entries: [{ serialNumber: fixture.existingTyre.serialNumber, nsd: '6.5', photos: [] }],
  });
  let scrap;
  await withFakeImageProcessing(async () => {
    scrap = await saveScrap({
      serialNumber: fixture.existingTyre.serialNumber, scrapDate: '2026-11-21', reason: 'Worn',
      damagedPartPhoto: imageFile('damage.jpg'), completeTyrePhoto: imageFile('whole.jpg'),
    });
  });
  await closeDatabase();
  const details = await loadScrapDetails(scrap.id);
  assert.equal(details.damagedPartPhoto.blob.size, 16);
  const history = await loadTyreLifecycleHistory(fixture.existingTyre.serialNumber);
  assert.deepEqual(history.timeline.map((event) => event.eventType), ['TYRE_REGISTERED', 'INSPECTION_RECORDED', 'SCRAP_RECORDED']);
  assert.equal(history.timeline[1].entry.nsd, 6.5);
  assert.ok(history.timeline[2].scrap.completeTyrePhoto.blob);
  assert.equal((await getPurchaseDetails('missing-purchase')), null);
});

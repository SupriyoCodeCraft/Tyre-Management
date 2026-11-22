import { createId, normalizeSerialNumber, nowIso } from '../database/recordUtils.js';
import { STORE_NAMES } from '../database/schema.js';
import { requestResult, withTransaction } from '../database/database.js';

const PURCHASE_STORES = [STORE_NAMES.purchases, STORE_NAMES.vendors, STORE_NAMES.tyres, STORE_NAMES.tyreHistoryEvents];

export function createPurchaseWithTyres(input) {
  return withTransaction(PURCHASE_STORES, 'readwrite', async (transaction) => {
    const vendorStore = transaction.objectStore(STORE_NAMES.vendors);
    let vendor;
    if (input.newVendorName) {
      const timestamp = nowIso();
      vendor = {
        id: createId(),
        name: input.newVendorName,
        contactInformation: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await requestResult(vendorStore.add(vendor));
    } else {
      vendor = await requestResult(vendorStore.get(input.vendorId));
      if (!vendor) throw new Error('The selected vendor could not be found.');
    }

    const serialIndex = transaction.objectStore(STORE_NAMES.tyres).index('serialNumberKey');
    const seenSerials = new Set();
    for (const tyre of input.tyres) {
      const key = normalizeSerialNumber(tyre.serialNumber);
      if (seenSerials.has(key)) throw new Error(`Serial number ${tyre.serialNumber} is repeated in this purchase.`);
      seenSerials.add(key);
      const existingTyre = await requestResult(serialIndex.get(key));
      if (existingTyre) throw new Error(`A tyre with serial number ${tyre.serialNumber} is already registered.`);
    }

    const timestamp = nowIso();
    const purchaseId = createId();
    const tyreRecords = input.tyres.map((item) => ({
      id: createId(),
      serialNumber: item.serialNumber,
      serialNumberKey: normalizeSerialNumber(item.serialNumber),
      brand: input.brand,
      model: input.model,
      initialNsd: item.initialNsd,
      registrationDate: input.purchaseDate,
      purchaseId,
      currentClientId: null,
      currentSiteId: null,
      currentVehicleId: null,
      currentStatus: 'registered',
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const purchase = {
      id: purchaseId,
      vendorId: vendor.id,
      invoiceNumber: input.invoiceNumber,
      purchaseDate: input.purchaseDate,
      price: input.price,
      brand: input.brand,
      model: input.model,
      tyreIds: tyreRecords.map(({ id }) => id),
      createdAt: timestamp,
    };

    await requestResult(transaction.objectStore(STORE_NAMES.purchases).add(purchase));
    for (const tyre of tyreRecords) {
      await requestResult(transaction.objectStore(STORE_NAMES.tyres).add(tyre));
      const registrationEvent = {
        id: createId(),
        tyreId: tyre.id,
        eventType: 'TYRE_REGISTERED',
        eventDate: input.purchaseDate,
        details: { origin: 'purchase', purchaseId, vendorId: vendor.id },
        createdAt: timestamp,
      };
      const purchaseEvent = {
        id: createId(),
        tyreId: tyre.id,
        eventType: 'PURCHASE_ASSOCIATED',
        eventDate: input.purchaseDate,
        details: { purchaseId, invoiceNumber: input.invoiceNumber, vendorId: vendor.id },
        createdAt: timestamp,
      };
      await requestResult(transaction.objectStore(STORE_NAMES.tyreHistoryEvents).add(registrationEvent));
      await requestResult(transaction.objectStore(STORE_NAMES.tyreHistoryEvents).add(purchaseEvent));
    }

    return { purchaseId, vendor, tyres: tyreRecords };
  });
}

export function listPurchaseSummaries() {
  return withTransaction(PURCHASE_STORES, 'readonly', async (transaction) => {
    const [purchases, vendors, tyres] = await Promise.all([
      requestResult(transaction.objectStore(STORE_NAMES.purchases).getAll()),
      requestResult(transaction.objectStore(STORE_NAMES.vendors).getAll()),
      requestResult(transaction.objectStore(STORE_NAMES.tyres).getAll()),
    ]);
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    const tyresById = new Map(tyres.map((tyre) => [tyre.id, tyre]));
    return purchases
      .map((purchase) => ({
        ...purchase,
        vendor: vendorById.get(purchase.vendorId) ?? null,
        tyres: purchase.tyreIds.map((id) => tyresById.get(id)).filter(Boolean),
        tyreCount: purchase.tyreIds.length,
      }))
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || b.createdAt.localeCompare(a.createdAt));
  });
}

export function getPurchaseDetails(purchaseId) {
  return withTransaction(PURCHASE_STORES, 'readonly', async (transaction) => {
    const purchase = await requestResult(transaction.objectStore(STORE_NAMES.purchases).get(purchaseId));
    if (!purchase) return null;
    const [vendor, tyres] = await Promise.all([
      requestResult(transaction.objectStore(STORE_NAMES.vendors).get(purchase.vendorId)),
      requestResult(transaction.objectStore(STORE_NAMES.tyres).index('purchaseId').getAll(purchaseId)),
    ]);
    return { ...purchase, vendor: vendor ?? null, tyres };
  });
}

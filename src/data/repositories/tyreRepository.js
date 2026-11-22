import { createId, normalizeSerialNumber, nowIso } from '../database/recordUtils.js';
import { STORE_NAMES } from '../database/schema.js';
import { requestResult, withTransaction } from '../database/database.js';

export function registerExistingTyre(input) {
  return withTransaction(
    [STORE_NAMES.clients, STORE_NAMES.sites, STORE_NAMES.vehicles, STORE_NAMES.tyres, STORE_NAMES.tyreHistoryEvents],
    'readwrite',
    async (transaction) => {
      const clients = transaction.objectStore(STORE_NAMES.clients);
      const sites = transaction.objectStore(STORE_NAMES.sites);
      const vehicles = transaction.objectStore(STORE_NAMES.vehicles);

      let client = input.currentClientId ? await requestResult(clients.get(input.currentClientId)) : null;
      let site = input.currentSiteId ? await requestResult(sites.get(input.currentSiteId)) : null;
      let vehicle = input.currentVehicleId ? await requestResult(vehicles.get(input.currentVehicleId)) : null;

      if (input.currentClientId && !client) throw new Error('The selected client could not be found.');
      if (input.currentSiteId && !site) throw new Error('The selected site could not be found.');
      if (input.currentVehicleId && !vehicle) throw new Error('The selected vehicle could not be found.');
      if (site && client && site.clientId !== client.id) {
        throw new Error('The selected site does not belong to the selected client.');
      }
      if (site && !client) client = await requestResult(clients.get(site.clientId));
      if (vehicle) {
        if (client && vehicle.clientId !== client.id) throw new Error('The selected vehicle belongs to another client.');
        if (site && vehicle.siteId !== site.id) throw new Error('The selected vehicle belongs to another site.');
        client ??= await requestResult(clients.get(vehicle.clientId));
        site ??= await requestResult(sites.get(vehicle.siteId));
      }

      const serialNumberKey = normalizeSerialNumber(input.serialNumber);
      const existing = await requestResult(
        transaction.objectStore(STORE_NAMES.tyres).index('serialNumberKey').get(serialNumberKey),
      );
      if (existing) throw new Error(`A tyre with serial number ${input.serialNumber} is already registered.`);

      const timestamp = nowIso();
      const tyre = {
        id: createId(),
        serialNumber: input.serialNumber,
        serialNumberKey,
        brand: input.brand,
        model: input.model,
        initialNsd: input.initialNsd,
        registrationDate: input.registrationDate,
        purchaseId: null,
        currentClientId: client?.id ?? null,
        currentSiteId: site?.id ?? null,
        currentVehicleId: vehicle?.id ?? null,
        currentStatus: 'registered',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const event = {
        id: createId(),
        tyreId: tyre.id,
        eventType: 'TYRE_REGISTERED',
        eventDate: input.registrationDate,
        details: { origin: 'existing-registration' },
        createdAt: timestamp,
      };

      await requestResult(transaction.objectStore(STORE_NAMES.tyres).add(tyre));
      await requestResult(transaction.objectStore(STORE_NAMES.tyreHistoryEvents).add(event));
      return tyre;
    },
  );
}

export function findTyreBySerial(serialNumber) {
  const serialNumberKey = normalizeSerialNumber(serialNumber);
  return withTransaction([STORE_NAMES.tyres], 'readonly', (transaction) =>
    requestResult(transaction.objectStore(STORE_NAMES.tyres).index('serialNumberKey').get(serialNumberKey)),
  );
}

export function listTyres() {
  return withTransaction([STORE_NAMES.tyres], 'readonly', (transaction) =>
    requestResult(transaction.objectStore(STORE_NAMES.tyres).getAll()),
  );
}

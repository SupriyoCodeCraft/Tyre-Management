export const DATABASE_NAME = 'tyre-management-prototype';
export const DATABASE_VERSION = 3;

export const STORE_NAMES = {
  clients: 'clients',
  sites: 'sites',
  vendors: 'vendors',
  vehicles: 'vehicles',
  tyres: 'tyres',
  purchases: 'purchases',
  tyreHistoryEvents: 'tyreHistoryEvents',
  inspectionSessions: 'inspectionSessions',
  inspectionEntries: 'inspectionEntries',
  inspectionPhotos: 'inspectionPhotos',
  scrapRecords: 'scrapRecords',
  scrapPhotos: 'scrapPhotos',
};

export const DATABASE_STORES = {
  [STORE_NAMES.clients]: [],
  [STORE_NAMES.sites]: ['clientId'],
  [STORE_NAMES.vendors]: [],
  [STORE_NAMES.vehicles]: ['clientId', 'siteId', 'registrationNumber'],
  [STORE_NAMES.tyres]: [
    { name: 'serialNumberKey', unique: true },
    'purchaseId',
    'currentClientId',
    'currentSiteId',
    'currentVehicleId',
  ],
  [STORE_NAMES.purchases]: ['invoiceNumber', 'vendorId', 'purchaseDate'],
  [STORE_NAMES.tyreHistoryEvents]: [
    'tyreId',
    { name: 'byTyreAndDate', keyPath: ['tyreId', 'eventDate'] },
  ],
  [STORE_NAMES.inspectionSessions]: ['vehicleId', 'inspectionDate', { name: 'byVehicleAndDate', keyPath: ['vehicleId', 'inspectionDate'] }],
  [STORE_NAMES.inspectionEntries]: ['sessionId', 'tyreId', { name: 'bySessionAndTyre', keyPath: ['sessionId', 'tyreId'] }],
  [STORE_NAMES.inspectionPhotos]: ['inspectionEntryId', 'sessionId'],
  [STORE_NAMES.scrapRecords]: [
    { name: 'tyreId', unique: true },
    'scrapDate',
    'reason',
    'clientId',
    'siteId',
  ],
  [STORE_NAMES.scrapPhotos]: [
    'scrapRecordId',
    { name: 'byRecordAndCategory', keyPath: ['scrapRecordId', 'category'], unique: true },
  ],
};

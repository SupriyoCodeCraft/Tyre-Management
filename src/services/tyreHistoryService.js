import { findTyreBySerial } from '../data/repositories/tyreRepository.js';
import { listTyreHistory } from '../data/repositories/tyreHistoryRepository.js';
import { getPurchaseDetails } from '../data/repositories/purchaseRepository.js';
import { getClient } from '../data/repositories/clientRepository.js';
import { getSite } from '../data/repositories/siteRepository.js';
import { getVehicle } from '../data/repositories/vehicleRepository.js';
import { getInspectionDetails } from '../data/repositories/inspectionRepository.js';
import { getScrapRecordByTyreId, getScrapRecordDetails } from '../data/repositories/scrapRepository.js';
import { searchTyres } from './tyreService.js';

export const searchTyreHistory = (query) => searchTyres(query);

export async function loadTyreLifecycleHistory(serialNumber) {
  const tyre = await findTyreBySerial(serialNumber);
  if (!tyre) return null;
  const [events, purchase, client, site, vehicle, scrapRecord] = await Promise.all([
    listTyreHistory(tyre.id),
    tyre.purchaseId ? getPurchaseDetails(tyre.purchaseId) : Promise.resolve(null),
    tyre.currentClientId ? getClient(tyre.currentClientId) : Promise.resolve(null),
    tyre.currentSiteId ? getSite(tyre.currentSiteId) : Promise.resolve(null),
    tyre.currentVehicleId ? getVehicle(tyre.currentVehicleId) : Promise.resolve(null),
    getScrapRecordByTyreId(tyre.id),
  ]);

  const inspectionIds = [...new Set(events
    .filter((event) => event.eventType === 'INSPECTION_RECORDED')
    .map((event) => event.details?.inspectionId)
    .filter(Boolean))];
  const [inspections, scrap] = await Promise.all([
    Promise.all(inspectionIds.map((id) => getInspectionDetails(id))),
    scrapRecord ? getScrapRecordDetails(scrapRecord.id) : Promise.resolve(null),
  ]);
  const inspectionById = new Map(inspections.filter(Boolean).map((inspection) => [inspection.id, inspection]));

  const timeline = events
    .filter((event) => !(event.eventType === 'TYRE_REGISTERED' && event.details?.origin === 'purchase'))
    .map((event) => {
      if (event.eventType === 'PURCHASE_ASSOCIATED') return { ...event, purchase };
      if (event.eventType === 'INSPECTION_RECORDED') {
        const inspection = inspectionById.get(event.details?.inspectionId);
        const entry = inspection?.entries.find((item) => item.id === event.details?.inspectionEntryId);
        return { ...event, inspection, entry };
      }
      if (event.eventType === 'SCRAP_RECORDED') return { ...event, scrap };
      return event;
    })
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.createdAt.localeCompare(b.createdAt));
  const inspectionEvents = timeline.filter((event) => event.eventType === 'INSPECTION_RECORDED');
  const latestInspection = inspectionEvents.at(-1);

  return {
    tyre,
    purchase,
    client,
    site,
    vehicle,
    currentNsd: latestInspection?.entry?.nsd ?? null,
    timeline,
  };
}

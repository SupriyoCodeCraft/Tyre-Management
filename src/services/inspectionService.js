import { isDateOnly, normalizeSerialNumber } from '../data/database/recordUtils.js';
import { createClient, listClients } from '../data/repositories/clientRepository.js';
import { createSite, listSites } from '../data/repositories/siteRepository.js';
import { createVehicle, listVehicles } from '../data/repositories/vehicleRepository.js';
import { findTyreBySerial } from '../data/repositories/tyreRepository.js';
import { createInspection, getInspectionDetails, listInspectionSessions } from '../data/repositories/inspectionRepository.js';
import { prepareInspectionImage } from './inspectionImageService.js';

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

export const loadInspectionRecords = async () => {
  const [clients, sites, vehicles] = await Promise.all([listClients(), listSites(), listVehicles()]);
  return { clients, sites, vehicles };
};

export function addClient(form) {
  return createClient({ name: requiredText(form.name, 'Client name') });
}

export function addSite(form) {
  return createSite({
    clientId: requiredText(form.clientId, 'Client'),
    name: requiredText(form.name, 'Site name'),
    location: String(form.location ?? '').trim(),
  });
}

export function addVehicle(form) {
  return createVehicle({
    clientId: requiredText(form.clientId, 'Client'),
    siteId: requiredText(form.siteId, 'Site'),
    registrationNumber: requiredText(form.registrationNumber, 'Vehicle registration or identifier'),
    description: String(form.description ?? '').trim(),
  });
}

export function lookupInspectionTyre(serialNumber) {
  return findTyreBySerial(String(serialNumber ?? '').trim());
}

export async function saveVehicleInspection(form) {
  const clientId = requiredText(form.clientId, 'Client');
  const siteId = requiredText(form.siteId, 'Site');
  const vehicleId = requiredText(form.vehicleId, 'Vehicle');
  const inspectionDate = requiredText(form.inspectionDate, 'Inspection date');
  if (!isDateOnly(inspectionDate)) throw new Error('Enter a valid inspection date.');
  if (!Array.isArray(form.entries) || form.entries.length === 0) {
    throw new Error('Add at least one registered tyre to the inspection.');
  }

  const serialKeys = new Set();
  const entries = [];
  for (const [index, entry] of form.entries.entries()) {
    const serialNumber = requiredText(entry.serialNumber, `Tyre ${index + 1} serial number`);
    const key = normalizeSerialNumber(serialNumber);
    if (serialKeys.has(key)) throw new Error(`Tyre ${serialNumber} is repeated in this inspection.`);
    serialKeys.add(key);
    if (entry.nsd === '' || entry.nsd === null || entry.nsd === undefined || !Number.isFinite(Number(entry.nsd)) || Number(entry.nsd) < 0) {
      throw new Error(`Tyre ${serialNumber} NSD must be a valid number greater than or equal to zero.`);
    }
    const tyre = await findTyreBySerial(serialNumber);
    if (!tyre) {
      throw new Error(`Tyre ${serialNumber} is not registered. Register it first from Purchase Register → Register existing tyre.`);
    }
    const photos = await Promise.all((entry.photos ?? []).map(prepareInspectionImage));
    entries.push({
      tyreId: tyre.id,
      serialNumber: tyre.serialNumber,
      brand: tyre.brand,
      nsd: Number(entry.nsd),
      photos,
    });
  }

  return createInspection({ clientId, siteId, vehicleId, inspectionDate, entries });
}

export const loadInspectionHistory = (vehicleId = '') => listInspectionSessions(vehicleId);
export const loadInspectionDetails = (sessionId) => getInspectionDetails(sessionId);

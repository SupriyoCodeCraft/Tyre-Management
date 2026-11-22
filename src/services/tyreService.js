import { isDateOnly, normalizeSerialNumber } from '../data/database/recordUtils.js';
import {
  findTyreBySerial as findTyreRecordBySerial,
  listTyres,
  registerExistingTyre as registerTyreRecord,
} from '../data/repositories/tyreRepository.js';
import { listTyreHistory } from '../data/repositories/tyreHistoryRepository.js';
import { listClients } from '../data/repositories/clientRepository.js';
import { listSites } from '../data/repositories/siteRepository.js';
import { listVehicles } from '../data/repositories/vehicleRepository.js';

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

export function validateExistingTyreForm(form) {
  const serialNumber = requiredText(form.serialNumber, 'Tyre serial number');
  const initialNsd = Number(form.initialNsd);
  if (form.initialNsd === '' || !Number.isFinite(initialNsd) || initialNsd < 0) {
    throw new Error('Initial NSD must be a valid number greater than or equal to zero.');
  }
  const registrationDate = requiredText(form.registrationDate, 'Registration date');
  if (!isDateOnly(registrationDate)) throw new Error('Enter a valid registration date.');

  return {
    serialNumber,
    serialNumberKey: normalizeSerialNumber(serialNumber),
    brand: requiredText(form.brand, 'Tyre brand'),
    model: String(form.model ?? '').trim(),
    initialNsd,
    registrationDate,
    currentClientId: String(form.currentClientId ?? '').trim() || null,
    currentSiteId: String(form.currentSiteId ?? '').trim() || null,
    currentVehicleId: String(form.currentVehicleId ?? '').trim() || null,
  };
}

export function registerExistingTyre(form) {
  return registerTyreRecord(validateExistingTyreForm(form));
}

export async function searchTyres(query) {
  const serialNumber = String(query ?? '').trim();
  if (!serialNumber) return [];
  const exactMatch = await findTyreRecordBySerial(serialNumber);
  if (exactMatch) return [exactMatch];
  const normalizedQuery = normalizeSerialNumber(serialNumber);
  const records = await listTyres();
  return records.filter((tyre) => tyre.serialNumberKey.includes(normalizedQuery));
}

export async function loadTyreHistoryBySerial(serialNumber) {
  const tyre = await findTyreRecordBySerial(serialNumber);
  if (!tyre) return null;
  const events = await listTyreHistory(tyre.id);
  return { tyre, events };
}

export async function loadTyreRegistrationOptions() {
  const [clients, sites, vehicles] = await Promise.all([listClients(), listSites(), listVehicles()]);
  return { clients, sites, vehicles };
}

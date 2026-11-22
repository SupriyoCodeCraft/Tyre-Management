import { isDateOnly } from '../data/database/recordUtils.js';
import { findTyreBySerial } from '../data/repositories/tyreRepository.js';
import { createScrapRecord, getScrapRecordByTyreId, getScrapRecordDetails, listScrapRecords } from '../data/repositories/scrapRepository.js';
import { prepareInspectionImage, validateInspectionImage } from './inspectionImageService.js';

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

export async function lookupScrapTyre(serialNumber) {
  const tyre = await findTyreBySerial(String(serialNumber ?? '').trim());
  if (tyre?.currentStatus === 'scrapped') throw new Error(`Tyre ${tyre.serialNumber} is already recorded as scrapped.`);
  return tyre;
}

export async function saveScrap(form) {
  const serialNumber = requiredText(form.serialNumber, 'Tyre serial number');
  const scrapDate = requiredText(form.scrapDate, 'Scrap date');
  if (!isDateOnly(scrapDate)) throw new Error('Enter a valid scrap date.');
  const reason = requiredText(form.reason, 'Scrap reason');
  if (!form.damagedPartPhoto) throw new Error('Attach a damaged-part photograph.');
  if (!form.completeTyrePhoto) throw new Error('Attach a complete-tyre photograph.');
  validateInspectionImage(form.damagedPartPhoto);
  validateInspectionImage(form.completeTyrePhoto);

  const tyre = await findTyreBySerial(serialNumber);
  if (!tyre) throw new Error(`Tyre ${serialNumber} is not registered. Register it through Purchase Register → Register existing tyre.`);
  if (tyre.currentStatus === 'scrapped' || await getScrapRecordByTyreId(tyre.id)) {
    throw new Error(`Tyre ${tyre.serialNumber} is already recorded as scrapped.`);
  }

  const [damagedPartPhoto, completeTyrePhoto] = await Promise.all([
    prepareInspectionImage(form.damagedPartPhoto),
    prepareInspectionImage(form.completeTyrePhoto),
  ]);
  return createScrapRecord({
    serialNumber: tyre.serialNumber,
    scrapDate,
    reason,
    remarks: String(form.remarks ?? '').trim(),
    damagedPartPhoto,
    completeTyrePhoto,
  });
}

export async function loadScrapAnalysis() {
  const records = await listScrapRecords();
  const reasonCounts = new Map();
  const brandCounts = new Map();
  const monthCounts = new Map();
  for (const record of records) {
    reasonCounts.set(record.reason, (reasonCounts.get(record.reason) ?? 0) + 1);
    if (record.brand) brandCounts.set(record.brand, (brandCounts.get(record.brand) ?? 0) + 1);
    const month = record.scrapDate.slice(0, 7);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  return {
    records,
    total: records.length,
    byReason: [...reasonCounts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    byBrand: [...brandCounts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    byMonth: [...monthCounts].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export const loadScrapDetails = (recordId) => getScrapRecordDetails(recordId);

import {
  createPurchaseWithTyres,
  getPurchaseDetails,
  listPurchaseSummaries,
} from '../data/repositories/purchaseRepository.js';
import { isDateOnly, normalizeSerialNumber } from '../data/database/recordUtils.js';
import { listVendors } from '../data/repositories/vendorRepository.js';

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function nonNegativeNumber(value, label) {
  if (value === '' || value === null || value === undefined) {
    throw new Error(`${label} is required.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a valid number greater than or equal to zero.`);
  }
  return number;
}

export function validatePurchaseForm(form) {
  const invoiceNumber = requiredText(form.invoiceNumber, 'Invoice number');
  const purchaseDate = requiredText(form.purchaseDate, 'Purchase date');
  if (!isDateOnly(purchaseDate)) throw new Error('Enter a valid purchase date.');

  const newVendorName = String(form.newVendorName ?? '').trim();
  const vendorId = String(form.vendorId ?? '').trim();
  if (!vendorId && !newVendorName) throw new Error('Select a vendor or add a vendor name.');

  const brand = requiredText(form.brand, 'Tyre brand');
  const model = requiredText(form.model, 'Tyre model');
  if (!Array.isArray(form.tyres) || form.tyres.length === 0) {
    throw new Error('Add at least one tyre to this purchase.');
  }

  const seenSerials = new Set();
  const tyres = form.tyres.map((tyre, index) => {
    const serialNumber = requiredText(tyre.serialNumber, `Tyre ${index + 1} serial number`);
    const serialKey = normalizeSerialNumber(serialNumber);
    if (seenSerials.has(serialKey)) {
      throw new Error(`Serial number ${serialNumber} is repeated in this purchase.`);
    }
    seenSerials.add(serialKey);
    return {
      serialNumber,
      initialNsd: nonNegativeNumber(tyre.initialNsd, `Tyre ${index + 1} initial NSD`),
    };
  });

  return {
    vendorId: newVendorName ? '' : vendorId,
    newVendorName,
    invoiceNumber,
    purchaseDate,
    price: nonNegativeNumber(form.price, 'Price'),
    brand,
    model,
    tyres,
  };
}

export function savePurchase(form) {
  return createPurchaseWithTyres(validatePurchaseForm(form));
}

export const loadPurchases = () => listPurchaseSummaries();
export const loadPurchaseDetails = (purchaseId) => getPurchaseDetails(purchaseId);
export const loadPurchaseVendors = () => listVendors();

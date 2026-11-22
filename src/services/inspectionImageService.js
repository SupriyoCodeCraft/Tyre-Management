const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1920;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateInspectionImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file.name || 'This file'} is not a supported image. Choose a JPEG, PNG, or WebP photo.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name || 'This photo'} is larger than 15 MB. Choose a smaller image.`);
  }
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The photo could not be compressed.'));
    }, 'image/jpeg', 0.86);
  });
}

export async function prepareInspectionImage(file) {
  validateInspectionImage(file);
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new Error('Image processing is unavailable in this browser. The record was not saved.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the photo.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    return { blob, fileName: file.name, mimeType: blob.type };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'The photo could not be processed.');
  } finally {
    bitmap?.close();
  }
}

// Inspect bytes, not filename or CDN Content-Type: a .jpg URL may contain JXL.
export function detectFormat(buffer) {
  const b = new Uint8Array(buffer);
  const starts = bytes => bytes.every((v, i) => b[i] === v);
  if (starts([0xff, 0xd8, 0xff])) return 'jpeg';
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'png';
  if (starts([0xff, 0x0a]) || starts([0, 0, 0, 12, 74, 88, 76, 32, 13, 10, 135, 10])) return 'jxl';
  if (starts([82, 73, 70, 70]) && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) return 'webp';
  throw new Error('Antwort ist kein unterstütztes Bild (JPEG, PNG, JXL oder WebP). Login-/Fehlerseiten werden nicht gespeichert.');
}

export function outputName(name, extension) {
  return name.replace(/\.(jpe?g|png|webp|jxl|avif)$/i, '') + extension;
}

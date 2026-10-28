import {imageUrl} from './core.js';

export function requiredOrigins(photos, origin) {
  return [...new Set(photos.map(photo => `${new URL(imageUrl(photo.url, origin)).origin}/*`))];
}

function convert(buffer, signal) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./convert-worker.js', import.meta.url), {type: 'module'});
    const finish = (error, result) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(new Error('Abgebrochen.'));
    const timer = setTimeout(() => finish(new Error('Konvertierungs-Zeitlimit erreicht (2 Minuten).')), 120000);
    worker.onmessage = ({data}) => finish(data.error ? new Error(data.error) : null, data);
    worker.onerror = () => finish(new Error('Bilddecoder konnte nicht ausgeführt werden. Erweiterung neu laden.'));
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) return abort();
    worker.postMessage(buffer, [buffer]);
  });
}

export async function prepareImage(url, origin, signal) {
  const target = imageUrl(url, origin);
  const response = await fetch(target, {
    credentials: 'include',
    headers: {Accept: 'image/jpeg, image/png, image/jxl, image/webp'},
    signal: AbortSignal.any([signal, AbortSignal.timeout(120000)])
  });
  if (!response.ok) throw new Error(`Bildabruf: HTTP ${response.status}. Login und Bildberechtigung prüfen.`);
  const limit = 150 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) throw new Error('Bilddatei überschreitet 150 MB.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Bilddatei überschreitet 150 MB.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  const result = await convert(buffer.buffer, signal);
  return {blob: new Blob([result.buffer], {type: result.extension === '.jpg' ? 'image/jpeg' : 'image/png'}),
    extension: result.extension, converted: result.converted};
}

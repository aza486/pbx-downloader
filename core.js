export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const IMAGE_ACCEPT = 'image/jpeg, image/png;q=0.95, image/webp;q=0.9';
export function imageExtension(mime) {
  return {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}[
    String(mime || '').split(';')[0].trim().toLowerCase()
  ] || null;
}

export function safeFilename(value, index) {
  let name = String(value ?? `photo_${index + 1}`).split(/[\\/]/).pop()
    .replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 150);
  if (!name || /^\.+$/.test(name)) name = `photo_${index + 1}`;
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  return `${String(index + 1).padStart(5, '0')}_${name}`;
}

export function imageUrl(value, origin) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Bild-URL fehlt.');
  const url = new URL(value, origin);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Bild-URL muss HTTPS ohne eingebettete Zugangsdaten verwenden.');
  }
  return url.href;
}

// Self-contained: executed inside the authenticated editor tab, never exports cookies.
export async function fetchPhotoPage(project, offset, expectedOrigin, requestKey) {
  const controller = new AbortController();
  if (requestKey) {
    globalThis.__pbxRequests ??= {};
    globalThis.__pbxRequests[requestKey] = controller;
  }
  try {
    if (location.origin !== expectedOrigin || !expectedOrigin.startsWith('https://')) {
      throw new Error('Editor-Tab hat die Instanz gewechselt. Bitte neu öffnen.');
    }
    const url = new URL('/api/editor/photos/', location.origin);
    url.search = new URLSearchParams({
      isUploading: 'false', shareToken: '', projectId: project,
      projectTemplateId: '', updateTimeAfter: '', updateTimeBefore: '',
      createTimeAfter: '', createTimeBefore: '', uploadTimeAfter: '',
      uploadTimeBefore: '', date_0: '', date_1: '',
      offset: String(offset), limit: '300', isDeleted: 'false'
    }).toString();
    const response = await fetch(url, {
      credentials: 'same-origin', redirect: 'error',
      headers: {'Accept': 'application/json', 'X-Version': 'v6', 'X-Pbx-Store-Name': 'default_store'},
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])
    });
    if (!response.ok) throw new Error(`Bilderliste: HTTP ${response.status}. Login, Projektberechtigung oder Sicherheitsschutz prüfen.`);
    if (!(response.headers.get('content-type') || '').includes('application/json')) {
      throw new Error('Statt JSON wurde eine andere Seite geliefert. Bitte Login/CAPTCHA im Editor prüfen.');
    }
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error('Unbekanntes API-Format: results fehlt.');
    return {items: data.results.map(item => ({id: item.id, filename: item.filename, url: item.url})),
      count: Number.isInteger(data.count) && data.count >= 0 ? data.count : null};
  } catch (error) {
    return {error: error.name === 'TimeoutError' ? 'Zeitüberschreitung beim Abrufen der Bilderliste.' : error.message};
  } finally {
    if (requestKey) delete globalThis.__pbxRequests?.[requestKey];
  }
}

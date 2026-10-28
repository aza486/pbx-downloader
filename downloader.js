import {UUID, safeFilename, fetchPhotoPage} from './core.js';
import {loadConfig} from './config.js';
import {prepareImage, requiredOrigins} from './conversion.js';
import {outputName} from './image-format.js';

const $ = id => document.getElementById(id);
const tabId = Number(new URLSearchParams(location.search).get('tab'));
let origin, photos = [], loadedProject = '', busy = false, stopped = false, activeDownload;
let abortController;
let requestKey;
function status(message) { $('status').textContent = message; }
function controls(running) {
  busy = running;
  $('project').disabled = running;
  $('check').disabled = running || !origin;
  $('first').disabled = running || !photos.length;
  $('all').disabled = running || !photos.length;
  $('stop').disabled = false;
}
function failure(message) {
  const li = document.createElement('li');
  li.textContent = message;
  $('errors').append(li);
}
async function initialize() {
  try {
    if (!Number.isInteger(tabId) || tabId <= 0) throw new Error('Kein Editor-Tab ausgewählt. Erweiterung im Editor erneut öffnen.');
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith('https://')) throw new Error('Bitte die Erweiterung im geöffneten HTTPS-Editor starten.');
    const url = new URL(tab.url);
    const hosts = await loadConfig();
    if (!hosts.has(url.origin)) throw new Error('Diese Instanz ist nicht konfiguriert. In config.local.json freigeben und die Erweiterung neu laden.');
    const source = await chrome.runtime.sendMessage({type: 'source', tabId});
    if (source.error) throw new Error(source.error);
    requestKey = source.requestKey;
    origin = url.origin;
    $('source').textContent = `Instanz: ${url.hostname}`;
    const project = url.pathname.match(/\/editor\/admin\/([^/]+)/)?.[1];
    if (project && UUID.test(project)) $('project').value = project;
  } catch (error) { status(error.message); }
  controls(false);
}
$('project').addEventListener('input', () => { photos = []; controls(false); });
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const project = $('project').value.trim();
  if (!UUID.test(project)) return status('Bitte eine gültige Projekt-UUID eingeben.');
  photos = []; stopped = false;
  $('errors').replaceChildren();
  $('progress').value = 0;
  controls(true);
  try {
    const granted = await chrome.permissions.request({origins: [`${origin}/*`]});
    if (!granted) throw new Error('Der Zugriff auf diese Editor-Instanz wurde nicht freigegeben.');
    const seen = new Set();
    let offset = 0;
    while (!stopped) {
      status(`Bilderliste laden … ${photos.length} Bilder gefunden.`);
      const results = await chrome.scripting.executeScript({
        target: {tabId}, func: fetchPhotoPage, args: [project, offset, origin, requestKey]
      });
      if (stopped) break;
      const page = results[0]?.result;
      if (!page || page.error) throw new Error(page?.error || 'Keine Antwort aus dem Editor-Tab.');
      if (!page.items.length) {
        if (page.count !== null && offset < page.count) throw new Error('API meldet weitere Bilder, liefert aber eine leere Seite.');
        break;
      }
      let added = 0;
      for (const item of page.items) {
        const key = item.id != null ? `id:${item.id}` : `url:${item.url}`;
        if (!seen.has(key)) { seen.add(key); photos.push(item); added++; }
      }
      if (!added) throw new Error('Die API wiederholt dieselben Bilder. Pagination muss für diese Instanz geprüft werden.');
      offset += page.items.length;
      if (page.count !== null && offset >= page.count) break;
      if (offset >= 100000) throw new Error('Sicherheitsgrenze von 100.000 Einträgen erreicht.');
    }
    if (stopped) { photos = []; status('Abruf abgebrochen.'); }
    else { loadedProject = project; status(`${photos.length} Bilder gefunden. Zuerst mit „Ein Bild testen“ prüfen.`); }
  } catch (error) { photos = []; status(`Fehler: ${error.message}`); }
  finally { controls(false); }
});

async function waitForDownload(id) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline && !stopped) {
    const [download] = await chrome.downloads.search({id});
    if (!download) throw new Error('Download nicht mehr verfügbar.');
    if (download.state === 'interrupted') throw new Error(`Download unterbrochen: ${download.error || 'siehe Edge-Downloads'}`);
    if (download.state === 'complete') {
      if (!['image/jpeg', 'image/png'].includes(download.mime)) throw new Error('Gespeicherte Datei wurde nicht als JPG oder PNG bestätigt. Bitte Edge-Downloads prüfen.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await chrome.downloads.cancel(id).catch(() => {});
  throw new Error(stopped ? 'Abgebrochen.' : 'Download-Zeitlimit erreicht (3 Minuten).');
}
async function download(firstOnly) {
  if (busy || !photos.length) return;
  const selected = firstOnly ? photos.slice(0, 1) : photos;
  stopped = false;
  controls(true);
  abortController = new AbortController();
  $('errors').replaceChildren();
  $('progress').max = selected.length;
  $('progress').value = 0;
  let completed = 0, failed = 0;
  try {
    // Called directly from the button click so Edge can display a scoped permission prompt.
    const granted = await chrome.permissions.request({origins: requiredOrigins(selected, origin)});
    if (!granted) throw new Error('Zugriff auf die Bildserver wurde nicht freigegeben. Ohne diesen Zugriff ist die lokale Konvertierung nicht möglich.');
    for (const [index, photo] of selected.entries()) {
      if (stopped) break;
      status(`Lade Bild ${index + 1} / ${selected.length} …`);
      let blobUrl;
      try {
        const prepared = await prepareImage(photo.url, origin, abortController.signal);
        if (stopped) break;
        blobUrl = URL.createObjectURL(prepared.blob);
        const result = await chrome.runtime.sendMessage({
          type: 'download',
          url: blobUrl,
          filename: `PrintboxDownloads/${loadedProject}/${outputName(safeFilename(photo.filename ?? photo.id, index), prepared.extension)}`,
        });
        if (result.error) throw new Error(result.error);
        activeDownload = result.id;
        await waitForDownload(activeDownload);
        completed++;
      } catch (error) {
        if (!stopped) { failed++; failure(`Bild ${index + 1}: ${error.message}`); }
        // Stop on first failure: avoid saving many login/error pages.
        break;
      } finally {
        if (blobUrl) {
          await chrome.runtime.sendMessage({type: 'release', url: blobUrl}).catch(() => {});
          URL.revokeObjectURL(blobUrl);
        }
        activeDownload = undefined;
      }
      $('progress').value = completed;
    }
    status(`${stopped ? 'Abgebrochen' : failed ? 'Bei einem Fehler angehalten' : 'Abgeschlossen'}: ${completed} / ${selected.length} Bilder gespeichert, ${failed} Fehler.`);
  } catch (error) { status(`Fehler: ${error.message}`); }
  finally { abortController = undefined; controls(false); }
}
$('first').addEventListener('click', () => download(true));
$('all').addEventListener('click', () => download(false));
$('stop').addEventListener('click', async () => {
  stopped = true;
  abortController?.abort();
  status('Abbruch angefordert …');
  await chrome.runtime.sendMessage({type: 'cancel'}).catch(() => {});
  const current = await chrome.tabs.getCurrent();
  if (current?.id !== undefined) await chrome.tabs.remove(current.id);
});
$('folder').addEventListener('click', () => chrome.downloads.showDefaultFolder());
window.addEventListener('pagehide', () => { stopped = true; abortController?.abort(); });
initialize();

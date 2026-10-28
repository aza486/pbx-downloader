import test from 'node:test';
import assert from 'node:assert/strict';
import {installDownloadManager} from '../download-manager.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const event = () => ({listeners: [], addListener(fn) { this.listeners.push(fn); }});
  const store = {}, cancelled = [], owner = 12;
  let exists = true;
  const api = {
    runtime: {id: 'test', getURL: path => `chrome-extension://test/${path}`, onMessage: event()},
    tabs: {onRemoved: event(), get: async () => { if (!exists) throw new Error('closed'); return {id: owner}; }},
    scripting: {executeScript: async () => []},
    storage: {session: {
      get: async key => key === null ? structuredClone(store) : {[key]: structuredClone(store[key])},
      set: async values => Object.assign(store, structuredClone(values)),
      remove: async key => { delete store[key]; }
    }},
    downloads: {onDeterminingFilename: event(), download: async () => 42,
      cancel: async id => { cancelled.push(id); }}
  };
  installDownloadManager(api);
  const send = message => new Promise(resolve => api.runtime.onMessage.listeners[0](message,
    {id: 'test', url: api.runtime.getURL('downloader.html?tab=1'), tab: {id: owner}}, resolve));
  const close = async () => {
    exists = false;
    api.tabs.onRemoved.listeners[0](owner);
    await tick();
  };
  return {api, store, cancelled, send, close};
}
const job = {type: 'download', url: 'blob:chrome-extension://test/image',
  filename: 'PrintboxDownloads/12345678-1234-1234-1234-123456789abc/00001_photo.png'};

test('blob downloads explicitly retain their project directory and are cancelled on tab closure', async () => {
  const h = setup();
  assert.deepEqual(await h.send(job), {id: 42});
  const suggested = await new Promise(resolve => {
    assert.equal(h.api.downloads.onDeterminingFilename.listeners[0](
      {url: job.url, byExtensionId: 'test', filename: 'random-blob-name'}, resolve), true);
  });
  assert.equal(suggested.filename, job.filename);
  await h.close();
  assert.deepEqual(h.cancelled, [42]);
  assert.deepEqual(h.store, {});
});

test('closure during download startup cancels the late download ID', async () => {
  const h = setup();
  let finish;
  h.api.downloads.download = () => new Promise(resolve => { finish = resolve; });
  const response = h.send(job);
  await tick();
  await h.close();
  finish(99);
  assert.match((await response).error, /geschlossen/);
  assert.deepEqual(h.cancelled, [99]);
});

test('explicit cancellation stops only owned downloads and rejects invalid paths', async () => {
  const h = setup();
  await h.send(job);
  h.store['download:other'] = {owner: 999, id: 100};
  await h.send({type: 'cancel'});
  assert.deepEqual(h.cancelled, [42]);
  assert.ok(h.store['download:other']);
  assert.match((await h.send({...job, filename: '../outside.png'})).error, /Ungültiger/);
});

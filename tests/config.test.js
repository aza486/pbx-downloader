import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../config.js';

test('local configuration is used; missing local file falls back to generic examples', async () => {
  const oldFetch = globalThis.fetch, oldChrome = globalThis.chrome;
  globalThis.chrome = {runtime: {getURL: path => `chrome-extension://test/${path}`}};
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({allowedOrigins: ['https://private.example.org']}));
    assert.deepEqual([...await loadConfig()], ['https://private.example.org']);
    globalThis.fetch = async url => {
      if (url.endsWith('config.local.json')) throw new TypeError('File missing');
      return new Response(JSON.stringify({allowedOrigins: ['https://editor.example.com']}));
    };
    assert.deepEqual([...await loadConfig()], ['https://editor.example.com']);
    for (const value of ['http://editor.example.com', 'https://editor.example.com/path', 'https://user:pass@editor.example.com']) {
      globalThis.fetch = async () => new Response(JSON.stringify({allowedOrigins: [value]}));
      await assert.rejects(loadConfig());
    }
    globalThis.fetch = async () => new Response(JSON.stringify({allowedOrigins: []}));
    await assert.rejects(loadConfig(), /mindestens eine/);
  } finally { globalThis.fetch = oldFetch; globalThis.chrome = oldChrome; }
});

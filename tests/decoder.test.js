import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import factory from '../vendor/jxl/codec/dec/jxl_dec.js';

test('bundled WASM decoder decodes a real JXL fixture into RGBA pixels', async () => {
  const wasm = await readFile(new URL('../vendor/jxl/codec/dec/jxl_dec.wasm', import.meta.url));
  const input = await readFile(new URL('./fixtures/test.jxl', import.meta.url));
  const decoder = await factory({wasmBinary: wasm});
  const image = decoder.decode(Uint8Array.from(input).buffer);
  assert.equal(image.width, 50);
  assert.equal(image.height, 50);
  assert.equal(image.data.length, 50 * 50 * 4);
});

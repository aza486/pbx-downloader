import test from 'node:test';
import assert from 'node:assert/strict';
import {safeFilename, imageUrl, fetchPhotoPage, IMAGE_ACCEPT, imageExtension} from '../core.js';
import {detectFormat, outputName} from '../image-format.js';

test('actual file bytes determine conversion, independent of filename or MIME', () => {
  assert.equal(detectFormat(Uint8Array.from([255, 10, 0]).buffer), 'jxl');
  assert.equal(detectFormat(Uint8Array.from([0,0,0,12,74,88,76,32,13,10,135,10]).buffer), 'jxl');
  assert.equal(detectFormat(Uint8Array.from([255,216,255,224]).buffer), 'jpeg');
  assert.equal(detectFormat(Uint8Array.from([137,80,78,71,13,10,26,10]).buffer), 'png');
  assert.equal(detectFormat(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80]).buffer), 'webp');
  assert.throws(() => detectFormat(new TextEncoder().encode('<html>login</html>').buffer));
  assert.throws(() => detectFormat(new ArrayBuffer(0)));
  assert.equal(outputName('00001_photo.jxl', '.png'), '00001_photo.png');
  assert.equal(outputName('00001_photo.JPG', '.jpg'), '00001_photo.jpg');
});

test('format negotiation excludes JPEG XL and extensions follow actual response MIME', () => {
  assert.doesNotMatch(IMAGE_ACCEPT, /jxl|avif|\*\/\*/);
  assert.equal(imageExtension('image/jpeg'), '.jpg');
  assert.equal(imageExtension('image/png; charset=binary'), '.png');
  assert.equal(imageExtension('image/webp'), '.webp');
  assert.equal(imageExtension('image/jxl'), null);
  assert.equal(imageExtension('text/html'), null);
});

test('download names cannot escape the project folder or use Windows reserved names', () => {
  for (const value of ['../../secret.jpg', '..\\..\\secret.jpg', 'CON.jpg', 'a:b?.png', '..', '', null]) {
    const name = safeFilename(value, 0);
    assert.ok(name.startsWith('00001_'));
    assert.doesNotMatch(name, /[\\/<>:"|?*\x00-\x1f]/);
    assert.ok(!name.endsWith('.') && !name.endsWith(' '));
  }
});

test('image URLs permit HTTPS CDNs but reject executable or credential-bearing URLs', () => {
  const origin = 'https://editor.example.com';
  assert.equal(imageUrl('/image.jpg', origin), `${origin}/image.jpg`);
  assert.equal(imageUrl('https://cdn.example/image.jpg', origin), 'https://cdn.example/image.jpg');
  for (const url of [undefined, '', 'javascript:alert(1)', 'http://example.com/a', 'https://user:password@example.com/a']) {
    assert.throws(() => imageUrl(url, origin));
  }
});

test('authenticated page fetch handles JSON, denial, login HTML and changed origin', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  const origin = 'https://editor.example.com';
  globalThis.location = {origin};
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.origin, origin);
      assert.equal(url.searchParams.get('offset'), '300');
      assert.equal(url.searchParams.get('projectId'), 'test-project');
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Cookie, undefined);
      return new Response(JSON.stringify({count: 301, results: [{id: 1, url: '/a.jpg', secret: 'not exported'}]}),
        {headers: {'content-type': 'application/json'}});
    };
    assert.deepEqual(await fetchPhotoPage('test-project', 300, origin), {
      count: 301, items: [{id: 1, filename: undefined, url: '/a.jpg'}]
    });
    globalThis.fetch = async () => new Response('', {status: 403});
    assert.match((await fetchPhotoPage('x', 0, origin)).error, /HTTP 403/);
    globalThis.fetch = async () => new Response('<html>Login</html>', {headers: {'content-type': 'text/html'}});
    assert.match((await fetchPhotoPage('x', 0, origin)).error, /Login\/CAPTCHA/);
    globalThis.fetch = async () => new Response('{}', {headers: {'content-type': 'application/json'}});
    assert.match((await fetchPhotoPage('x', 0, origin)).error, /results fehlt/);
    globalThis.location = {origin: 'https://example.com'};
    globalThis.fetch = async () => { throw new Error('Must not fetch on another origin'); };
    assert.match((await fetchPhotoPage('x', 0, origin)).error, /Instanz gewechselt/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});

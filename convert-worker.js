import decodeJxl from './vendor/jxl/decode.js';
import {detectFormat} from './image-format.js';

self.onmessage = async ({data: buffer}) => {
  let bitmap;
  try {
    const format = detectFormat(buffer);
    if (format === 'jpeg' || format === 'png') {
      self.postMessage({buffer, extension: format === 'jpeg' ? '.jpg' : '.png', converted: false}, [buffer]);
      return;
    }
    let pixels;
    if (format === 'jxl') pixels = await decodeJxl(buffer);
    else bitmap = await createImageBitmap(new Blob([buffer], {type: 'image/webp'}));
    const image = pixels || bitmap;
    if (!image.width || !image.height || image.width * image.height > 100000000) {
      throw new Error('Bild ist zu groß (maximal 100 Megapixel) oder ungültig.');
    }
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d', {colorSpace: 'srgb'});
    if (!ctx) throw new Error('PNG-Konvertierung ist in diesem Edge nicht verfügbar.');
    if (pixels) ctx.putImageData(pixels, 0, 0);
    else ctx.drawImage(bitmap, 0, 0);
    const png = await canvas.convertToBlob({type: 'image/png'});
    const output = await png.arrayBuffer();
    self.postMessage({buffer: output, extension: '.png', converted: true}, [output]);
  } catch (error) {
    self.postMessage({error: `Bildkonvertierung fehlgeschlagen: ${error.message}`});
  } finally { bitmap?.close(); }
};

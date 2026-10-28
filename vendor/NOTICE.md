# Bundled JPEG XL decoder

`jxl/`: decoder-only files from `@jsquash/jxl` version 1.3.0.
Source: https://github.com/jamsinclair/jSquash
Package: https://registry.npmjs.org/@jsquash/jxl/-/jxl-1.3.0.tgz
Original package SHA-256: `737C6E4749213A46AAB1A2B39AED5BC527E06F0390D3A4E337ED006C349A876B`.
Apache-2.0 license included in `jxl/LICENSE`; upstream code headers retained.
No remote executable code is loaded at runtime.

Test fixture `tests/fixtures/test.jxl` is from the same Apache-2.0 project:
https://github.com/jamsinclair/jSquash/blob/main/test/fixtures/test.jxl

Decoder output is 8-bit RGBA, subsequently encoded to PNG using Edge's OffscreenCanvas.
This path does not reconstruct original JPEG bitstreams or preserve all source metadata/HDR information.

// Generates the PWA PNG icons (192 & 512) without any image dependencies.
// Draws the same dark-Norse diamond motif as favicon.svg, pixel by pixel,
// then encodes a PNG via the built-in zlib.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/icons");

const COLORS = {
  bg: [14, 20, 25],
  frame: [107, 80, 52],
  gold: [214, 168, 74],
  light: [233, 224, 207],
  dark: [34, 40, 49],
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const c = size / 2;

  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255;
    px[i] = lerp(px[i], r, ia);
    px[i + 1] = lerp(px[i + 1], g, ia);
    px[i + 2] = lerp(px[i + 2], b, ia);
    px[i + 3] = 255;
  };

  const disc = (cx, cy, rad, color) => {
    for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) {
      for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= rad) set(x, y, color);
        else if (d <= rad + 1.2) set(x, y, color, 140);
      }
    }
  };

  // Background with a subtle radial gradient.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / (size * 0.7);
      const t = Math.min(1, d);
      const col = [
        Math.round(lerp(22, COLORS.bg[0], t)),
        Math.round(lerp(33, COLORS.bg[1], t)),
        Math.round(lerp(44, COLORS.bg[2], t)),
      ];
      set(x, y, col);
    }
  }

  // Outer frame.
  const m = size * 0.13;
  const lw = Math.max(2, size * 0.018);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const onV = (x >= m && x <= m + lw) || (x >= size - m - lw && x <= size - m);
      const onH = (y >= m && y <= m + lw) || (y >= size - m - lw && y <= size - m);
      const inBox = x >= m && x <= size - m && y >= m && y <= size - m;
      if (inBox && (onV || onH)) set(x, y, COLORS.frame);
    }
  }

  // Diamond outline.
  const rad = size * 0.30;
  const dlw = size * 0.022;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dd = Math.abs(x - c) + Math.abs(y - c);
      if (Math.abs(dd - rad) <= dlw) set(x, y, COLORS.gold);
    }
  }

  // Pieces: king center, defenders + attackers on the cross points.
  disc(c, c, size * 0.11, COLORS.gold);
  disc(c, c - rad, size * 0.055, COLORS.light);
  disc(c, c + rad, size * 0.055, COLORS.dark);
  disc(c - rad, c, size * 0.055, COLORS.dark);
  disc(c + rad, c, size * 0.055, COLORS.light);

  return px;
}

// --- Minimal PNG encoder ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // remaining bytes (compression, filter, interlace) are 0.

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size, drawIcon(size));
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), png);
  console.log(`wrote icons/icon-${size}.png (${png.length} bytes)`);
}

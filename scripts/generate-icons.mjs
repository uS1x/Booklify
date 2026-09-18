/**
 * Erzeugt die PWA-Icons als echte PNG-Dateien – ohne Bildbibliothek,
 * direkt über einen kleinen PNG-Encoder (zlib + CRC32).
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../public/icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

/* ── PNG-Encoder ─────────────────────────────────────────────────────────── */

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // Filtertyp „none“
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Zeichnen ────────────────────────────────────────────────────────────── */

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

function canvas(size) {
  const data = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b], a = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const src = a;
    const dstA = data[i + 3] / 255;
    const outA = src + dstA * (1 - src);
    if (outA === 0) return;
    data[i] = Math.round((r * src + data[i] * dstA * (1 - src)) / outA);
    data[i + 1] = Math.round((g * src + data[i + 1] * dstA * (1 - src)) / outA);
    data[i + 2] = Math.round((b * src + data[i + 2] * dstA * (1 - src)) / outA);
    data[i + 3] = Math.round(outA * 255);
  };

  const roundedRect = (x, y, w, h, radius, colorTop, colorBottom, alpha = 1) => {
    const top = hex(colorTop);
    const bottom = hex(colorBottom ?? colorTop);
    for (let py = Math.floor(y); py < y + h; py++) {
      for (let px = Math.floor(x); px < x + w; px++) {
        const dx = Math.min(px - x, x + w - 1 - px);
        const dy = Math.min(py - y, y + h - 1 - py);
        if (dx < radius && dy < radius) {
          const d = Math.hypot(radius - dx, radius - dy);
          if (d > radius) continue;
        }
        const t = (py - y) / h;
        put(px, py, [
          top[0] + (bottom[0] - top[0]) * t,
          top[1] + (bottom[1] - top[1]) * t,
          top[2] + (bottom[2] - top[2]) * t,
        ], alpha);
      }
    }
  };

  return { data, roundedRect };
}

/** Icon: warmes Terrakotta-Quadrat mit drei Buchrücken. */
function icon(size, { maskable = false } = {}) {
  const c = canvas(size);
  const pad = maskable ? size * 0.16 : size * 0.06;
  const radius = maskable ? size * 0.5 : size * 0.22;

  if (maskable) c.roundedRect(0, 0, size, size, 0, "#b9654c", "#7d4030");
  c.roundedRect(pad * 0.4, pad * 0.4, size - pad * 0.8, size - pad * 0.8, radius, "#c0705a", "#7d4030");

  const books = [
    { color: ["#fbecd2", "#f5d9a8"], h: 0.46 },
    { color: ["#fbf7f1", "#ede3d6"], h: 0.62 },
    { color: ["#c9d8c5", "#a4bd9e"], h: 0.38 },
  ];
  const slotW = (size - pad * 2) / 3.4;
  const baseY = size - pad - size * 0.1;

  books.forEach((book, i) => {
    const w = slotW * 0.64;
    const h = size * book.h;
    const x = pad + size * 0.08 + i * slotW;
    c.roundedRect(x, baseY - h, w, h, w * 0.18, book.color[0], book.color[1]);
  });

  // Regalbrett
  c.roundedRect(pad + size * 0.05, baseY, size - pad * 2 - size * 0.02, size * 0.055, size * 0.02, "#e3cdb4", "#9a6f4d");

  return encodePng(size, size, c.data);
}

writeFileSync(new URL("icon-192.png", OUT), icon(192));
writeFileSync(new URL("icon-512.png", OUT), icon(512));
writeFileSync(new URL("icon-maskable-512.png", OUT), icon(512, { maskable: true }));
writeFileSync(new URL("apple-touch-icon.png", OUT), icon(180));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c0705a"/><stop offset="1" stop-color="#7d4030"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <rect x="13" y="26" width="9" height="24" rx="2" fill="#fbecd2"/>
  <rect x="25" y="18" width="9" height="32" rx="2" fill="#fbf7f1"/>
  <rect x="37" y="30" width="9" height="20" rx="2" fill="#c9d8c5"/>
  <rect x="11" y="50" width="42" height="4" rx="2" fill="#e3cdb4"/>
</svg>`;
writeFileSync(new URL("icon.svg", OUT), svg);

console.log("✔ Icons erzeugt: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, icon.svg");

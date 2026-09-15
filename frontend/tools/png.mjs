/** Liest und schreibt PNG in Echtfarbe, 8 Bit je Kanal, ohne Interlace. */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = 3;

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

/** Berechnet die CRC-32-Prüfsumme eines Puffers. */
function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Baut einen PNG-Abschnitt aus Kennung und Inhalt. */
function chunk(name, body) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const tagged = Buffer.concat([Buffer.from(name, 'ascii'), body]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(tagged));
  return Buffer.concat([head, tagged, tail]);
}

/** Gibt den Paeth-Schätzwert aus linkem, oberem und diagonalem Byte. */
function paeth(left, up, corner) {
  const guess = left + up - corner;
  const toLeft = Math.abs(guess - left);
  const toUp = Math.abs(guess - up);
  const toCorner = Math.abs(guess - corner);
  if (toLeft <= toUp && toLeft <= toCorner) return left;
  return toUp <= toCorner ? up : corner;
}

/** Nimmt den Zeilenfilter aus den Rohdaten heraus. */
function unfilter(raw, width, height) {
  const stride = width * CHANNELS;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row += 1) {
    const kind = raw[row * (stride + 1)];
    const from = row * (stride + 1) + 1;
    const to = row * stride;
    for (let index = 0; index < stride; index += 1) {
      const value = raw[from + index];
      const left = index >= CHANNELS ? pixels[to + index - CHANNELS] : 0;
      const up = row > 0 ? pixels[to - stride + index] : 0;
      const corner = row > 0 && index >= CHANNELS ? pixels[to - stride + index - CHANNELS] : 0;
      let base = 0;
      if (kind === 1) base = left;
      else if (kind === 2) base = up;
      else if (kind === 3) base = (left + up) >> 1;
      else if (kind === 4) base = paeth(left, up, corner);
      else if (kind !== 0) throw new Error(`Zeilenfilter ${kind} ist unbekannt`);
      pixels[to + index] = (value + base) & 0xff;
    }
  }
  return pixels;
}

/** Legt den Paeth-Filter auf jede Zeile und gibt die Rohdaten zurück. */
function filter(pixels, width, height) {
  const stride = width * CHANNELS;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const from = row * stride;
    const to = row * (stride + 1);
    raw[to] = 4;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= CHANNELS ? pixels[from + index - CHANNELS] : 0;
      const up = row > 0 ? pixels[from - stride + index] : 0;
      const corner = row > 0 && index >= CHANNELS ? pixels[from - stride + index - CHANNELS] : 0;
      raw[to + 1 + index] = (pixels[from + index] - paeth(left, up, corner)) & 0xff;
    }
  }
  return raw;
}

/** Liest ein PNG und gibt Breite, Höhe und die RGB-Werte zurück. */
export function decode(file) {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('Keine PNG-Signatur');
  let offset = 8;
  let head = null;
  const parts = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const name = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') head = body;
    if (name === 'IDAT') parts.push(body);
    offset += length + 12;
  }
  if (!head) throw new Error('IHDR fehlt');
  const width = head.readUInt32BE(0);
  const height = head.readUInt32BE(4);
  if (head[8] !== 8 || head[9] !== 2 || head[12] !== 0) {
    throw new Error('Nur Echtfarbe mit 8 Bit und ohne Interlace');
  }
  return { width, height, pixels: unfilter(inflateSync(Buffer.concat(parts)), width, height) };
}

/** Schreibt Breite, Höhe und RGB-Werte als PNG. */
export function encode({ width, height, pixels }) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;
  head[9] = 2;
  const body = deflateSync(filter(pixels, width, height), { level: 9 });
  return Buffer.concat([SIGNATURE, chunk('IHDR', head), chunk('IDAT', body), chunk('IEND', Buffer.alloc(0))]);
}

/** Schneidet ein Rechteck aus einem Bild heraus. */
export function crop(image, { x, y, w, h }) {
  if (x < 0 || y < 0 || x + w > image.width || y + h > image.height) {
    throw new Error(`Ausschnitt ${x},${y} ${w}×${h} liegt nicht im Bild`);
  }
  const pixels = Buffer.alloc(w * h * CHANNELS);
  for (let row = 0; row < h; row += 1) {
    const from = ((y + row) * image.width + x) * CHANNELS;
    image.pixels.copy(pixels, row * w * CHANNELS, from, from + w * CHANNELS);
  }
  return { width: w, height: h, pixels };
}

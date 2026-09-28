// Bağımlılıksız PNG ikon üretici: yeşil zemin + beyaz damla/halka glifi.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, { padding }) {
  const bg = [15, 81, 50];
  const fg = [255, 255, 255];
  const rows = [];
  const c = size / 2;
  const r = (size / 2) * (1 - padding);
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      // Damla: üstte sivri uçlu daire
      const dx = x - c;
      const dy = y - c - r * 0.15;
      const inCircle = dx * dx + dy * dy <= (r * 0.55) ** 2;
      const tipY = c - r * 0.85;
      const inTip = y >= tipY && y <= c && Math.abs(dx) <= ((y - tipY) / (c - tipY)) * r * 0.5;
      const inner = dx * dx + dy * dy <= (r * 0.3) ** 2;
      const on = (inCircle || inTip) && !inner;
      const col = on ? fg : bg;
      row.set([...col, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, { padding: 0.1 }));
writeFileSync('public/icons/icon-512.png', png(512, { padding: 0.1 }));
writeFileSync('public/icons/maskable-512.png', png(512, { padding: 0.3 }));
console.warn('icons written');

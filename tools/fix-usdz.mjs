// Post-process a USDZ written by three's USDZExporter so it passes the USD
// schema validators: primvar `varname` must be a string and UsdTransform2d's
// `inputs:in` a float2. Re-packs the archive uncompressed with every file's
// data aligned to 64 bytes, as the USDZ spec requires.
//   node tools/fix-usdz.mjs models/kawasaki-zx6r-2019.usdz
import fs from 'node:fs';

const file = process.argv[2];
const buf = fs.readFileSync(file);

// ---- read the central directory (stored entries only)
const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) throw new Error('not a zip file');
const count = buf.readUInt16LE(eocd + 10);
let p = buf.readUInt32LE(eocd + 16);
const entries = [];
for (let i = 0; i < count; i++) {
  if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
  const method = buf.readUInt16LE(p + 10);
  const size = buf.readUInt32LE(p + 20);
  const nameLen = buf.readUInt16LE(p + 28);
  const extraLen = buf.readUInt16LE(p + 30);
  const commentLen = buf.readUInt16LE(p + 32);
  const local = buf.readUInt32LE(p + 42);
  const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
  if (method !== 0) throw new Error(`${name} is compressed; USDZ entries must be stored`);
  const lNameLen = buf.readUInt16LE(local + 26);
  const lExtraLen = buf.readUInt16LE(local + 28);
  const start = local + 30 + lNameLen + lExtraLen;
  entries.push({ name, data: buf.subarray(start, start + size) });
  p += 46 + nameLen + extraLen + commentLen;
}

// ---- patch the layers
let fixes = 0;
for (const e of entries) {
  if (!e.name.endsWith('.usda')) continue;
  const before = e.data.toString('utf8');
  const after = before
    .replace(/token inputs:varname = /g, () => (fixes++, 'string inputs:varname = '))
    .replace(/token inputs:in\.connect = /g, () => (fixes++, 'float2 inputs:in.connect = '));
  if (after !== before) e.data = Buffer.from(after, 'utf8');
}

// ---- write an aligned, stored zip
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const parts = [];
const central = [];
let offset = 0;
for (const e of entries) {
  const name = Buffer.from(e.name, 'utf8');
  const crc = crc32(e.data);
  // pad with an extra field so the file data starts on a 64-byte boundary
  let pad = (64 - ((offset + 30 + name.length + 4) % 64)) % 64;
  const extra = Buffer.alloc(4 + pad);
  extra.writeUInt16LE(0x1986, 0);
  extra.writeUInt16LE(pad, 2);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(e.data.length, 18);
  lh.writeUInt32LE(e.data.length, 22);
  lh.writeUInt16LE(name.length, 26);
  lh.writeUInt16LE(extra.length, 28);
  parts.push(lh, name, extra, e.data);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(e.data.length, 20);
  ch.writeUInt32LE(e.data.length, 24);
  ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, name);
  offset += 30 + name.length + extra.length + e.data.length;
}
const cdSize = central.reduce((s, b) => s + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(cdSize, 12);
end.writeUInt32LE(offset, 16);
fs.writeFileSync(file, Buffer.concat([...parts, ...central, end]));
console.log(`fixed ${fixes} attributes in ${file} (${entries.length} files, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB)`);

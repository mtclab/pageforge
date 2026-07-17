/** A deterministic ZIP writer using STORE entries (no compression). */

const encoder = new TextEncoder();
const UTF8_FLAG = 0x0800;
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < table.length; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function join(parts: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function buildStoreZip(files: Record<string, Uint8Array>): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localSize = 0;
  let centralSize = 0;

  for (const name of Object.keys(files).sort()) {
    const data = files[name]!;
    const filename = encoder.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + filename.byteLength + data.byteLength);
    const localView = new DataView(local.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 6, UTF8_FLAG);
    u16(localView, 8, 0);
    u16(localView, 10, DOS_TIME);
    u16(localView, 12, DOS_DATE);
    u32(localView, 14, crc);
    u32(localView, 18, data.byteLength);
    u32(localView, 22, data.byteLength);
    u16(localView, 26, filename.byteLength);
    u16(localView, 28, 0);
    local.set(filename, 30);
    local.set(data, 30 + filename.byteLength);
    locals.push(local);

    const central = new Uint8Array(46 + filename.byteLength);
    const centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u16(centralView, 8, UTF8_FLAG);
    u16(centralView, 10, 0);
    u16(centralView, 12, DOS_TIME);
    u16(centralView, 14, DOS_DATE);
    u32(centralView, 16, crc);
    u32(centralView, 20, data.byteLength);
    u32(centralView, 24, data.byteLength);
    u16(centralView, 28, filename.byteLength);
    u16(centralView, 30, 0);
    u16(centralView, 32, 0);
    u16(centralView, 34, 0);
    u16(centralView, 36, 0);
    u32(centralView, 38, 0);
    u32(centralView, 42, localSize);
    central.set(filename, 46);
    centrals.push(central);

    localSize += local.byteLength;
    centralSize += central.byteLength;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 4, 0);
  u16(endView, 6, 0);
  u16(endView, 8, centrals.length);
  u16(endView, 10, centrals.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, localSize);
  u16(endView, 20, 0);

  return join([...locals, ...centrals, end], localSize + centralSize + end.byteLength);
}

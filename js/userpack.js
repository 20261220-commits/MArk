// A resource pack or client.jar the player picks (설정 → 리소스 팩). Its textures are converted right here on the
// player's device and kept in this browser's IndexedDB; nothing is uploaded or bundled with the game. Whatever the
// chosen pack lacks keeps the built-in Pixel Perfection CE textures.
const UPACK = { name: null };
function upDB() { return new Promise((res, rej) => { const q = indexedDB.open('nemo-userpack', 1); q.onupgradeneeded = () => q.result.createObjectStore('p'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function upGet() {
  try { const db = await upDB(); return await new Promise(res => { const t = db.transaction('p').objectStore('p').get('pack'); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); }
  catch (e) { return null; }
}
async function upPut(v) { const db = await upDB(); await new Promise((res, rej) => { const t = db.transaction('p', 'readwrite'), s = t.objectStore('p'); if (v) s.put(v, 'pack'); else s.delete('pack'); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
// raw DEFLATE decoder (after zlib's puff): synchronous, so thousands of small files don't each wait on a stream
const INF_LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], INF_LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const INF_DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577], INF_DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const INF_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
function infTable(len, n) { const cnt = new Uint16Array(16), sym = new Uint16Array(n), offs = new Uint16Array(16); for (let i = 0; i < n; i++) cnt[len[i]]++; cnt[0] = 0; for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + cnt[i - 1]; for (let i = 0; i < n; i++) if (len[i]) sym[offs[len[i]]++] = i; return { cnt, sym }; }
let INF_FIXED = null;
function inflateRaw(src, size, start = 0) {
  let pos = start, bit = 0, nb = 0, op = 0, out = new Uint8Array(size || src.length * 4);
  const need = n => { if (op + n > out.length) { const o = new Uint8Array(Math.max(out.length * 2, op + n)); o.set(out); out = o; } };
  const bits = n => { while (nb < n) { bit |= (src[pos++] | 0) << nb; nb += 8; } const v = bit & ((1 << n) - 1); bit >>>= n; nb -= n; return v; };
  const dec = t => { let code = 0, first = 0, index = 0; for (let l = 1; l < 16; l++) { code |= bits(1); const c = t.cnt[l]; if (code - c < first) return t.sym[index + code - first]; index += c; first = (first + c) << 1; code <<= 1; } throw new Error('bad deflate data'); };
  let last = 0;
  while (!last) {
    last = bits(1); const type = bits(2);
    if (type === 0) { bit = 0; nb = 0; const len = src[pos] | (src[pos + 1] << 8); pos += 4; need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len; continue; }
    let lt, dt;
    if (type === 1) {
      if (!INF_FIXED) { const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288); INF_FIXED = [infTable(l, 288), infTable(new Uint8Array(30).fill(5), 30)]; }
      [lt, dt] = INF_FIXED;
    } else if (type === 2) {
      const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4, cl = new Uint8Array(19);
      for (let i = 0; i < hc; i++) cl[INF_ORDER[i]] = bits(3);
      const ct = infTable(cl, 19), lens = new Uint8Array(hl + hd);
      for (let i = 0; i < hl + hd;) { const sy = dec(ct); if (sy < 16) lens[i++] = sy; else { let rep, v = 0; if (sy === 16) { v = lens[i - 1]; rep = 3 + bits(2); } else if (sy === 17) rep = 3 + bits(3); else rep = 11 + bits(7); while (rep--) lens[i++] = v; } }
      lt = infTable(lens.subarray(0, hl), hl); dt = infTable(lens.subarray(hl), hd);
    } else throw new Error('bad deflate block');
    for (;;) {
      const sy = dec(lt);
      if (sy < 256) { need(1); out[op++] = sy; continue; }
      if (sy === 256) break;
      const li = sy - 257, len = INF_LB[li] + bits(INF_LE[li]), di = dec(dt), dist = INF_DB[di] + bits(INF_DE[di]);
      need(len); for (let k = 0; k < len; k++, op++) out[op] = out[op - dist];
    }
  }
  return op === out.length ? out : out.subarray(0, op);
}

// zip central directory -> { name: () => bytes } (stored and deflated entries; jars are zips)
function unzipIndex(buf) {
  const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), files = {};
  let e = buf.length - 22; while (e >= 0 && d.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip/jar 파일이 아닙니다');
  let p = d.getUint32(e + 16, true); const n = d.getUint16(e + 10, true), dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const method = d.getUint16(p + 10, true), csize = d.getUint32(p + 20, true), nl = d.getUint16(p + 28, true), xl = d.getUint16(p + 30, true), cl = d.getUint16(p + 32, true), lo = d.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl));
    const usize = d.getUint32(p + 24, true);
    files[name] = () => { const s = lo + 30 + d.getUint16(lo + 26, true) + d.getUint16(lo + 28, true), raw = buf.subarray(s, s + csize); return method === 0 ? raw : inflateRaw(raw, usize); };
    p += 46 + nl + xl + cl;
  }
  return files;
}

// PNG -> { w, h, px } (all colour types, bit depths 1-8, no interlace), exact pixels with no canvas colour handling
function decodePNG(buf) {
  const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), idat = []; let p = 8, w, h, depth, ctype, palette = null, trns = null;
  while (p < buf.length) {
    const len = d.getUint32(p), type = String.fromCharCode(buf[p + 4], buf[p + 5], buf[p + 6], buf[p + 7]), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.getUint32(p + 8); h = d.getUint32(p + 12); depth = data[8]; ctype = data[9]; if (data[12]) return null; }
    else if (type === 'PLTE') palette = data; else if (type === 'tRNS') trns = data; else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const all = new Uint8Array(idat.reduce((a, b) => a + b.length, 0)); let o = 0; for (const c of idat) { all.set(c, o); o += c.length; }
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype], bpp = Math.max(1, (chans * depth) >> 3), stride = (w * chans * depth + 7) >> 3;
  const raw = inflateRaw(all, (stride + 1) * h, 2); // zlib stream: skip the 2-byte header
  const lines = new Uint8Array(stride * h); let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = lines.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[i] = v & 255;
    }
    prev = out;
  }
  const px = new Uint8Array(w * h * 4);
  const sample = (y, i) => { if (depth === 8) return lines[y * stride + i]; const bit = i * depth, byte = lines[y * stride + (bit >> 3)]; return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = (y * w + x) * 4;
    if (ctype === 3) { const k = sample(y, x); px[q] = palette[k * 3]; px[q + 1] = palette[k * 3 + 1]; px[q + 2] = palette[k * 3 + 2]; px[q + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (ctype === 0) { const s = depth === 8 ? sample(y, x) : sample(y, x) * 255 / ((1 << depth) - 1); px[q] = px[q + 1] = px[q + 2] = s; px[q + 3] = 255; }
    else if (ctype === 4) { px[q] = px[q + 1] = px[q + 2] = sample(y, x * 2); px[q + 3] = sample(y, x * 2 + 1); }
    else if (ctype === 2) { px[q] = sample(y, x * 3); px[q + 1] = sample(y, x * 3 + 1); px[q + 2] = sample(y, x * 3 + 2); px[q + 3] = 255; }
    else for (let c = 0; c < 4; c++) px[q + c] = sample(y, x * 4 + c);
  }
  return { w, h, px };
}

// file -> stored pack { name, out, data }; progress(text) reports along the way
async function importPack(file, progress) {
  const buf = new Uint8Array(await file.arrayBuffer()), files = unzipIndex(buf);
  const key = Object.keys(files).find(k => k.includes('assets/minecraft/textures/'));
  if (!key) throw new Error('assets/minecraft/textures 폴더가 없습니다 (리소스 팩이나 client.jar가 아님)');
  const root = key.slice(0, key.indexOf('assets/minecraft/')) + 'assets/minecraft/';
  const want = Object.keys(files).filter(k => k.startsWith(root) && k.endsWith('.png') && /^(textures\/(block|item|entity)\/|optifine\/(random|sky)\/)/.test(k.slice(root.length)));
  const imgs = new Map();
  for (let i = 0; i < want.length; i++) {
    const rel = want[i].slice(root.length), path = rel.startsWith('textures/') ? rel.slice(9, -4) : '../' + rel.slice(0, -4);
    try { const img = decodePNG(files[want[i]]()); if (img) imgs.set(path, img); } catch (e) { /* skip unreadable images */ }
    if (i % 200 === 0) { progress && progress(`텍스처 읽는 중 ${i} / ${want.length}`); await new Promise(r => setTimeout(r)); }
  }
  progress && progress('변환 중...');
  const items = ITEMS.filter(d => d && !d.block).map(d => d.key);
  const { out, data } = PACKMAP.packBuild(f => imgs.get(f) || null, S.TILES, items);
  const pack = { name: file.name, out, data, date: Date.now() };
  await upPut(pack);
  return pack;
}

// boot: lay the stored pack over the built-in one; textures it lacks stay as they are, but the built-in pack's OptiFine
// extras (random skins, emissive layers) are dropped unless the chosen pack has its own
async function applyUserPack() {
  const up = await upGet(); if (!up) return false;
  for (const k of Object.keys(PACKPX.ent)) if ((k.startsWith('r_') || k.endsWith('_e')) && !up.out.ent[k]) delete PACKPX.ent[k];
  applyPackData(up.out, up.data);
  UPACK.name = up.name;
  return true;
}

// 설정 → 리소스 팩 screen actions
function pickPackFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip,.jar';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const el = document.getElementById('packStatus'), say = t => { if (el) el.textContent = t; };
    try { await importPack(f, say); say('불러왔습니다. 다시 시작합니다...'); setTimeout(() => location.reload(), 400); }
    catch (e) { say('불러오지 못했습니다: ' + (e.message || e)); }
  };
  inp.click();
}
async function resetPack() { await upPut(null); location.reload(); }

// Maps: an empty map becomes a map of the 128 x 128 area around the player that fills in while you hold it (the
// view shows bottom right). Explorer maps from shipwrecks, ocean ruins and cartographers point to buried treasure,
// ocean monuments and woodland mansions. Map data lives in the world record (W.meta.maps).
const MAPS = { tileAvg: null, view: null, ctx: null, cache: new Map() };
const mapStore = () => (W.meta.maps || (W.meta.maps = {}));
function newMap(cx, cz, scale, marks, dim = W.dim) {
  const id = (W.meta.mapN = (W.meta.mapN || 0) + 1), size = 128 << scale;
  const x = Math.floor((cx + size / 2) / size) * size - size / 2 + size / 2, z = Math.floor((cz + size / 2) / size) * size - size / 2 + size / 2;
  mapStore()[id] = { x: marks ? Math.round(cx) : x, z: marks ? Math.round(cz) : z, s: scale, dim, px: '', pal: [], marks: marks || [] };
  return id;
}
function mapData(id) {
  const m = mapStore()[id]; if (!m) return null;
  let c = MAPS.cache.get(id);
  if (!c) { const px = new Uint8Array(128 * 128); if (m.px) { const bin = atob(m.px); for (let i = 0; i < bin.length; i++) px[i] = bin.charCodeAt(i); } c = { m, px, dirty: false }; MAPS.cache.set(id, c); }
  return c;
}
function mapSave(c) { let s = ''; for (let i = 0; i < c.px.length; i += 4096) s += String.fromCharCode.apply(null, c.px.subarray(i, i + 4096)); c.m.px = btoa(s); c.dirty = false; }
// average colour of every atlas tile (for the colours of blocks on maps)
function tileAvg(t) {
  if (!MAPS.tileAvg) MAPS.tileAvg = new Map();
  let v = MAPS.tileAvg.get(t); if (v) return v;
  let r = 0, g = 0, b = 0, n = 0; const ox = (t % TPR) * TS, oy = ((t / TPR) | 0) * TS;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const i = ((oy + y) * ATLAS_W + ox + x) * 4; if (AD[i + 3] < 128) continue; r += AD[i]; g += AD[i + 1]; b += AD[i + 2]; n++; }
  v = n ? [r / n, g / n, b / n] : [128, 128, 128]; MAPS.tileAvg.set(t, v); return v;
}
function blockMapColor(id, meta, bio) {
  if (id === BID.water) return hex(S.BIOMES[bio][3]);
  if (id === BID.lava) return [255, 120, 20];
  let c = tileAvg(S.tileFor(id, meta, 1));
  const tn = S.TINT[id];
  if (tn === 1 || id === BID.grass_block) c = c.map((v, i) => v * hex(S.BIOMES[bio][1])[i] / 255 * 1.6);
  else if (tn === 2 || S.LEAF[id]) c = c.map((v, i) => v * hex(S.BIOMES[bio][2])[i] / 255 * 1.6);
  return c.map(v => Math.min(255, v));
}
function palIndex(m, c) {
  const h = '#' + c.map(v => (Math.max(0, Math.min(255, Math.round(v / 8) * 8)) | 0).toString(16).padStart(2, '0')).join('');
  let i = m.pal.indexOf(h); if (i < 0) { if (m.pal.length >= 255) { let best = 0, bd = 1e9; m.pal.forEach((p, k) => { const d = Math.abs(parseInt(p.slice(1, 3), 16) - c[0]) + Math.abs(parseInt(p.slice(3, 5), 16) - c[1]) + Math.abs(parseInt(p.slice(5, 7), 16) - c[2]); if (d < bd) { bd = d; best = k; } }); return best + 1; } m.pal.push(h); i = m.pal.length - 1; }
  return i + 1; // 0 = not explored
}
// the surface seen from above: first block that is not air or a small plant; water shaded by depth, land by slope
function surfaceAt(x, z) {
  const c = chunkAt(x >> 4, z >> 4); if (!c) return null;
  let y = Math.min(CH - 1, c.maxY + 1);
  while (y > 0) { const b = getBlock(x, y, z); if (b && RTYPE[b] !== RT.CROSS && RTYPE[b] !== RT.CROP && RTYPE[b] !== RT.TORCH && RTYPE[b] !== RT.WIRE) break; y--; }
  const b = getBlock(x, y, z); let depth = 0;
  if (b === BID.water || S.isWet(b, getMeta(x, y, z))) { let d = y; while (d > 0 && (getBlock(x, d, z) === BID.water || S.isWet(getBlock(x, d, z), getMeta(x, d, z)))) d--; depth = y - d; }
  return { y, b: depth ? BID.water : b, m: getMeta(x, y, z), depth };
}
// fill in the part of the map around the player (a few rows per call)
function mapUpdate(c) {
  const m = c.m; if (m.dim !== W.dim) return;
  const sc = 1 << m.s, x0 = m.x - 64 * sc, z0 = m.z - 64 * sc;
  const pu = Math.floor((PL.x - x0) / sc), pv = Math.floor((PL.z - z0) / sc), R = Math.ceil(64 / sc) + 4;
  c.row = ((c.row || 0) + 1) % 8;
  for (let v = Math.max(0, pv - R) + c.row; v < Math.min(128, pv + R); v += 8) for (let u = Math.max(0, pu - R); u < Math.min(128, pu + R); u++) {
    if ((u - pu) ** 2 + (v - pv) ** 2 > R * R) continue;
    const wx = x0 + u * sc, wz = z0 + v * sc, s = surfaceAt(wx, wz); if (!s) continue;
    let col = blockMapColor(s.b, s.m, biomeAt(wx, wz));
    if (s.depth) col = col.map(k => k * Math.max(0.45, 1 - s.depth * 0.06));
    else { const n = surfaceAt(wx, wz - sc); if (n) col = col.map(k => k * (s.y > n.y ? 1.12 : s.y < n.y ? 0.82 : 1)); }
    const i = v * 128 + u, p = palIndex(m, col); if (c.px[i] !== p) { c.px[i] = p; c.dirty = true; }
  }
}
// ---------- the map in hand ----------
function mapViewTick() {
  const h = PL.held() && PL.held().id === IID.filled_map ? PL.held() : offItem(), show = h && h.id === IID.filled_map && h.map && !UI.screen;
  if (!MAPS.view) { MAPS.view = document.createElement('canvas'); MAPS.view.id = 'mapview'; MAPS.view.width = MAPS.view.height = 128; document.body.appendChild(MAPS.view); MAPS.ctx = MAPS.view.getContext('2d'); }
  MAPS.view.hidden = !show; if (!show) return;
  const c = mapData(h.map); if (!c) return;
  if (W.tickN % 2 === 0) mapUpdate(c);
  if (c.dirty && W.tickN % 100 === 0) mapSave(c);
  drawMap(c);
}
function drawMap(c) {
  const g = MAPS.ctx, img = g.createImageData(128, 128), m = c.m;
  const pal = m.pal.map(p => [parseInt(p.slice(1, 3), 16), parseInt(p.slice(3, 5), 16), parseInt(p.slice(5, 7), 16)]);
  for (let i = 0; i < 128 * 128; i++) { const p = c.px[i]; const col = p ? pal[p - 1] : [222, 206, 168]; img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const sc = 1 << m.s, toU = x => (x - (m.x - 64 * sc)) / sc, toV = z => (z - (m.z - 64 * sc)) / sc;
  for (const [mx, mz, kind] of m.marks) { const u = toU(mx), v = toV(mz); g.fillStyle = kind === 'x' ? '#c01818' : kind === 'monument' ? '#2a9a8a' : '#6a4a2a'; if (kind === 'x') { g.fillRect(u - 3, v - 1, 7, 2); g.fillRect(u - 1, v - 3, 2, 7); } else { g.fillRect(u - 3, v - 3, 7, 7); g.fillStyle = '#fff'; g.fillRect(u - 1, v - 1, 2, 2); } }
  if (m.dim === W.dim) { // the player: a white arrow (a dot at the map edge when off the map)
    let u = toU(PL.x), v = toV(PL.z); const off = u < 0 || v < 0 || u > 127 || v > 127; u = Math.max(2, Math.min(125, u)); v = Math.max(2, Math.min(125, v));
    g.save(); g.translate(u, v); g.rotate(-PL.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.beginPath();
    if (off) g.arc(0, 0, 2, 0, 6.3); else { g.moveTo(0, -4); g.lineTo(3, 3); g.lineTo(0, 1.5); g.lineTo(-3, 3); g.closePath(); }
    g.fill(); g.stroke(); g.restore();
  }
}
// use an empty map: it becomes a map of where you stand
function useEmptyMap() {
  const id = newMap(PL.x, PL.z, 0, null), st = { id: IID.filled_map, n: 1, map: id, name: '지도 #' + id };
  if (creative()) INV.giveOrDrop(st); else { const h = PL.held(); h.n--; if (!h.n) INV.slots[INV.sel] = st; else INV.giveOrDrop(st); }
  play('click'); swing(); UI.hudDirty = true;
}
// ---------- explorer maps ----------
function nearestTreasure(wx, wz) {
  const G = W.genCache || (W.genCache = S.makeGen(W.seed)), ccx = wx >> 4, ccz = wz >> 4;
  for (let r = 0; r <= 48; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const t = S.treasureAt(W.seed, G, ccx + dx, ccz + dz); if (t) return t;
  }
  return null;
}
function nearestMonument(wx, wz) {
  const G = W.genCache || (W.genCache = S.makeGen(W.seed)), rx = Math.floor((wx >> 4) / 32), rz = Math.floor((wz >> 4) / 32); let best = null, bd = 1e9;
  for (let i = rx - 6; i <= rx + 6; i++) for (let j = rz - 6; j <= rz + 6; j++) { const m = S.monumentAt(W.seed, G, i, j); if (m) { const d = Math.hypot(m.x - wx, m.z - wz); if (d < bd) { bd = d; best = [m.x, 0, m.z]; } } }
  return best;
}
function explorerMap(kind, wx, wz) {
  const at = kind === 'x' ? nearestTreasure(wx, wz) : kind === 'monument' ? nearestMonument(wx, wz) : typeof nearestMansion === 'function' ? nearestMansion(wx, wz) : null;
  if (!at) return { id: IID.map, n: 1 };
  const id = newMap(at[0], at[2], kind === 'x' ? 1 : 2, [[at[0], at[2], kind]], 0);
  return { id: IID.filled_map, n: 1, map: id, name: kind === 'x' ? '매장된 보물 지도' : kind === 'monument' ? '바다 탐험 지도' : '삼림 탐험 지도' };
}
// loot keys that are not plain items (world.js addChunk)
function lootSpecial(key, wx, wz) {
  if (key === 'buried_treasure_map') return explorerMap('x', wx, wz);
  if (key === 'ocean_explorer_map') return explorerMap('monument', wx, wz);
  if (key === 'woodland_explorer_map') return explorerMap('mansion', wx, wz);
  return null;
}
// cartographers sell explorer maps
TRADES.cartographer.push([['emerald', 13], ['ocean_explorer_map', 1]], [['emerald', 14], ['woodland_explorer_map', 1]]);
function nearestMansion(wx, wz) {
  const G = W.genCache || (W.genCache = S.makeGen(W.seed)), rx = Math.floor((wx >> 4) / S.MREG), rz = Math.floor((wz >> 4) / S.MREG); let best = null, bd = 1e9;
  for (let i = rx - 4; i <= rx + 4; i++) for (let j = rz - 4; j <= rz + 4; j++) { const m = S.mansionAt(W.seed, G, i, j); if (m) { const d = Math.hypot(m.x - wx, m.z - wz); if (d < bd) { bd = d; best = [m.x, 0, m.z]; } } }
  return best;
}

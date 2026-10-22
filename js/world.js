// World: chunk storage/streaming, cross-chunk lighting, block updates, fluids,
// random ticks and IndexedDB persistence.
const { OPQ, LOP, LEM, SOLID, FLUID, REPL, RTYPE, DIRS, CVOL } = S;
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

class Chunk {
  constructor(cx, cz, d) {
    this.cx = cx; this.cz = cz; this.key = ckey(cx, cz);
    this.blocks = d.blocks; this.meta = d.meta; this.light = d.light; this.biome = d.biome;
    this.tiles = new Map(); this.modified = false; this.dirty = true; this.ver = 0; this.meshing = false; this.mesh = null;
    this.mobs = d.mobs || null; this.edited = !!d.fromSave; // edited: blocks differ from generated terrain
  }
}

const W = {
  seed: 0, id: '', chunks: new Map(), time: 1000, rain: 0, rainTarget: 0, rainTimer: 12000,
  last: null, lastKey: -1,
  saved: new Set(), pending: new Map(), inbox: [], meshInbox: [], pendingMobs: new Map(), // pending: key -> job id | 'load'
  sched: new Map(), tickN: 0,
  onDrop: null, onFall: null, onBlockChanged: null, onChunkLoaded: null, onChunkUnloaded: null,
};
function chunkAt(cx, cz) {
  const k = ckey(cx, cz); if (k === W.lastKey) return W.last;
  const c = W.chunks.get(k); if (c) { W.last = c; W.lastKey = k; } return c;
}
function getBlock(x, y, z) {
  if (y < 0) return 8; if (y >= CH) return 0;
  const c = chunkAt(x >> 4, z >> 4); if (!c) return 0;
  return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
}
function getMeta(x, y, z) { if (y < 0 || y >= CH) return 0; const c = chunkAt(x >> 4, z >> 4); return c ? c.meta[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0; }
function getLight(x, y, z) { if (y >= CH) return 0xf0; if (y < 0) return 0; const c = chunkAt(x >> 4, z >> 4); return c ? c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0xf0; }
function isLoaded(x, z) { return !!chunkAt(x >> 4, z >> 4); }
function biomeAt(x, z) { const c = chunkAt(x >> 4, z >> 4); return c ? c.biome[((z & 15) << 4) | (x & 15)] : 1; }
function topY(x, z) { for (let y = CH - 1; y > 0; y--) { const b = getBlock(x, y, z); if (b && LOP[b] > 0) return y; } return 0; }
function markDirty(x, z) {
  const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
  const m = (a, b) => { const c = chunkAt(a, b); if (c) c.dirty = true; };
  m(cx, cz);
  if (lx === 0) m(cx - 1, cz); else if (lx === 15) m(cx + 1, cz);
  if (lz === 0) m(cx, cz - 1); else if (lz === 15) m(cx, cz + 1);
  if ((lx === 0 || lx === 15) && (lz === 0 || lz === 15)) m(cx + (lx ? 1 : -1), cz + (lz ? 1 : -1));
}

// ---------- lighting across chunks ----------
function lightAdd(seeds, sh) {
  // seeds: array of [x,y,z]
  const q = []; for (const s of seeds) q.push(s[0], s[1], s[2]);
  let h = 0;
  while (h < q.length) {
    const x = q[h], y = q[h + 1], z = q[h + 2]; h += 3;
    const c = chunkAt(x >> 4, z >> 4); if (!c) continue;
    const l = (c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] >> sh) & 15; if (l <= 1) continue;
    for (let k = 0; k < 6; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0), nz = z + (k === 4 ? 1 : k === 5 ? -1 : 0);
      if (ny < 0 || ny >= CH) continue;
      const nc = chunkAt(nx >> 4, nz >> 4); if (!nc) continue;
      const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15), op = LOP[nc.blocks[ni]];
      if (op >= 15) continue;
      let nl = l - Math.max(1, op);
      if (sh && k === 3 && l === 15 && op === 0) nl = 15;
      const cur = (nc.light[ni] >> sh) & 15;
      if (cur >= nl) continue;
      nc.light[ni] = sh ? (nc.light[ni] & 0x0f) | (nl << 4) : (nc.light[ni] & 0xf0) | nl;
      markDirty(nx, nz);
      q.push(nx, ny, nz);
    }
  }
}
function lightRemove(x, y, z, sh) {
  const c = chunkAt(x >> 4, z >> 4); if (!c) return [];
  const i = (y << 8) | ((z & 15) << 4) | (x & 15);
  const old = (c.light[i] >> sh) & 15;
  c.light[i] = sh ? c.light[i] & 0x0f : c.light[i] & 0xf0;
  const q = [x, y, z, old], re = [];
  let h = 0;
  while (h < q.length) {
    const px = q[h], py = q[h + 1], pz = q[h + 2], l = q[h + 3]; h += 4;
    for (let k = 0; k < 6; k++) {
      const nx = px + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = py + (k === 2 ? 1 : k === 3 ? -1 : 0), nz = pz + (k === 4 ? 1 : k === 5 ? -1 : 0);
      if (ny < 0 || ny >= CH) continue;
      const nc = chunkAt(nx >> 4, nz >> 4); if (!nc) continue;
      const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15), nl = (nc.light[ni] >> sh) & 15;
      if (nl && (nl < l || (sh && k === 3 && l === 15 && nl === 15))) {
        nc.light[ni] = sh ? nc.light[ni] & 0x0f : nc.light[ni] & 0xf0; markDirty(nx, nz);
        q.push(nx, ny, nz, nl);
      } else if (nl >= l) re.push([nx, ny, nz]);
    }
  }
  markDirty(x, z);
  return re;
}
function relight(x, y, z, oldId, newId) {
  // block light
  if (LEM[oldId] || LEM[newId] || LOP[oldId] !== LOP[newId]) {
    const re = lightRemove(x, y, z, 0);
    const c = chunkAt(x >> 4, z >> 4), i = (y << 8) | ((z & 15) << 4) | (x & 15);
    if (LEM[newId]) { c.light[i] = (c.light[i] & 0xf0) | LEM[newId]; re.push([x, y, z]); }
    else if (LOP[newId] < 15) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) re.push([x + dx, y + dy, z + dz]);
    lightAdd(re, 0);
  }
  if (LOP[oldId] !== LOP[newId]) {
    const re = lightRemove(x, y, z, 4);
    if (LOP[newId] < 15) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) re.push([x + dx, y + dy, z + dz]);
      if (y === CH - 1) { const c = chunkAt(x >> 4, z >> 4); const i = (y << 8) | ((z & 15) << 4) | (x & 15); c.light[i] |= 0xf0; re.push([x, y, z]); }
    }
    lightAdd(re, 4);
  }
}
// propagate light across the borders of a freshly added chunk
function stitchLight(c) {
  for (const sh of [4, 0]) {
    const seeds = [];
    const x0 = c.cx * 16, z0 = c.cz * 16;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = chunkAt(c.cx + dx, c.cz + dz); if (!n) continue;
      for (let k = 0; k < 16; k++) {
        const ax = dx === 1 ? 15 : dx === -1 ? 0 : k, az = dz === 1 ? 15 : dz === -1 ? 0 : k;
        const bx = dx === 1 ? 0 : dx === -1 ? 15 : k, bz = dz === 1 ? 0 : dz === -1 ? 15 : k;
        for (let y = 0; y < CH; y++) {
          const la = (c.light[(y << 8) | (az << 4) | ax] >> sh) & 15, lb = (n.light[(y << 8) | (bz << 4) | bx] >> sh) & 15;
          if (la > lb + 1) seeds.push([x0 + ax, y, z0 + az]);
          else if (lb > la + 1) seeds.push([(c.cx + dx) * 16 + bx, y, (c.cz + dz) * 16 + bz]);
        }
      }
    }
    if (seeds.length) lightAdd(seeds, sh);
  }
}

// ---------- block set & updates ----------
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function setBlock(x, y, z, id, meta = 0, opts = {}) {
  if (y < 0 || y >= CH) return false;
  const c = chunkAt(x >> 4, z >> 4); if (!c) return false;
  const i = (y << 8) | ((z & 15) << 4) | (x & 15), old = c.blocks[i], oldM = c.meta[i];
  if (old === id && oldM === meta) return false;
  c.blocks[i] = id; c.meta[i] = meta; c.modified = c.edited = true;
  if (old !== id && c.tiles.has(i) && !opts.keepTile) { const t = c.tiles.get(i); c.tiles.delete(i); if (W.onTileRemoved) W.onTileRemoved(x, y, z, t); }
  if (old !== id) relight(x, y, z, old, id);
  markDirty(x, z);
  if (W.onBlockChanged) W.onBlockChanged(x, y, z, old, id);
  if (!opts.noUpdate) { neighborUpdate(x, y, z); for (const [dx, dy, dz] of N6) neighborUpdate(x + dx, y + dy, z + dz); }
  return true;
}
function setMeta(x, y, z, meta) { const c = chunkAt(x >> 4, z >> 4); if (!c || y < 0 || y >= CH) return; const i = (y << 8) | ((z & 15) << 4) | (x & 15); if (c.meta[i] === meta) return; c.meta[i] = meta; c.modified = c.edited = true; markDirty(x, z); }
function getTile(x, y, z) { const c = chunkAt(x >> 4, z >> 4); return c ? c.tiles.get((y << 8) | ((z & 15) << 4) | (x & 15)) : null; }
function setTile(x, y, z, t) { const c = chunkAt(x >> 4, z >> 4); if (!c) return; c.tiles.set((y << 8) | ((z & 15) << 4) | (x & 15), t); c.modified = c.edited = true; }
function schedule(x, y, z, delay) { const k = x + ',' + y + ',' + z; if (!W.sched.has(k)) W.sched.set(k, W.tickN + delay); }
const supportedBy = id => OPQ[id] || id === BID.farmland || (RTYPE[id] === RT.BOX && id !== BID.snow && id !== BID.ladder && id !== BID.lantern) || id === BID.glass || (id >= 22 && id <= 24);
function breakNaturally(x, y, z, b, m) {
  setBlock(x, y, z, 0, 0);
  if (W.onDrop) { const d = blockDrops(b, m, null); W.onDrop(x, y, z, d.items, 0); }
}
function neighborUpdate(x, y, z) {
  if (y < 0 || y >= CH) return;
  const b = getBlock(x, y, z); if (!b) return;
  const m = getMeta(x, y, z), below = getBlock(x, y - 1, z), d = BLOCKS[b];
  if (FLUID[b]) { schedule(x, y, z, b === 27 ? 5 : 30); return; }
  if (d.fall) { if (below === 0 || FLUID[below] || (REPL[below] && below !== b)) schedule(x, y, z, 2); return; }
  if (d.plant) {
    let ok = true;
    if (d.plant === 1) ok = below === 2 || below === 3 || below === BID.farmland || below === BID.moss_block;
    else if (d.plant === 2) ok = below === 9 || below === 3 || below === 2;
    else if (d.plant === 3) { ok = below === b || ((below === 2 || below === 3 || below === 9) && N6.some(([dx, dy, dz]) => !dy && getBlock(x + dx, y - 1, z + dz) === 27)); }
    else if (d.plant === 4) { ok = (below === b || below === 9) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => SOLID[getBlock(x + dx, y, z + dz)]); }
    else if (d.plant === 5) ok = below === BID.farmland;
    else if (d.plant === 6) ok = OPQ[below];
    if (!ok) breakNaturally(x, y, z, b, m);
    return;
  }
  if (b === BID.torch) { const sup = m >= 1 && m <= 4 ? getBlock(x + DIRS[m - 1][0], y, z + DIRS[m - 1][2]) : below; if (!OPQ[sup] && !(m === 0 && supportedBy(sup))) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.ladder) { const f = m & 3; if (!OPQ[getBlock(x + DIRS[f][0], y, z + DIRS[f][2])]) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.snow) { if (!OPQ[below] && !(below >= 22 && below <= 24)) setBlock(x, y, z, 0); return; }
  if (b === BID.oak_door) { const up = m & 8, other = getBlock(x, y + (up ? -1 : 1), z); if (other !== b) setBlock(x, y, z, 0); else if (!up && !supportedBy(below)) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.red_bed) { const f = m & 3, dir = DIRS[f], s = (m & 4) ? -1 : 1; if (getBlock(x + dir[0] * s, y, z + dir[2] * s) !== b) setBlock(x, y, z, 0); return; }
  if (b === BID.farmland && SOLID[getBlock(x, y + 1, z)] && RTYPE[getBlock(x, y + 1, z)] === RT.CUBE) { setBlock(x, y, z, 3); return; }
  if (b === BID.amethyst_cluster || b === BID.pointed_dripstone) { if (!N6.some(([dx, dy, dz]) => OPQ[getBlock(x + dx, y + dy, z + dz)])) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.lantern) { const sup = m & 1 ? getBlock(x, y + 1, z) : below; if (!SOLID[sup]) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.tnt && W.onTntCheck) W.onTntCheck(x, y, z);
}
// ---------- fluids ----------
function fluidUpdate(x, y, z) {
  const b = getBlock(x, y, z); if (!FLUID[b]) { const d = BLOCKS[b]; if (d && d.fall) fallCheck(x, y, z, b); return; }
  const water = b === 27, drop = water ? 1 : 2, m = getMeta(x, y, z);
  let lvl = m & 7, falling = (m & 8) !== 0;
  const other = water ? 28 : 27;
  // lava meets water
  if (!water) for (const [dx, dy, dz] of N6) if (dy !== -1 && getBlock(x + dx, y + dy, z + dz) === 27) { setBlock(x, y, z, lvl === 0 && !falling ? BID.obsidian : BID.cobblestone); return; }
  if (lvl !== 0 || falling) {
    let expect;
    const above = getBlock(x, y + 1, z);
    if (above === b) expect = 8;
    else {
      let best = 99, sources = 0;
      for (const [dx, , dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
        if (getBlock(x + dx, y, z + dz) !== b) continue;
        const nm = getMeta(x + dx, y, z + dz), nl = (nm & 8) ? 0 : nm & 7;
        if (nm === 0) sources++;
        best = Math.min(best, nl);
      }
      expect = best + drop;
      if (water && sources >= 2) { const bl = getBlock(x, y - 1, z); if (SOLID[bl] || (bl === 27 && getMeta(x, y - 1, z) === 0)) expect = 0; }
    }
    if (expect >= 8 && expect !== 8) { setBlock(x, y, z, 0); return; }
    const nm = expect === 8 ? 8 : expect;
    if (nm !== m) { setBlock(x, y, z, b, nm); return; }
    lvl = nm & 7; falling = nm === 8;
  }
  // flow down
  const bl = getBlock(x, y - 1, z);
  if (y > 0 && (bl === 0 || (REPL[bl] && !FLUID[bl]) || bl === other)) {
    if (bl === other) { setBlock(x, y - 1, z, water ? (getMeta(x, y - 1, z) === 0 ? BID.obsidian : BID.cobblestone) : BID.stone); return; }
    if (bl && W.onDrop && !FLUID[bl]) W.onDrop(x, y - 1, z, blockDrops(bl, 0, null).items, 0);
    setBlock(x, y - 1, z, b, 8); return;
  }
  if (bl === b && !(lvl === 0 && !falling)) return;
  const nl = (falling ? 0 : lvl) + drop; if (nl >= 8) return;
  // choose directions towards the nearest drop
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const range = water ? 4 : 2;
  const canFlow = (px, pz) => { const t = getBlock(px, y, pz); return t === 0 || (REPL[t] && !FLUID[t]) || (t === b && getMeta(px, y, pz) !== 0 && (getMeta(px, y, pz) & 7) > nl) || t === other; };
  const dist = dirs.map(([dx, dz]) => {
    if (!canFlow(x + dx, z + dz)) return 99;
    for (let s = 1; s <= range; s++) { const px = x + dx * s, pz = z + dz * s; if (s > 1 && !canFlow(px, pz)) break; const u = getBlock(px, y - 1, pz); if (u === 0 || (REPL[u] && !FLUID[u]) || u === b) return s; }
    return 50;
  });
  const min = Math.min(...dist); if (min >= 99) return;
  dirs.forEach(([dx, dz], k) => {
    if (dist[k] !== min) return;
    const px = x + dx, pz = z + dz, t = getBlock(px, y, pz);
    if (t === other) { setBlock(px, y, pz, water ? (getMeta(px, y, pz) === 0 ? BID.obsidian : BID.cobblestone) : BID.cobblestone); return; }
    if (t && !FLUID[t] && W.onDrop) W.onDrop(px, y, pz, blockDrops(t, 0, null).items, 0);
    setBlock(px, y, pz, b, nl);
  });
}
function fallCheck(x, y, z, b) {
  const below = getBlock(x, y - 1, z);
  if (y > 0 && (below === 0 || FLUID[below] || (REPL[below] && below !== b))) { setBlock(x, y, z, 0); if (W.onFall) W.onFall(x, y, z, b); }
}
function tickScheduled() {
  W.tickN++;
  let n = 0;
  for (const [k, t] of W.sched) {
    if (t > W.tickN) continue;
    W.sched.delete(k);
    const [x, y, z] = k.split(',').map(Number);
    if (isLoaded(x, z)) fluidUpdate(x, y, z);
    if (++n > 160) break;
  }
}
// ---------- random ticks ----------
function lightLevelAbove(x, y, z) { const l = getLight(x, y + 1, z); return Math.max(l & 15, (l >> 4) - skyDarken()); }
function skyDarken() { const d = dayFactor(); return Math.round((1 - d) * 11); }
function celestial() { let a = (((W.time % 24000) + 24000) % 24000) / 24000 - 0.25; if (a < 0) a += 1; const b = 1 - (Math.cos(a * Math.PI) + 1) / 2; return a + (b - a) / 3; }
function dayFactor() { const f = Math.cos(celestial() * Math.PI * 2) * 2 + 0.5; return Math.max(0, Math.min(1, f)) * (1 - W.rain * 0.3); }
function randomTicks(px, pz) {
  const pcx = px >> 4, pcz = pz >> 4, R = 6;
  for (let cx = pcx - R; cx <= pcx + R; cx++) for (let cz = pcz - R; cz <= pcz + R; cz++) {
    const c = chunkAt(cx, cz); if (!c || !meshable(c)) continue; // neighbours must be loaded (leaf decay, spreading)
    for (let s = 0; s < 8; s++) for (let k = 0; k < 3; k++) {
      const r = (Math.random() * 4096) | 0, i = (s << 12) | r, b = c.blocks[i];
      if (!b || !RANDOM_TICK[b]) continue;
      const x = cx * 16 + (i & 15), y = i >> 8, z = cz * 16 + ((i >> 4) & 15);
      RANDOM_TICK[b](x, y, z, b, c.meta[i]);
    }
  }
}
const RANDOM_TICK = [];
RANDOM_TICK[BID.grass_block] = (x, y, z) => {
  const a = getBlock(x, y + 1, z);
  if (LOP[a] >= 2 && OPQ[a]) { setBlock(x, y, z, 3); return; }
  if (lightLevelAbove(x, y, z) >= 9) for (let k = 0; k < 4; k++) {
    const tx = x + ((Math.random() * 3) | 0) - 1, ty = y + ((Math.random() * 5) | 0) - 3, tz = z + ((Math.random() * 3) | 0) - 1;
    if (getBlock(tx, ty, tz) === 3 && !OPQ[getBlock(tx, ty + 1, tz)] && !FLUID[getBlock(tx, ty + 1, tz)] && lightLevelAbove(tx, ty, tz) >= 4) setBlock(tx, ty, tz, 2);
  }
};
const grow = (x, y, z, b, m) => {
  if (lightLevelAbove(x, y - 1, z) < 9) return;
  const below = getBlock(x, y - 1, z), wet = below === BID.farmland && (getMeta(x, y - 1, z) & 7) > 0;
  if (m < 7 && Math.random() < (wet ? 0.33 : 0.14)) setMeta(x, y, z, m + 1);
};
RANDOM_TICK[BID.wheat] = grow;
for (const [sap, type] of [[BID.oak_sapling, 0], [BID.birch_sapling, 2], [BID.spruce_sapling, 3]]) RANDOM_TICK[sap] = (x, y, z, b, m) => {
  if (lightLevelAbove(x, y - 1, z) < 9 || Math.random() > 1 / 7) return;
  if (!m) { setMeta(x, y, z, 1); return; }
  growTreeAt(x, y, z, type);
};
function growTreeAt(x, y, z, type) {
  const h = type === 3 ? 10 : 7;
  for (let k = 1; k <= h; k++) { const t = getBlock(x, y + k, z); if (t && !REPL[t] && !(t >= 22 && t <= 24)) return false; }
  if (y + h + 2 >= CH) return false;
  setBlock(x, y, z, 0, 0, { noUpdate: true });
  S.growTree((wx, wy, wz, id, m, force) => { const cur = getBlock(wx, wy, wz); if (force || cur === 0 || REPL[cur] && !FLUID[cur]) setBlock(wx, wy, wz, id, m, { noUpdate: true }); }, x, y, z, type, Math.random(), false);
  setBlock(x, y - 1, z, 3);
  return true;
}
const stack = (x, y, z, b, m) => {
  if (getBlock(x, y + 1, z) !== 0) return;
  let h = 1; while (getBlock(x, y - h, z) === b) h++;
  if (h >= 3) return;
  if (m >= 15) { setBlock(x, y + 1, z, b, 0); setMeta(x, y, z, 0); } else setMeta(x, y, z, m + 1);
};
RANDOM_TICK[BID.sugar_cane] = stack; RANDOM_TICK[BID.cactus] = stack;
for (const lv of [22, 23, 24]) RANDOM_TICK[lv] = (x, y, z, b, m) => {
  if (m & 1) return;
  // search for a log within 4 blocks through leaves
  const seen = new Set(), q = [[x, y, z, 0]];
  while (q.length) { const [px, py, pz, d] = q.shift(); for (const [dx, dy, dz] of N6) { const nx = px + dx, ny = py + dy, nz = pz + dz, k = nx + ',' + ny + ',' + nz; if (seen.has(k)) continue; seen.add(k); const t = getBlock(nx, ny, nz); if (S.LOGAX[t] && t !== BID.hay_block) return; if (t >= 22 && t <= 24 && d < 4) q.push([nx, ny, nz, d + 1]); } }
  breakNaturally(x, y, z, b, m);
};
RANDOM_TICK[BID.farmland] = (x, y, z, b, m) => {
  let wet = false;
  for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dy = 0; dy <= 1; dy++) if (getBlock(x + dx, y + dy, z + dz) === 27) { wet = true; break; }
  if (wet || W.rain > 0.5) { if (m !== 7) setMeta(x, y, z, 7); }
  else if (m > 0) setMeta(x, y, z, m - 1);
  else if (getBlock(x, y + 1, z) !== BID.wheat) setBlock(x, y, z, 3);
};
for (const id of [63, 64, 65]) RANDOM_TICK[id] = (x, y, z, b) => { if (Math.random() < 0.02) setBlock(x, y, z, BLOCKS[b].oxid); };
RANDOM_TICK[BID.budding_amethyst] = (x, y, z) => { if (Math.random() > 0.2) return; const [dx, dy, dz] = N6[(Math.random() * 6) | 0]; if (getBlock(x + dx, y + dy, z + dz) === 0) setBlock(x + dx, y + dy, z + dz, BID.amethyst_cluster); };
RANDOM_TICK[BID.ice] = (x, y, z) => { if ((getLight(x, y, z) & 15) > 11 || (getLight(x, y + 1, z) & 15) > 11) setBlock(x, y, z, 27); };
RANDOM_TICK[BID.snow] = (x, y, z) => { if ((getLight(x, y, z) & 15) > 11) setBlock(x, y, z, 0); };

// ---------- worker pool ----------
const WORKER_SRC = `const S=(${SHARED.toString()})();(${workerMain.toString()})(S);`;
const workerURL = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
const NWORK = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
const workers = [];
let jobId = 0;
for (let i = 0; i < NWORK; i++) { const w = new Worker(workerURL); w.busy = 0; w.onmessage = e => onWorker(w, e.data); workers.push(w); }
const bufPool = [];
function idleWorker(max) { let best = null; for (const w of workers) if (w.busy < max && (!best || w.busy < best.busy)) best = w; return best; }
function onWorker(w, m) {
  w.busy--;
  handleWorker(m);
  if (W.pump) W.pump(); // keep workers saturated between frames
}
function handleWorker(m) {
  if (m.type === 'gen') {
    const k = ckey(m.cx, m.cz);
    if (W.pending.get(k) !== m.id) return;
    W.pending.delete(k);
    W.inbox.push(m);
  } else if (m.type === 'mesh') {
    bufPool.push([m.B, m.M, m.L]);
    const c = W.chunks.get(ckey(m.cx, m.cz));
    if (!c) return;
    c.meshing = false;
    if (m.ver !== c.ver) return;
    W.meshInbox.push([c, m, m.ver]);
  }
}
function addChunk(cx, cz, d, tiles) {
  const c = new Chunk(cx, cz, d);
  W.chunks.set(c.key, c); W.lastKey = -1;
  const pm = W.pendingMobs.get(c.key); if (pm) { W.pendingMobs.delete(c.key); c.mobs = pm; d.fromSave = true; }
  if (tiles) for (const t of tiles) {
    if (t.t === 'chest') { const items = new Array(27).fill(null); for (const [slot, key, n] of t.loot) if (IID[key] != null) items[slot] = { id: IID[key], n }; c.tiles.set(t.i, { type: 'chest', items }); }
    else if (t.t === 'spawner') c.tiles.set(t.i, { type: 'spawner', mob: t.mob, delay: 200 });
    else if (t.type) c.tiles.set(t.i, t);
  }
  stitchLight(c);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = chunkAt(cx + dx, cz + dz); if (n) n.dirty = true; }
  if (W.onChunkLoaded) W.onChunkLoaded(c, !d.fromSave);
}
function requestGen(cx, cz) {
  const w = idleWorker(2); if (!w) return false; // leave the third slot for meshing
  w.busy++; const id = jobId++; W.pending.set(ckey(cx, cz), id);
  w.postMessage({ type: 'gen', id, seed: W.seed, cx, cz });
  return true;
}
function meshable(c) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!chunkAt(c.cx + dx, c.cz + dz)) return false; return true; }
function requestMesh(c, opts) {
  const w = idleWorker(3); if (!w) return false;
  const PA = S.PA, PH = S.PH, P = bufPool.pop() || [new Uint8Array(PA * PH), new Uint8Array(PA * PH), new Uint8Array(PA * PH)];
  const [B, M, L] = P, bio = new Uint8Array(PA);
  B.fill(8, 0, PA); L.fill(0, 0, PA); B.fill(0, (PH - 1) * PA); L.fill(0xf0, (PH - 1) * PA); // floor below y=0 and open sky above
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const n = chunkAt(c.cx + dx, c.cz + dz);
    const xa = dx < 0 ? 15 : 0, xb = dx > 0 ? 0 : 15, za = dz < 0 ? 15 : 0, zb = dz > 0 ? 0 : 15;
    const ox = dx * 16, oz = dz * 16;
    for (let z = za; z <= zb; z++) {
      const pz = z + oz + 1; for (let x = xa; x <= xb; x++) bio[pz * 18 + x + ox + 1] = n.biome[z * 16 + x];
      if (xa === 0 && xb === 15) {
        for (let y = 0; y < CH; y++) { const si = (y << 8) | (z << 4), di = (y + 1) * PA + pz * 18 + 1; B.set(n.blocks.subarray(si, si + 16), di); M.set(n.meta.subarray(si, si + 16), di); L.set(n.light.subarray(si, si + 16), di); }
      } else {
        const x = xa, di0 = pz * 18 + x + ox + 1;
        for (let y = 0; y < CH; y++) { const si = (y << 8) | (z << 4) | x, di = (y + 1) * PA + di0; B[di] = n.blocks[si]; M[di] = n.meta[si]; L[di] = n.light[si]; }
      }
    }
  }
  w.busy++; c.meshing = true; c.dirty = false; c.ver++;
  w.postMessage({ type: 'mesh', id: jobId++, cx: c.cx, cz: c.cz, ver: c.ver, B, M, L, bio, opts }, [B.buffer, M.buffer, L.buffer, bio.buffer]);
  return true;
}

// ---------- persistence (IndexedDB) ----------
const DB = { db: null };
function dbOpen() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('nemo-mc-117', 1);
      rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains('worlds')) d.createObjectStore('worlds', { keyPath: 'id' }); if (!d.objectStoreNames.contains('chunks')) d.createObjectStore('chunks'); };
      rq.onsuccess = () => { DB.db = rq.result; res(DB.db); };
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function dbReq(store, mode, fn) {
  return new Promise(res => {
    if (!DB.db) return res(null);
    try { const tx = DB.db.transaction(store, mode), st = tx.objectStore(store); const r = fn(st); tx.oncomplete = () => res(r && r.result !== undefined ? r.result : true); tx.onerror = () => res(null); }
    catch (e) { res(null); }
  });
}
const listWorlds = () => dbReq('worlds', 'readonly', st => st.getAll());
const putWorld = w => dbReq('worlds', 'readwrite', st => st.put(w));
async function deleteWorld(id) {
  await dbReq('worlds', 'readwrite', st => st.delete(id));
  await dbReq('chunks', 'readwrite', st => st.delete(IDBKeyRange.bound(id + ':', id + ':￿')));
}
async function loadSavedKeys(id) { const keys = await dbReq('chunks', 'readonly', st => st.getAllKeys(IDBKeyRange.bound(id + ':', id + ':￿'))); W.saved = new Set((keys || []).map(k => k.slice(id.length + 1))); }
function serTiles(c) { const a = []; for (const [i, t] of c.tiles) a.push([i, t]); return a; }
// run-length encoding: chunk arrays are mostly long runs (air, stone, sky light)
function rleEnc(a) {
  const out = new Uint8Array(a.length * 2); let n = 0;
  for (let i = 0; i < a.length;) { const v = a[i]; let r = 1; while (r < 255 && i + r < a.length && a[i + r] === v) r++; out[n++] = r; out[n++] = v; i += r; }
  return out.slice(0, n);
}
function rleDec(b, len) { const a = new Uint8Array(len); let p = 0; for (let i = 0; i < b.length; i += 2) { a.fill(b[i + 1], p, p + b[i]); p += b[i]; } return a; }
function saveChunk(c) {
  if (!c.modified || W.pano) return; c.modified = false;
  const k = c.cx + ',' + c.cz; W.saved.add(k);
  // untouched terrain is regenerated from the seed; only its animals are stored
  const rec = c.edited ? { v: 2, b: rleEnc(c.blocks), m: rleEnc(c.meta), l: rleEnc(c.light), bio: c.biome.slice(), t: serTiles(c), mobs: c.mobs || null } : { v: 2, mobs: c.mobs || null };
  dbReq('chunks', 'readwrite', st => st.put(rec, W.id + ':' + k));
}
async function loadChunk(cx, cz) {
  const key = ckey(cx, cz); W.pending.set(key, 'load');
  const wid = W.id;
  const rec = await dbReq('chunks', 'readonly', st => st.get(wid + ':' + cx + ',' + cz));
  if (W.pending.get(key) !== 'load' || wid !== W.id) return;
  W.pending.delete(key);
  if (!rec || !rec.b) { W.saved.delete(cx + ',' + cz); if (rec && rec.mobs) W.pendingMobs.set(key, rec.mobs); return; }
  const dec = a => rec.v === 2 ? rleDec(a, CVOL) : a;
  W.inbox.push({ cx, cz, blocks: dec(rec.b), meta: dec(rec.m), light: dec(rec.l), biome: rec.bio, mobs: rec.mobs, fromSave: true, tileList: rec.t || [] });
}
function unloadChunk(c) {
  saveChunk(c);
  if (W.onChunkUnloaded) W.onChunkUnloaded(c);
  W.chunks.delete(c.key); W.lastKey = -1;
}
// streaming: called every frame with player chunk position
let spiral = null, spiralR = -1;
function buildSpiral(r) { const a = []; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= (r + 0.5) * (r + 0.5)) a.push([dx, dz, dx * dx + dz * dz]); a.sort((p, q) => p[2] - q[2]); return a; }
function streamChunks(px, pz, rd, meshOpts, budget) {
  const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4, r = rd + 1;
  if (spiralR !== r) { spiral = buildSpiral(r); spiralR = r; }
  // meshing first (nearest first): visible chunks beat far terrain generation
  let sent = 0;
  for (const [dx, dz] of spiral) {
    if (dx * dx + dz * dz > rd * rd + rd) continue;
    const c = chunkAt(pcx + dx, pcz + dz);
    if (!c || !c.dirty || c.meshing || !meshable(c)) continue;
    if (!requestMesh(c, meshOpts)) break;
    if (++sent >= budget) break;
  }
  let reqs = 0;
  for (const [dx, dz] of spiral) {
    const cx = pcx + dx, cz = pcz + dz, k = ckey(cx, cz);
    if (W.chunks.has(k) || W.pending.has(k)) continue;
    if (W.saved.has(cx + ',' + cz)) { loadChunk(cx, cz); if (++reqs > 4) break; continue; }
    if (!requestGen(cx, cz)) break;
  }
  // unload far chunks
  const lim = r + 2;
  for (const c of W.chunks.values()) if (Math.abs(c.cx - pcx) > lim || Math.abs(c.cz - pcz) > lim) unloadChunk(c);
}
// apply finished worker jobs within a time budget so frames stay smooth
function processInbox(budgetMs, maxMeshes) {
  const t0 = performance.now(); let uploads = 0;
  while (W.meshInbox.length && uploads < maxMeshes) {
    const [c, m, ver] = W.meshInbox.shift();
    if (W.chunks.get(c.key) === c && ver === c.ver && W.onMesh) { W.onMesh(c, m); uploads++; }
    if (performance.now() - t0 > budgetMs) return;
  }
  while (W.inbox.length) {
    const m = W.inbox.shift();
    if (!W.chunks.has(ckey(m.cx, m.cz))) { addChunk(m.cx, m.cz, m, m.tiles); if (m.tileList) { const ch = chunkAt(m.cx, m.cz); for (const [i, t] of m.tileList) ch.tiles.set(i, t); } }
    if (performance.now() - t0 > budgetMs) return;
  }
}
function resetWorld() {
  for (const c of W.chunks.values()) if (W.onChunkUnloaded) W.onChunkUnloaded(c);
  W.chunks.clear(); W.pending.clear(); W.pendingMobs.clear(); W.inbox.length = 0; W.meshInbox.length = 0; W.sched.clear(); W.lastKey = -1; W.saved = new Set();
}

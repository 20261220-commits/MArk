// World: chunk storage/streaming, cross-chunk lighting, block updates, fluids,
// random ticks and IndexedDB persistence.
const { OPQ, LOP, LEM, SOLID, FLUID, REPL, RTYPE, DIRS, CVOL } = S; // (MINY, MAXY: items.js)
// a block's place in a chunk's arrays: rows are world y - MINY (the 1.18 world starts at y -64)
const BI = (x, y, z) => ((y - MINY) << 8) | ((z & 15) << 4) | (x & 15);
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

class Chunk {
  constructor(cx, cz, d) {
    this.cx = cx; this.cz = cz; this.key = ckey(cx, cz);
    this.blocks = d.blocks; this.meta = d.meta; this.light = d.light; this.biome = d.biome;
    this.tiles = new Map(); this.modified = false; this.dirty = true; this.ver = 0; this.meshing = false; this.mesh = null;
    this.mobs = d.mobs || null; this.edited = !!d.fromSave; // edited: blocks differ from generated terrain
    let y = CH - 1; scan: for (; y > 0; y--) { const o = y << 8; for (let i = 0; i < 256; i++) if (this.blocks[o + i]) break scan; }
    this.maxY = y; // highest non-air row (array row, y - MINY): meshing and random ticks skip the empty sky above
  }
}

const W = {
  seed: 0, id: '', dim: 0, verSeq: 0, chunks: new Map(), time: 1000, rain: 0, rainTarget: 0, rainTimer: 12000,
  last: null, lastKey: -1,
  saved: new Set(), pending: new Map(), inbox: [], meshInbox: [], pendingMobs: new Map(), // pending: key -> job id | 'load'
  sched: new Map(), tickN: 0,
  onDrop: null, onFall: null, onBlockChanged: null, onChunkLoaded: null, onChunkUnloaded: null,
};
const DIM_PREFIX = { 0: '', '-1': 'n', 1: 'e' };
const dkey = (cx, cz) => DIM_PREFIX[W.dim] + cx + ',' + cz; // save key of a chunk in the current dimension
function chunkAt(cx, cz) {
  const k = ckey(cx, cz); if (k === W.lastKey) return W.last;
  const c = W.chunks.get(k); if (c) { W.last = c; W.lastKey = k; } return c;
}
function getBlock(x, y, z) {
  if (y < MINY) return 8; if (y >= MAXY) return 0;
  const c = chunkAt(x >> 4, z >> 4); if (!c) return 0;
  return c.blocks[BI(x, y, z)];
}
function getMeta(x, y, z) { if (y < MINY || y >= MAXY) return 0; const c = chunkAt(x >> 4, z >> 4); return c ? c.meta[BI(x, y, z)] : 0; }
function getLight(x, y, z) { if (y >= MAXY) return 0xf0; if (y < MINY) return 0; const c = chunkAt(x >> 4, z >> 4); return c ? c.light[BI(x, y, z)] : 0xf0; }
function isLoaded(x, z) { return !!chunkAt(x >> 4, z >> 4); }
function biomeAt(x, z) { const c = chunkAt(x >> 4, z >> 4); return c ? c.biome[((z & 15) << 4) | (x & 15)] : 1; }
const biomeBase = (x, z) => S.BB[biomeAt(x, z)]; // the base biome of a 1.17 variant (taiga hills -> taiga), for spawning rules
// the void: things below this die (Java: 64 below the bottom of the world; the Nether and the End start at y 0)
const voidY = () => Math.min(MINY, 0) - 64;
function topY(x, z) { for (let y = MAXY - 1; y > MINY; y--) { const b = getBlock(x, y, z); if (b && LOP[b] > 0) return y; } return MINY; }
function markDirty(x, z) {
  const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
  const m = (a, b) => { const c = chunkAt(a, b); if (c) c.dirty = c.urgent = true; }; // edits are remeshed first, on their own worker
  m(cx, cz);
  if (lx === 0) m(cx - 1, cz); else if (lx === 15) m(cx + 1, cz);
  if (lz === 0) m(cx, cz - 1); else if (lz === 15) m(cx, cz + 1);
  if ((lx === 0 || lx === 15) && (lz === 0 || lz === 15)) m(cx + (lx ? 1 : -1), cz + (lz ? 1 : -1));
}

// ---------- lighting across chunks ----------
function lightAdd(seeds, sh, flat) {
  // seeds: array of [x,y,z], or a flat [x,y,z,x,y,z...] list when flat is set
  let q; if (flat) q = seeds; else { q = []; for (const s of seeds) q.push(s[0], s[1], s[2]); }
  let h = 0;
  while (h < q.length) {
    const x = q[h], y = q[h + 1], z = q[h + 2]; h += 3;
    const c = chunkAt(x >> 4, z >> 4); if (!c) continue;
    const l = (c.light[BI(x, y, z)] >> sh) & 15; if (l <= 1) continue;
    for (let k = 0; k < 6; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0), nz = z + (k === 4 ? 1 : k === 5 ? -1 : 0);
      if (ny < MINY || ny >= MAXY) continue;
      const nc = chunkAt(nx >> 4, nz >> 4); if (!nc) continue;
      const ni = BI(nx, ny, nz), op = LOP[nc.blocks[ni]];
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
  const i = BI(x, y, z);
  const old = (c.light[i] >> sh) & 15;
  c.light[i] = sh ? c.light[i] & 0x0f : c.light[i] & 0xf0;
  const q = [x, y, z, old], re = [];
  let h = 0;
  while (h < q.length) {
    const px = q[h], py = q[h + 1], pz = q[h + 2], l = q[h + 3]; h += 4;
    for (let k = 0; k < 6; k++) {
      const nx = px + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = py + (k === 2 ? 1 : k === 3 ? -1 : 0), nz = pz + (k === 4 ? 1 : k === 5 ? -1 : 0);
      if (ny < MINY || ny >= MAXY) continue;
      const nc = chunkAt(nx >> 4, nz >> 4); if (!nc) continue;
      const ni = BI(nx, ny, nz), nl = (nc.light[ni] >> sh) & 15;
      if (nl && (nl < l || (sh && k === 3 && l === 15 && nl === 15))) {
        nc.light[ni] = sh ? nc.light[ni] & 0x0f : nc.light[ni] & 0xf0; markDirty(nx, nz);
        q.push(nx, ny, nz, nl);
        const e = sh ? 0 : S.emitOf(nc.blocks[ni], nc.meta[ni]); if (e) { nc.light[ni] |= e; re.push([nx, ny, nz]); } // a dimmer light source in the dark wave keeps its own glow
      } else if (nl >= l) re.push([nx, ny, nz]);
    }
  }
  markDirty(x, z);
  return re;
}
function relight(x, y, z, oldId, newId, oldE = LEM[oldId], newE = LEM[newId]) {
  // block light (emission can depend on meta: lit candles)
  if (oldE || newE || LOP[oldId] !== LOP[newId]) {
    const re = lightRemove(x, y, z, 0);
    const c = chunkAt(x >> 4, z >> 4), i = BI(x, y, z);
    if (newE) { c.light[i] = (c.light[i] & 0xf0) | newE; re.push([x, y, z]); }
    else if (LOP[newId] < 15) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) re.push([x + dx, y + dy, z + dz]);
    lightAdd(re, 0);
  }
  if (LOP[oldId] !== LOP[newId]) {
    const re = lightRemove(x, y, z, 4);
    if (LOP[newId] < 15) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) re.push([x + dx, y + dy, z + dz]);
      if (y === MAXY - 1) { const c = chunkAt(x >> 4, z >> 4); const i = BI(x, y, z); c.light[i] |= 0xf0; re.push([x, y, z]); }
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
        for (let r = 0, top = Math.min(CH - 1, Math.max(c.maxY, n.maxY) + 1); r <= top; r++) { // array rows; the seeds are world y
          const la = (c.light[(r << 8) | (az << 4) | ax] >> sh) & 15, lb = (n.light[(r << 8) | (bz << 4) | bx] >> sh) & 15;
          if (la > lb + 1) seeds.push(x0 + ax, r + MINY, z0 + az);
          else if (lb > la + 1) seeds.push((c.cx + dx) * 16 + bx, r + MINY, (c.cz + dz) * 16 + bz);
        }
      }
    }
    if (seeds.length) lightAdd(seeds, sh, true);
  }
}

// ---------- block set & updates ----------
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function setBlock(x, y, z, id, meta = 0, opts = {}) {
  if (y < MINY || y >= MAXY) return false;
  const c = chunkAt(x >> 4, z >> 4); if (!c) return false;
  const i = BI(x, y, z), old = c.blocks[i], oldM = c.meta[i];
  if (!id && S.isWet(old, oldM) && !opts.dry) id = 27; // breaking a waterlogged block leaves its water behind
  if (old === id && oldM === meta) return false;
  c.blocks[i] = id; c.meta[i] = meta; c.modified = c.edited = true;
  if (MP.on && (MP.role === 'host' || (MP.local && !MP.applying))) mpBlockChanged(x, y, z, id, meta); // multiplayer: the host's world (and what a guest did) reaches the others
  if (id && y - MINY > c.maxY) c.maxY = y - MINY;
  if (old !== id && c.tiles.has(i) && !opts.keepTile) { const t = c.tiles.get(i); c.tiles.delete(i); if (W.onTileRemoved) W.onTileRemoved(x, y, z, t); }
  if (id === BID.oak_sign && !c.tiles.has(i)) c.tiles.set(i, { type: 'sign', lines: ['', '', '', ''] });
  const oe = S.emitOf(old, oldM), ne = S.emitOf(id, meta);
  if (old !== id || oe !== ne) relight(x, y, z, old, id, oe, ne);
  markDirty(x, z);
  if ((old === BID.chain || id === BID.chain) && typeof rodTrack === 'function') rodTrack(x, y, z, S.isRod(id, meta));
  if (old !== id && (TRACKED.has(old) || TRACKED.has(id))) { const k = x + ',' + y + ',' + z; if (TRACKED.has(old)) TRACKED.get(old).delete(k); if (TRACKED.has(id)) TRACKED.get(id).add(k); }
  if (W.onBlockChanged) W.onBlockChanged(x, y, z, old, id);
  if (!opts.noUpdate) {
    neighborUpdate(x, y, z); for (const [dx, dy, dz] of N6) neighborUpdate(x + dx, y + dy, z + dz);
    if ((BLOCKS[old] && BLOCKS[old].rs) || (BLOCKS[id] && BLOCKS[id].rs)) rsNotify(x, y, z);
    observerCheck(x, y, z);
  }
  return true;
}
function setMeta(x, y, z, meta) { const c = chunkAt(x >> 4, z >> 4); if (!c || y < MINY || y >= MAXY) return; const i = BI(x, y, z); if (c.meta[i] === meta) return; const id = c.blocks[i], oe = S.emitOf(id, c.meta[i]); c.meta[i] = meta; c.modified = c.edited = true; if (MP.on && (MP.role === 'host' || (MP.local && !MP.applying))) mpBlockChanged(x, y, z, id, meta, true); markDirty(x, z); const ne = S.emitOf(id, meta); if (oe !== ne) relight(x, y, z, id, id, oe, ne); if (c.blocks[i] !== BID.redstone_wire) observerCheck(x, y, z); }
// an observer facing (x,y,z) fires a short pulse whenever that block changes
function observerCheck(x, y, z) {
  for (let k = 0; k < 6; k++) { const d = S.DIR6[k], ox = x - d[0], oy = y - d[1], oz = z - d[2]; if (getBlock(ox, oy, oz) === BID.observer && (getMeta(ox, oy, oz) & 7) === k && typeof observerFire === 'function') observerFire(ox, oy, oz); }
}
function getTile(x, y, z) { const c = chunkAt(x >> 4, z >> 4); return c ? c.tiles.get(BI(x, y, z)) : null; }
function setTile(x, y, z, t) { const c = chunkAt(x >> 4, z >> 4); if (!c) return; c.tiles.set(BI(x, y, z), t); c.modified = c.edited = true; if (t.type === 'furnace' || t.type === 'brewing' || t.type === 'campfire') c.hasFurnace = true; c.noTicking = false; }
function schedule(x, y, z, delay) { const k = x + ',' + y + ',' + z; if (!W.sched.has(k)) W.sched.set(k, W.tickN + delay); }
// support rules of the 1.17 lush-cave plants (plant codes 10+)
const LUSH_SOIL = new Set([2, 3, 53, 57, 87, 203, 204, 205, 1049]); // grass, dirt, clay, farmland, moss, podzol, mycelium, coarse dirt, rooted dirt
function plantOK(b, x, y, z, m) {
  const below = getBlock(x, y - 1, z), above = getBlock(x, y + 1, z);
  switch (BLOCKS[b].plant) {
    case 10: return LUSH_SOIL.has(below); // azaleas
    case 11: return OPQ[above] || above === b; // hangs from the ceiling: cave vines, spore blossom, hanging roots
    case 12: { // big dripleaf: stems stand on soil or another stem; a stem needs more dripleaf above
      const base = below === BID.big_dripleaf_stem || LUSH_SOIL.has(below);
      return b === BID.big_dripleaf_stem ? base && (above === BID.big_dripleaf_stem || above === BID.big_dripleaf) : base;
    }
    case 13: return m & 8 ? below === b : (below === BID.clay || below === BID.moss_block) && above === b; // small dripleaf: two blocks tall
    case 14: return below !== 0; // moss carpet
    case 15: return OPQ[below] || below === BID.kelp_plant || below === BID.kelp; // kelp
    case 16: return OPQ[below]; // seagrass
    case 17: return m & 8 ? below === b : OPQ[below] && above === b; // tall seagrass
    case 18: return supportedBy(below); // corals, fans, sea pickles
    case 19: return below === BID.bamboo || BAMBOO_SOIL.has(below); // bamboo
    case 20: return m & 8 ? below === b : (below === BID.grass_block || below === BID.dirt || below === BID.podzol) && above === b; // tall flowers
    default: if (typeof plant6OK === 'function') return plant6OK(b, x, y, z, m, below, above);
  }
  return true;
}
const supportedBy = id => OPQ[id] || id === BID.farmland || (RTYPE[id] === RT.BOX && id !== BID.snow && id !== BID.ladder && id !== BID.lantern && id !== BID.soul_lantern && id !== BID.vine) || id === BID.glass || S.LEAF[id] || id === BID.stained_glass;
function breakNaturally(x, y, z, b, m) {
  setBlock(x, y, z, 0, 0);
  if (W.onDrop) { const d = blockDrops(b, m, null); W.onDrop(x, y, z, d.items, 0); }
}
function neighborUpdate(x, y, z) {
  if (y < MINY || y >= MAXY) return;
  const b = getBlock(x, y, z); if (!b) return;
  const m = getMeta(x, y, z), below = getBlock(x, y - 1, z), d = BLOCKS[b];
  if (FLUID[b]) { schedule(x, y, z, b === 27 ? 5 : W.dim === -1 ? 10 : 30); return; }
  if (d.fall) { if (below === 0 || FLUID[below] || (REPL[below] && below !== b)) schedule(x, y, z, 2); return; }
  if (d.plant) {
    let ok = true;
    if (d.plant >= 10) ok = plantOK(b, x, y, z, m);
    else if (d.plant === 1) ok = below === 2 || below === 3 || below === BID.farmland || below === BID.moss_block;
    else if (d.plant === 2) ok = below === 9 || below === 3 || below === 2 || below === BID.red_sand || below === BID.terracotta || below === BID.stained_terracotta || below === BID.podzol || below === BID.coarse_dirt; // dead bush
    else if (d.plant === 3) { ok = below === b || ((below === 2 || below === 3 || below === 9 || below === BID.red_sand || below === BID.podzol || below === BID.coarse_dirt || below === BID.moss_block || below === BID.rooted_dirt) && N6.some(([dx, dy, dz]) => !dy && getBlock(x + dx, y - 1, z + dz) === 27)); }
    else if (d.plant === 4) { ok = (below === b || below === 9 || below === BID.red_sand) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => SOLID[getBlock(x + dx, y, z + dz)]); }
    else if (d.plant === 5) {
      ok = below === BID.farmland;
      if (ok && b === BID.stem && (m & 16)) { const dd = DIRS[(m >> 5) & 3]; if (getBlock(x + dd[0], y, z + dd[2]) !== (m & 8 ? BID.melon : BID.pumpkin)) setMeta(x, y, z, (m & 8) | 7); } // the fruit was taken
    }
    else if (d.plant === 6) ok = OPQ[below];
    else if (d.plant === 7) ok = OPQ[below] || below === BID.soul_sand;
    else if (d.plant === 8) ok = below === BID.soul_sand;
    else if (d.plant === 9) ok = below === 27;
    if (!ok) breakNaturally(x, y, z, b, m);
    return;
  }
  if (b === BID.torch || b === BID.soul_torch) { const sup = m >= 1 && m <= 4 ? getBlock(x + DIRS[m - 1][0], y, z + DIRS[m - 1][2]) : below; if (!OPQ[sup] && !(m === 0 && supportedBy(sup))) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.ladder) { const f = m & 3; if (!OPQ[getBlock(x + DIRS[f][0], y, z + DIRS[f][2])]) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.snow) { if (!OPQ[below] && !S.LEAF[below]) setBlock(x, y, z, 0); return; }
  if (S.DOOR[b]) { const up = m & 8, other = getBlock(x, y + (up ? -1 : 1), z); if (other !== b) setBlock(x, y, z, 0); else if (!up && !supportedBy(below)) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.red_bed) { const f = m & 3, dir = DIRS[f], s = (m & 4) ? -1 : 1; if (getBlock(x + dir[0] * s, y, z + dir[2] * s) !== b) setBlock(x, y, z, 0); return; }
  if (b === BID.farmland && SOLID[getBlock(x, y + 1, z)] && RTYPE[getBlock(x, y + 1, z)] === RT.CUBE) { setBlock(x, y, z, 3); return; }
  if (b === BID.dirt_path && SOLID[getBlock(x, y + 1, z)] && !FLUID[getBlock(x, y + 1, z)] && RTYPE[getBlock(x, y + 1, z)] !== RT.CROSS) { setBlock(x, y, z, 3); if (W.onPathToDirt) W.onPathToDirt(x, y, z); return; } // a solid block on a path turns it to dirt
  // pointed dripstone: meta 0 hangs (needs the block above), meta 1 stands (needs the block below); an unsupported stalactite falls
  if (b === BID.pointed_dripstone) {
    if (m === 0) { const up = getBlock(x, y + 1, z); if (!OPQ[up] && !(up === b && getMeta(x, y + 1, z) === 0)) { setBlock(x, y, z, 0); if (W.onFall) W.onFall(x, y, z, b, m); } }
    else if (!OPQ[below] && !(below === b && getMeta(x, y - 1, z) === 1)) breakNaturally(x, y, z, b, m);
    return;
  }
  if ((b === 198 || b === 246) && S.candleOf(b, m)) { if (!supportedBy(below) || FLUID[getBlock(x, y + 1, z)] === 2) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.bell) { if (!bellSupported(x, y, z, m)) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.banner && !SOLID[below]) { setBlock(x, y, z, 0); return; }
  if (b === BID.wall_banner) { const d = DIRS[(m >> 4) & 3]; if (!SOLID[getBlock(x - d[0], y, z - d[2])]) setBlock(x, y, z, 0); return; }
  if (S.BUD[b]) { // buds and clusters need the block they grow from (old saves without a facing: any side)
    if (m) { const d = S.DIR6[m - 1]; if (!OPQ[getBlock(x - d[0], y - d[1], z - d[2])]) breakNaturally(x, y, z, b, m); }
    else if (!N6.some(([dx, dy, dz]) => OPQ[getBlock(x + dx, y + dy, z + dz)])) breakNaturally(x, y, z, b, m);
    return;
  }
  if (b === BID.concrete_powder) { if (N6.some(([dx, dy, dz]) => dy !== -1 && getBlock(x + dx, y + dy, z + dz) === 27)) setBlock(x, y, z, BID.concrete, m); else if (below === 0 || FLUID[below] || REPL[below]) schedule(x, y, z, 2); return; }
  if (b === BID.glow_lichen || b === BID.vine) { const [dx, dy, dz] = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][m % 6]; if (!OPQ[getBlock(x + dx, y + dy, z + dz)]) setBlock(x, y, z, 0); return; }
  if (b === BID.lantern || b === BID.soul_lantern) { const sup = m & 1 ? getBlock(x, y + 1, z) : below; if (!SOLID[sup]) breakNaturally(x, y, z, b, m); return; }
  if (b === BID.tnt && W.onTntCheck) W.onTntCheck(x, y, z);
  if (b === BID.nether_portal) { if (!portalIntact(x, y, z)) setBlock(x, y, z, 0); return; }
  if (b === BID.fire) { if (!SOLID[below]) setBlock(x, y, z, 0); return; }
  if ((b === BID.tripwire || b === BID.flower_pot) && !supportedBy(below)) { breakNaturally(x, y, z, b, m); return; }
  if (b === BID.tripwire_hook_block) { const [ax, , az] = DIRS[m & 3]; if (!OPQ[getBlock(x - ax, y, z - az)]) { breakNaturally(x, y, z, b, m); return; } }
  if (d.rail && !supportedBy(below)) { breakNaturally(x, y, z, b, m); return; }
  if (d.connect) updateConnections(x, y, z, b);
  if (d.rs || S.DOOR[b] || b === BID.tnt || b === BID.oak_trapdoor) {
    if (d.rs === 'torch' || d.rs === 'lever' || d.rs === 'button') { const a = d.rs === 'torch' ? torchAttach(x, y, z, m) : switchAttach(x, y, z, m); if (!SOLID[getBlock(a[0], a[1], a[2])] && !(d.rs === 'torch' && m === 0 && supportedBy(getBlock(a[0], a[1], a[2])))) { breakNaturally(x, y, z, b, m); rsNotify(x, y, z); return; } }
    else if ((d.rs === 'wire' || d.rs === 'repeater' || d.rs === 'plate') && !supportedBy(below)) { breakNaturally(x, y, z, b, m); rsNotify(x, y, z); return; }
    else if (d.rs === 'head') { const f = m & 7, bk = S.DIR6[f]; const base = getBlock(x - bk[0], y - bk[1], z - bk[2]); if (base !== BID.piston && base !== BID.sticky_piston) { setBlock(x, y, z, 0); return; } }
    else if (d.rs === 'piston' && (m & 8)) { const f = m & 7, fw = S.DIR6[f]; if (getBlock(x + fw[0], y + fw[1], z + fw[2]) !== BID.piston_head) setMeta(x, y, z, m & ~8); }
    rsMark(x, y, z);
  }
  // any block change can reroute dust next to it
  for (const [dx, dy, dz] of N6) if (getBlock(x + dx, y + dy, z + dz) === BID.redstone_wire) { rsMark(x + dx, y + dy, z + dz); break; }
}
// changes made while this world was open to others, kept beside chunks that weren't stored again (see mpcore.js)
async function applyMpLog(c) {
  const dk = dkey(c.cx, c.cz), key = 'mplog:' + W.id + ':' + dk, wid = W.id; W.mpLogs.delete(dk);
  const lg = await dbReq('chunks', 'readonly', st => st.get(key)); if (!lg || typeof lg !== 'object' || wid !== W.id || W.chunks.get(c.key) !== c) return;
  for (const [x, y, z, id, m, mo] of lg.edits || []) { if (mo && getBlock(x, y, z) === id) setMeta(x, y, z, m); else setBlock(x, y, z, id, m, { noUpdate: true, keepTile: true }); }
  for (const i in lg.tiles || {}) c.tiles.set(+i, lg.tiles[i]);
  c.modified = c.edited = true; saveChunk(c, false, true); dbReq('chunks', 'readwrite', st => st.delete(key));
}
// fences and panes store their N/E/S/W connections in meta (like block states)
function updateConnections(x, y, z, b) {
  const kind = BLOCKS[b].connect; let m = 0;
  [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dz], i) => { if (S.connectsTo(kind, getBlock(x + dx, y, z + dz), getMeta(x + dx, y, z + dz), dx)) m |= 1 << i; });
  setMeta(x, y, z, (getMeta(x, y, z) & 0xf0) | m); // material bits above the connections stay
}
// a chunk generated on its own can't see its neighbours: fences, walls and panes along its edges are joined to the
// neighbouring chunk's once both are here (straight into the arrays: every player works out the same, nothing to save)
// a sign is drawn from its tile (text, wood): give one to every sign that came without (structures, commands)
function signTiles(c) {
  const id = BID.oak_sign, b = c.blocks; if (id == null) return;
  for (let i = 0; i < b.length; i++) if (b[i] === id && !c.tiles.has(i)) c.tiles.set(i, { type: 'sign', lines: ['', '', '', ''] });
}
function joinConnections(c) {
  for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const n = chunkAt(c.cx + ox, c.cz + oz); if (!n) continue;
    for (const [ch, edgeX, edgeZ, dx, dz] of [[c, ox < 0 ? 0 : ox > 0 ? 15 : -1, oz < 0 ? 0 : oz > 0 ? 15 : -1, ox, oz], [n, ox < 0 ? 15 : ox > 0 ? 0 : -1, oz < 0 ? 15 : oz > 0 ? 0 : -1, -ox, -oz]]) {
      const top = Math.min(CH - 1, Math.max(ch.maxY || 0, 0) + 1); let touched = false;
      for (let k = 0; k < 16; k++) { const lx = edgeX >= 0 ? edgeX : k, lz = edgeZ >= 0 ? edgeZ : k;
        for (let r = 1; r <= top; r++) { const i = (r << 8) | (lz << 4) | lx, b = ch.blocks[i], kind = BLOCKS[b] && BLOCKS[b].connect; if (!kind) continue;
          const y = r + MINY, wx = ch.cx * 16 + lx, wz = ch.cz * 16 + lz, bit = dz < 0 ? 1 : dx > 0 ? 2 : dz > 0 ? 4 : 8, on = S.connectsTo(kind, getBlock(wx + dx, y, wz + dz), getMeta(wx + dx, y, wz + dz), dx);
          const m = ch.meta[i], nm = on ? m | bit : m & ~bit; if (nm !== m) { ch.meta[i] = nm; touched = true; } } }
      if (touched) ch.dirty = true;
    }
  }
}
// ---------- fluids ----------
// blocks that some system needs to find quickly (sculk sensors, beacons): block id -> Set of "x,y,z" in loaded chunks
const TRACKED = new Map();
function trackBlocks(id) { if (!TRACKED.has(id)) TRACKED.set(id, new Set()); return TRACKED.get(id); }
const SCHED_TICK = []; // scheduled block ticks of non-fluid blocks (big dripleaf tilting)
function fluidUpdate(x, y, z) {
  const b = getBlock(x, y, z); if (!FLUID[b]) { if (SCHED_TICK[b]) { SCHED_TICK[b](x, y, z, b, getMeta(x, y, z)); return; } const d = BLOCKS[b]; if (d && d.fall) fallCheck(x, y, z, b); return; }
  const water = b === 27, drop = water || W.dim === -1 ? 1 : 2, m = getMeta(x, y, z); // lava runs 7 blocks in the Nether, 3 elsewhere
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
    if (expect >= 8 && above !== b) { setBlock(x, y, z, 0); return; } // only fluid right above makes falling (level 8): a flow's last block must dry up, not turn into a new source
    const nm = expect === 8 ? 8 : expect;
    if (nm !== m) { setBlock(x, y, z, b, nm); return; }
    lvl = nm & 7; falling = nm === 8;
  }
  // flow down
  const bl = getBlock(x, y - 1, z);
  if (y > MINY && (bl === 0 || (REPL[bl] && !FLUID[bl]) || bl === other)) {
    if (bl === other) { setBlock(x, y - 1, z, water ? (getMeta(x, y - 1, z) === 0 ? BID.obsidian : BID.cobblestone) : BID.stone); return; }
    if (bl && W.onDrop && !FLUID[bl]) W.onDrop(x, y - 1, z, blockDrops(bl, 0, null).items, 0);
    setBlock(x, y - 1, z, b, 8); return;
  }
  if (bl === b && (getMeta(x, y - 1, z) !== 0 || !(lvl === 0 && !falling))) { if (getMeta(x, y - 1, z) !== 8 && getMeta(x, y - 1, z) !== 0) setBlock(x, y - 1, z, b, 8); return; } // over flowing fluid it pours down; only still fluid below lets it spread
  const nl = (falling ? 0 : lvl) + drop; if (nl >= 8) return;
  // choose directions towards the nearest drop
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const range = water || W.dim === -1 ? 4 : 2;
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
  if (y > MINY && (below === 0 || FLUID[below] || (REPL[below] && below !== b))) { const m = getMeta(x, y, z); setBlock(x, y, z, 0); if (W.onFall) W.onFall(x, y, z, b, m); }
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
function dayFactor() { const f = Math.cos(celestial() * Math.PI * 2) * 2 + 0.5; return Math.max(0, Math.min(1, f)) * (1 - W.rain * 0.3) * (1 - (W.thunder || 0) * 0.3); }
function randomTicks(px, pz) {
  const pcx = px >> 4, pcz = pz >> 4, R = 6;
  for (let cx = pcx - R; cx <= pcx + R; cx++) for (let cz = pcz - R; cz <= pcz + R; cz++) {
    const c = chunkAt(cx, cz); if (!c || !meshable(c)) continue; // neighbours must be loaded (leaf decay, spreading)
    for (let s = 0, ns = (c.maxY >> 4) + 1, rts = gr('randomTickSpeed'); s < ns; s++) for (let k = 0; k < rts; k++) { // only sections that contain blocks
      const r = (Math.random() * 4096) | 0, i = (s << 12) | r, b = c.blocks[i];
      if (!b || !RANDOM_TICK[b]) continue;
      const x = cx * 16 + (i & 15), y = (i >> 8) + MINY, z = cz * 16 + ((i >> 4) & 15);
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
// pumpkin / melon stems: grow to age 7, then try to put a fruit on a random side (on dirt, grass, farmland...) and bend toward it
const FRUIT_SOIL = new Set([2, 3, BID.farmland, BID.podzol, BID.coarse_dirt, BID.moss_block, BID.rooted_dirt]);
RANDOM_TICK[BID.stem] = (x, y, z, b, m) => {
  if (m & 16 || lightLevelAbove(x, y - 1, z) < 9) return;
  const wet = (getMeta(x, y - 1, z) & 7) > 0;
  if (Math.random() > (wet ? 0.33 : 0.14)) return;
  if ((m & 7) < 7) { setMeta(x, y, z, m + 1); return; }
  const f = (Math.random() * 4) | 0, d = DIRS[f], fx = x + d[0], fz = z + d[2];
  if (getBlock(fx, y, fz) !== 0 || !FRUIT_SOIL.has(getBlock(fx, y - 1, fz))) return;
  setBlock(fx, y, fz, m & 8 ? BID.melon : BID.pumpkin);
  setMeta(x, y, z, (m & 15) | 16 | (f << 5));
};
// carrots / potatoes / beetroots share one block: type in meta bits 3-4, age in bits 0-2
RANDOM_TICK[BID.crops2] = (x, y, z, b, m) => { if (lightLevelAbove(x, y - 1, z) < 9) return; const age = m & 7, wet = (getMeta(x, y - 1, z) & 7) > 0; if (age < 7 && Math.random() < (wet ? 0.33 : 0.14)) setMeta(x, y, z, (m & ~7) | (age + 1)); };
for (const [sap, type] of [[BID.oak_sapling, 0], [BID.birch_sapling, 2], [BID.spruce_sapling, 3], [BID.jungle_sapling, 4], [BID.acacia_sapling, 5], [BID.dark_oak_sapling, 6]]) RANDOM_TICK[sap] = (x, y, z, b, m) => {
  if (lightLevelAbove(x, y - 1, z) < 9 || Math.random() > 1 / 7) return;
  if (!m) { setMeta(x, y, z, 1); return; }
  growTreeAt(x, y, z, type);
};
function growTreeAt(x, y, z, type) {
  const h = type === 3 || type === 4 ? 12 : 8;
  for (let k = 1; k <= h; k++) { const t = getBlock(x, y + k, z); if (t && !REPL[t] && !S.LEAF[t]) return false; }
  if (y + h + 2 >= MAXY) return false;
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
for (const lv of [22, 23, 24, BID.jungle_leaves, BID.acacia_leaves, BID.dark_oak_leaves, BID.azalea_leaves, BID.flowering_azalea_leaves]) RANDOM_TICK[lv] = (x, y, z, b, m) => {
  if (m & 1) return;
  // search for a log within 4 blocks through leaves (flat typed queue, 9x9x9 visited grid)
  if (leafSearch(x, y, z)) return;
  breakNaturally(x, y, z, b, m);
};
const LQ = new Int16Array(729 * 4), LSEEN = new Uint8Array(729); let lstamp = 0;
function leafSearch(x, y, z) {
  if (++lstamp > 250) { lstamp = 1; LSEEN.fill(0); }
  let h = 0, t = 0; LQ[t++] = 4; LQ[t++] = 4; LQ[t++] = 4; LQ[t++] = 0; LSEEN[364] = lstamp;
  while (h < t) {
    const px = LQ[h], py = LQ[h + 1], pz = LQ[h + 2], d = LQ[h + 3]; h += 4;
    for (let k = 0; k < 6; k++) {
      const n = N6[k], nx = px + n[0], ny = py + n[1], nz = pz + n[2];
      if (nx < 0 || ny < 0 || nz < 0 || nx > 8 || ny > 8 || nz > 8) continue;
      const i = nx * 81 + ny * 9 + nz; if (LSEEN[i] === lstamp) continue; LSEEN[i] = lstamp;
      const tb = getBlock(x + nx - 4, y + ny - 4, z + nz - 4);
      if (S.LOGAX[tb] && tb !== BID.hay_block) return true;
      if (S.LEAF[tb] && d < 4) { LQ[t++] = nx; LQ[t++] = ny; LQ[t++] = nz; LQ[t++] = d + 1; }
    }
  }
  return false;
}
RANDOM_TICK[BID.farmland] = (x, y, z, b, m) => {
  let wet = false;
  for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dy = 0; dy <= 1; dy++) if (getBlock(x + dx, y + dy, z + dz) === 27) { wet = true; break; }
  if (wet || (W.rain > 0.5 && W.dim === 0 && (getLight(x, y + 1, z) >> 4) === 15)) { if (m !== 7) setMeta(x, y, z, 7); } // rain only reaches farmland open to the sky
  else if (m > 0) setMeta(x, y, z, m - 1);
  else if (BLOCKS[getBlock(x, y + 1, z)].plant !== 5) setBlock(x, y, z, 3); // dry farmland under a crop stays tilled
};
for (const b of BLOCKS) if (b && b.oxid) RANDOM_TICK[b.id] = (x, y, z, id, m) => { if (!(m & BLOCKS[id].wax) && Math.random() < 0.02) setBlock(x, y, z, BLOCKS[id].oxid, m); }; // waxed copper never oxidises; shape bits (slab half, stair facing) stay
// budding amethyst (1.17): small bud -> medium -> large -> cluster, each pointing away from the budding block
const BUD_STAGES = [BID.small_amethyst_bud, BID.medium_amethyst_bud, BID.large_amethyst_bud, BID.amethyst_cluster];
RANDOM_TICK[BID.budding_amethyst] = (x, y, z) => {
  if (Math.random() > 0.2) return;
  const f = (Math.random() * 6) | 0, d = S.DIR6[f], tx = x + d[0], ty = y + d[1], tz = z + d[2], tb = getBlock(tx, ty, tz);
  if (tb === 0 || (tb === BID.water && getMeta(tx, ty, tz) === 0)) setBlock(tx, ty, tz, BUD_STAGES[0], 1 + f);
  else { const k = BUD_STAGES.indexOf(tb); if (k >= 0 && k < 3 && getMeta(tx, ty, tz) === 1 + f) setBlock(tx, ty, tz, BUD_STAGES[k + 1], 1 + f); }
};
// pointed dripstone (1.17): a stalactite tip under a fluid drips into a cauldron below; one fed by water through a dripstone block slowly grows
const isTip = (x, y, z) => getBlock(x, y, z) === BID.pointed_dripstone && getMeta(x, y, z) === 0 && getBlock(x, y - 1, z) !== BID.pointed_dripstone;
function dripSource(x, y, z) { // the fluid above the block this stalactite hangs from: [fluid id, root y]
  let ry = y; while (ry < MAXY - 2 && getBlock(x, ry + 1, z) === BID.pointed_dripstone && getMeta(x, ry + 1, z) === 0) ry++;
  if (y - ry > 10) return null;
  const f = getBlock(x, ry + 2, z); return FLUID[f] && getMeta(x, ry + 2, z) === 0 ? [f, ry + 1] : null;
}
RANDOM_TICK[BID.pointed_dripstone] = (x, y, z, b, m) => {
  if (!isTip(x, y, z)) return;
  const src = dripSource(x, y, z); if (!src) return;
  const [fl, root] = src;
  // fill a cauldron within 11 blocks below
  if (Math.random() < (fl === 27 ? 0.17578125 : 0.05859375)) for (let cy = y - 1; cy > y - 12 && cy > MINY; cy--) {
    const cb = getBlock(x, cy, z); if (cb === 0) continue;
    if (cb === BID.cauldron) { const cm = getMeta(x, cy, z), lv = cm & 3, k = (cm >> 2) & 3; if (fl === 27 && (lv === 0 || (k === 0 && lv < 3))) setMeta(x, cy, z, lv + 1); else if (fl === 28 && lv === 0) setMeta(x, cy, z, 3 | 4); }
    break;
  }
  // growth: only with water above a dripstone block
  if (fl !== 27 || getBlock(x, root, z) !== BID.dripstone_block || Math.random() >= 0.011) return;
  if (root - y < 7 && getBlock(x, y - 1, z) === 0 && getBlock(x, y - 2, z) === 0 && Math.random() < 0.5) { setBlock(x, y - 1, z, BID.pointed_dripstone, 0); return; }
  for (let fy = y - 1; fy > y - 11 && fy > 1; fy--) { // otherwise the stalagmite below grows by one
    const fb = getBlock(x, fy, z); if (fb === 0) continue;
    if ((fb === BID.pointed_dripstone && getMeta(x, fy, z) === 1) || OPQ[fb]) { if (getBlock(x, fy + 1, z) === 0 && fy + 1 < y - 1) setBlock(x, fy + 1, z, BID.pointed_dripstone, 1); }
    return;
  }
};
// cauldrons fill up in rain (water) or snow (powder snow) when open to the sky
RANDOM_TICK[BID.cauldron] = (x, y, z, b, m) => {
  if (W.dim !== 0 || W.rain < 0.5 || (getLight(x, y + 1, z) >> 4) !== 15) return;
  const lv = m & 3, k = (m >> 2) & 3, cold = S.BIOMES[biomeAt(x, z)][4] <= 0.15, kind = cold ? 2 : 0;
  if (lv < 3 && (lv === 0 || k === kind) && Math.random() < (cold ? 0.1 : 0.05)) setMeta(x, y, z, (lv + 1) | (kind << 2));
};
RANDOM_TICK[BID.ice] = (x, y, z) => { if ((getLight(x, y, z) & 15) > 11 || (getLight(x, y + 1, z) & 15) > 11) setBlock(x, y, z, W.dim === -1 ? 0 : 27); };
RANDOM_TICK[BID.snow] = (x, y, z) => { if ((getLight(x, y, z) & 15) > 11) setBlock(x, y, z, 0); };

// ---------- worker pool ----------
const WORKER_SRC = `const S=(${SHARED.toString()})();(${workerMain.toString()})(S);`;
const workerURL = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
const NWORK = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
const workers = [];
let jobId = 0;
for (let i = 0; i < NWORK; i++) { const w = new Worker(workerURL); w.busy = 0; w.onmessage = e => onWorker(w, e.data); workers.push(w); }
// one more worker only for chunks the player just changed: a broken or placed block never waits behind terrain generation
const editWorker = new Worker(workerURL); editWorker.busy = 0; editWorker.onmessage = e => onWorker(editWorker, e.data);
const bufPool = [];
for (let i = 0; i < 4; i++) bufPool.push([new Uint16Array(S.PA * S.PH), new Uint8Array(S.PA * S.PH), new Uint8Array(S.PA * S.PH)]); // allocated up front: no GC spike on the first meshes
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
    if (m.ver === c.urgentVer) W.meshInbox.unshift([c, m, m.ver]); else W.meshInbox.push([c, m, m.ver]);
  }
}
// a rolled loot entry -> stack, with what jar loot tables add: damage, random / leveled enchantments, explorer maps
function lootStack(key, n, x, wx, wz, seed) {
  const sp = typeof lootSpecial === 'function' && lootSpecial(x && x.map ? { buried_treasure: 'buried_treasure_map', monument: 'ocean_explorer_map', mansion: 'woodland_explorer_map' }[x.map] || key : key, wx, wz); if (sp) return sp;
  const id = IID[key]; if (id == null) return null;
  const st = { id, n }; if (!x) return st;
  const d = ITEMS[id];
  if (x.dmg != null && d.dur) st.d = Math.min(d.dur - 1, Math.max(0, Math.round(d.dur * (1 - x.dmg))));
  if (x.ench) {
    const r = S.rng(seed);
    if (x.ench > 1 && enchKinds(id).length) st.e = rollEnchant(id, x.ench, seed);
    else { const ks = Object.keys(ENCH).filter(k => id === IID.enchanted_book || id === IID.book || ENCH[k][2].some(t => enchKinds(id).includes(t))); if (ks.length) { const k = ks[r.int(ks.length)]; st.e = { [k]: 1 + r.int(ENCH[k][1]) }; } }
    if (id === IID.book && st.e) st.id = IID.enchanted_book;
    if (st.e && !Object.keys(st.e).length) delete st.e;
  }
  return st;
}
function addChunk(cx, cz, d, tiles) {
  const c = new Chunk(cx, cz, d);
  W.chunks.set(c.key, c); W.lastKey = -1;
  const pm = W.pendingMobs.get(c.key); if (pm) { W.pendingMobs.delete(c.key); c.mobs = pm; d.fromSave = true; }
  if (tiles) for (const t of tiles) {
    if (t.t === 'chest') { const items = new Array(27).fill(null), wx = cx * 16 + (t.i & 15), wz = cz * 16 + ((t.i >> 4) & 15); for (const [slot, key, n, x] of t.loot) items[slot] = lootStack(key, n, x, wx, wz, (wx * 31 + wz) * 27 + slot); const tile = { type: 'chest', items }; if (t.loot.table) tile.lt = t.loot.table; c.tiles.set(t.i, tile); }
    else if (t.t === 'dispenser') { const items = new Array(9).fill(null); for (const [slot, key, n] of t.loot) if (IID[key] != null) items[slot] = { id: IID[key], n }; c.tiles.set(t.i, { type: 'dispenser', items }); }
    else if (t.t === 'brew') { const b = newBrewing(); const pid = POTION[t.potion] && POTION[t.potion].items.splash; if (pid != null) b.items[0] = { id: pid, n: 1 }; c.tiles.set(t.i, b); }
    else if (t.t === 'spawner') c.tiles.set(t.i, { type: 'spawner', mob: t.mob, delay: 200 });
    else if (t.t === 'mob') (c.spawns || (c.spawns = [])).push(t);
    else if (t.type) c.tiles.set(t.i, t);
  }
  if (d.lifted) c.modified = true; // kept in the 1.18 layout from now on
  stitchLight(c);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = chunkAt(cx + dx, cz + dz); if (n) n.dirty = true; }
  if (d.fromSave && typeof rodScan === 'function') rodScan(c);
  if (TRACKED.size) { const b = c.blocks; for (let i = 0; i < b.length; i++) { const s = TRACKED.get(b[i]); if (s) s.add((c.cx * 16 + (i & 15)) + ',' + ((i >> 8) + MINY) + ',' + (c.cz * 16 + ((i >> 4) & 15))); } }
  if (W.onChunkLoaded) W.onChunkLoaded(c, !d.fromSave);
  joinConnections(c); signTiles(c);
  if (W.mpLogs && W.mpLogs.has(dkey(cx, cz)) && !(typeof MP !== 'undefined' && MP.server)) applyMpLog(c);
}
function requestGen(cx, cz) {
  const w = idleWorker(2); if (!w) return false; // leave the third slot for meshing
  w.busy++; const id = jobId++; W.pending.set(ckey(cx, cz), id);
  w.postMessage({ type: 'gen', id, seed: W.seed, gen: W.gen || 1, cx, cz, dim: W.dim, exp: W.exp });
  return true;
}
function meshable(c) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!chunkAt(c.cx + dx, c.cz + dz)) return false; return true; }
function requestMesh(c, opts, urgent) {
  const w = urgent && editWorker.busy < 2 ? editWorker : idleWorker(3); if (!w) return false;
  const PA = S.PA, PH = S.PH, P = bufPool.pop() || [new Uint16Array(PA * PH), new Uint8Array(PA * PH), new Uint8Array(PA * PH)];
  const [B, M, L] = P, bio = new Uint8Array(PA);
  // only copy layers up to the tallest neighbour; everything above is open sky
  let top = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) top = Math.max(top, chunkAt(c.cx + dx, c.cz + dz).maxY);
  const h = Math.min(CH, top + 2);
  B.fill(8, 0, PA); L.fill(0, 0, PA); B.fill(0, (h + 1) * PA, (h + 2) * PA); L.fill(0xf0, (h + 1) * PA, (h + 2) * PA); // floor below the bottom row, sky layer above h (array rows)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const n = chunkAt(c.cx + dx, c.cz + dz);
    const xa = dx < 0 ? 15 : 0, xb = dx > 0 ? 0 : 15, za = dz < 0 ? 15 : 0, zb = dz > 0 ? 0 : 15;
    const ox = dx * 16, oz = dz * 16;
    for (let z = za; z <= zb; z++) {
      const pz = z + oz + 1; for (let x = xa; x <= xb; x++) bio[pz * 18 + x + ox + 1] = n.biome[z * 16 + x];
      if (xa === 0 && xb === 15) {
        for (let y = 0; y < h; y++) { const si = (y << 8) | (z << 4), di = (y + 1) * PA + pz * 18 + 1; B.set(n.blocks.subarray(si, si + 16), di); M.set(n.meta.subarray(si, si + 16), di); L.set(n.light.subarray(si, si + 16), di); }
      } else {
        const x = xa, di0 = pz * 18 + x + ox + 1;
        for (let y = 0; y < h; y++) { const si = (y << 8) | (z << 4) | x, di = (y + 1) * PA + di0; B[di] = n.blocks[si]; M[di] = n.meta[si]; L[di] = n.light[si]; }
      }
    }
  }
  w.busy++; c.meshing = true; c.dirty = false; c.ver = ++W.verSeq; if (urgent) { c.urgent = false; c.urgentVer = c.ver; } // unique across chunks, so a stale job can never match a reloaded chunk
  w.postMessage({ type: 'mesh', id: jobId++, cx: c.cx, cz: c.cz, ver: c.ver, B, M, L, bio, opts: { ...opts, h } }, [B.buffer, M.buffer, L.buffer, bio.buffer]);
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
function rleEnc(a) { // keeps the element type: block ids are 16 bit, meta and light 8 bit
  const out = new a.constructor(a.length * 2); let n = 0;
  for (let i = 0; i < a.length;) { const v = a[i]; let r = 1; while (r < 255 && i + r < a.length && a[i + r] === v) r++; out[n++] = r; out[n++] = v; i += r; }
  return out.slice(0, n);
}
function rleDec(b, len, T = Uint8Array) { const a = new T(len); let p = 0; for (let i = 0; i < b.length; i += 2) { a.fill(b[i + 1], p, p + b[i]); p += b[i]; } return a; }
// RLE encoding runs in a small worker so saving (autosave, unloading while flying) never stalls a frame
const saveWorker = new Worker(URL.createObjectURL(new Blob([`const rleEnc=${rleEnc.toString()};onmessage=e=>{const m=e.data;postMessage({k:m.k,rec:{v:3,it:m.it,ch:m.ch,my:m.my,b:rleEnc(m.b),m:rleEnc(m.m),l:rleEnc(m.l),bio:m.bio,t:m.t,mobs:m.mobs}});};`], { type: 'text/javascript' })));
const savePending = new Map(), saveWaiters = new Map();
saveWorker.onmessage = e => {
  const { k, rec } = e.data;
  dbReq('chunks', 'readwrite', st => st.put(rec, k)).then(() => {
    const n = (savePending.get(k) || 1) - 1;
    if (n > 0) { savePending.set(k, n); return; }
    savePending.delete(k); const w = saveWaiters.get(k); if (w) { saveWaiters.delete(k); for (const f of w) f(); }
  });
};
const saveDone = k => savePending.has(k) ? new Promise(r => { const w = saveWaiters.get(k) || []; w.push(r); saveWaiters.set(k, w); }) : null;
// unloading: the chunk's arrays are handed to the worker without copying; sync: encode here (page is closing)
function saveChunk(c, unloading, sync) {
  if (!c.modified || W.pano || (W.meta && W.meta.remote)) return; c.modified = false; // a multiplayer guest keeps nothing: the host's world is the real one
  const k = dkey(c.cx, c.cz), dk = W.id + ':' + k; W.saved.add(k);
  // untouched terrain is regenerated from the seed; only its animals are stored
  if (!c.edited) { dbReq('chunks', 'readwrite', st => st.put({ v: 2, it: ITEM_TABLE, mobs: c.mobs || null }, dk)); return; }
  if (sync) { dbReq('chunks', 'readwrite', st => st.put({ v: 3, it: ITEM_TABLE, ch: CH, my: MINY, b: rleEnc(c.blocks), m: rleEnc(c.meta), l: rleEnc(c.light), bio: c.biome.slice(), t: serTiles(c), mobs: c.mobs || null }, dk)); return; }
  const b = unloading ? c.blocks : c.blocks.slice(), m = unloading ? c.meta : c.meta.slice(), l = unloading ? c.light : c.light.slice();
  savePending.set(dk, (savePending.get(dk) || 0) + 1);
  saveWorker.postMessage({ k: dk, it: ITEM_TABLE, ch: CH, my: MINY, b, m, l, bio: c.biome.slice(), t: serTiles(c), mobs: c.mobs || null }, [b.buffer, m.buffer, l.buffer]);
}
async function loadChunk(cx, cz) {
  const key = ckey(cx, cz); W.pending.set(key, 'load');
  const wid = W.id;
  const dk = dkey(cx, cz), dim = W.dim;
  const pend = saveDone(wid + ':' + dk); if (pend) await pend; // reloading a chunk that is still being saved
  const rec = await dbReq('chunks', 'readonly', st => st.get(wid + ':' + dk));
  if (W.pending.get(key) !== 'load' || wid !== W.id || dim !== W.dim) return;
  W.pending.delete(key);
  if (rec) { const rm = itemRemapFor(rec.it); if (rm) { remapItems(rec.t, rm); remapItems(rec.mobs, rm); } }
  if (!rec || !rec.b) { W.saved.delete(dk); if (rec && rec.mobs) W.pendingMobs.set(key, rec.mobs); return; }
  const oldH = rec.ch || 128; // saves from the 128-high version are padded with sky
  // v3 saves 16-bit block ids; older saves (v2 RLE, v1 raw) hold 8-bit ids and are widened here
  const dec = (a, fill, T = Uint8Array) => { const n = 256 * oldH, src = rec.v >= 2 ? rleDec(a, n, rec.v >= 3 ? T : Uint8Array) : a; return src.subarray(0, n); };
  // a record that can't be read (damaged storage, an interrupted write) is generated again instead of leaving a hole the
  // world waits on for ever
  let d; try { d = { cx, cz, blocks: dec(rec.b, 0, Uint16Array), meta: dec(rec.m), light: dec(rec.l, 0xf0), biome: rec.bio && rec.bio.length >= 256 ? rec.bio : null, mobs: Array.isArray(rec.mobs) ? rec.mobs : null, fromSave: true, tileList: Array.isArray(rec.t) ? rec.t : [] }; if (!d.biome) throw new Error('no biome data');
    fitRows(d, rec.my || 0, oldH, dim); unshiftRows(d, dim); }
  catch (e) { console.warn('chunk ' + dk + ' could not be read; generated again', e); W.saved.delete(dk); return; }
  W.inbox.push(d);
}
// a chunk saved with another world height (before 1.18: y 0..255, or 128 high) put into this world's rows (-64..319):
// the shared heights are copied, rows above the save are sky, and below it the overworld gets its 1.18 depths
// (deepslate, caves, deep ores; the old bedrock floor turns to deepslate, as when Java upgrades a world)
function fitRows(d, my, ch, dim) {
  if (my === MINY && ch === CH && d.blocks.length === CVOL) return;
  const b = new Uint16Array(CVOL), m = new Uint8Array(CVOL), lo = Math.max(my, MINY), hi = Math.min(my + ch, MAXY);
  if (hi > lo) { const a = (lo - my) << 8, z = (hi - my) << 8, o = (lo - MINY) << 8; b.set(d.blocks.subarray(a, z), o); m.set(d.meta.subarray(a, z), o); }
  if (my > MINY && dim === 0) S.deepFill(b, m, W.seed, d.cx, d.cz); // the overworld's 1.18 depths below an older save; other dimensions stay open there
  const shift = (my - MINY) << 8;
  d.blocks = b; d.meta = m; d.light = new Uint8Array(CVOL); S.lightChunk(b, d.light, m);
  d.tileList = d.tileList.map(([i, t]) => [i + shift, t]).filter(([i]) => i >= 0 && i < CVOL); d.lifted = true; // saved again in this layout
}
// a chunk that came back 64 blocks too high (a server once sent stored 1.18 chunks without their height; guests took
// them for old 0..255 chunks and stored them back lifted): the overworld then has its deepslate layer at y 0..63, the
// Nether its bedrock floor at y 64. Moved back down (the floor gets its bedrock back; the top 64 rows are sky).
const DEEPISH = new Set();
function unshiftRows(d, dim) {
  if (dim === 1 || d.blocks.length !== CVOL) return false;
  const B = d.blocks, row = y => (y - MINY) << 8, count = (y, f) => { let n = 0; for (let i = row(y), e = i + 256; i < e; i++) if (f(B[i])) n++; return n; };
  if (!DEEPISH.size) for (const k of ['deepslate', 'cobbled_deepslate', 'tuff', 'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_copper_ore', 'deepslate_gold_ore', 'deepslate_redstone_ore', 'deepslate_lapis_ore', 'deepslate_diamond_ore', 'deepslate_emerald_ore', 'lava']) if (BID[k] != null) DEEPISH.add(BID[k]);
  const shifted = dim === -1 ? count(64, b => b === BID.bedrock) >= 240 && count(0, b => b === BID.bedrock) < 16
    : (() => { let deep = 0, solid = 0; for (const y of [12, 24, 36, 48]) { deep += count(y, b => DEEPISH.has(b)); solid += count(y, b => b && b !== 27); } return solid >= 300 && deep >= solid * 0.8; })(); // real terrain is stone up there
  if (!shifted) return false;
  const sh = 64 << 8, b = new Uint16Array(CVOL), m = new Uint8Array(CVOL);
  b.set(B.subarray(sh)); m.set(d.meta.subarray(sh));
  if (dim === 0) for (let i = 0; i < 256; i++) { b[i] = BID.bedrock; m[i] = 0; } // the floor at -64 (it had been turned to deepslate)
  d.blocks = b; d.meta = m; d.light = new Uint8Array(CVOL); S.lightChunk(b, d.light, m);
  d.tileList = (d.tileList || []).map(([i, t]) => [i - sh, t]).filter(([i]) => i >= 0 && i < CVOL); d.lifted = true;
  return true;
}
function unloadChunk(c) {
  if (W.onChunkUnloaded) W.onChunkUnloaded(c); // stores the chunk's animals first
  saveChunk(c, true);
  if (typeof rodUnload === 'function') rodUnload(c);
  for (const s of TRACKED.values()) for (const k of s) { const [x, , z] = k.split(',').map(Number); if (x >> 4 === c.cx && z >> 4 === c.cz) s.delete(k); }
  W.chunks.delete(c.key); W.lastKey = -1;
}
// streaming: called every frame with player chunk position
let spiral = null, spiralR = -1;
function buildSpiral(r) { const a = []; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= (r + 0.5) * (r + 0.5)) a.push([dx, dz, dx * dx + dz * dz]); a.sort((p, q) => p[2] - q[2]); return a; }
function streamChunks(px, pz, rd, meshOpts, budget) {
  const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4, r = rd + 1;
  if (spiralR !== r) { spiral = buildSpiral(r); spiralR = r; }
  // chunks the player just changed come first, even while an older mesh of them is still on its way
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const c = chunkAt(pcx + dx, pcz + dz); if (c && c.urgent && c.dirty && meshable(c)) requestMesh(c, meshOpts, true); }
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
    if (W.saved.has(dkey(cx, cz))) { loadChunk(cx, cz); if (++reqs > 4) break; continue; }
    if (!requestGen(cx, cz)) break;
  }
  // other places that must stay loaded (a multiplayer host keeps its guests' surroundings running): generate, don't mesh
  const keep = W.keepCenters || null;
  if (keep) for (const [kx, kz, kr] of keep) { const kcx = Math.floor(kx) >> 4, kcz = Math.floor(kz) >> 4;
    for (let dx = -kr; dx <= kr; dx++) for (let dz = -kr; dz <= kr; dz++) { const cx = kcx + dx, cz = kcz + dz, k = ckey(cx, cz);
      if (W.chunks.has(k) || W.pending.has(k)) continue; if (W.saved.has(dkey(cx, cz))) { loadChunk(cx, cz); if (++reqs > 4) break; continue; } if (!requestGen(cx, cz)) break; } }
  // unload far chunks
  const lim = r + 2;
  for (const c of W.chunks.values()) if ((Math.abs(c.cx - pcx) > lim || Math.abs(c.cz - pcz) > lim) && !(keep && keep.some(([kx, kz, kr]) => Math.abs(c.cx - (Math.floor(kx) >> 4)) <= kr + 1 && Math.abs(c.cz - (Math.floor(kz) >> 4)) <= kr + 1))) unloadChunk(c);
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
function resetWorld(keepSaved) {
  for (const c of W.chunks.values()) if (W.onChunkUnloaded) W.onChunkUnloaded(c);
  W.chunks.clear(); W.pending.clear(); W.pendingMobs.clear(); W.inbox.length = 0; W.meshInbox.length = 0; W.sched.clear(); W.lastKey = -1; if (!keepSaved) W.saved = new Set();
  if (typeof RS !== 'undefined') { RS.dirty.clear(); RS.sched.clear(); }
}

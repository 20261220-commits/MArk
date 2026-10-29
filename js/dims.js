// Dimensions: travelling between the Overworld, the Nether and the End through portals.
const DIM_NAME = { 0: '오버월드', '-1': '네더', 1: '디 엔드' };
function switchDim(to, x, y, z, arrive) {
  saveAll();
  if (PL.riding) { PL.riding = null; }
  for (const c of [...W.chunks.values()]) unloadChunk(c);
  resetWorld(true);
  for (const e of ENT) removeEnt(e); ENT.length = 0; R.particles.length = 0;
  if (typeof bossBar === 'function') bossBar(null);
  const from = W.dim; W.dim = to; W.arrive = arrive || null;
  PL.x = x; PL.y = y; PL.z = z; PL.px = x; PL.py = y; PL.pz = z; PL.vx = PL.vy = PL.vz = 0; PL.fallDist = 0; PL.portalT = 0; PL.portalLock = true;
  if (W.meta) W.meta.dim = to;
  if (typeof ADVT !== 'undefined') { ADVT.dim(to); advNetherTravel(from, to); }
  clearInput(); UI.paused = true; showMenu('loading', DIM_NAME[to] + '(으)로 이동하는 중'); loadingFrom = performance.now();
}
// after the destination chunks are loaded: find or build a portal, or the End platform
function arriveDim() {
  const a = W.arrive; W.arrive = null; if (!a) return;
  if (a === 'end') {
    for (let x = 98; x <= 102; x++) for (let z = -2; z <= 2; z++) { setBlock(x, 48, z, BID.obsidian, 0, { noUpdate: true }); for (let y = 49; y <= 51; y++) if (getBlock(x, y, z)) setBlock(x, y, z, 0, 0, { noUpdate: true }); }
    PL.x = 100.5; PL.y = 49; PL.z = 0.5; PL.yaw = Math.PI / 2;
  } else if (a === 'spawn') {
    const x = Math.floor(PL.x), z = Math.floor(PL.z); let y = Math.max(Math.floor(PL.y) - 1, 1);
    if (SOLID[getBlock(x, y + 1, z)] || SOLID[getBlock(x, y + 2, z)] || !SOLID[getBlock(x, y, z)]) { y = topY(x, z); }
    PL.y = y + 1;
  } else if (a === 'anchor') { anchorArrive();
  } else if (a === 'gateway' || a === 'gatehome') {
    const x0 = Math.floor(PL.x), z0 = Math.floor(PL.z); let best = null;
    for (let r = 0; r <= 24 && !best; r += 2) for (let dx = -r; dx <= r && !best; dx += 2) for (let dz = -r; dz <= r && !best; dz += 2) { const t = topY(x0 + dx, z0 + dz); if (t > 30 && getBlock(x0 + dx, t, z0 + dz) === BID.end_stone) best = [x0 + dx, t + 1, z0 + dz]; }
    if (!best) { best = [x0, 71, z0]; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) setBlock(x0 + x, 70, z0 + z, BID.end_stone, 0, { noUpdate: true }); }
    PL.x = best[0] + .5; PL.y = best[1]; PL.z = best[2] + .5;
    if (a === 'gateway' && !hasGateway(best[0], best[1], best[2])) { const gy = best[1] + 3; setBlock(best[0] + 2, gy - 1, best[2], BID.bedrock, 0, { noUpdate: true }); setBlock(best[0] + 2, gy + 1, best[2], BID.bedrock, 0, { noUpdate: true }); setBlock(best[0] + 2, gy, best[2], BID.end_portal, 1, { noUpdate: true }); }
  } else if (a === 'portal') {
    const found = findPortalNear(Math.floor(PL.x), Math.floor(PL.z), W.dim === -1 ? 24 : 96);
    if (found) { PL.x = found[0] + .5; PL.y = found[1]; PL.z = found[2] + .5; }
    else { const p = buildPortal(Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)); PL.x = p[0] + .5; PL.y = p[1]; PL.z = p[2] + .5; }
  }
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.portalLock = true;
}
function findPortalNear(cx, cz, rad) {
  let best = null, bd = Infinity;
  for (const c of W.chunks.values()) {
    const x0 = c.cx * 16, z0 = c.cz * 16; if (x0 + 16 < cx - rad || x0 > cx + rad || z0 + 16 < cz - rad || z0 > cz + rad) continue;
    for (let r = 1; r <= c.maxY; r++) for (let i = 0; i < 256; i++) { // array rows
      if (c.blocks[(r << 8) | i] !== BID.nether_portal) continue;
      if (c.blocks[((r - 1) << 8) | i] === BID.nether_portal) continue; // bottom row only
      const y = r + MINY, x = x0 + (i & 15), z = z0 + (i >> 4), d = (x - cx) ** 2 + (z - cz) ** 2 + (y - PL.y) ** 2 * 0.25;
      if (d < bd) { bd = d; best = [x, y, z]; }
    }
  }
  return best;
}
// Java-style portal placement: look for a flat spot with headroom near the target, else carve a platform
function buildPortal(tx, ty, tz) {
  const fits = (x, y, z) => { for (let i = -1; i <= 2; i++) for (let k = -1; k <= 1; k++) { if (!SOLID[getBlock(x + i, y - 1, z + k)] || FLUID[getBlock(x + i, y - 1, z + k)]) return false; for (let h = 0; h < 4; h++) { const b = getBlock(x + i, y + h, z + k); if (b && !REPL[b] || FLUID[b]) return false; } } return true; };
  const ymin = W.dim === -1 ? 32 : W.dim === 1 ? 4 : MINY + 4, ymax = W.dim === -1 ? 118 : W.dim === 1 ? 248 : MAXY - 8;
  let spot = null;
  for (let r = 0; r <= 16 && !spot; r++) for (let dx = -r; dx <= r && !spot; dx++) for (let dz = -r; dz <= r && !spot; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = tx + dx, z = tz + dz;
    for (let y = ymax; y >= ymin; y--) if (fits(x, y, z)) { spot = [x, y, z]; break; }
  }
  if (!spot) { // floating platform, as Java does when nothing fits
    const y = Math.max(ymin + 2, Math.min(ymax - 6, W.dim === -1 ? 70 : ty));
    spot = [tx, y, tz];
    for (let i = -1; i <= 2; i++) for (let k = -1; k <= 1; k++) { setBlock(tx + i, y - 1, tz + k, BID.obsidian, 0, { noUpdate: true }); for (let h = 0; h < 4; h++) setBlock(tx + i, y + h, tz + k, 0, 0, { noUpdate: true }); }
  }
  const [x, y, z] = spot;
  for (let i = -1; i <= 2; i++) for (let h = -1; h <= 3; h++) { const edge = i === -1 || i === 2 || h === -1 || h === 3; setBlock(x + i, y + h, z, edge ? BID.obsidian : BID.nether_portal, 0, { noUpdate: true }); }
  return [x, y, z];
}
// called every tick from playerTick
function portalTick() {
  if (PL.dead || spectator()) return;
  let inNether = false, inEnd = false;
  let gate = null;
  inBlock((b, x, y, z) => { if (b === BID.nether_portal) inNether = true; if (b === BID.end_portal) { if (getMeta(x, y, z) & 1) gate = [x, z]; else inEnd = true; } });
  if (gate && !PL.portalLock) { // end gateway: main island <-> outer islands
    const d = Math.hypot(gate[0], gate[1]) || 1, far = d > 500, k = far ? 100 / d : 1000 / d;
    if (typeof advGrant === 'function') advGrant('end/enter_end_gateway'); switchDim(1, gate[0] * k + 0.5, 90, gate[1] * k + 0.5, far ? 'gatehome' : 'gateway'); return;
  }
  if (!inNether && !inEnd) PL.portalLock = false; // arriving in a portal: step out before it works again
  if (inEnd && !PL.portalLock) {
    if (W.dim === 1) { const sp = PL.spawn || W.worldSpawn; switchDim(0, sp[0] + .5, sp[1], sp[2] + .5, 'spawn'); chatMsg('엔드를 떠났습니다', '#aaaaaa'); }
    else switchDim(1, 100.5, 49, 0.5, 'end');
    return;
  }
  if (inNether && !PL.portalLock) {
    PL.portalT = (PL.portalT || 0) + 1;
    if (PL.portalT === 1 && !creative()) play('portal', { trigger: true, vol: 0.5 });
    if (PL.portalT >= (creative() ? 1 : 80)) {
      const to = W.dim === -1 ? 0 : -1, s = to === -1 ? 1 / 8 : 8;
      switchDim(to, PL.x * s, Math.max(40, Math.min(110, PL.y)), PL.z * s, 'portal');
    }
  } else if (PL.portalT > 0) PL.portalT = Math.max(0, PL.portalT - 4);
  const ov = $('ovPortal'); if (ov) ov.style.opacity = Math.min(1, (PL.portalT || 0) / 80) * 0.8;
}
// ---------- fire (Java's FireBlock): every 1.5-2 s it ages, burns and spreads to flammable blocks, and burns out; it
// burns for ever on netherrack and magma (and on bedrock in the End); rain puts it out. Lava lights flammable blocks near it.
const FLAM = []; // block id -> [encouragement, flammability]
BLOCKS.forEach((d, id) => { if (!d) return; const k = d.key; if (/crimson|warped/.test(k)) return;
  const v = /_log$|^stem$/.test(k) ? [5, 5] : /(_planks|_slab|_stairs|_fence|_fence_gate|_door|_trapdoor)$|^(wood|stripped_wood|composter|beehive|lectern)$/.test(k) && !/iron|cobble|stone|brick|copper|smooth|nether|quartz|sand|prismarine|purpur|blackstone|deepslate|tuff|andesite|granite|diorite/.test(k) ? [5, 20]
    : /leaves$/.test(k) || /wool$/.test(k) || k === 'dried_kelp_block' ? [30, 60] : k === 'carpet' || k === 'moss_carpet' || k === 'hay_block' ? [60, 20] : k === 'bookshelf' ? [30, 20] : k === 'tnt' || k === 'vine' || k === 'cave_vines' ? [15, 100]
    : /^(short_grass|fern|tall_grass|large_fern|dandelion|poppy|cornflower|oxeye_daisy|dead_bush|flowers2|tall_flower|sweet_berry_bush|azalea|flowering_azalea)$/.test(k) ? [60, 100]
    : k === 'scaffolding' || k === 'bamboo' ? [60, 60] : k === 'coal_block' ? [5, 5] : k === 'target' ? [15, 20] : k === 'moss_block' ? [5, 100] : null;
  if (v) FLAM[id] = v; });
const N6F = [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
const fireEnc = (x, y, z) => { let e = 0; for (const [dx, dy, dz] of N6F) { const f = FLAM[getBlock(x + dx, y + dy, z + dz)]; if (f && f[0] > e) e = f[0]; } return e; };
const rainedOn = (x, y, z) => W.dim === 0 && W.rain > 0.5 && (getLight(x, y, z) >> 4) === 15 && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => (getLight(x + dx, y, z + dz) >> 4) === 15);
function fireBurn(x, y, z, chance, age) {
  const b = getBlock(x, y, z), f = FLAM[b]; if (!f || Math.random() * chance >= f[1]) return;
  if (Math.random() * (age + 10) < 5 && !rainedOn(x, y, z)) setBlock(x, y, z, BID.fire, Math.min(15, age + ((Math.random() * 5) | 0) / 4 | 0)); else setBlock(x, y, z, 0);
  if (b === BID.tnt) primeTNT(x, y, z);
}
SCHED_TICK[BID.fire] = (x, y, z, b, m) => {
  if (!gr('doFireTick')) return;
  const below = getBlock(x, y - 1, z), eternal = below === BID.netherrack || below === BID.magma_block || (W.dim === 1 && below === BID.bedrock);
  const enc = fireEnc(x, y, z), age = m & 15;
  if (!eternal && !SOLID[below] && !enc) { setBlock(x, y, z, 0); return; }
  if (!eternal && rainedOn(x, y, z) && Math.random() < 0.2 + age * 0.03) { setBlock(x, y, z, 0); return; }
  const na = Math.min(15, age + (((Math.random() * 3) | 0) >> 1)); if (na !== age) setMeta(x, y, z, na);
  if (!eternal) {
    if (!enc) { if (!SOLID[below] || age > 3) { setBlock(x, y, z, 0); return; } }
    else if (age === 15 && !FLAM[below] && Math.random() < 0.25) { setBlock(x, y, z, 0); return; }
  }
  for (const [dx, dy, dz] of N6F) fireBurn(x + dx, y + dy, z + dz, dy ? 250 : 300, age);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 4; dy++) {
    if (!dx && !dy && !dz) continue; const px = x + dx, py = y + dy, pz = z + dz; if (getBlock(px, py, pz) !== 0) continue;
    const e = fireEnc(px, py, pz); if (!e) continue;
    const p = (e + 40 + PL.difficulty * 7) / (age + 30);
    if (p > 0 && Math.random() * (100 + (dy > 1 ? (dy - 1) * 100 : 0)) <= p && !rainedOn(px, py, pz)) setBlock(px, py, pz, BID.fire, Math.min(15, age + (((Math.random() * 5) | 0) >> 2)));
  }
  if (getBlock(x, y, z) === BID.fire) schedule(x, y, z, 30 + ((Math.random() * 10) | 0));
};
RANDOM_TICK[BID.lava] = (x, y, z) => { // LavaFluid.onRandomTick
  if (!gr('doFireTick')) return; const n = (Math.random() * 3) | 0;
  if (n > 0) { let px = x, py = y, pz = z; for (let k = 0; k < n; k++) { px += ((Math.random() * 3) | 0) - 1; py++; pz += ((Math.random() * 3) | 0) - 1; const b = getBlock(px, py, pz);
    if (b === 0) { if (fireEnc(px, py, pz)) { setBlock(px, py, pz, BID.fire); return; } } else if (SOLID[b]) return; } }
  else for (let k = 0; k < 3; k++) { const px = x + ((Math.random() * 3) | 0) - 1, pz = z + ((Math.random() * 3) | 0) - 1; if (getBlock(px, y + 1, pz) === 0 && FLAM[getBlock(px, y, pz)]) setBlock(px, y + 1, pz, BID.fire); }
};
RANDOM_TICK[BID.nether_wart] = (x, y, z, b, m) => { if (m < 3 && Math.random() < 0.1) setMeta(x, y, z, m + 1); };
function hasGateway(x, y, z) { for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -4; dy <= 8; dy++) if (getBlock(x + dx, y + dy, z + dz) === BID.end_portal) return true; return false; }

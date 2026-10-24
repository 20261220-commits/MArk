// Blocks of S6: fence gates, cake, ender chests (one shared inventory), shulker boxes (keep their contents when
// broken), respawn anchors (charged with glowstone, set the spawn in the Nether, explode elsewhere), scaffolding
// (climbable, falls apart more than 6 blocks from support), nether vines, frosted ice and frost walker.
const SCAFB = BID.scaffolding, SHULK = BID.shulker_box, ANCHOR = BID.respawn_anchor, FICE = BID.frosted_ice;
const isShulkerItem = id => ITEMS[id] && ITEMS[id].place === SHULK;

// ---------- support (world.js plantOK, cases 21+) ----------
function scafDist(x, y, z) {
  const below = getBlock(x, y - 1, z);
  if (below === SCAFB) return getMeta(x, y - 1, z) & 7;
  if (OPQ[below] || supportedBy(below)) return 0;
  let best = 7;
  for (const [dx, , dz] of DIRS) if (getBlock(x + dx, y, z + dz) === SCAFB) best = Math.min(best, (getMeta(x + dx, y, z + dz) & 7) + 1);
  return best;
}
function plant6OK(b, x, y, z, m, below, above) {
  switch (BLOCKS[b].plant) {
    case 21: return OPQ[above] || above === b; // weeping vines hang
    case 22: return OPQ[below] || below === b; // twisting vines stand
    case 23: return supportedBy(below); // cake
    case 24: { // scaffolding: recompute the distance; too far from support and it falls apart
      const d = scafDist(x, y, z); if (d > 6) return false;
      if (d !== (m & 7)) { setMeta(x, y, z, d); for (const [dx, dy, dz] of N6) if (getBlock(x + dx, y + dy, z + dz) === SCAFB) neighborUpdate(x + dx, y + dy, z + dz); }
      return true;
    }
  }
  return true;
}

// ---------- placing ----------
function blocks6Place(t, x, y, z, id, meta, fd) {
  const below = getBlock(x, y - 1, z), above = getBlock(x, y + 1, z);
  if (id === BID.oak_fence_gate) return (meta & ~7) | fd;
  if (id === SCAFB) { const d = scafDist(x, y, z); return d > 6 ? false : d; }
  if (id === BID.cake) return supportedBy(below) ? 0 : false;
  if (id === BID.weeping_vines) return OPQ[above] || above === id ? 1 : false;
  if (id === BID.twisting_vines) return OPQ[below] || below === id ? 1 : false;
  return meta;
}
function blocks6Placed(x, y, z, id, meta, h) {
  if (id === SHULK) setTile(x, y, z, { type: 'chest', shulker: true, items: h && h.items ? h.items.map(s => s && { ...s }) : new Array(27).fill(null) });
  if ((id === BID.weeping_vines || id === BID.twisting_vines)) { const oy = id === BID.weeping_vines ? 1 : -1; if (getBlock(x, y + oy, z) === id) setMeta(x, y + oy, z, 0); } // the old tip is now a stem
}
// a broken shulker box drops itself with everything inside (in creative too, unless it is empty)
function blocks6Break(x, y, z, id, m) {
  if (id !== SHULK) return;
  const t = getTile(x, y, z), items = t && t.items; if (t) t.items = null; // nothing spills
  const full = items && items.some(s => s);
  if (creative() && !full) return;
  const st = { id: itemOfBlock(id, m), n: 1 }; if (full) st.items = items;
  dropStack(x + .5, y + .5, z + .5, st);
}

// ---------- using ----------
function blocks6Use(t, h, dry) {
  const { x, y, z, id, m } = t;
  if (id === BID.oak_fence_gate) {
    if (!dry) { let nm = m ^ 4; if (nm & 4) { const away = (m & 1) ? PL.x > x + .5 : PL.z > z + .5; nm = away ? nm | 2 : nm & ~2; } setMeta(x, y, z, nm); play('door', { vol: 0.6, pitch: 1.2 }); }
    return true;
  }
  if (id === BID.cake) {
    if (!(PL.food < 20 || creative())) return false;
    if (!dry) { PL.food = Math.min(20, PL.food + 2); PL.sat = Math.min(PL.food, PL.sat + 0.4); if ((m & 7) >= 6) setBlock(x, y, z, 0); else setMeta(x, y, z, m + 1); play('eat'); UI.hudDirty = true; }
    return true;
  }
  if (id === BID.ender_chest) {
    if (!dry) { if (!PL.ender) PL.ender = new Array(27).fill(null); UI.openScreen('chest', { cart: { items: PL.ender }, title: '엔더 상자' }); play('door', { vol: 0.4, pitch: 0.7 }); }
    return true;
  }
  if (id === SHULK) {
    if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, { type: 'chest', shulker: true, items: new Array(27).fill(null) }); UI.openScreen('chest', { x, y, z, title: ITEMS[itemOfBlock(id, m)].name }); play('door', { vol: 0.4, pitch: 1.4 }); }
    return true;
  }
  if (id === ANCHOR) {
    const ch = m & 7;
    if (h && h.id === BID.glowstone && ch < 4) { if (!dry) { setMeta(x, y, z, ch + 1); consume(); play('portal', { vol: 0.3, pitch: 1.6 }); } return true; }
    if (!ch) return false;
    if (dry) return true;
    if (W.dim === -1) { PL.spawn = [x, y, z]; PL.spawnDim = -1; UI.flash('리스폰 지점이 설정되었습니다'); play('portal', { vol: 0.4 }); }
    else { setBlock(x, y, z, 0); explode(x + .5, y + .5, z + .5, 5, true); } // anchors blow up outside the Nether
    return true;
  }
  return null;
}
// respawning at an anchor uses up one charge; without a charged anchor the player goes to the world spawn
function anchorArrive() {
  const sp = PL.spawn, ok = sp && getBlock(sp[0], sp[1], sp[2]) === ANCHOR && (getMeta(sp[0], sp[1], sp[2]) & 7) > 0;
  if (!ok) {
    PL.spawn = null; PL.spawnDim = 0; UI.flash('충전된 리스폰 정박기가 없어요');
    const ws = W.worldSpawn; switchDim(0, ws[0] + .5, ws[1], ws[2] + .5, 'spawn'); return;
  }
  setMeta(sp[0], sp[1], sp[2], getMeta(sp[0], sp[1], sp[2]) - 1);
  for (let r = 1; r <= 2; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = -1; dy <= 1; dy++) {
    const x = sp[0] + dx, y = sp[1] + dy, z = sp[2] + dz;
    if (SOLID[getBlock(x, y - 1, z)] && !SOLID[getBlock(x, y, z)] && !SOLID[getBlock(x, y + 1, z)] && !FLUID[getBlock(x, y, z)]) { PL.x = x + .5; PL.y = y; PL.z = z + .5; PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; return; }
  }
  PL.x = sp[0] + .5; PL.y = sp[1] + 1; PL.z = sp[2] + .5;
}

// ---------- frosted ice and frost walker ----------
const FROST = new Map();
RANDOM_TICK[FICE] = (x, y, z, b, m) => { if (!FROST.has(x + ',' + y + ',' + z)) setBlock(x, y, z, 27); }; // left over from before a reload
function blocks6Tick() {
  const boots = INV.armor[3], fw = enchLv(boots, 'frost_walker');
  if (fw && PL.onGround && !PL.dead && W.tickN % 2 === 0) {
    const r = 2 + fw, y = Math.floor(PL.y - 0.5), px = Math.floor(PL.x), pz = Math.floor(PL.z);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r) continue; const x = px + dx, z = pz + dz;
      if (getBlock(x, y, z) === 27 && getMeta(x, y, z) === 0 && !getBlock(x, y + 1, z)) { setBlock(x, y, z, FICE, 0, { noUpdate: true }); FROST.set(x + ',' + y + ',' + z, W.tickN + 60 + Math.floor(Math.random() * 40)); }
      else { const k = x + ',' + y + ',' + z; if (FROST.has(k) && getBlock(x, y, z) === FICE) { setMeta(x, y, z, 0); FROST.set(k, W.tickN + 60 + Math.floor(Math.random() * 40)); } } // refreshed while you stand near it
    }
  }
  if (W.tickN % 10) return;
  for (const [k, due] of FROST) {
    if (due > W.tickN) continue;
    const [x, y, z] = k.split(',').map(Number);
    if (getBlock(x, y, z) !== FICE) { FROST.delete(k); continue; }
    const a = getMeta(x, y, z);
    if (a < 3) { setMeta(x, y, z, a + 1); FROST.set(k, W.tickN + 20 + Math.floor(Math.random() * 20)); } else { FROST.delete(k); setBlock(x, y, z, 27); }
  }
}
ENCH.frost_walker = ['차가운 걸음', 2, ['boots'], 1];

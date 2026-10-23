// Lush-cave plants (1.17): cave vines and glow berries, big dripleaves that tilt under you, small dripleaves,
// azalea trees, moss that spreads with bone meal, rooted dirt and hanging roots.

// ---------- growth ----------
// the bottom of a cave vine grows down now and then; new pieces sometimes carry glow berries
RANDOM_TICK[BID.cave_vines] = (x, y, z) => {
  if (getBlock(x, y - 1, z) !== 0 || Math.random() > 0.1) return;
  let n = 0; while (n < 25 && getBlock(x, y + n + 1, z) === BID.cave_vines) n++;
  if (n < 25) setBlock(x, y - 1, z, BID.cave_vines, Math.random() < 0.11 ? 1 : 0);
};

// ---------- big dripleaf: stand on it and it gives way ----------
const DL_DELAY = [0, 10, 10, 100]; // ticks spent in unstable, partial and full tilt (Java)
function dripleafTilt(x, y, z, t) {
  const m = getMeta(x, y, z); setBlock(x, y, z, BID.big_dripleaf, (m & 3) | (t << 2));
  if (t === 2 || t === 3) play(t === 3 ? 'door' : 'click', { vol: 0.5, pitch: 0.8 });
  if (t) schedule(x, y, z, DL_DELAY[t]);
}
SCHED_TICK[BID.big_dripleaf] = (x, y, z, b, m) => {
  const t = (m >> 2) & 3;
  if (t === 1) dripleafTilt(x, y, z, 2); else if (t === 2) dripleafTilt(x, y, z, 3); else if (t === 3) dripleafTilt(x, y, z, 0);
};
// called every player tick: an untilted leaf under the player starts to tip unless it is powered by redstone
function dripleafStep() {
  if (!PL.onGround || spectator()) return;
  const x = Math.floor(PL.x), y = Math.floor(PL.y - 0.05), z = Math.floor(PL.z);
  if (getBlock(x, y, z) !== BID.big_dripleaf || ((getMeta(x, y, z) >> 2) & 3) !== 0) return;
  if (typeof powerAt === 'function' && powerAt(x, y, z) > 0) return;
  dripleafTilt(x, y, z, 1);
}

// ---------- bone meal ----------
function growAzaleaTree(x, y, z) {
  const h = 4 + ((Math.random() * 2) | 0);
  for (let k = 1; k <= h + 2; k++) { const b = getBlock(x, y + k, z); if (b && !REPL[b] && !S.LEAF[b]) return false; }
  const soil = getBlock(x, y - 1, z); if (soil === 2 || soil === 3 || soil === BID.moss_block) setBlock(x, y - 1, z, BID.rooted_dirt);
  for (let k = 0; k < h; k++) setBlock(x, y + k, z, BID.oak_log);
  for (let dy = h - 2; dy <= h; dy++) {
    const r = dy === h ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if ((dx || dz || dy === h) && !(Math.abs(dx) === r && Math.abs(dz) === r && Math.random() < 0.6) && !getBlock(x + dx, y + dy, z + dz))
        setBlock(x + dx, y + dy, z + dz, Math.random() < 0.25 ? BID.flowering_azalea_leaves : BID.azalea_leaves, 0);
    }
  }
  for (let k = 2; k < 5 && getBlock(x, y - k, z) === 0; k++) if (k === 2 || Math.random() < 0.5) { setBlock(x, y - k, z, BID.hanging_roots); break; }
  return true;
}
// moss block: turns nearby stone and dirt into moss and plants moss carpet, grass and the odd azalea on top
const MOSSABLE = new Set([1, 2, 3, 91, 92, 93, 75, 76, 205, 203, 204, 1049]);
function spreadMoss(x, y, z) {
  const r = 2 + ((Math.random() * 2) | 0);
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
    if (Math.random() > ((Math.abs(dx) === r || Math.abs(dz) === r) ? 0.4 : 0.85)) continue;
    for (let dy = 2; dy >= -2; dy--) {
      const bx = x + dx, by = y + dy, bz = z + dz, b = getBlock(bx, by, bz);
      if ((MOSSABLE.has(b) || b === BID.moss_block) && !OPQ[getBlock(bx, by + 1, bz)]) {
        if (b !== BID.moss_block) setBlock(bx, by, bz, BID.moss_block);
        if (getBlock(bx, by + 1, bz) === 0 && Math.random() < 0.55) {
          const v = Math.random();
          setBlock(bx, by + 1, bz, v < 0.5 ? BID.short_grass : v < 0.85 ? BID.moss_carpet : v < 0.95 ? BID.azalea : BID.flowering_azalea);
        }
        break;
      }
    }
  }
}
// returns true/false when it handled the block, null for blocks it does not know
function lushBoneMeal(x, y, z, id) {
  const m = getMeta(x, y, z);
  if (id === BID.cave_vines) { if (m & 1) return false; setMeta(x, y, z, 1); return true; }
  if (id === BID.moss_block) { if (getBlock(x, y + 1, z) !== 0) return false; spreadMoss(x, y, z); return true; }
  if (id === BID.azalea || id === BID.flowering_azalea) { if (Math.random() < 0.45) { setBlock(x, y, z, 0, 0, { noUpdate: true }); if (!growAzaleaTree(x, y, z)) setBlock(x, y, z, id); } return true; }
  if (id === BID.rooted_dirt) { if (getBlock(x, y - 1, z) !== 0) return false; setBlock(x, y - 1, z, BID.hanging_roots); return true; }
  if (id === BID.big_dripleaf || id === BID.big_dripleaf_stem) { // the leaf climbs one block if there is room
    let hy = y; while (getBlock(x, hy, z) === BID.big_dripleaf_stem) hy++;
    if (getBlock(x, hy, z) !== BID.big_dripleaf || getBlock(x, hy + 1, z) !== 0) return false;
    const hm = getMeta(x, hy, z) & 3; setBlock(x, hy + 1, z, BID.big_dripleaf, hm, { noUpdate: true }); setBlock(x, hy, z, BID.big_dripleaf_stem); return true;
  }
  if (id === BID.small_dripleaf) { // grows into a big dripleaf 2-5 tall
    const by = m & 8 ? y - 1 : y, f = (Math.random() * 4) | 0; let h = 2 + ((Math.random() * 4) | 0);
    while (h > 2 && getBlock(x, by + h - 1, z) !== 0 && getBlock(x, by + h - 1, z) !== BID.small_dripleaf) h--;
    for (let k = 0; k < h; k++) setBlock(x, by + k, z, k === h - 1 ? BID.big_dripleaf : BID.big_dripleaf_stem, k === h - 1 ? f : 0, { noUpdate: true });
    return true;
  }
  return null;
}

// ---------- using items on lush blocks; returns true when the click was used ----------
function lushUse(t, h, d) {
  const { x, y, z, id, m } = t;
  if (id === BID.cave_vines && (m & 1)) { setMeta(x, y, z, 0); dropItem(x + .5, y + .5, z + .5, IID.glow_berries, 1); play('pop'); swing(); return true; } // pick glow berries
  if (!d) return false;
  if (d.tool && d.tool.type === S.TOOL.HOE && id === BID.rooted_dirt) { setBlock(x, y, z, 3); dropItem(x + .5, y + .5 + t.ny * 0.6, z + .5, BID.hanging_roots, 1); damageItem(INV.slots, INV.sel, 1); play('place', { mat: 'gravel' }); swing(); return true; }
  if (h.id === IID.glow_berries || h.id === BID.small_dripleaf || h.id === BID.big_dripleaf) {
    const px = x + t.nx, py = y + t.ny, pz = z + t.nz, cur = getBlock(px, py, pz);
    if (cur && !REPL[cur]) return true;
    if (h.id === IID.glow_berries) { // glow berries plant a cave vine under a ceiling or another vine
      const up = getBlock(px, py + 1, pz); if (!OPQ[up] && up !== BID.cave_vines) return false;
      setBlock(px, py, pz, BID.cave_vines, 0);
    } else if (h.id === BID.small_dripleaf) {
      const below = getBlock(px, py - 1, pz), above = getBlock(px, py + 1, pz);
      if ((below !== BID.clay && below !== BID.moss_block) || (above && !REPL[above])) return true;
      setBlock(px, py + 1, pz, BID.small_dripleaf, 8, { noUpdate: true }); setBlock(px, py, pz, BID.small_dripleaf, 0);
    } else { // big dripleaf: faces away from the player; placing one on another turns the lower one into stem
      if (getBlock(px, py - 1, pz) === BID.big_dripleaf) setBlock(px, py - 1, pz, BID.big_dripleaf_stem, 0, { noUpdate: true });
      const below = getBlock(px, py - 1, pz); if (below !== BID.big_dripleaf_stem && !LUSH_SOIL.has(below)) return true;
      setBlock(px, py, pz, BID.big_dripleaf, (facingDir() + 2) & 3);
    }
    consume(); play('place', { mat: 'grass' }); swing(); return true;
  }
  return false;
}

// ---------- ambience: spore blossoms shower green spores around them ----------
function lushDisplay(x, y, z, b) {
  if (b === BID.spore_blossom && Math.random() < 0.5) {
    R.simpleParticle(x + .5, y + 0.9, z + .5, [0.55, 0.75, 0.3], { size: 0.06, vx: (Math.random() - .5) * 0.2, vy: -0.05, vz: (Math.random() - .5) * 0.2, grav: 0.02, life: 4 });
    for (let i = 0; i < 2; i++) R.simpleParticle(x - 4 + Math.random() * 9, y - Math.random() * 8, z - 4 + Math.random() * 9, [0.5, 0.7, 0.3], { size: 0.04, vx: 1e-4, vy: -0.02, vz: 1e-4, grav: 0, life: 3 });
  }
}

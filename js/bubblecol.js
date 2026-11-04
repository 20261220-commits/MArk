// ---------- bubble columns (Java 1.13+) ----------
// Water source blocks standing on soul sand make a column that lifts whatever is in it; on a magma block, one that
// pulls it down. The column is worked out from the blocks each time (no block of its own): it goes up through water
// sources from the soul sand or magma block and stops at the first block that isn't one. Java's numbers, per tick:
// inside the column the speed goes toward 0.7 up (+0.06) or 0.3 down (-0.03); in its top block, under air, toward
// 1.8 up (+0.1, out of the water) or 0.9 down. Bubbles rise in a lifting column and whirl down in a dragging one.
const BCOL = { cache: new Map(), at: -1, bases: [], scanAt: -99 };
const bcolWater = (x, y, z) => FLUID[getBlock(x, y, z)] === 1 && getMeta(x, y, z) === 0;
// 1 lifting, -1 dragging, 0 none, for the block at x, y, z
function bubbleCol(x, y, z) {
  if (!bcolWater(x, y, z)) return 0;
  if (BCOL.at !== W.tickN) { BCOL.cache.clear(); BCOL.at = W.tickN; }
  const k = x + ',' + z + ',' + y; if (BCOL.cache.has(k)) return BCOL.cache.get(k);
  let yy = y - 1, n = 0; while (yy >= MINY && bcolWater(x, yy, z) && n++ < 384) yy--;
  const b = getBlock(x, yy, z), r = b === BID.soul_sand ? 1 : b === BID.magma_block ? -1 : 0;
  BCOL.cache.set(k, r); return r;
}
// the push, before an entity moves: its feet block decides (the top block, with air above, pushes harder)
function bubbleColPush(e, dy) {
  if (e.kind === 'arrow' || e.kind === 'fireball' || e.kind === 'frame' || e.kind === 'painting' || (e === PL && PL.mode === 'spectator')) return dy;
  const x = Math.floor(e.x), y = Math.floor(e.y + Math.min(0.2, (e.h || 0.5) * 0.4)), z = Math.floor(e.z), c = bubbleCol(x, y, z); if (!c) return dy;
  const top = getBlock(x, y + 1, z) === 0, v0 = e.vy || 0;
  let v = c > 0 ? Math.min(top ? 1.8 : 0.7, v0 + (top ? 0.1 : 0.06)) : Math.max(top ? -0.9 : -0.3, v0 - 0.03);
  if (e.kind === 'boat' && c > 0) v = Math.min(v, 0.15); // a boat on a lifting column bobs instead of flying off
  e.vy = v; if (!top || c < 0) e.fallDist = 0;
  return dy + (v - v0);
}
{ const pm = physMove; physMove = function (e, dx, dy, dz, stepUp) { if (e && (e === PL || e.kind === 'mob' || e.kind === 'item' || e.kind === 'boat' || e.kind === 'xp')) dy = bubbleColPush(e, dy); return pm.call(this, e, dx, dy, dz, stepUp); }; }
// bubbles: the columns near the player are found every second; each tick a few of them give off bubbles
function bubbleColTick() {
  if (!W.active || !R.simpleParticle) return;
  if (W.tickN - BCOL.scanAt >= 20) {
    BCOL.scanAt = W.tickN; BCOL.bases = [];
    const px = Math.floor(PL.x), py = Math.floor(PL.y), pz = Math.floor(PL.z), r = 12;
    for (let x = px - r; x <= px + r; x++) for (let z = pz - r; z <= pz + r; z++) for (let y = py - r; y <= py + r; y++) {
      const b = getBlock(x, y, z); if (b !== BID.soul_sand && b !== BID.magma_block) continue;
      if (!bcolWater(x, y + 1, z)) continue;
      let t = y + 1; while (t < MAXY - 1 && bcolWater(x, t + 1, z)) t++;
      BCOL.bases.push([x, y + 1, z, t, b === BID.soul_sand ? 1 : -1]);
      if (BCOL.bases.length > 200) break;
    }
  }
  for (const [x, y0, z, y1, c] of BCOL.bases) {
    for (let n = Math.min(3, 1 + ((y1 - y0) >> 2)); n > 0; n--) if (Math.random() < 0.6) { const y = y0 + Math.random() * (y1 - y0 + 1); R.simpleParticle(x + .5 + (Math.random() - .5) * 0.6, y, z + .5 + (Math.random() - .5) * 0.6, [0.7, 0.85, 1], { kind: 'bubble', size: 0.11, vx: (Math.random() - .5) * 0.2, vz: (Math.random() - .5) * 0.2, vy: c > 0 ? 2.5 : -1.5, grav: 0, life: 0.6 }); }
    if (getBlock(x, y1 + 1, z) === 0 && Math.random() < 0.3) { // the surface: bubbles bursting over a lifting column, a whirl over a dragging one
      const a = Math.random() * Math.PI * 2, rr = c > 0 ? 0.3 : 0.45;
      R.simpleParticle(x + .5 + Math.cos(a) * rr, y1 + 1.02, z + .5 + Math.sin(a) * rr, [0.85, 0.95, 1], { kind: 'bubble', size: 0.1, vx: c > 0 ? 0 : -Math.sin(a) * 0.8, vz: c > 0 ? 0 : Math.cos(a) * 0.8, vy: c > 0 ? 0.6 : 0, grav: 0, life: 0.5 });
    }
  }
}

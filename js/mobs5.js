// Turtles (home beaches, eggs, scutes), dolphins (dolphin's grace) and bees (nests and hives, pollination, honey,
// stinging), plus sweet berry bushes and honey blocks.

// ---------- shared swimming ----------
function swimToward(e, gx, gy, gz, sp) {
  const dx = gx - e.x, dy = gy - e.y, dz = gz - e.z, l = Math.hypot(dx, dy, dz) || 1;
  e.vx += (dx / l * sp - e.vx) * 0.1; e.vy += (dy / l * sp - e.vy) * 0.1; e.vz += (dz / l * sp - e.vz) * 0.1;
  e.yawTarget = Math.atan2(-dx, -dz); turn(e, 0.2);
  physMove(e, e.vx, e.vy, e.vz, 0);
  const hs = Math.hypot(e.vx, e.vz); e.walkAmt += (Math.min(1, hs * 8) - e.walkAmt) * 0.3; e.walk += hs * 6;
}
function waterGoal(e, r, yMin, yMax) {
  for (let k = 0; k < 8; k++) {
    const x = Math.floor(e.x + (Math.random() - .5) * r * 2), z = Math.floor(e.z + (Math.random() - .5) * r * 2), y = Math.floor(Math.max(yMin, Math.min(yMax, e.y + (Math.random() - .5) * 6)));
    if (getBlock(x, y, z) === BID.water) return [x + .5, y + .5, z + .5];
  }
  return null;
}

// ---------- turtles ----------
const TURTLE_M = autoModel(() => [
  ['shell', [0, 0, 0], [-9.5, 2, -10, 19, 6, 20], (k, x, y) => hex(k === 'bottom' ? 0xc8c090 : (x + y) % 6 < 2 ? 0x3a6a2a : 0x4a8a3a)],
  ['head', [0, 0, 0], [-3, 2, -15, 6, 5, 6], 0x78b850, 0, eyes('#101010', 1, 0, 5)],
  ['rleg', [6, 2, -7], [-2, -2, -3, 4, 1, 6], 0x78b850], ['lleg', [-6, 2, -7], [-2, -2, -3, 4, 1, 6], 0x78b850],
  ['rleg2', [6, 2, 8], [-2, -2, -2, 4, 1, 5], 0x78b850], ['lleg2', [-6, 2, 8], [-2, -2, -2, 4, 1, 5], 0x78b850],
], 128, 64);
function turtleAI(e) {
  e.home = e.home || [Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)];
  const [hx, hy, hz] = e.home;
  // carrying eggs: head home and dig them into the sand
  if (e.pregnant) {
    const dh = Math.hypot(hx + .5 - e.x, hz + .5 - e.z);
    if (dh < 2 && !e.inWater && e.onGround) {
      const bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z), g = getBlock(bx, by - 1, bz);
      if ((g === BID.sand || g === BID.red_sand) && !getBlock(bx, by, bz)) { setBlock(bx, by, bz, BID.turtle_egg, Math.floor(Math.random() * 4)); play('place', { mat: 'sand' }); }
      e.pregnant = false;
    } else if (e.inWater) { swimToward(e, hx + .5, Math.max(e.y, hy), hz + .5, 0.12); return; }
    else { faceTo(e, hx + .5, hz + .5); const [mx, mz] = pathDir(e, hx + .5, hy, hz + .5); walkPhysics(e, mx, mz, 0.05); return; }
  }
  if (e.love > 0) {
    const mate = ENT.find(o => o !== e && o.type === 'turtle' && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) < 8);
    if (mate) { if (Math.hypot(mate.x - e.x, mate.z - e.z) < 1.5) { e.love = mate.love = 0; e.pregnant = true; spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); } else if (e.inWater) { swimToward(e, mate.x, mate.y, mate.z, 0.1); return; } else { faceTo(e, mate.x, mate.z); const [mx, mz] = pathDir(e, mate.x, mate.y, mate.z); walkPhysics(e, mx, mz, 0.05); return; } }
  }
  if (e.inWater) {
    if (!e.goal || Math.random() < 0.01 || Math.hypot(e.goal[0] - e.x, e.goal[1] - e.y, e.goal[2] - e.z) < 1) e.goal = waterGoal(e, 10, 40, 62) || [e.x, e.y, e.z];
    swimToward(e, e.goal[0], e.goal[1], e.goal[2], 0.1); e.vy -= 0.005; return;
  }
  let mx = 0, mz = 0;
  if (!e.goal2 && Math.random() < 1 / 120) e.goal2 = [e.x + (Math.random() - .5) * 10, e.z + (Math.random() - .5) * 10];
  if (e.goal2) { const gx = e.goal2[0] - e.x, gz = e.goal2[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal2 = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  walkPhysics(e, mx, mz, e.held && isFood(e.def, e.held) ? 0.03 : 0.04);
}
// eggs hatch on sand, mostly at night: three stages, then one baby turtle per egg
RANDOM_TICK[BID.turtle_egg] = (x, y, z, b, m) => {
  const g = getBlock(x, y - 1, z); if (g !== BID.sand && g !== BID.red_sand) return;
  if (dayFactor() > 0.5 && Math.random() > 0.002) return;
  if ((m >> 2) < 2) { setMeta(x, y, z, m + 4); play('click', { pitch: 1.6, vol: 0.4 }); return; }
  setBlock(x, y, z, 0); play('break', { mat: 'glass' });
  for (let k = 0; k <= (m & 3); k++) { const t = spawnMob('turtle', x + .3 + Math.random() * .4, y, z + .3 + Math.random() * .4, { baby: true }); t.home = [x, y, z]; }
};
function turtleGrow(e) { dropItem(e.x, e.y + .3, e.z, IID.scute, 1); } // a baby turtle sheds a scute when it grows up
function turtleAnim(e, P) { for (const n of ['rleg', 'lleg', 'rleg2', 'lleg2']) if (P[n]) P[n].rotation.y = Math.sin(e.walk + (n.length & 1) * 2) * 0.5 * e.walkAmt; }

// ---------- dolphins ----------
const DOLPHIN_M = autoModel(() => [
  ['body', [0, 0, 0], [-4, 0, -6, 8, 7, 13], (k) => hex(k === 'bottom' ? 0xd8dce0 : 0x8a96a4)],
  ['head', [0, 0, 0], [-4, 0, -12, 8, 7, 6], (k) => hex(k === 'bottom' ? 0xd8dce0 : 0x8a96a4), 0, eyes('#101010', 2, 0, 7)],
  ['nose', [0, 0, 0], [-1, 0, -16, 2, 2, 4], 0x9aa4b0],
  ['fin', [0, 0, 0], [-0.5, 7, -2, 1, 4, 5], 0x7a8694],
  ['rleg', [4, 1, -4], [0, -1, -2, 5, 1, 4], 0x8a96a4], ['lleg', [-4, 1, -4], [-5, -1, -2, 5, 1, 4], 0x8a96a4],
  ['tail', [0, 3, 7], [-2, -2, 0, 4, 4, 9], 0x8a96a4], ['fluke', [0, 3, 7], [-5, -1, 8, 10, 1, 5], 0x7a8694],
]);
function dolphinAI(e, dist) {
  // out of water a dolphin dries out after two minutes
  if (!e.inWater) { e.dry = (e.dry || 0) + 1; if (e.dry > 2400 && e.age % 20 === 0) hurtMob(e, 1, null); e.vy -= 0.08; physMove(e, e.vx * 0.9, e.vy, e.vz * 0.9, 0); if (e.onGround && Math.random() < 0.05) { e.vy = 0.3; e.vx = (Math.random() - .5) * 0.2; e.vz = (Math.random() - .5) * 0.2; } return; }
  e.dry = 0;
  if (e.target === PL && (!plTargetable() || dist > 16)) e.target = null;
  if (e.target === PL) {
    swimToward(e, PL.x, PL.y + 0.5, PL.z, 0.2);
    if (dist < 1.6 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, 3, PL.x - e.x, PL.z - e.z); }
    return;
  }
  // swims along with a swimming player and gives them dolphin's grace
  if (PL.inWater && dist < 10 && !PL.dead && !spectator()) {
    const [dx, , dz] = lookDir(); swimToward(e, PL.x + dx * 2, PL.y + 0.3, PL.z + dz * 2, PL.sprinting ? 0.3 : 0.15);
    if (dist < 5 && e.age % 20 === 0) addEffect(PL, 'dolphins_grace', 100, 0);
    return;
  }
  if (!e.goal || Math.random() < 0.01 || Math.hypot(e.goal[0] - e.x, e.goal[1] - e.y, e.goal[2] - e.z) < 1.5) e.goal = waterGoal(e, 16, 50, 62) || [e.x, e.y, e.z];
  swimToward(e, e.goal[0], e.goal[1], e.goal[2], 0.15);
  // leaps out at the surface now and then
  if (!getBlock(Math.floor(e.x), Math.floor(e.y + 1), Math.floor(e.z)) && Math.random() < 1 / 150) { e.vy = 0.5; e.vx *= 2; e.vz *= 2; play('splash', { vol: 0.4 }); }
}
function dolphinAnim(e, P, now) { const s = Math.sin(now / 150 + e.id) * 0.3 * Math.max(0.3, e.walkAmt); if (P.tail) P.tail.rotation.x = s; if (P.fluke) P.fluke.rotation.x = s * 1.5; e.mesh.rotation.x = Math.max(-0.8, Math.min(0.8, e.vy * 3)); }

// ---------- bees ----------
const BEE_M = autoModel(v => [
  ['body', [0, 0, 0], [-3.5, 2, -5, 7, 7, 10], (k, x, y, w, h) => hex(k === 'front' ? (v ? 0xf0b030 : 0xe8b020) : (k === 'top' || k === 'bottom' ? (Math.floor(y / 2.5) % 2 ? 0x3a2a14 : 0xe8b020) : (Math.floor(x / 2.5) % 2 ? 0x3a2a14 : 0xe8b020))), 0,
    { front: (g, x, y) => { px(g, x + 1, y + 2, '#101010', 2, 2); px(g, x + 4, y + 2, '#101010', 2, 2); if (v) px(g, x + 1, y + 1, '#c02020', 5, 1); } }],
  ['sting', [0, 0, 0], [-0.5, 4.5, 5, 1, 1, 2], 0x3a2a14],
  ['ant1', [0, 0, 0], [-2, 7, -8, 1, 2, 3], 0x2a2014], ['ant2', [0, 0, 0], [1, 7, -8, 1, 2, 3], 0x2a2014],
  ['rwing', [1.5, 9, -2], [0, 0, 0, 6, 0.1, 6], () => [220, 235, 245]], ['lwing', [-1.5, 9, -2], [-6, 0, 0, 6, 0.1, 6], () => [220, 235, 245]],
  ['rleg', [2, 2, 0], [-0.5, -2, -2, 1, 2, 4], 0x3a2a14], ['lleg', [-2, 2, 0], [-0.5, -2, -2, 1, 2, 4], 0x3a2a14],
]);
const FLOWERS = new Set(['dandelion', 'poppy', 'cornflower', 'oxeye_daisy', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_the_valley', 'blue_orchid', 'flowering_azalea', 'flowering_azalea_leaves'].map(k => BID[k]).filter(v => v != null));
const HIVES = trackBlocks(BID.bee_nest), HIVES2 = trackBlocks(BID.beehive);
const isHive = b => b === BID.bee_nest || b === BID.beehive;
function hiveFront(x, y, z) { const d = DIRS[getMeta(x, y, z) & 3]; return [x + d[0] + .5, y + .2, z + d[2] + .5]; }
const beesOut = () => W.dim === 0 && dayFactor() > 0.45 && W.rain < 0.3;
function beeAI(e, dist) {
  const d = e.def, fly = (gx, gy, gz, sp) => {
    const dx = gx - e.x, dy = gy - e.y, dz = gz - e.z, l = Math.hypot(dx, dy, dz) || 1;
    e.vx += (dx / l * sp - e.vx) * 0.12; e.vy += (dy / l * sp - e.vy) * 0.12 + Math.sin(e.age / 6) * 0.004; e.vz += (dz / l * sp - e.vz) * 0.12;
    e.yawTarget = Math.atan2(-dx, -dz); turn(e, 0.3); physMove(e, e.vx, e.vy, e.vz, 0);
    if (e.hitH) e.vy += 0.08;
  };
  if (e.stung) { if (++e.stungT > 600) hurtMob(e, 99, null); fly(e.x + (Math.random() - .5), e.y - 0.2, e.z + (Math.random() - .5), 0.05); return; } // a bee that has stung slowly dies
  // angry bees (hit, or their hive was robbed) chase and sting
  if (e.target === PL && (!plTargetable() || dist > 24)) e.target = null;
  if (e.target === PL) {
    if (!e.spread) { e.spread = true; for (const o of ENT) if (o.type === 'bee' && o !== e && !o.dead && !o.stung && Math.hypot(o.x - e.x, o.z - e.z) < 10) o.target = PL; }
    fly(PL.x, PL.y + 1.2, PL.z, 0.2);
    if (dist < 1.5 && e.attackCd <= 0) {
      e.attackCd = 20;
      if (hurtPlayer(2 * DIFF_MUL() || 0, 'mob', e) !== false && PL.difficulty >= 2) addEffect(PL, 'poison', PL.difficulty === 3 ? 360 : 200, 0);
      e.stung = true; e.stungT = 0; e.target = null; hidePart(e, 'sting', false);
    }
    return;
  }
  e.spread = false;
  // the hive is gone: wander and look for another one
  if (e.hive && !isHive(getBlock(...e.hive))) e.hive = null;
  if (!e.hive && e.age % 40 === 0) { let best = null, bd = 20; for (const set of [HIVES, HIVES2]) for (const k of set) { const p = k.split(',').map(Number), dd = Math.hypot(p[0] - e.x, p[1] - e.y, p[2] - e.z); const t = getTile(...p); if (dd < bd && (!t || !t.bees || t.bees.length < 3)) { bd = dd; best = p; } } e.hive = best; }
  // go home at night, in rain, or with nectar
  if (e.hive && (!beesOut() || e.nectar && e.age > 200)) {
    const [fx, fy, fz] = hiveFront(...e.hive);
    if (Math.hypot(fx - e.x, fy - e.y, fz - e.z) < 1.2) { beeEnter(e); return; }
    fly(fx, fy + 0.3, fz, 0.13);
    // pollinating crops on the way home
    if (e.nectar && e.age % 20 === 0) { for (let dy = 1; dy <= 2; dy++) { const bx = Math.floor(e.x), by = Math.floor(e.y) - dy, bz = Math.floor(e.z), b = getBlock(bx, by, bz); if ((b === BID.wheat || b === BID.crops2) && (getMeta(bx, by, bz) & 7) < 7 && Math.random() < 0.3) { setMeta(bx, by, bz, getMeta(bx, by, bz) + 1); for (let i = 0; i < 3; i++) R.simpleParticle(bx + Math.random(), by + 0.8, bz + Math.random(), [0.4, 0.9, 0.3], { size: 0.08, vy: 0.4 }); } } }
    return;
  }
  // look for a flower, hover at it for a while to collect nectar
  if (!e.nectar) {
    if (!e.flower && e.age % 20 === 0) {
      const cx = e.hive ? e.hive[0] : e.x, cz = e.hive ? e.hive[2] : e.z;
      for (let k = 0; k < 40 && !e.flower; k++) { const x = Math.floor(e.x + (Math.random() - .5) * 16), y = Math.floor(e.y + (Math.random() - .5) * 8), z = Math.floor(e.z + (Math.random() - .5) * 16); if (FLOWERS.has(getBlock(x, y, z)) && Math.hypot(x - cx, z - cz) < 22) e.flower = [x, y, z]; }
    }
    if (e.flower) {
      if (!FLOWERS.has(getBlock(...e.flower))) { e.flower = null; e.pollT = 0; }
      else {
        const [fx, fy, fz] = e.flower; fly(fx + .5, fy + 0.6, fz + .5, 0.1);
        if (Math.hypot(fx + .5 - e.x, fy + .6 - e.y, fz + .5 - e.z) < 0.8 && ++e.pollT > 80) { e.nectar = true; e.flower = null; e.pollT = 0; e.age = Math.max(e.age, 201); }
        return;
      }
    }
  }
  if (e.love > 0) { const mate = ENT.find(o => o !== e && o.type === 'bee' && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) < 8); if (mate) { fly(mate.x, mate.y, mate.z, 0.1); if (Math.hypot(mate.x - e.x, mate.y - e.y, mate.z - e.z) < 1) { e.love = mate.love = 0; spawnMob('bee', e.x, e.y, e.z, { baby: true }).hive = e.hive; spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); } return; } }
  // wander around the hive
  const cx = e.hive ? e.hive[0] + .5 : e.x, cy = e.hive ? e.hive[1] : e.y, cz = e.hive ? e.hive[2] + .5 : e.z;
  if (!e.goal || Math.random() < 0.02 || Math.hypot(e.goal[0] - e.x, e.goal[1] - e.y, e.goal[2] - e.z) < 1) e.goal = [cx + (Math.random() - .5) * 14, cy + Math.random() * 4 - 1, cz + (Math.random() - .5) * 14];
  fly(e.goal[0], e.goal[1], e.goal[2], 0.07);
}
function beeAnim(e, P, now) {
  const f = Math.sin(now / 15) * 0.6; if (P.rwing) { P.rwing.rotation.z = f; P.lwing.rotation.z = -f; }
  e.mesh.position.y += Math.sin(now / 200 + e.id) * 0.03;
}
// into the hive: the bee is stored in the hive tile; nectar adds a level of honey
function beeEnter(e) {
  const [x, y, z] = e.hive, t = getTile(x, y, z) || { type: 'hive', bees: [] };
  if (!t.bees) t.bees = [];
  if (t.bees.length >= 3) { e.hive = null; return; }
  t.bees.push({ t: W.tickN, nectar: !!e.nectar, hp: e.hp, baby: e.baby > 0 ? 1 : 0 });
  setTile(x, y, z, t);
  if (e.nectar) { const m = getMeta(x, y, z); if ((m >> 2) < 5) setMeta(x, y, z, (m & 3) | (((m >> 2) + 1) << 2)); }
  removeEnt(e); play('click', { vol: 0.2, pitch: 1.5 });
}
function releaseBees(x, y, z, t, angry) {
  if (!t || !t.bees) return;
  const [fx, fy, fz] = isHive(getBlock(x, y, z)) ? hiveFront(x, y, z) : [x + .5, y + .2, z + .5];
  for (const b of t.bees) { const e = spawnMob('bee', fx, fy, fz, { baby: !!b.baby }); e.hive = isHive(getBlock(x, y, z)) ? [x, y, z] : null; if (b.hp) e.hp = b.hp; if (angry && plTargetable()) e.target = PL; }
  t.bees = [];
}
// hives let bees out by day (after 2 minutes inside with nectar, 30 s without)
function hiveTick() {
  if (W.tickN % 20 || W.dim !== 0) return;
  const out = beesOut();
  for (const set of [HIVES, HIVES2]) for (const k of set) {
    const [x, y, z] = k.split(',').map(Number), t = getTile(x, y, z);
    if (!t || !t.bees || !t.bees.length || !out) continue;
    const front = hiveFront(x, y, z); if (SOLID[getBlock(Math.floor(front[0]), Math.floor(front[1]), Math.floor(front[2]))]) continue;
    const ready = t.bees.filter(b => W.tickN - (b.t || 0) > (b.nectar ? 2400 : 600));
    if (!ready.length) continue;
    t.bees = t.bees.filter(b => !ready.includes(b));
    for (const b of ready) { const e = spawnMob('bee', front[0], front[1], front[2], { baby: !!b.baby }); e.hive = [x, y, z]; if (b.hp) e.hp = b.hp; }
    const c = chunkAt(x >> 4, z >> 4); if (c) c.modified = c.edited = true;
  }
}
// harvesting a full hive: glass bottle -> honey bottle, shears -> 3 honeycomb; bees attack unless a campfire smokes them
function hiveCalm(x, y, z) { for (let dy = 1; dy <= 5; dy++) { const b = getBlock(x, y - dy, z); if ((b === BID.campfire || b === BID.soul_campfire) && (getMeta(x, y - dy, z) & 4)) return true; if (OPQ[b]) break; } return false; }
function hiveUse(t, h) {
  const { x, y, z } = t, m = getMeta(x, y, z);
  if ((m >> 2) < 5 || !h || (h.id !== IID.glass_bottle && h.id !== IID.shears)) return false;
  if (h.id === IID.shears) { dropItem(x + .5, y + 1, z + .5, IID.honeycomb, 3); damageItem(INV.slots, INV.sel, 1); play('click'); }
  else { consume(); INV.giveOrDrop({ id: IID.honey_bottle, n: 1 }); play('splash', { vol: 0.4 }); }
  setMeta(x, y, z, m & 3);
  if (!hiveCalm(x, y, z)) { const tile = getTile(x, y, z); releaseBees(x, y, z, tile, true); for (const e of ENT) if (e.type === 'bee' && !e.dead && Math.hypot(e.x - x, e.z - z) < 16) e.target = PL; }
  swing(); return true;
}

// ---------- sweet berry bushes & honey blocks ----------
RANDOM_TICK[BID.sweet_berry_bush] = (x, y, z, b, m) => { if ((m & 3) < 3 && Math.random() < 0.2 && (getLight(x, y + 1, z) >> 4) >= 9) setMeta(x, y, z, m + 1); };
function berryUse(t) {
  const a = getMeta(t.x, t.y, t.z) & 3; if (a < 2) return false;
  dropItem(t.x + .5, t.y + .6, t.z + .5, IID.sweet_berries, a === 3 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2));
  setMeta(t.x, t.y, t.z, 1); play('pop', { vol: 0.6 }); swing(); return true;
}
// per tick: thorns of sweet berry bushes (not for foxes), the turtle shell's water breathing
function animalTick() {
  hiveTick(); raidTick();
  if (W.dim === 0 && !PL.sleeping && !PL.dead && !creative() && !spectator()) PL.rest = (PL.rest || 0) + 1; // ticks since the last sleep (phantoms)
  if (W.tickN % 1200 === 600) trySpawnPhantoms();
  if (W.tickN % 12000 === 6000) trySpawnPatrol();
  if (W.tickN % 200 === 100) outpostSpawn();
  if (W.tickN % 24000 === 1000 && typeof trySpawnTrader === 'function') trySpawnTrader();
  if (W.tickN % 10 === 0 && INV.armor[0] && INV.armor[0].id === IID.turtle_helmet && fluidAt(PL.x, PL.y + PL.eyeH, PL.z) !== 1) addEffect(PL, 'water_breathing', 200, 0);
}
function inBerryBush(e) { return boxBlocks(e, b => b === BID.sweet_berry_bush) ; }

Object.assign(MOBDEF, {
  turtle: { hp: 30, w: 0.6, h: 0.4, speed: 0.04, xp: 2, snd: 'splash', drops: [], parts: TURTLE_M.parts, tw: 128, th: 64, tex: () => TURTLE_M.tex(0), food: ['seagrass'], ai: turtleAI, anim: turtleAnim, onGrow: turtleGrow,
    save: e => ({ home: e.home || null, pregnant: !!e.pregnant }), init: (e, o) => { if (o.home) e.home = o.home; if (o.pregnant) e.pregnant = true; } },
  dolphin: { hp: 10, w: 0.45, h: 0.6, speed: 0.12, xp: 2, snd: 'splash', neutral: 1, drops: [['cod', 0, 1]], parts: DOLPHIN_M.parts, tex: () => DOLPHIN_M.tex(0), ai: dolphinAI, anim: dolphinAnim },
  bee: { hp: 10, w: 0.35, h: 0.6, speed: 0.07, xp: 2, snd: 'hmm', neutral: 1, fly: 1, fallReduce: 99, drops: [], parts: BEE_M.parts, tex: () => BEE_M.tex(0), food: [...FLOWERS].map(id => BLOCKS[id].key).filter(k => IID[k] != null),
    ai: beeAI, anim: beeAnim, save: e => ({ hive: e.hive || null, nectar: !!e.nectar }), init: (e, o) => { if (o.hive) e.hive = o.hive; if (o.nectar) e.nectar = true; } },
});

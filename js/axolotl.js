// 1.17 water mobs: axolotls (five colours, hunt fish and drowned underwater, play dead, dry out on land,
// bred with buckets of tropical fish) and tropical fish (a few colour patterns, caught in buckets).

// ---------- models (MC box UV layout on a 64x64 canvas; the front faces -z) ----------
const AXO_COL = [ // [body, gills, belly] for lucy (pink), wild (brown), gold, cyan, blue
  [0xf6b4c8, 0xe0588a, 0xfad0dc], [0x6e5642, 0x9a7a58, 0x8a7058], [0xf0c048, 0xe89a20, 0xf8d878], [0xdcecf0, 0xe878a8, 0xeef6f8], [0x4c5ad8, 0x8a96f0, 0x7080e8]];
const AXO_PARTS = [
  ['body', [0, 2, 0], [-4, 0, -5, 8, 4, 10], [0, 11]],
  ['head', [0, 3, -5], [-4, -1, -5, 8, 5, 5], [0, 0]],
  ['gillt', [0, 3, -5], [-4, 4, -2, 8, 2, 1], [40, 8]], ['gillr', [0, 3, -5], [-6, 0, -2, 2, 4, 1], [40, 12]], ['gilll', [0, 3, -5], [4, 0, -2, 2, 4, 1], [40, 12]],
  ['rleg', [3, 2, -3.5], [-1, -2, -1, 2, 2, 2], [40, 0]], ['lleg', [-3, 2, -3.5], [-1, -2, -1, 2, 2, 2], [40, 0]],
  ['rleg2', [3, 2, 3.5], [-1, -2, -1, 2, 2, 2], [40, 0]], ['lleg2', [-3, 2, 3.5], [-1, -2, -1, 2, 2, 2], [40, 0]],
  ['tail', [0, 3, 5], [-0.5, -1, 0, 1, 4, 10], [0, 26]],
];
function axolotlTex(v) {
  const [bc, gc, lc] = AXO_COL[v] || AXO_COL[0];
  return mobCanvas(g => {
    const r = trng(91 + v), spots = v === 1;
    const skin = (k, x, y) => k === 'bottom' ? hex(lc) : spots && (x * 7 + y * 3) % 11 === 0 ? shade(hex(bc), 0.7) : hex(bc);
    paintBox(g, 0, 0, 8, 5, 5, skin, r, 0.1, { front: (g, x, y) => { px(g, x, y + 1, '#101010'); px(g, x + 7, y + 1, '#101010'); px(g, x + 2, y + 3, '#2a1a20', 4, 1); } });
    paintBox(g, 0, 11, 8, 4, 10, skin, r, 0.1);
    paintBox(g, 0, 26, 1, 4, 10, (k, x, y) => shade(hex(bc), 0.92), r, 0.1);
    paintBox(g, 40, 0, 2, 2, 2, () => hex(bc), r, 0.1);
    paintBox(g, 40, 8, 8, 2, 1, () => hex(gc), r, 0.15); paintBox(g, 40, 12, 2, 4, 1, () => hex(gc), r, 0.15);
  });
}
// tropical fish: [base, pattern] colours; even variants have a stripe, odd ones a spotted back
const TFISH_COL = [[0xf08a20, 0xf4f4f4], [0xf4f4f4, 0xf08a20], [0x3a6ad8, 0xf0d040], [0xe8d030, 0x3a6ad8], [0xd84040, 0xf4f4f4], [0x40c0c0, 0xf06aa0],
  [0x8a4ad8, 0xf0d040], [0x40a040, 0xf0f0a0], [0x303030, 0xf08a20], [0xf06aa0, 0x40c0c0], [0xf4f4f4, 0x303030], [0xf0d040, 0xd84040]];
const TFISH_PARTS = [
  ['body', [0, 1, 0], [-1, 0, -3, 2, 3, 6], [0, 0]],
  ['tail', [0, 2.5, 3], [-0.5, -1.5, 0, 1, 3, 3], [0, 10]],
  ['fin', [0, 4, 0], [-0.5, 0, -1, 1, 2, 3], [10, 10]],
];
function tropicalFishTex(v) {
  const [bc, pc] = TFISH_COL[v % TFISH_COL.length];
  return mobCanvas(g => {
    const r = trng(57 + v);
    paintBox(g, 0, 0, 2, 3, 6, (k, x, y) => (v % 2 === 0 ? (x === 2 || x === 3) : (x + y) % 3 === 0) ? hex(pc) : hex(bc), r, 0.08,
      { left: (g, x, y) => px(g, x + 1, y + 1, '#101010'), right: (g, x, y) => px(g, x + 4, y + 1, '#101010') });
    paintBox(g, 0, 10, 1, 3, 3, () => hex(pc), r, 0.08); paintBox(g, 10, 10, 1, 2, 3, () => hex(pc), r, 0.08);
  });
}
const AXO_PREY = new Set(['cod', 'salmon', 'tropical_fish', 'squid', 'glow_squid', 'drowned']);
Object.assign(MOBDEF, {
  axolotl: { hp: 14, w: 0.375, h: 0.42, speed: 0.1, xp: 2, snd: 'splash', drops: [], parts: AXO_PARTS, tex: () => axolotlTex(0), vtex: axolotlTex,
    variant: () => (Math.random() * 4) | 0, food: 'tropical_fish_bucket', ai: axolotlAI, anim: axolotlAnim },
  tropical_fish: { hp: 3, w: 0.25, h: 0.4, speed: 0.04, xp: 1, snd: 'splash', water: 1, fish: 1, drops: [['tropical_fish', 1, 1]], extraDrop: [['bone_meal', 0.05]], parts: TFISH_PARTS, tex: () => tropicalFishTex(0), vtex: tropicalFishTex,
    variant: () => (Math.random() * TFISH_COL.length) | 0 },
});

// ---------- axolotl behaviour ----------
function axolotlAI(e, dist) {
  const d = e.def;
  // moisture: 6000 ticks out of water (rain counts as water), then 1 damage per hit-cooldown
  const wet = e.inWater || (W.dim === 0 && W.rain > 0.5 && (getLight(Math.floor(e.x), Math.floor(e.y + e.h), Math.floor(e.z)) >> 4) === 15);
  e.moist = wet ? 6000 : (e.moist == null ? 6000 : e.moist) - 1;
  if (e.moist <= 0) hurtMob(e, 1, null);
  // playing dead: a hurt axolotl in water has a 1 in 3 chance to go limp for 10 seconds and heal
  if (e.lastHp != null && e.hp < e.lastHp && e.hp > 0 && e.inWater && !(e.playDead > 0) && Math.random() < 1 / 3) { e.playDead = 200; e.target = null; }
  e.lastHp = e.hp;
  if (e.playDead > 0) {
    e.playDead--; if (e.playDead % 50 === 0 && e.hp < d.hp) e.hp = Math.min(d.hp, e.hp + 1);
    e.vx *= 0.8; e.vz *= 0.8; e.vy = e.inWater ? Math.max(e.vy - 0.005, -0.03) : (e.vy - 0.08) * 0.98;
    physMove(e, e.vx, e.vy, e.vz, 0); e.walkAmt = 0; return;
  }
  // hunting underwater; mobs the player hit recently come first
  if (e.target && (e.target.dead || e.target.deathT || Math.hypot(e.target.x - e.x, e.target.y - e.y, e.target.z - e.z) > 16)) e.target = null;
  if (!e.target && e.inWater && e.age % 20 === 0 && !e.baby) {
    let best = null, bd = 8;
    for (const o of ENT) {
      if (o.kind !== 'mob' || o.dead || o.deathT || !AXO_PREY.has(o.type) || !o.inWater) continue;
      const dd = Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) - (W.tickN - (o.plHitT || -1e9) < 200 ? 6 : 0);
      if (dd < bd) { bd = dd; best = o; }
    }
    e.target = best;
  }
  // breeding: two axolotls in love make a baby that takes a parent's colour (blue: 1 in 1200)
  if (e.love > 0) {
    const mate = ENT.find(o => o !== e && o.type === 'axolotl' && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8);
    if (mate) {
      e.goal = [mate.x, mate.y, mate.z];
      if (Math.hypot(mate.x - e.x, mate.z - e.z) < 1.2) { e.love = mate.love = 0; spawnMob('axolotl', e.x, e.y, e.z, { baby: true, variant: Math.random() < 1 / 1200 ? 4 : (Math.random() < 0.5 ? e : mate).variant }); ADVT.bred('axolotl'); spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); }
    }
  }
  const lure = PL.held() && PL.held().id === IID.tropical_fish_bucket && dist < 8 && !e.love && PL.mode !== 'spectator';
  if (e.inWater) {
    let tx, ty, tz, sp = 0.06;
    if (e.target) { tx = e.target.x; ty = e.target.y + e.target.h * 0.4; tz = e.target.z; sp = 0.12; }
    else if (lure) { tx = PL.x; ty = PL.y + 0.5; tz = PL.z; }
    else if (e.love > 0 && e.goal && e.goal.length === 3) [tx, ty, tz] = e.goal;
    else { if (!e.goal || e.goal.length !== 3 || Math.random() < 0.01) e.goal = [e.x + (Math.random() - .5) * 10, e.y + (Math.random() - .5) * 4, e.z + (Math.random() - .5) * 10]; [tx, ty, tz] = e.goal; }
    const gx = tx - e.x, gy = ty - e.y, gz = tz - e.z, gl = Math.hypot(gx, gy, gz) || 1;
    if (gl < 0.8 && !e.target) e.goal = null;
    e.vx += (gx / gl * sp - e.vx) * 0.12; e.vy += (gy / gl * sp - e.vy) * 0.12; e.vz += (gz / gl * sp - e.vz) * 0.12;
    if (fluidAt(e.x, e.y + e.h + 0.1, e.z) !== 1 && e.vy > 0) e.vy = 0; // stays under the surface
    e.yawTarget = Math.atan2(-gx, -gz); turn(e, 0.25);
    physMove(e, e.vx, e.vy, e.vz, 0.6);
    if (e.target && e.attackCd <= 0 && gl < e.w + e.target.w + 0.6) {
      e.attackCd = 20; const t = e.target; hurtMob(t, 2, e);
      if (t.hp <= 0 && W.tickN - (t.plHitT || -1e9) < 200) addEffect(PL, 'regeneration', Math.min(2400, ((PL.eff && PL.eff.regeneration && PL.eff.regeneration.lv === 0 ? PL.eff.regeneration.t : 0)) + 100), 0); // helped the player: Regeneration I
    }
    const hs = Math.hypot(e.vx, e.vy, e.vz); e.walkAmt += (Math.min(1, hs * 10) - e.walkAmt) * 0.3; e.walk += hs * 5;
  } else {
    // on land: crawl slowly, heading for nearby water
    if (!e.goal || e.goal.length !== 2 || Math.random() < 0.005) {
      e.goal = null;
      for (let k = 0; k < 12 && !e.goal; k++) { const wx = Math.floor(e.x + (Math.random() - .5) * 16), wz = Math.floor(e.z + (Math.random() - .5) * 16); for (let wy = Math.floor(e.y) + 2; wy >= Math.floor(e.y) - 3; wy--) if (getBlock(wx, wy, wz) === BID.water) { e.goal = [wx + .5, wz + .5]; break; } }
      if (!e.goal) e.goal = [e.x + (Math.random() - .5) * 8, e.z + (Math.random() - .5) * 8];
    }
    if (lure) e.goal = [PL.x, PL.z];
    const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz) || 1;
    faceTo(e, e.goal[0], e.goal[1]);
    walkPhysics(e, gl > 0.5 ? gx / gl : 0, gl > 0.5 ? gz / gl : 0, 0.03);
  }
  if (e.y < voidY()) removeEnt(e);
}
function axolotlAnim(e, P, now) {
  const swim = e.inWater && !(e.playDead > 0), t = now / 120 + e.id;
  if (P.tail) P.tail.rotation.y = Math.sin(t * (swim ? 1.6 : 0.8)) * (swim ? 0.5 : 0.25);
  for (const n of ['rleg', 'lleg', 'rleg2', 'lleg2']) if (P[n] && swim) P[n].rotation.x = 1.1; // legs tucked back while swimming
  for (const n of ['gillt', 'gillr', 'gilll']) if (P[n]) P[n].rotation.x = Math.sin(now / 300 + e.id) * 0.08;
  if (e.playDead > 0) e.mesh.rotation.z = Math.PI / 2; // lying on its side
  else if (swim) e.mesh.rotation.x = Math.max(-0.5, Math.min(0.5, -e.vy * 6));
}

// ---------- spawning ----------
// 1.17: groups of axolotls in dark water below sea level, over clay
function trySpawnAxolotl() {
  if (W.dim !== 0 || countMobs(e => e.type === 'axolotl' && Math.hypot(e.x - PL.x, e.z - PL.z) < 64) >= 6) return;
  const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 32, x = Math.floor(PL.x + Math.cos(a) * r), z = Math.floor(PL.z + Math.sin(a) * r);
  if (!isLoaded(x, z)) return;
  for (let y = S.SEA; y > MINY + 2; y--) {
    if (getBlock(x, y, z) !== BID.water || getBlock(x, y - 1, z) !== BID.clay) continue;
    if (getLight(x, y, z) !== 0) return; // no sky light and no block light
    const n = 1 + ((Math.random() * 4) | 0), v = MOBDEF.axolotl.variant();
    for (let i = 0; i < n; i++) spawnMob('axolotl', x + .5 + (Math.random() - .5), y + .1, z + .5 + (Math.random() - .5), { variant: Math.random() < 0.7 ? v : undefined });
    return;
  }
}
// tropical fish school in warm and lukewarm oceans; pufferfish too
function spawnWarmFish(c) {
  const b = S.BB[c.biome[8 * 16 + 8]]; if (b !== S.BIO.WARM_OCEAN && b !== S.BIO.LUKEWARM_OCEAN) return;
  const R0 = S.rng(S.hash32(W.seed, c.cx, c.cz, 23)); if (R0() > 0.25) return;
  if (R0() < 0.3) { for (let i = 0; i < 1 + R0.int(3); i++) { const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12), y = 50 + R0.int(9); if (c.blocks[BI(x, y, z)] === 27) spawnMob('pufferfish', x + .5, y, z + .5); } return; }
  const v = R0.int(TFISH_COL.length);
  for (let i = 0; i < 4 + R0.int(5); i++) { const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12), y = 52 + R0.int(8); if (c.blocks[BI(x, y, z)] === 27) spawnMob('tropical_fish', x + .5, y, z + .5, { variant: v }); }
}
// glow squid (1.17): dark water at y 30 and below
function trySpawnGlowSquid() {
  if (W.dim !== 0 || countMobs(e => e.type === 'glow_squid' && Math.hypot(e.x - PL.x, e.z - PL.z) < 64) >= 5) return;
  const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 32, x = Math.floor(PL.x + Math.cos(a) * r), z = Math.floor(PL.z + Math.sin(a) * r);
  if (!isLoaded(x, z)) return;
  for (let y = 30; y > 2; y--) {
    if (getBlock(x, y, z) !== BID.water || getBlock(x, y + 1, z) !== BID.water) continue;
    if (getLight(x, y, z) !== 0) return;
    for (let i = 1 + ((Math.random() * 3) | 0); i > 0; i--) spawnMob('glow_squid', x + .5, y, z + .5);
    return;
  }
}

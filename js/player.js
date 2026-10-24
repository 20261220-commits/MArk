// Player: movement physics (Java Edition constants, 20 TPS), survival stats, mining, combat, item use.
const PL = {
  x: 0.5, y: 80, z: 0.5, px: 0.5, py: 80, pz: 0.5, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, yaw: 0, pitch: 0, onGround: false,
  mode: 'survival', hardcore: false, difficulty: 2, flying: false, sprinting: false, sneaking: false, eye: 1.62, eyeH: 1.62,
  health: 20, food: 20, sat: 5, exh: 0, air: 300, level: 0, xpP: 0, xpTotal: 0, fallDist: 0, fire: 0, hurtT: 0, inv: 0, dead: false,
  foodTimer: 0, spawn: null, regen: 0, sleeping: 0, absorb: 0, attackT: 100, lastHurtBy: null, cam: 0, bob: 0, bobPrev: 0, walkDist: 0, stepDist: 0,
};
PL.held = () => INV.slots[INV.sel];
const IN = { f: 0, s: 0, jump: false, sneak: false, sprintKey: false, attack: false, use: false, lastSpace: 0, lastW: 0, wTap: false };
const MINE = { x: 0, y: 0, z: 0, id: -1, prog: 0, cd: 0, ticks: 0 };
const USE = { t: 0, kind: null, placeCd: 0 };
const creative = () => PL.mode === 'creative';
const spectator = () => PL.mode === 'spectator';

// a box authored pointing up, turned to point along DIR6 index f
function rot6Box(b, f) {
  const [x0, y0, z0, x1, y1, z1] = b, P = (x, y, z) => f === 1 ? [x, y, z] : f === 0 ? [x, 16 - y, z] : f === 2 ? [x, z, 16 - y] : f === 3 ? [x, z, y] : f === 4 ? [16 - y, x, z] : [y, x, z];
  const a = P(x0, y0, z0), c = P(x1, y1, z1); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])];
}
function selShape(id, m) {
  const rt = RTYPE[id];
  if (id === BID.banner) return [[4, 0, 4, 12, 16, 12]];
  if (id === BID.wall_banner) { const f = (m >> 4) & 3; return [[[0, 0, 14, 16, 16, 16], [0, 0, 0, 2, 16, 16], [0, 0, 0, 16, 16, 2], [14, 0, 0, 16, 16, 16]][f]]; }
  if (rt === RT.CROSS) { if (id === BID.sugar_cane) return [[2, 0, 2, 14, 16, 14]]; if (id === BID.cobweb) return null; if (S.BUD[id]) { const h = [3, 4, 5, 7][S.BUD[id] - 1]; return [rot6Box([3, 0, 3, 13, h, 13], m ? m - 1 : 1)]; } if (id === BID.pointed_dripstone) return [[5, 0, 5, 11, 16, 11]]; return [[3, 0, 3, 13, 13, 13]]; }
  if (rt === RT.TORCH) { if (m >= 1 && m <= 4) { const d = DIRS[m - 1]; const ox = d[0] * 5, oz = d[2] * 5; return [[5.5 + ox, 3, 5.5 + oz, 10.5 + ox, 13, 10.5 + oz]]; } return [[6, 0, 6, 10, 10, 10]]; }
  if (rt === RT.CROP) return [[0, 0, 0, 16, 2 + (m & 7) * 2, 16]];
  if (rt === RT.BOX) return S.shapes(id, m);
  if (rt === RT.WIRE) { const sh = S.isRail(id) ? S.railShape(id, m) : 0; return [[0, 0, 0, 16, sh >= 2 && sh <= 5 ? 8 : S.isRail(id) ? 2 : 1, 16]]; }
  return null;
}
// ray vs axis-aligned box: returns [t, face] or null
function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity, face = -1;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [b[0], b[1], b[2]], hi = [b[3], b[4], b[5]];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return null; continue; }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a], f1 = a * 2 + 1, f2 = a * 2;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; const f = f1; f1 = f2; f2 = f; }
    if (t1 > tmin) { tmin = t1; face = f1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return [Math.max(0, tmin), face];
}
const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; // face idx from rayBox: a*2+1 = min side (negative normal)
function lookDir() { const cp = Math.cos(PL.pitch); return [-Math.sin(PL.yaw) * cp, Math.sin(PL.pitch), -Math.cos(PL.yaw) * cp]; }
function raycast(reach, fluids) {
  const [dx, dy, dz] = lookDir();
  const ox = PL.x, oy = PL.y + PL.eyeH, oz = PL.z;
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
  let tx = dx ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity, ty = dy ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity, tz = dz ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
  let best = null;
  for (let i = 0; i < 64; i++) {
    const id = getBlock(x, y, z);
    if (id && (!FLUID[id] || (fluids && getMeta(x, y, z) === 0))) {
      const m = getMeta(x, y, z), boxes = FLUID[id] ? [[0, 0, 0, 16, 14, 16]] : (selShape(id, m) || [[0, 0, 0, 16, 16, 16]]);
      for (const b of boxes) {
        const h = rayBox(ox, oy, oz, dx, dy, dz, [x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16]);
        if (h && h[0] <= reach && (!best || h[0] < best.t)) { const n = FACE_N[h[1]]; const hn = [h[1] % 2 ? -Math.abs(n[0]) : Math.abs(n[0]), h[1] % 2 ? -Math.abs(n[1]) : Math.abs(n[1]), h[1] % 2 ? -Math.abs(n[2]) : Math.abs(n[2])]; best = { type: 'block', x, y, z, id, m, nx: hn[0], ny: hn[1], nz: hn[2], t: h[0], hy: oy + dy * h[0] - y }; }
      }
      if (best) break;
    }
    const tn = Math.min(tx, ty, tz); if (tn > reach) break;
    if (tx <= ty && tx <= tz) { x += sx; tx += tdx; } else if (ty <= tz) { y += sy; ty += tdy; } else { z += sz; tz += tdz; }
  }
  // entities
  for (const e of ENT) {
    if ((e.kind !== 'mob' && !e.hittable) || e.dead || e.deathT || e === PL.riding) continue;
    const h = rayBox(ox, oy, oz, dx, dy, dz, e.box || [e.x - e.w - .05, e.y, e.z - e.w - .05, e.x + e.w + .05, e.y + e.h, e.z + e.w + .05]);
    const lim = creative() ? 5 : 3;
    if (h && h[0] <= lim && (!best || h[0] < best.t)) best = { type: 'ent', e, t: h[0] };
  }
  return best;
}

// ---------- damage & stats ----------
function armorPoints() { let p = 0, t = 0; for (const s of INV.armor) if (s) { const a = ITEMS[s.id].armor; p += a.pts; t += a.tough; } return [p, t]; }
function hurtPlayer(dmg, cause, attacker, from) { // from: the projectile or explosion position, for shields
  if (PL.dead || spectator()) return false;
  if (creative() && cause !== 'void' && cause !== 'kill') return false;
  if (PL.inv > 0 && cause !== 'void' && cause !== 'kill') return false;
  if (dmg <= 0) return false;
  if (shieldBlocks(dmg, cause, attacker, from)) return false;
  if (effLv(PL, 'fire_resistance') && (cause === 'fire' || cause === 'lava')) return false;
  const res = effLv(PL, 'resistance'); if (res && cause !== 'void' && cause !== 'kill' && cause !== 'starve') { dmg *= Math.max(0, 1 - 0.2 * res); if (dmg <= 0) return false; }
  if (cause === 'mob' || cause === 'arrow' || cause === 'explosion') {
    const [pts, tough] = armorPoints();
    dmg = dmg * (1 - Math.min(20, Math.max(pts / 5, pts - dmg / (2 + tough / 4))) / 25);
    const epf = INV.armor.reduce((a, s) => a + enchLv(s, 'protection'), 0); dmg *= 1 - Math.min(20, epf) * 0.04; // protection
    for (let i = 0; i < 4; i++) if (INV.armor[i]) damageItem(INV.armor, i, Math.max(1, Math.floor(dmg / 4)));
  }
  if (PL.absorb > 0) { const a = Math.min(PL.absorb, dmg); PL.absorb -= a; dmg -= a; }
  PL.health = Math.max(0, PL.health - dmg); PL.hurtT = 10; PL.inv = 10; PL.exh += 0.1; PL.lastHurtBy = cause;
  if (attacker) PL.hurtDir = Math.atan2(attacker.z - PL.z, attacker.x - PL.x) - PL.yaw; else PL.hurtDir = 0;
  if (attacker && attacker.kind === 'mob') PL.lastAttacked = attacker;
  play('hurt');
  if (PL.health <= 0 && cause !== 'void' && cause !== 'kill') { // totem of undying (held anywhere in the hotbar: there is no off-hand)
    const k = INV.slots.findIndex((s, i) => i < 9 && s && s.id === IID.totem_of_undying);
    if (k >= 0) { INV.slots[k] = null; PL.health = 1; clearEffects(PL); addEffect(PL, 'regeneration', 900, 1); addEffect(PL, 'absorption', 100, 1); addEffect(PL, 'fire_resistance', 800, 0); PL.fire = 0; play('levelup'); for (let i = 0; i < 40; i++) R.simpleParticle(PL.x, PL.y + 1, PL.z, [0.4 + Math.random() * 0.4, 0.9, 0.2], { size: 0.15, vy: 2 + Math.random() * 2, vx: (Math.random() - .5) * 3, vz: (Math.random() - .5) * 3, grav: 0.4, life: 1.5 }); UI.flash('불사의 토템이 발동했습니다!'); UI.hudDirty = true; return true; }
  }
  if (PL.health <= 0) die(cause);
  UI.hudDirty = true;
  return true;
}
const DEATH_MSG = { fall: '높은 곳에서 떨어졌습니다', mob: '몹에게 살해당했습니다', arrow: '화살에 맞았습니다', explosion: '폭발했습니다', drown: '익사했습니다', lava: '용암에서 수영하려 했습니다', fire: '불에 타 죽었습니다', starve: '굶어 죽었습니다', void: '세계 밖으로 떨어졌습니다', suffocate: '벽 속에서 질식했습니다', cactus: '선인장에 찔려 죽었습니다', magic: '마법으로 죽었습니다', wither: '말라 죽었습니다', poison: '독으로 죽었습니다', freeze: '얼어 죽었습니다', lightning: '벼락에 맞았습니다', stalagmite: '석순에 찔렸습니다', stalactite: '떨어지는 종유석에 찔렸습니다', berry: '달콤한 열매 덤불에 찔려 죽었습니다', kill: '죽었습니다' };
function die(cause) {
  PL.dead = true; PL.sleeping = 0; PL.rest = 0;
  if (!W.keepInv) {
    const all = [...INV.slots, ...INV.armor]; INV.slots.fill(null); INV.armor.fill(null);
    for (const s of all) if (s) dropStack(PL.x, PL.y + 1, PL.z, s, [(Math.random() - .5) * .4, .2, (Math.random() - .5) * .4], 40);
    const xp = Math.min(100, PL.level * 7); if (xp) spawnXP(PL.x, PL.y + 1, PL.z, xp);
    PL.level = 0; PL.xpP = 0; PL.xpTotal = 0;
  }
  UI.showDeath('플레이어가 ' + (DEATH_MSG[cause] || '죽었습니다'));
}
function respawn() {
  const sp = PL.spawn || W.worldSpawn;
  if (PL.spawnDim === -1 && PL.spawn) { // a respawn anchor in the Nether
    PL.health = 20; PL.food = 20; PL.sat = 5; PL.exh = 0; PL.air = 300; PL.fire = 0; PL.fallDist = 0; PL.dead = false; PL.inv = 60; PL.vx = PL.vy = PL.vz = 0; UI.hudDirty = true;
    if (W.dim !== -1) switchDim(-1, sp[0] + .5, sp[1] + 1, sp[2] + .5, 'anchor'); else anchorArrive();
    return;
  }
  if (W.dim !== 0) { PL.health = 20; PL.food = 20; PL.sat = 5; PL.air = 300; PL.fire = 0; PL.dead = false; PL.inv = 60; switchDim(0, sp[0] + .5, sp[1], sp[2] + .5, 'spawn'); UI.hudDirty = true; return; }
  PL.x = sp[0] + .5; PL.y = sp[1]; PL.z = sp[2] + .5; PL.vx = PL.vy = PL.vz = 0;
  PL.health = 20; PL.food = 20; PL.sat = 5; PL.exh = 0; PL.air = 300; PL.fire = 0; PL.fallDist = 0; PL.dead = false; PL.inv = 60;
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z;
  UI.hudDirty = true;
}
function xpNeeded(l) { return l < 16 ? 2 * l + 7 : l < 31 ? 5 * l - 38 : 9 * l - 158; }
function addXP(v) {
  PL.xpTotal += v; PL.xpP += v / xpNeeded(PL.level);
  let up = false; while (PL.xpP >= 1) { PL.xpP = (PL.xpP - 1) * xpNeeded(PL.level); PL.level++; PL.xpP /= xpNeeded(PL.level); up = true; }
  play(up && PL.level % 5 === 0 ? 'levelup' : 'xp'); UI.hudDirty = true;
}
function damageItem(arr, i, n = 1) {
  if (creative()) return;
  const s = arr[i]; if (!s) return; const d = ITEMS[s.id]; if (!d.dur) return;
  const ub = enchLv(s, 'unbreaking'); if (ub && Math.random() > (d.armor ? 0.6 + 0.4 / (ub + 1) : 1 / (ub + 1))) return; // unbreaking
  s.d = (s.d || 0) + n;
  if (s.d >= d.dur) { arr[i] = null; play('break', { mat: 'metal' }); UI.flash(d.name + ' 부서짐'); }
  UI.hudDirty = true;
}

// ---------- movement ----------
function blockUnder() { return getBlock(Math.floor(PL.x), Math.floor(PL.y - 0.2), Math.floor(PL.z)); }
function inBlock(f) { return boxBlocks(PL, f); }
function noCollision(x, y, z) { const n = gatherBoxes(x - PL.w, y, z - PL.w, x + PL.w, y + PL.h, z + PL.w); for (let i = 0; i < n * 6; i += 6) if (BX[i + 3] > x - PL.w && BX[i] < x + PL.w && BX[i + 4] > y && BX[i + 1] < y + PL.h && BX[i + 5] > z - PL.w && BX[i + 2] < z + PL.w) return false; return true; }
function playerTick() {
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.bobPrev = PL.bob;
  if (PL.attackT < 1000) PL.attackT++;
  if (PL.dead) return;
  if (PL.inv > 0) PL.inv--; if (PL.hurtT > 0) PL.hurtT--;
  if (PL.sleeping) { PL.sleeping++; if (PL.sleeping > 100) { W.time = Math.ceil(W.time / 24000) * 24000; W.rain = 0; W.rainTarget = 0; W.thunderOn = false; W.thunder = 0; PL.sleeping = 0; PL.rest = 0; catGifts(); UI.flash('좋은 아침이에요!'); UI.advance('sleep'); } return; }
  const spec = spectator();
  const feet = fluidAt(PL.x, PL.y + 0.05, PL.z), waist = fluidAt(PL.x, PL.y + 0.6, PL.z), eyeF = fluidAt(PL.x, PL.y + PL.eyeH, PL.z);
  const inWater = !spec && (feet === 1 || waist === 1), inLava = !spec && (feet === 2 || waist === 2);
  PL.inWater = inWater; PL.eyeFluid = spec ? 0 : eyeF;
  if (PL.riding) { rideTick(); if (!spec) survivalTick(false, false, 0); interactTick(); return; }
  let web = false, snowB = false, ladder = false, scaf = false;
  if (!spec) inBlock(b => { if (b === BID.cobweb) web = true; if (b === BID.powder_snow) snowB = true; if (BLOCKS[b].climb || b === BID.vine) ladder = true; if (b === BID.scaffolding) scaf = true; });
  if (snowB && INV.armor[3] && INV.armor[3].id === IID.leather_boots && !PL.sneaking && getBlock(Math.floor(PL.x), Math.floor(PL.y - 0.01), Math.floor(PL.z)) === BID.powder_snow) { snowB = false; UI.advance('snow'); }
  PL.inSnowBody = snowB;
  PL.inSnow = snowB && getBlock(Math.floor(PL.x), Math.floor(PL.y + PL.eyeH), Math.floor(PL.z)) === BID.powder_snow;
  // input
  let f = IN.f, s = IN.s;
  const using = USE.kind === 'eat' || USE.kind === 'bow' || USE.kind === 'shield' || USE.kind === 'crossbow' || USE.kind === 'trident';
  if (PL.shieldCd > 0) PL.shieldCd--;
  PL.sneaking = IN.sneak && !PL.flying && !spec;
  if (PL.sneaking) { f *= 0.3; s *= 0.3; }
  if (using) { f *= 0.2; s *= 0.2; }
  const canSprint = (PL.food > 6 || creative()) && !PL.sneaking && !using && f > 0.8 && !web;
  if ((IN.sprintKey || IN.wTap) && canSprint) PL.sprinting = true;
  if (PL.sprinting && (f < 0.8 || !canSprint || (PL.hitH && !inWater))) PL.sprinting = false;
  if (f <= 0) IN.wTap = false;
  const sp = 0.1 * (PL.sprinting ? 1.3 : 1) * speedMul();
  const len = Math.hypot(f, s), fn = len > 1 ? f / len : f, sn = len > 1 ? s / len : s;
  const sin = Math.sin(PL.yaw), cos = Math.cos(PL.yaw);
  const accel = (a) => { PL.vx += (-sin * fn + cos * sn) * a * 0.98; PL.vz += (-cos * fn - sin * sn) * a * 0.98; };
  if (spec || (PL.flying && (creative() || spec))) {
    accel(PL.sprinting ? 0.1 : 0.05);
    if (IN.jump) PL.vy += 0.15; if (IN.sneak) PL.vy -= 0.15;
    if (spec) { PL.x += PL.vx; PL.y += PL.vy; PL.z += PL.vz; PL.onGround = false; }
    else { physMove(PL, PL.vx, PL.vy, PL.vz, 0); if (PL.onGround && !spec) PL.flying = false; }
    PL.vx *= 0.91; PL.vz *= 0.91; PL.vy *= 0.6; PL.fallDist = 0;
  } else if (elytraTick()) { // gliding handled entirely there
  } else if (inWater || inLava) {
    accel(0.02 * (inWater && PL.sprinting ? 2 : 1) * (inWater && effLv(PL, 'dolphins_grace') ? 2.5 : 1));
    if (IN.jump) PL.vy += 0.04;
    physMove(PL, PL.vx, PL.vy, PL.vz, 0.6);
    const fr = inWater ? 0.8 : 0.5;
    PL.vx *= fr; PL.vz *= fr; PL.vy *= fr; PL.vy -= 0.02;
    if (PL.hitH && noCollision(PL.x + PL.vx, PL.y + 0.6, PL.z + PL.vz) && !fluidAt(PL.x, PL.y + 1.2, PL.z)) PL.vy = 0.3; // climb out of water onto a ledge
    PL.fallDist = 0;
  } else {
    const slipB = blockUnder(), sl = BLOCKS[slipB] && BLOCKS[slipB].slip, slip = PL.onGround ? (sl === 2 ? 0.989 : sl ? 0.98 : 0.6) : 1;
    const fr = slip * 0.91;
    accel(PL.onGround ? sp * (0.21600002 / (fr * fr * fr)) : (PL.sprinting ? 0.026 : 0.02));
    if (ladder) { PL.vx = Math.max(-0.15, Math.min(0.15, PL.vx)); PL.vz = Math.max(-0.15, Math.min(0.15, PL.vz)); PL.vy = Math.max(PL.vy, PL.sneaking ? 0 : -0.15); PL.fallDist = 0; }
    if (scaf) { if (IN.jump) PL.vy = 0.2; else if (PL.sneaking) PL.vy = -0.15; }
    if (IN.jump && PL.onGround && USE.jumpCd <= 0) {
      PL.vy = (0.42 + 0.1 * effLv(PL, 'jump_boost')) * (blockUnder() === BID.honey_block ? 0.5 : 1); USE.jumpCd = 10;
      if (PL.sprinting) { PL.vx += -sin * 0.2; PL.vz += -cos * 0.2; PL.exh += 0.2; } else PL.exh += 0.05;
    }
    let mx = PL.vx, my = PL.vy, mz = PL.vz;
    if (PL.onGround && (slipB === BID.soul_sand || slipB === BID.honey_block)) { mx *= 0.4; mz *= 0.4; }
    if (!spec && inBerryBush(PL)) { mx *= 0.8; my = Math.max(my, -0.08) * (my > 0 ? 0.75 : 1); mz *= 0.8; if ((Math.abs(PL.x - PL.px) > 0.003 || Math.abs(PL.z - PL.pz) > 0.003) && W.tickN % 10 === 0 && !creative()) hurtPlayer(1, 'berry'); }
    if (web) { mx *= 0.25; my *= 0.05; mz *= 0.25; PL.fallDist = 0; }
    if (snowB) { mx *= 0.9; my *= 1.5; mz *= 0.9; my = Math.max(my, -0.1); PL.fallDist = 0; }
    // sneak edge protection
    if (PL.sneaking && PL.onGround) {
      const step = 0.05;
      while (mx !== 0 && noCollision(PL.x + mx, PL.y - 0.6, PL.z)) mx = Math.abs(mx) < step ? 0 : mx - Math.sign(mx) * step;
      while (mz !== 0 && noCollision(PL.x, PL.y - 0.6, PL.z + mz)) mz = Math.abs(mz) < step ? 0 : mz - Math.sign(mz) * step;
      while (mx !== 0 && mz !== 0 && noCollision(PL.x + mx, PL.y - 0.6, PL.z + mz)) { mx = Math.abs(mx) < step ? 0 : mx - Math.sign(mx) * step; mz = Math.abs(mz) < step ? 0 : mz - Math.sign(mz) * step; }
    }
    const oy = PL.y;
    PHYS.snowSolid = !!(INV.armor[3] && INV.armor[3].id === IID.leather_boots) && !PL.sneaking; PHYS.scafTop = !PL.sneaking;
    physMove(PL, mx, my, mz, 0.6); PHYS.snowSolid = false; PHYS.scafTop = false;
    if (web || snowB) { if (PL.vx) PL.vx = mx; if (PL.vz) PL.vz = mz; }
    if (ladder && PL.hitH) PL.vy = 0.2;
    if (PL.onGround && blockUnder() === BID.slime_block && !PL.sneaking && my < -0.1) { PL.vy = -my * 0.95; PL.fallDist = 0; } // slime blocks bounce
    else if (PL.onGround) {
      const sgy = [Math.floor(PL.y - 0.01), Math.floor(PL.y + 0.01)].find(yy => getBlock(Math.floor(PL.x), yy, Math.floor(PL.z)) === BID.pointed_dripstone && getMeta(Math.floor(PL.x), yy, Math.floor(PL.z)) === 1);
      if (sgy != null && PL.fallDist > 1 && !creative()) { hurtPlayer(Math.ceil((PL.fallDist - 1) * 2), 'stalagmite'); play('hit'); PL.fallDist = 0; } // a stalagmite doubles fall damage and adds two blocks
      if (PL.fallDist > 3 + effLv(PL, 'jump_boost') && !creative()) { const dmg = Math.ceil((PL.fallDist - 3 - effLv(PL, 'jump_boost')) * (1 - Math.min(0.8, enchLv(INV.armor[3], 'feather_falling') * 0.12 + INV.armor.reduce((a, s) => a + enchLv(s, 'protection'), 0) * 0.04))); const lb = blockUnder(); if (lb !== BID.hay_block && lb !== BID.honey_block) hurtPlayer(dmg, 'fall'); else hurtPlayer(Math.ceil(dmg * 0.2), 'fall'); if (dmg > 0) play('hit'); }
      PL.fallDist = 0;
    } else if (PL.y < oy) PL.fallDist += oy - PL.y;
    if (!(PL.vy > 0 && PL.onGround)) PL.vy = (PL.vy - 0.08) * 0.98;
    PL.vx *= fr; PL.vz *= fr;
  }
  const lev = effLv(PL, 'levitation'); if (lev && !PL.flying) { PL.vy += (0.05 * lev - PL.vy) * 0.2; PL.fallDist = 0; } // shulker bullets
  else if (effLv(PL, 'slow_falling') && PL.vy < -0.05 && !PL.flying) { PL.vy = Math.max(PL.vy, -0.08); PL.fallDist = 0; }
  IN.jumpWas = IN.jump;
  if (USE.jumpCd > 0) USE.jumpCd--;
  if (!IN.jump) USE.jumpCd = 0;
  // walking stats & sounds
  const moved = Math.hypot(PL.x - PL.px, PL.z - PL.pz);
  if (PL.onGround && !inWater) { PL.bob += moved; PL.stepDist += moved; if (PL.stepDist > 1.7) { PL.stepDist = 0; const b = blockUnder(); if (b) play('step', { mat: soundMat(b), vol: PL.sneaking ? 0.3 : 0.8 }); } }
  if (PL.sprinting && PL.onGround) PL.exh += moved * 0.1; else if (inWater) PL.exh += moved * 0.01;
  // eye height (sneak)
  const targetEye = PL.sneaking ? 1.27 : 1.62; PL.eyeH += (targetEye - PL.eyeH) * 0.5;
  if (!spec) survivalTick(inWater, inLava, eyeF);
  if (PL.onGround && !spec) plateCheck(PL);
  portalTick();
  dripleafStep(); stepVibration();
  interactTick();
}
function survivalTick(inWater, inLava, eyeF) {
  // air
  effectTick(PL);
  if (eyeF === 1 && !effLv(PL, 'water_breathing') && !effLv(PL, 'conduit_power')) { PL.air--; if (PL.air <= -20) { PL.air = 0; hurtPlayer(2, 'drown'); } }
  else PL.air = Math.min(300, PL.air + 4);
  // fire & lava
  campfireStand();
  const cx = Math.floor(PL.x), cy = Math.floor(PL.y + 0.3), cz = Math.floor(PL.z);
  if (getBlock(cx, cy, cz) === BID.cauldron && (getMeta(cx, cy, cz) & 3)) { const k = (getMeta(cx, cy, cz) >> 2) & 3; if (k === 1) inLava = true; else if (k === 0) inWater = true; }
  if (inLava) { PL.fire = 300; if (W.tickN % 10 === 0) hurtPlayer(4, 'lava'); }
  if (inWater || (W.rain > 0.5 && (getLight(Math.floor(PL.x), Math.floor(PL.y + 1.8), Math.floor(PL.z)) >> 4) === 15)) PL.fire = 0;
  if (PL.fire > 0) { PL.fire--; if (PL.fire % 20 === 0 && !inLava) hurtPlayer(1, 'fire'); }
  // contact damage
  inBlock(b => { if (b === BID.cactus) { hurtPlayer(1, 'cactus'); return true; } if (b === BID.fire) { PL.fire = Math.max(PL.fire, 160); if (W.tickN % 10 === 0) hurtPlayer(1, 'fire'); return true; } });
  if (PL.onGround && blockUnder() === BID.magma_block && !PL.sneaking && W.tickN % 20 === 0 && !enchLv(INV.armor[3], 'frost_walker')) hurtPlayer(1, 'fire');
  const around = (dx, dz) => getBlock(Math.floor(PL.x + dx), Math.floor(PL.y + 0.5), Math.floor(PL.z + dz)) === BID.cactus;
  if (around(PL.w + 0.05, 0) || around(-PL.w - 0.05, 0) || around(0, PL.w + 0.05) || around(0, -PL.w - 0.05)) hurtPlayer(1, 'cactus');
  // suffocation
  const hb = getBlock(Math.floor(PL.x), Math.floor(PL.y + PL.eyeH), Math.floor(PL.z));
  if (OPQ[hb] && SOLID[hb] && hb !== BID.powder_snow && W.tickN % 10 === 0) hurtPlayer(1, 'suffocate');
  if (PL.y < -64) hurtPlayer(4, 'void');
  // freezing (1.17): 140 ticks inside powder snow to freeze fully, thaws twice as fast; any leather armour piece or burning prevents it
  const canFreeze = !creative() && PL.fire <= 0 && !INV.armor.some(s => s && ITEMS[s.id].armor.mat === 'leather');
  PL.frozen = PL.inSnowBody && canFreeze ? Math.min(140, (PL.frozen || 0) + 1) : Math.max(0, (PL.frozen || 0) - 2);
  if (PL.frozen >= 140 && W.tickN % 40 === 0) hurtPlayer(1, 'freeze');
  if (creative()) return;
  // hunger
  if (PL.difficulty === 0) { if (W.tickN % 20 === 0 && PL.health < 20) PL.health = Math.min(20, PL.health + 1); if (W.tickN % 20 === 0 && PL.food < 20) PL.food++; }
  if (PL.exh >= 4) { PL.exh -= 4; if (PL.sat > 0) PL.sat = Math.max(0, PL.sat - 1); else if (PL.difficulty > 0) PL.food = Math.max(0, PL.food - 1); UI.hudDirty = true; }
  PL.foodTimer++;
  if (PL.food >= 20 && PL.sat > 0 && PL.health < 20) { if (PL.foodTimer >= 10) { const a = Math.min(PL.sat, 6); PL.health = Math.min(20, PL.health + a / 6); PL.exh += a; PL.foodTimer = 0; UI.hudDirty = true; } }
  else if (PL.food >= 18 && PL.health < 20) { if (PL.foodTimer >= 80) { PL.health = Math.min(20, PL.health + 1); PL.exh += 6; PL.foodTimer = 0; UI.hudDirty = true; } }
  else if (PL.food <= 0) { if (PL.foodTimer >= 80) { if (PL.health > 10 || PL.difficulty === 3 || (PL.health > 1 && PL.difficulty === 2)) hurtPlayer(1, 'starve'); PL.foodTimer = 0; } }
  else PL.foodTimer = 0;
}

// ---------- interaction ----------
let TARGET = null;
function reach() { return creative() ? 5 : 4.5; }
function interactTick() {
  const held = PL.held();
  TARGET = raycast(reach(), held && (held.id === IID.bucket || held.id === IID.glass_bottle || ITEMS[held.id].boat || held.id === IID.oak_boat || held.id === IID.lily_pad));
  if (MINE.cd > 0) MINE.cd--;
  if (USE.placeCd > 0) USE.placeCd--;
  // mining
  if (IN.attack && !PL.sleeping && TARGET && TARGET.type === 'block' && MINE.cd <= 0) {
    const t = TARGET;
    if (creative()) { breakBlock(t.x, t.y, t.z); MINE.cd = 5; }
    else {
      if (MINE.x !== t.x || MINE.y !== t.y || MINE.z !== t.z || MINE.id !== t.id) { MINE.x = t.x; MINE.y = t.y; MINE.z = t.z; MINE.id = t.id; MINE.prog = 0; MINE.ticks = 0; }
      const need = breakTicks(t.id, held, PL.onGround || PL.flying, PL.eyeFluid === 1, t.m);
      if (need === Infinity) MINE.prog = 0;
      else {
        MINE.prog += need === 0 ? 1 : 1 / need; MINE.ticks++;
        R.hand.swing = Math.max(R.hand.swing, 0.01);
        if (MINE.ticks % 4 === 1) { play('dig', { mat: soundMat(t.id), vol: 0.5 }); R.blockParticles(t.x, t.y, t.z, t.id, 1, lightBright(t.x + .5, t.y + 1, t.z + .5)); }
        if (MINE.prog >= 1) { breakBlock(t.x, t.y, t.z); MINE.prog = 0; MINE.id = -1; MINE.cd = need === 0 ? 0 : 5; }
      }
    }
  } else if (!IN.attack || !TARGET || TARGET.type !== 'block') { MINE.prog = 0; MINE.id = -1; }
  // continuous use
  if (IN.use && !PL.sleeping) {
    if (USE.kind === 'eat') {
      USE.t++; R.hand.eat = 1;
      if (USE.t % 4 === 0 && USE.t > 8) { play('eat', { vol: 0.5 }); const h = PL.held(); if (h) for (let i = 0; i < 3; i++) R.simpleParticle(PL.x - Math.sin(PL.yaw) * .4, PL.y + 1.4, PL.z - Math.cos(PL.yaw) * .4, [0.8, 0.6, 0.4], { size: 0.06, vy: 1, life: 0.4 }); }
      if (USE.t >= 32) finishEat();
    } else if (USE.kind === 'bow') { USE.t++; R.hand.bow = Math.min(1, USE.t / 20); }
    else if (USE.kind === 'shield' || USE.kind === 'trident') USE.t++;
    else if (USE.kind === 'crossbow') { USE.t++; R.hand.bow = Math.min(1, USE.t / Math.max(1, crossbowCharge(PL.held()))); if (USE.t === crossbowCharge(PL.held())) play('click', { pitch: 1.4 }); }
    else if (USE.kind === 'spy') { R.hand.spy = true; }
    else if (USE.kind === 'place' && USE.placeCd <= 0) { useItem(false); }
  }
}
function swing() { if (R.hand.swing <= 0 || R.hand.swing < 0.5) R.hand.swing = 1; }
function onAttackPress() {
  swing();
  const t = TARGET;
  if (t && t.type === 'ent') { attackEntity(t.e); return; }
  PL.attackT = 0;
}
function attackEntity(e) {
  if (e.kind !== 'mob') { if (e.onHit) e.onHit(e); PL.attackT = 0; return; }
  PL.lastAttacked = e;
  const h = PL.held(), tool = h && ITEMS[h.id] && ITEMS[h.id].tool;
  const sharp = enchLv(h, 'sharpness'), base = (tool ? tool.dmg : 1) + (sharp ? 0.5 * sharp + 0.5 : 0), as = tool ? tool.as : 4;
  const p = Math.min(1, (PL.attackT + 0.5) / (20 / as));
  let dmg = Math.max(0, base + meleeBonus()) * (0.2 + p * p * 0.8);
  const crit = p > 0.9 && PL.vy < 0 && !PL.onGround && !PL.inWater;
  if (crit) { dmg *= 1.5; for (let i = 0; i < 10; i++) R.simpleParticle(e.x + (Math.random() - .5) * .6, e.y + e.h * .6, e.z + (Math.random() - .5) * .6, [0.9, 0.9, 0.8], { size: 0.08, vy: 1 }); }
  PL.attackT = 0;
  const kb = (PL.sprinting && p > 0.9 ? 1.6 : 1) + enchLv(h, 'knockback') * 0.8;
  const s = Math.sin(PL.yaw), c = Math.cos(PL.yaw);
  if (hurtMob(e, dmg, PL, -s * kb, -c * kb, 'player')) { if (e.def.thorns && e.def.thorns(e)) hurtPlayer(2, 'magic', e); /* guardian spikes */ PL.exh += 0.1; if (PL.sprinting) PL.sprinting = false; play('hit'); }
  if (tool) damageItem(INV.slots, INV.sel, tool.type === S.TOOL.SWORD ? 1 : 2);
}
function breakBlock(x, y, z) {
  { const bb = getBlock(x, y, z); if (bb === BID.gold_block || bb === BID.gilded_blackstone || bb === BID.nether_gold_ore) piglinAnger(x, y, z); } // piglins guard their gold
  const id = getBlock(x, y, z), m = getMeta(x, y, z); if (!id || BLOCKS[id].hard < 0 && !creative()) return;
  if (BLOCKS[id].hard < 0) return;
  vibrate(x + .5, y + .5, z + .5);
  const held = PL.held();
  play('break', { mat: soundMat(id) });
  R.blockParticles(x, y, z, id, 24, lightBright(x + .5, y + 1, z + .5), m);
  // multi-block
  if (S.DOOR[id]) { const oy = m & 8 ? -1 : 1; if (getBlock(x, y + oy, z) === id) setBlock(x, y + oy, z, 0, 0, { noUpdate: true }); }
  if (id === BID.red_bed) { const d = DIRS[m & 3], s = (m & 4) ? -1 : 1; if (getBlock(x + d[0] * s, y, z + d[2] * s) === id) setBlock(x + d[0] * s, y, z + d[2] * s, 0, 0, { noUpdate: true }); }
  if ((id === BID.piston || id === BID.sticky_piston) && (m & 8)) { const d = S.DIR6[m & 7]; if (getBlock(x + d[0], y + d[1], z + d[2]) === BID.piston_head) setBlock(x + d[0], y + d[1], z + d[2], 0, 0, { noUpdate: true }); }
  if (id === BID.piston_head) { const d = S.DIR6[m & 7], bx = x - d[0], by = y - d[1], bz = z - d[2], bb = getBlock(bx, by, bz); if (bb === BID.piston || bb === BID.sticky_piston) { setBlock(bx, by, bz, 0); if (!creative()) dropItem(bx + .5, by + .3, bz + .5, bb, 1); } }
  blocks6Break(x, y, z, id, m);
  let repl = 0;
  if (id === BID.ice && !creative() && SOLID[getBlock(x, y - 1, z)]) repl = 27;
  setBlock(x, y, z, repl);
  if (!creative()) {
    const d = blockDrops(id, m, held);
    if (S.DOOR[id] && (m & 8)) d.items.length = 0, d.items.push([id, 1]);
    for (const [iid, n] of d.items) dropItem(x + .5, y + .3, z + .5, iid, n);
    if (d.xp) spawnXP(x + .5, y + .5, z + .5, d.xp);
    PL.exh += 0.005;
    const tool = held && ITEMS[held.id].tool; if (tool && BLOCKS[id].hard > 0) damageItem(INV.slots, INV.sel, tool.type === S.TOOL.SWORD ? 2 : 1);
    if (held && held.id === IID.shears) damageItem(INV.slots, INV.sel, 1);
  }
  // water flows into the gap
  for (const [dx, dy, dz] of N6) { const b = getBlock(x + dx, y + dy, z + dz); if (FLUID[b]) schedule(x + dx, y + dy, z + dz, b === 27 ? 5 : 30); }
}
function finishEat() {
  const h = PL.held(); USE.kind = null; USE.t = 0; R.hand.eat = 0;
  if (!h) return;
  const d = ITEMS[h.id];
  if (d.drink) { drinkPotion(h); return; }
  if (h.id === IID.milk_bucket) { clearEffects(PL); INV.slots[INV.sel] = creative() ? h : { id: IID.bucket, n: 1 }; play('burp'); return; }
  if (!d.food) return;
  PL.food = Math.min(20, PL.food + d.food[0]); PL.sat = Math.min(PL.food, PL.sat + d.food[0] * d.food[1] / d.food[0] * 1);
  if (h.stew) addEffect(PL, h.stew[0], h.stew[1], 0); // suspicious stew
  PL.sat = Math.min(PL.food, PL.sat);
  if (d.cures && PL.eff && PL.eff[d.cures]) { delete PL.eff[d.cures]; UI.hudDirty = true; }
  if (d.eff) for (const [k, dur, lv, ch] of d.eff) if (ch == null || Math.random() < ch) addEffect(PL, k, dur, lv);
  if (d.chorusTp) chorusTeleport();
  if (h.id === IID.rotten_flesh && Math.random() < 0.8) PL.exh += 4;
  play('burp');
  if (!creative()) { h.n--; if (h.n <= 0) INV.slots[INV.sel] = d.leaves ? { id: IID[d.leaves], n: 1 } : null; else if (d.leaves) INV.add({ id: IID[d.leaves], n: 1 }); }
  UI.hudDirty = true;
}
function onUsePress() {
  const h = PL.held(), d = h && ITEMS[h.id];
  if (PL.sleeping) return;
  // eat / drink
  const plantBerries = d && h.id === IID.glow_berries && TARGET && TARGET.type === 'block' && (TARGET.ny === -1 || TARGET.id === BID.cave_vines); // aimed at a ceiling: plant instead of eating
  if (d && d.drink) { if (!(TARGET && TARGET.type === 'block' && (TARGET.id === BID.cauldron && h.id === POTION.water.items.potion || interactBlock(TARGET, true)))) { USE.kind = 'eat'; USE.t = 0; } return; }
  if (d && !plantBerries && (d.food || h.id === IID.milk_bucket) && (PL.food < 20 || d.always || creative() || h.id === IID.milk_bucket || PL.difficulty === 0)) {
    if (!(TARGET && TARGET.type === 'block' && interactBlock(TARGET, true))) { USE.kind = 'eat'; USE.t = 0; return; }
  }
  if (d && h.id === IID.bow) { if (creative() || arrowSlot() >= 0) { USE.kind = 'bow'; USE.t = 0; } return; }
  if (d && h.id === IID.shield) { if (!(PL.shieldCd > 0)) { USE.kind = 'shield'; USE.t = 0; } return; }
  if (d && h.id === IID.crossbow) { if (h.ch) crossbowFire(h); else if (creative() || arrowSlot() >= 0) { USE.kind = 'crossbow'; USE.t = 0; } return; }
  if (d && h.id === IID.trident) { USE.kind = 'trident'; USE.t = 0; return; }
  if (d && h.id === IID.spyglass) { USE.kind = 'spy'; UI.advance('spyglass'); return; }
  USE.kind = 'place';
  useItem(true);
}
function onUseRelease() {
  if (USE.kind === 'bow') {
    const charge = Math.min(1, USE.t / 20), f = (charge * charge + charge * 2) / 3;
    if (f >= 0.1) {
      const [dx, dy, dz] = lookDir(); const v = f * 3;
      const bowSt = PL.held(), pw = enchLv(bowSt, 'power');
      const ai = arrowSlot(), ast = ai >= 0 ? INV.slots[ai] : null;
      const arr = shootArrow(PL.x + dx * 0.4, PL.y + PL.eyeH - 0.1, PL.z + dz * 0.4, dx * v, dy * v, dz * v, PL, 2 * (pw ? 1 + 0.25 * (pw + 1) : 1));
      if (ast && ITEMS[ast.id].tipped != null) { arr.potion = ITEMS[ast.id].tipped; arr.item = ast.id; }
      if (!creative()) { if (ast && (!enchLv(bowSt, 'infinity') || ast.id !== IID.arrow)) { ast.n--; if (!ast.n) INV.slots[ai] = null; } else if (enchLv(bowSt, 'infinity')) arr.noPickup = true; damageItem(INV.slots, INV.sel, 1); }
    }
  }
  if (USE.kind === 'crossbow' && PL.held() && PL.held().id === IID.crossbow) crossbowRelease(PL.held());
  if (USE.kind === 'trident' && PL.held() && PL.held().id === IID.trident) tridentRelease(PL.held());
  if (USE.kind === 'eat') R.hand.eat = 0;
  USE.kind = null; USE.t = 0; R.hand.bow = 0; R.hand.spy = false; R.hand.eat = 0;
}
function interactBlock(t, dry) {
  if (PL.sneaking && PL.held()) return false;
  const { x, y, z, id, m } = t;
  if (isHive(id)) { const h = PL.held(); if ((m >> 2) >= 5 && h && (h.id === IID.glass_bottle || h.id === IID.shears)) { if (!dry) hiveUse(t, h); return true; } return false; }
  if (id === BID.sweet_berry_bush && (m & 3) >= 2 && !(PL.held() && PL.held().id === IID.bone_meal)) { if (!dry) berryUse(t); return true; }
  { const r = blocks6Use(t, PL.held(), dry); if (r !== null) return r; }
  switch (id) {
    case 198: case 246: { const cd = S.candleOf(id, m); if (!cd || !cd.lit || PL.held()) return false; if (!dry) { setBlock(x, y, z, ...S.candleBlock(cd.c, cd.n, 0)); play('fizz', { vol: 0.4 }); } return true; }
    case BID.cauldron: { // buckets fill and empty it (water, lava, powder snow)
      const h = PL.held(), lv = m & 3, k = (m >> 2) & 3; if (!h) return false;
      const FILL = { [IID.water_bucket]: 0, [IID.lava_bucket]: 1, [IID.powder_snow_bucket]: 2 }, OUT = [IID.water_bucket, IID.lava_bucket, IID.powder_snow_bucket];
      if (FILL[h.id] != null) { if (!dry) { setMeta(x, y, z, 3 | (FILL[h.id] << 2)); if (!creative()) INV.slots[INV.sel] = { id: IID.bucket, n: 1 }; play('splash'); } return true; }
      if (h.id === IID.bucket && lv === 3) { if (!dry) { setMeta(x, y, z, 0); const it = { id: OUT[k], n: 1 }; if (!creative()) { consume(); if (!PL.held()) INV.slots[INV.sel] = it; else if (INV.add(it)) dropStack(PL.x, PL.y + 1, PL.z, it); } play('splash'); } return true; }
      return false;
    }
    case BID.flower_pot: { const h = PL.held(); if (m ? h : !(h && S.POT_PLANTS.some(p => p && IID[p[0]] === h.id))) return false; if (!dry) potUse(t, h); return true; }
    case BID.loom: if (!dry) UI.openScreen('loom', { x, y, z }); return true;
    case BID.campfire: case BID.soul_campfire: { const h = PL.held(); if (dry) return !!(h && (campfireFood(h.id) || (ITEMS[h.id].tool && ITEMS[h.id].tool.type === S.TOOL.SHOVEL && (m & 4)) || ((h.id === IID.flint_and_steel || h.id === IID.fire_charge) && !(m & 4)))); return campfireUse(x, y, z, m, h); }
    case BID.bell: if (!dry) ringBell(x, y, z); return true;
    case BID.jukebox: { const h = PL.held(), t = getTile(x, y, z); if (dry) return !!((t && t.items && t.items[0]) || (h && ITEMS[h.id].disc)); return jukeboxUse(x, y, z, h); }
    case BID.beacon: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, { type: 'beacon' }); UI.openScreen('beacon', { x, y, z }); } return true;
    case BID.brewing_stand: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, newBrewing()); UI.openScreen('brewing', { x, y, z }); } return true;
    case BID.crafting_table: if (!dry) UI.openScreen('craft', { x, y, z }); return true;
    case BID.enchanting_table: if (!dry) UI.openScreen('enchant', { x, y, z }); return true;
    case BID.blast_furnace: case BID.smoker: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, newFurnace(BLOCKS[id].furnace)); UI.openScreen('furnace', { x, y, z }); } return true;
    case BID.barrel: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) }); UI.openScreen('chest', { x, y, z, title: '통' }); play('door', { vol: 0.4 }); } return true;
    case BID.hopper: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, { type: 'hopper', items: new Array(5).fill(null), cd: 0 }); UI.openScreen('hopper', { x, y, z }); } return true;
    case BID.dispenser: case BID.dropper: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, { type: 'dispenser', items: new Array(9).fill(null) }); UI.openScreen('dispenser', { x, y, z, title: BLOCKS[id].name }); } return true;
    case BID.daylight_detector: if (!dry) { setMeta(x, y, z, m ^ 16); if (!getTile(x, y, z)) setTile(x, y, z, { type: 'daylight' }); play('click'); } return true;
    case BID.oak_trapdoor: if (!dry) { setMeta(x, y, z, m ^ 4); play('door', { vol: 0.6 }); } return true;
    case BID.note_block: if (!dry) { const tile = getTile(x, y, z) || { type: 'note', n: 0 }; tile.n = ((tile.n || 0) + 1) % 25; setTile(x, y, z, tile); playNote(x, y, z, tile.n); } return true;
    case BID.comparator: if (!dry) { setMeta(x, y, z, m ^ 4); play('click', { pitch: 0.55 }); rsMark(x, y, z); } return true;
    case BID.composter: { const h = PL.held(); if (!dry) composterUse(x, y, z, m, h); return true; }
    case BID.grindstone: { const h = PL.held(); if (h && h.e) { if (!dry) { let xp = 0; for (const lv of Object.values(h.e)) xp += lv * 3; delete h.e; delete h.rp; spawnXP(PL.x, PL.y + 1, PL.z, xp); play('anvil', { vol: 0.4 }); UI.hudDirty = true; } return true; } return false; }
    case BID.furnace: case BID.lit_furnace: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, newFurnace()); UI.openScreen('furnace', { x, y, z }); } return true;
    case BID.chest: if (!dry) { piglinAnger(x, y, z); if (!getTile(x, y, z)) setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) }); UI.openScreen('chest', { x, y, z }); } return true;
    case BID.iron_door: return false;
    case BID.oak_door: if (!dry) { const oy = m & 8 ? -1 : 1; setMeta(x, y, z, m ^ 4); if (getBlock(x, y + oy, z) === id) setMeta(x, y + oy, z, getMeta(x, y + oy, z) ^ 4); play('door'); } return true;
    case BID.red_bed: if (!dry) trySleep(x, y, z); return true;
    case BID.lever: case BID.stone_button: case BID.repeater: if (!dry) useSwitch(x, y, z, id, m); return true;
    case BID.anvil: if (!dry) UI.openScreen('anvil', { x, y, z }); return true;
    case BID.smithing_table: if (!dry) UI.openScreen('smithing', { x, y, z }); return true;
    case BID.end_portal_frame: { const h = PL.held(); if (h && h.id === IID.ender_eye && !(m & 4)) { if (!dry) { setMeta(x, y, z, m | 4); consume(); play('portal', { vol: 0.4 }); checkEndPortal(x, y, z); } return true; } return false; }
    case BID.tnt: { const h = PL.held(); if (h && h.id === IID.flint_and_steel) { if (!dry) { setBlock(x, y, z, 0); primeTNT(x, y, z); damageItem(INV.slots, INV.sel, 1); } return true; } return false; }
  }
  return false;
}
function trySleep(x, y, z) {
  if (W.dim !== 0) { setBlock(x, y, z, 0); explode(x + .5, y + .5, z + .5, 5, true); return; } // beds explode outside the Overworld
  const t = ((W.time % 24000) + 24000) % 24000;
  PL.spawn = [x, y + 1, z]; PL.spawnDim = 0; UI.flash('리스폰 지점이 설정되었습니다');
  if (t < 12542 || t > 23460) { if (W.thunder < 0.5) { UI.flash('밤이나 뇌우 때만 잘 수 있어요'); return; } } // plain rain is not enough (Java)
  if (ENT.some(e => e.kind === 'mob' && !e.dead && e.def.hostile && Math.abs(e.x - x) < 8 && Math.abs(e.y - y) < 5 && Math.abs(e.z - z) < 8)) { UI.flash('주변에 몬스터가 있어 잠들 수 없어요'); return; }
  PL.sleeping = 1; PL.x = x + .5; PL.z = z + .5; PL.y = y + 0.6; PL.vx = PL.vy = PL.vz = 0;
}
const BLAST_OK = id => { const k = ITEMS[id].key; return k.startsWith('raw_') || k.endsWith('_ore') || k.startsWith('iron_') || k.startsWith('golden_') || k === 'ancient_debris'; };
function newFurnace(kind) { return { type: 'furnace', kind: kind || null, items: [null, null, null], burn: 0, burnMax: 0, cook: 0, xp: 0 }; }
// composter: compostable items raise the level; at 8 it yields bone meal
const COMPOST = { wheat_seeds: 0.3, beetroot_seeds: 0.3, short_grass: 0.3, oak_leaves: 0.3, spruce_leaves: 0.3, birch_leaves: 0.3, jungle_leaves: 0.3, acacia_leaves: 0.3, dark_oak_leaves: 0.3, oak_sapling: 0.3, spruce_sapling: 0.3, birch_sapling: 0.3,
  vine: 0.5, melon_slice: 0.5, sugar_cane: 0.5, cactus: 0.5, apple: 0.65, carrot: 0.65, potato: 0.65, beetroot: 0.65, wheat: 0.65, fern: 0.65, dandelion: 0.65, poppy: 0.65, pumpkin: 0.65, lily_pad: 0.65, brown_mushroom: 0.65, red_mushroom: 0.65,
  baked_potato: 0.85, bread: 0.85, cookie: 0.85, hay_block: 0.85, pumpkin_pie: 1 };
function composterUse(x, y, z, m, h) {
  if ((m & 15) >= 8) { setMeta(x, y, z, 0); dropItem(x + .5, y + 1, z + .5, IID.bone_meal, 1); play('pop'); return; }
  const c = h && COMPOST[ITEMS[h.id].key]; if (!c) return;
  consume(); swing();
  if (Math.random() < c) { const lv = (m & 15) + 1; setMeta(x, y, z, lv); for (let i = 0; i < 6; i++) R.simpleParticle(x + .3 + Math.random() * .4, y + 1, z + .3 + Math.random() * .4, [0.3, 0.8, 0.2], { size: 0.08, vy: 0.5 }); }
  play('place', { mat: 'grass', vol: 0.6 });
}
function playNote(x, y, z, n) { const b = getBlock(x, y - 1, z), inst = b === BID.sand || b === BID.gravel ? 'snare' : OPQ[b] && BLOCKS[b].tool === S.TOOL.PICK ? 'bass' : 'harp'; play('note', { pitch: Math.pow(2, (n - 12) / 12), inst }); R.simpleParticle(x + .5, y + 1.2, z + .5, [n / 24, 1 - n / 24, 0.5], { size: 0.2, vy: 0.5, grav: 0, life: 0.6 }); }
// horizontal facing of the player: 0 north (-z), 1 east, 2 south, 3 west
function facingDir() { const a = ((PL.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return [0, 3, 2, 1][Math.round(a / (Math.PI / 2)) % 4]; }
function entityBlocks(x, y, z) {
  if (x + 1 > PL.x - PL.w && x < PL.x + PL.w && z + 1 > PL.z - PL.w && z < PL.z + PL.w && y + 1 > PL.y && y < PL.y + PL.h && !spectator()) return true;
  for (const e of ENT) if (e.kind === 'mob' && !e.dead && x + 1 > e.x - e.w && x < e.x + e.w && z + 1 > e.z - e.w && z < e.z + e.w && y + 1 > e.y && y < e.y + e.h) return true;
  return false;
}
function consume(n = 1) { if (creative()) return; const h = PL.held(); if (!h) return; h.n -= n; if (h.n <= 0) INV.slots[INV.sel] = null; UI.hudDirty = true; }
function useItem(first) {
  USE.placeCd = 4;
  const t = TARGET, h = PL.held(), d = h && ITEMS[h.id];
  if (d && h.id === IID.map && !(t && t.type === 'block' && interactBlock(t, true))) { useEmptyMap(); return; }
  if (first && items6Use(t, h, d)) return;
  if (t && t.type === 'ent') {
    const e = t.e;
    if (e.kind === 'frame') { frameUse(e, h); return; }
    if (e.kind === 'armor_stand') { const [, ldy] = lookDir(); standUse(e, h, PL.y + PL.eyeH + ldy * t.t); return; }
    if (e.kind === 'boat') { if (!PL.sneaking) mount(e); return; }
    if (e.kind === 'minecart') { cartUse(e, h); return; }
    if (d && h.id === IID.water_bucket && (e.type === 'axolotl' || e.type === 'tropical_fish') && !e.dead) {
      removeEnt(e); const it = { id: e.type === 'axolotl' ? IID.axolotl_bucket : IID.tropical_fish_bucket, n: 1, v: e.variant || 0 };
      if (creative()) { if (INV.add(it)) dropStack(PL.x, PL.y + 1, PL.z, it); } else INV.slots[INV.sel] = it;
      play('splash'); swing(); UI.hudDirty = true; return;
    }
    if (e.kind === 'mob' && mobInteract(e, h, d)) return;
    if (e.type === 'villager' && !e.baby && !(d && h.id === IID.name_tag)) { UI.openScreen('trade', { e }); e.trading = true; play('hmm'); return; }
    if (e.kind !== 'mob') return;
    if (d && h.id === IID.shears && e.type === 'sheep' && !e.sheared && !e.baby) { setSheared(e); dropItem(e.x, e.y + 1, e.z, BID.white_wool, 1 + Math.floor(Math.random() * 3)); damageItem(INV.slots, INV.sel, 1); swing(); return; }
    if (d && h.id === IID.bucket && (e.type === 'cow' || e.type === 'goat') && !e.baby) { consume(); INV.add({ id: IID.milk_bucket, n: 1 }) && dropItem(PL.x, PL.y + 1, PL.z, IID.milk_bucket, 1); swing(); return; }
    if (d && e.def.food && isFood(e.def, h.id) && !e.baby && e.love <= 0 && (!e.def.tameFirst || e.owner === 'player')) { e.love = 600; consume(); if (h.id === IID.tropical_fish_bucket && !creative()) INV.slots[INV.sel] = { id: IID.water_bucket, n: 1 }; for (let i = 0; i < 5; i++) R.simpleParticle(e.x, e.y + e.h + .3, e.z, [1, 0.3, 0.4], { size: 0.15, vy: 1, grav: 0 }); swing(); return; }
    return;
  }
  if (t && t.type === 'block') {
    if (first && interactBlock(t, false)) { swing(); vibrate(t.x + .5, t.y + .5, t.z + .5); return; }
    if (d && (h.id === IID.item_frame || h.id === IID.glow_item_frame)) { placeFrame(t, h.id === IID.glow_item_frame); return; }
    if (d && h.id === IID.painting) { placePainting(t); return; }
    if (d && h.id === IID.armor_stand) { if (t.ny === 1 && !SOLID[getBlock(t.x, t.y + 1, t.z)]) { spawnArmorStand(t.x + .5, t.y + 1, t.z + .5, Math.round(PL.yaw / (Math.PI / 4)) * Math.PI / 4 + Math.PI); consume(); swing(); play('place', { mat: 'wood' }); } return; }
    if (d && d.place === BID.banner) { placeBanner(t, h); return; }
    if (first && lushUse(t, h, d)) return;
    if (first && oceanUse(t, h, d)) return;
    if (first && biomeUse(t, h, d)) return;
    if (first && d && bottleUse(t, h)) return;
    const { x, y, z, id } = t;
    if (d) {
      // candles: stack up to four of the same colour, or light one with flint and steel
      const cdT = S.candleOf(id, t.m);
      if (d.candle != null && cdT && cdT.c === d.candle && cdT.n < 4) { setBlock(x, y, z, ...S.candleBlock(cdT.c, cdT.n + 1, cdT.lit)); consume(); play('place', { mat: 'wool' }); swing(); return; }
      if (d.candle != null) { placeCandle(t, d.candle); return; }
      if (cdT && !cdT.lit && (h.id === IID.flint_and_steel || h.id === IID.fire_charge) && !FLUID[getBlock(x, y + 1, z)]) { setBlock(x, y, z, ...S.candleBlock(cdT.c, cdT.n, 1)); play('ignite'); if (h.id === IID.fire_charge) consume(); else damageItem(INV.slots, INV.sel, 1); swing(); return; }
      // copper (1.17): honeycomb waxes it (no more oxidation), an axe scrapes the wax off before any oxidation
      if (h.id === IID.honeycomb && BLOCKS[id].wax && !(t.m & BLOCKS[id].wax)) { setMeta(x, y, z, t.m | BLOCKS[id].wax); for (let i = 0; i < 8; i++) R.simpleParticle(x + Math.random(), y + 1.05, z + Math.random(), [1, 0.7, 0.2], { size: 0.08, vy: 0.5 }); consume(); play('place', { mat: 'wool' }); swing(); return; }
      const tool = d.tool;
      if (tool && tool.type === S.TOOL.AXE && BLOCKS[id].wax && (t.m & BLOCKS[id].wax)) { setMeta(x, y, z, t.m & ~BLOCKS[id].wax); for (let i = 0; i < 8; i++) R.simpleParticle(x + Math.random(), y + 1.05, z + Math.random(), [1, 1, 1], { size: 0.08, vy: 0.5 }); damageItem(INV.slots, INV.sel, 1); swing(); return; }
      if (tool && tool.type === S.TOOL.HOE && (id === 2 || id === 3) && getBlock(x, y + 1, z) === 0) { setBlock(x, y, z, BID.farmland); play('place', { mat: 'gravel' }); damageItem(INV.slots, INV.sel, 1); swing(); return; }
      if (tool && tool.type === S.TOOL.SHOVEL && id === 2 && getBlock(x, y + 1, z) === 0) { return; }
      if (tool && tool.type === S.TOOL.AXE && BLOCKS[id].scrape) { setBlock(x, y, z, BLOCKS[id].scrape, BLOCKS[id].wax ? t.m : 0); for (let i = 0; i < 8; i++) R.simpleParticle(x + Math.random(), y + 1.05, z + Math.random(), [0.9, 0.9, 0.9], { size: 0.08, vy: 0.5 }); damageItem(INV.slots, INV.sel, 1); swing(); return; }
      if (h.id === IID.bone_meal) { if (boneMeal(x, y, z, id)) { consume(); swing(); } return; }
      if (h.id === IID.flint_and_steel || h.id === IID.fire_charge) {
        const px = x + t.nx, py = y + t.ny, pz = z + t.nz, cur = getBlock(px, py, pz);
        if (id === BID.tnt) return;
        if (cur && !REPL[cur]) return;
        if (!tryLightPortal(px, py, pz)) { if (!SOLID[getBlock(px, py - 1, pz)] && !N6.some(([a, b2, c]) => BLOCKS[getBlock(px + a, py + b2, pz + c)].log)) return; setBlock(px, py, pz, BID.fire); }
        play(h.id === IID.fire_charge ? 'fireball' : 'ignite'); if (h.id === IID.fire_charge) consume(); else damageItem(INV.slots, INV.sel, 1); swing(); return;
      }
      if (h.id === IID.oak_boat) { const fl = FLUID[id] === 1; const bx = x + (fl ? 0 : t.nx) + .5, by = fl ? y + 0.9 : y + t.ny + (t.ny > 0 ? 0 : 0), bz = z + (fl ? 0 : t.nz) + .5; if (!fl && t.ny !== 1) return; placeBoat(bx, fl ? y + 0.88 : y + 1, bz, PL.yaw); consume(); swing(); return; }
      if (h.id === IID.ender_pearl) { throwItem(h.id); USE.placeCd = 20; return; }
      if (h.id === IID.ender_eye) { if (throwEye()) consume(); swing(); return; }
      if (h.id === IID.bucket) { if (FLUID[id] && getMeta(x, y, z) === 0) { setBlock(x, y, z, 0); consume(); const it = { id: id === 27 ? IID.water_bucket : IID.lava_bucket, n: 1 }; if (creative()) {} else if (!PL.held()) INV.slots[INV.sel] = it; else if (INV.add(it)) dropStack(PL.x, PL.y + 1, PL.z, it); play('splash'); swing(); } else if (id === BID.powder_snow) { setBlock(x, y, z, 0); consume(); const it = { id: IID.powder_snow_bucket, n: 1 }; if (!PL.held()) INV.slots[INV.sel] = it; else INV.add(it); swing(); } return; }
      if (h.id === IID.water_bucket || h.id === IID.lava_bucket || h.id === IID.powder_snow_bucket || h.id === IID.axolotl_bucket || h.id === IID.tropical_fish_bucket) {
        const [px, py, pz] = REPL[id] && !FLUID[id] ? [x, y, z] : [x + t.nx, y + t.ny, z + t.nz];
        const cur = getBlock(px, py, pz); if (cur && !REPL[cur] && !FLUID[cur]) return;
        const fl = h.id === IID.lava_bucket ? 28 : h.id === IID.powder_snow_bucket ? BID.powder_snow : 27;
        setBlock(px, py, pz, fl, 0); schedule(px, py, pz, 1);
        if (h.id === IID.axolotl_bucket || h.id === IID.tropical_fish_bucket) spawnMob(h.id === IID.axolotl_bucket ? 'axolotl' : 'tropical_fish', px + .5, py + .1, pz + .5, { variant: h.v || 0, fromBucket: true });
        if (!creative()) INV.slots[INV.sel] = { id: IID.bucket, n: 1 };
        play('splash'); swing(); return;
      }
      if (h.id === IID.snowball || h.id === IID.egg || h.id === IID.experience_bottle || d.splash || d.lingering) { throwItem(h.id); return; }
      if (h.id === IID.fishing_rod) { useRod(); return; }
      if (d.cart) { placeMinecart(t, d); return; }
      if (ITEMS[h.id].boat) { const fl = FLUID[id] === 1; if (!fl && t.ny !== 1) return; placeBoat(x + (fl ? 0 : t.nx) + .5, fl ? y + 0.88 : y + 1, z + (fl ? 0 : t.nz) + .5, PL.yaw, ITEMS[h.id].boat); consume(); swing(); return; }
      if (d.place != null) { placeBlock(t, d); return; }
    }
  } else if (d && h.id === IID.fishing_rod) { useRod(); return; }
  else if (d && bottleUse(null, h)) return;
  else if (d && (h.id === IID.snowball || h.id === IID.egg || h.id === IID.ender_pearl || h.id === IID.experience_bottle || d.splash || d.lingering)) { throwItem(h.id); USE.placeCd = h.id === IID.ender_pearl ? 20 : 4; return; }
  else if (d && h.id === IID.ender_eye) { if (throwEye()) consume(); swing(); return; }
}
function throwItem(id) {
  const [dx, dy, dz] = lookDir();
  const v = ITEMS[id].splash || ITEMS[id].lingering ? 0.75 : 1.5; // potions are thrown softer
  const e = shootArrow(PL.x + dx * .4, PL.y + PL.eyeH - .1, PL.z + dz * .4, dx * v, dy * v + 0.1, dz * v, PL, 0);
  e.thrown = id; scene.remove(e.mesh); e.mesh = R.itemMesh(id); e.mesh.scale.setScalar(0.3); scene.add(e.mesh);
  consume(); swing();
}
function boneMeal(x, y, z, id) {
  for (let i = 0; i < 8; i++) R.simpleParticle(x + Math.random(), y + 0.5 + Math.random() * .5, z + Math.random(), [0.4, 0.9, 0.3], { size: 0.08, vy: 0.4, grav: 0 });
  const lb = lushBoneMeal(x, y, z, id); if (lb != null) return lb;
  if (id === BID.wheat) { setMeta(x, y, z, Math.min(7, getMeta(x, y, z) + 2 + Math.floor(Math.random() * 4))); return true; }
  if (id === BID.crops2) { const m = getMeta(x, y, z); setMeta(x, y, z, (m & ~7) | Math.min(7, (m & 7) + 2 + Math.floor(Math.random() * 4))); return true; }
  const sap = { 38: 0, 39: 3, 40: 2, [BID.jungle_sapling]: 4, [BID.acacia_sapling]: 5, [BID.dark_oak_sapling]: 6 }[id];
  if (sap != null) { if (Math.random() < 0.45) growTreeAt(x, y, z, sap); return true; }
  if (id === 2) { for (let k = 0; k < 40; k++) { const tx = x + Math.floor((Math.random() - .5) * 7), tz = z + Math.floor((Math.random() - .5) * 7); for (let ty = y + 2; ty >= y - 2; ty--) if (getBlock(tx, ty, tz) === 2 && getBlock(tx, ty + 1, tz) === 0) { setBlock(tx, ty + 1, tz, Math.random() < 0.85 ? 29 : [31, 32, 33, 34][Math.floor(Math.random() * 4)]); break; } } return true; }
  return false;
}
function placeCandle(t, c) {
  let x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
  const tgt = getBlock(t.x, t.y, t.z); if (REPL[tgt] && !FLUID[tgt]) { x = t.x; y = t.y; z = t.z; }
  const cur = getBlock(x, y, z); if ((cur && !REPL[cur]) || FLUID[cur] === 2 || !supportedBy(getBlock(x, y - 1, z)) || y < 0 || y >= CH) return;
  setBlock(x, y, z, ...S.candleBlock(c, 1, 0)); consume(); play('place', { mat: 'wool' }); swing();
}
function placeBlock(t, d) {
  let id = d.place, meta = d.pmeta || 0;
  const vi = d.vi != null ? d.vi : null, vsh = S.VSH[id];
  let x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
  const tgt = getBlock(t.x, t.y, t.z);
  if (REPL[tgt] && !FLUID[tgt] && !(tgt === BID.snow && id === BID.snow)) { x = t.x; y = t.y; z = t.z; }
  // slab merging / snow stacking
  // slab merging keeps the wax: a waxed copper slab doubles into waxed cut copper
  const slabFull = BLOCKS[id].slab || (BLOCKS[id].slabv && BLOCKS[id].full[vi]);
  const sameSlab = m => !BLOCKS[id].slabv || (m >> 1) === vi;
  if (d.block && slabFull && tgt === id && sameSlab(t.m) && ((t.ny === 1 && !(t.m & 1)) || (t.ny === -1 && (t.m & 1)))) { setBlock(t.x, t.y, t.z, slabFull, BLOCKS[id].wax && (t.m & BLOCKS[id].wax) ? 1 : 0); consume(); play('place', { mat: soundMat(id) }); swing(); return; }
  if (id === BID.snow && tgt === BID.snow && (t.m & 7) < 7) { setBlock(t.x, t.y, t.z, BID.snow, t.m + 1); consume(); swing(); return; }
  if (y < 0 || y >= CH) return;
  const cur = getBlock(x, y, z); if (cur && !REPL[cur]) return;
  if (cur === id && slabFull && sameSlab(getMeta(x, y, z))) { setBlock(x, y, z, slabFull, BLOCKS[id].wax && (getMeta(x, y, z) & BLOCKS[id].wax) ? 1 : 0); consume(); swing(); return; }
  const below = getBlock(x, y - 1, z), fd = facingDir();
  const b = BLOCKS[id];
  // placement rules
  if (b.plant) {
    const ok = b.plant === 1 ? (below === 2 || below === 3 || below === BID.farmland || below === BID.moss_block) : b.plant === 2 ? (below === 9 || below === 3 || below === 2) : b.plant === 3 ? (below === id || ((below === 2 || below === 3 || below === 9) && N6.some(([dx, dy, dz]) => !dy && getBlock(x + dx, y - 1, z + dz) === 27))) : b.plant === 4 ? (below === id || below === 9) : b.plant === 5 ? below === BID.farmland : b.plant === 7 ? (OPQ[below] || below === BID.soul_sand) : b.plant === 8 ? below === BID.soul_sand : b.plant === 9 ? below === 27 : b.plant >= 15 ? true : OPQ[below]; // 15+: sea plants, checked by oceanPlace
    if (!ok) return;
    if (id === BID.cactus && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => SOLID[getBlock(x + dx, y, z + dz)])) return;
  }
  if (id === BID.torch || id === BID.soul_torch) { if (t.ny === 1 && supportedBy(below)) meta = 0; else if (t.ny === 0) { meta = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dz]) => dx === -t.nx && dz === -t.nz) + 1; if (!OPQ[getBlock(x - t.nx, y, z - t.nz)]) return; } else return; }
  if (id === BID.ladder) { if (t.ny !== 0) return; meta = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dz]) => dx === -t.nx && dz === -t.nz); if (!OPQ[getBlock(x - t.nx, y, z - t.nz)]) return; }
  if (id === BID.lantern || id === BID.soul_lantern) meta = t.ny === -1 ? 1 : 0;
  if (isCampfire(id)) meta = fd | 4; // placed lit
  if (id === BID.bell) { meta = bellAttach(t, fd); if (!bellSupported(x, y, z, meta)) return; }
  if (id === BID.end_rod || (id === BID.chain && vi === 1)) meta = S.DIR6.findIndex(v => v[0] === t.nx && v[1] === t.ny && v[2] === t.nz);
  if (S.BUD[id]) { const f = S.DIR6.findIndex(v => v[0] === t.nx && v[1] === t.ny && v[2] === t.nz); if (f < 0 || !OPQ[getBlock(x - t.nx, y - t.ny, z - t.nz)]) return; meta = 1 + f; }
  if (id === BID.observer || id === BID.dispenser || id === BID.dropper) meta = PL.pitch < -0.85 ? 1 : PL.pitch > 0.85 ? 0 : [3, 4, 2, 5][fd];
  if (id === BID.comparator) { if (!supportedBy(below)) return; meta = fd; }
  if (id === BID.oak_trapdoor) meta = ((fd + 2) & 3) | (t.ny === -1 || (t.ny === 0 && t.hy > 0.5) ? 8 : 0);
  if (id === BID.vine && (t.ny !== 0 || !OPQ[getBlock(x - t.nx, y, z - t.nz)])) return;
  if (id === BID.lily_pad && below !== 27) return;
  if (id === BID.redstone_torch) { if (t.ny === 1 && supportedBy(below)) meta = 0; else if (t.ny === 0) { meta = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dz]) => dx === -t.nx && dz === -t.nz) + 1; if (!OPQ[getBlock(x - t.nx, y, z - t.nz)]) return; } else return; }
  if (id === BID.lever || id === BID.stone_button) { const a = S.DIR6.findIndex(v => v[0] === -t.nx && v[1] === -t.ny && v[2] === -t.nz); if (a < 0 || !SOLID[getBlock(x - t.nx, y - t.ny, z - t.nz)]) return; meta = a; }
  if ((id === BID.redstone_wire || id === BID.repeater || id === BID.stone_pressure_plate || S.isRail(id)) && !supportedBy(below)) return;
  if (id === BID.repeater) meta = fd;
  if (id === BID.piston || id === BID.sticky_piston) meta = PL.pitch < -0.85 ? 1 : PL.pitch > 0.85 ? 0 : [3, 4, 2, 5][fd];
  if (id === BID.nether_wart && below !== BID.soul_sand) return;
  if (id === BID.glow_lichen || id === BID.vine) { meta = t.ny === 1 ? 0 : t.ny === -1 ? 1 : t.nz === 1 ? 2 : t.nz === -1 ? 3 : t.nx === 1 ? 4 : 5; }
  if (b.facing) meta = (fd + 2) & 3;
  if (S.LOGAX[id]) meta = t.nx ? 1 : t.nz ? 2 : 0;
  if (b.slab || b.slabv) meta = t.ny === -1 || (t.ny === 0 && t.hy > 0.5) ? 1 : 0;
  if (b.stairs) meta = fd | (t.ny === -1 || (t.ny === 0 && t.hy > 0.5) ? 4 : 0);
  if (b.leaves) meta = 1;
  if (vi != null && S.HASV[id]) meta = (meta & ((1 << vsh) - 1)) | (vi << vsh); // colour / material lives above the shape bits
  if (id === BID.pointed_dripstone) meta = t.ny === -1 ? 0 : 1;
  { const tm = tripPlace(t, d, x, y, z, fd); if (tm === false) return; if (tm != null) meta = tm; }
  if (typeof oceanPlace === 'function') { const om = oceanPlace(x, y, z, id, meta); if (om === false) return; meta = om; }
  { const bm = biomePlace(x, y, z, id, meta); if (bm === false) return; meta = bm; }
  { const bm = blocks6Place(t, x, y, z, id, meta, fd); if (bm === false) return; meta = bm; }
  if (S.DOOR[id]) {
    if (getBlock(x, y + 1, z) && !REPL[getBlock(x, y + 1, z)] || !supportedBy(below)) return;
    if (entityBlocks(x, y, z) || entityBlocks(x, y + 1, z)) return;
    meta = (fd + 2) & 3;
    setBlock(x, y, z, id, meta, { noUpdate: true }); setBlock(x, y + 1, z, id, meta | 8);
    consume(); play('place', { mat: id === BID.iron_door ? 'stone' : 'wood' }); swing(); return;
  }
  if (id === BID.red_bed) {
    const dir = DIRS[fd], hx = x + dir[0], hz = z + dir[2], hb = getBlock(hx, y, hz);
    if ((hb && !REPL[hb]) || !SOLID[below] || !SOLID[getBlock(hx, y - 1, hz)]) return;
    setBlock(x, y, z, id, fd, { noUpdate: true }); setBlock(hx, y, hz, id, fd | 4);
    consume(); play('place', { mat: 'wool' }); swing(); return;
  }
  if (SOLID[id] && entityBlocks(x, y, z)) return;
  setBlock(x, y, z, id, meta);
  if (id === BID.wheat) UI.advance('seed');
  if (b.fall) schedule(x, y, z, 2);
  if (FLUID[getBlock(x, y + 1, z)] || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => FLUID[getBlock(x + dx, y, z + dz)])) for (const [dx, dy, dz] of N6) if (FLUID[getBlock(x + dx, y + dy, z + dz)]) schedule(x + dx, y + dy, z + dz, 5);
  if (id === BID.furnace) setTile(x, y, z, newFurnace());
  if (id === BID.blast_furnace || id === BID.smoker) setTile(x, y, z, newFurnace(BLOCKS[id].furnace));
  if (id === BID.barrel) setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) });
  if (id === BID.brewing_stand) setTile(x, y, z, newBrewing());
  if (id === BID.beacon) setTile(x, y, z, { type: 'beacon' });
  if (isCampfire(id)) setTile(x, y, z, newCampfire());
  if (id === BID.jukebox) setTile(x, y, z, { type: 'jukebox', items: [null] });
  if (id === BID.hopper) setTile(x, y, z, { type: 'hopper', items: new Array(5).fill(null), cd: 0 });
  if (id === BID.dispenser || id === BID.dropper) setTile(x, y, z, { type: 'dispenser', items: new Array(9).fill(null) });
  if (id === BID.daylight_detector) setTile(x, y, z, { type: 'daylight' });
  if (id === BID.concrete_powder) neighborUpdate(x, y, z);
  if (S.isRail(id)) railPlaced(x, y, z, fd);
  if (id === BID.wither_skeleton_skull) witherCheck(x, y, z);
  biomePlaced(x, y, z, id, meta); blocks6Placed(x, y, z, id, meta, PL.held());
  if (id === BID.tripwire || id === BID.tripwire_hook_block) tripRefresh(x, y, z);
  if (id === BID.chest) setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) });
  consume(); play('place', { mat: soundMat(id) }); swing(); vibrate(x + .5, y + .5, z + .5);
}
function pickBlock() {
  const t = TARGET; if (!t || t.type !== 'block') return;
  let id = itemOfBlock(t.id, t.m); if (t.id === BID.crops2) id = [IID.carrot, IID.potato, IID.beetroot_seeds][(t.m >> 3) & 3] || IID.carrot; if (id === BID.lit_furnace) id = BID.furnace; if (id === BID.redstone_wire) id = IID.redstone; if (id === BID.unlit_redstone_torch) id = BID.redstone_torch; if (id === BID.lit_redstone_lamp) id = BID.redstone_lamp; if (id === BID.nether_wart) id = IID.nether_wart; if (id === BID.wheat) id = IID.wheat_seeds; if (id === BID.farmland) id = BID.dirt;
  if (!ITEMS[id]) return;
  const i = INV.slots.findIndex(s => s && s.id === id);
  if (i >= 0 && i < 9) { INV.sel = i; }
  else if (creative()) { if (INV.slots[INV.sel] && INV.slots.slice(0, 9).some(s => !s)) INV.sel = INV.slots.findIndex((s, k) => k < 9 && !s); INV.slots[INV.sel] = { id, n: maxStack(id) }; }
  else if (i >= 9) { const tmp = INV.slots[INV.sel]; INV.slots[INV.sel] = INV.slots[i]; INV.slots[i] = tmp; }
  UI.hudDirty = true;
}
function dropHeld(all) {
  const h = PL.held(); if (!h) return;
  const n = all ? h.n : 1; const [dx, dy, dz] = lookDir();
  dropItem(PL.x, PL.y + PL.eyeH - 0.3, PL.z, h.id, n, [dx * 0.3, dy * 0.3 + 0.1, dz * 0.3], 40, h.d, h);
  h.n -= n; if (h.n <= 0) INV.slots[INV.sel] = null; swing(); UI.hudDirty = true;
}
// ---------- furnaces ----------
function furnaceTick() {
  for (const c of W.chunks.values()) if (c.hasFurnace !== false) for (const [i, t] of c.tiles) {
    if (c.hasFurnace === undefined) c.hasFurnace = false; // re-flagged below (or by setTile) when a furnace exists
    if (t.type === 'brewing') { c.hasFurnace = true; brewTick(c, i, t); continue; }
    if (t.type === 'campfire') { c.hasFurnace = true; campfireTick(c, i, t); continue; }
    if (t.type !== 'furnace') continue;
    c.hasFurnace = true;
    const [inp, fuel, out] = t.items;
    let r = inp && SMELT[inp.id];
    if (r && t.kind === 'blast' && !BLAST_OK(inp.id)) r = null;
    if (r && t.kind === 'smoker' && !ITEMS[inp.id].food) r = null;
    const cookT = t.kind ? 100 : 200;
    const canOut = r && (!out || (out.id === r[0] && out.n < maxStack(r[0])));
    const wasLit = t.burn > 0;
    if (t.burn > 0) t.burn--;
    if (t.burn <= 0 && canOut && fuel && ITEMS[fuel.id].fuel) {
      t.burn = t.burnMax = ITEMS[fuel.id].fuel; fuel.n--;
      if (fuel.n <= 0) t.items[1] = fuel.id === IID.lava_bucket ? { id: IID.bucket, n: 1 } : null;
      c.modified = c.edited = true;
    }
    if (t.burn > 0 && canOut) { t.cook++; if (t.cook >= cookT) { t.cook = 0; inp.n--; if (inp.n <= 0) t.items[0] = null; if (out) out.n++; else t.items[2] = { id: r[0], n: 1 }; t.xp += r[1]; c.modified = c.edited = true; } }
    else if (t.cook > 0) t.cook = Math.max(0, t.cook - 2);
    const lit = t.burn > 0;
    if (lit !== wasLit) { const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15); const b = c.blocks[i]; if (b === BID.furnace || b === BID.lit_furnace) setBlock(x, y, z, lit ? BID.lit_furnace : BID.furnace, c.meta[i], { keepTile: true }); else setMeta(x, y, z, lit ? c.meta[i] | 4 : c.meta[i] & ~4); }
  }
}

// ---------- chorus fruit, fishing, elytra ----------
function chorusTeleport() {
  for (let k = 0; k < 16; k++) {
    const x = Math.floor(PL.x + (Math.random() - .5) * 16), z = Math.floor(PL.z + (Math.random() - .5) * 16); let y = Math.floor(PL.y + (Math.random() - .5) * 16);
    while (y > 1 && !SOLID[getBlock(x, y - 1, z)]) y--;
    if (!SOLID[getBlock(x, y - 1, z)] || SOLID[getBlock(x, y, z)] || SOLID[getBlock(x, y + 1, z)] || FLUID[getBlock(x, y, z)]) continue;
    PL.x = PL.px = x + .5; PL.y = PL.py = y; PL.z = PL.pz = z + .5; PL.fallDist = 0; play('teleport'); return;
  }
}
function useRod() {
  swing();
  const b = ENT.find(e => e.kind === 'bobber' && !e.dead);
  if (b) { // reel in
    if (b.bite > 0) {
      const r = Math.random(), loot = r < 0.51 ? 'cod' : r < 0.7225 ? 'salmon' : r < 0.7395 ? 'tropical_fish' : r < 0.85 ? 'pufferfish' : r < 0.95 ? ['bowl', 'leather', 'string', 'bone', 'stick', 'rotten_flesh', 'ink_sac'][Math.floor(Math.random() * 7)] : ['name_tag', 'saddle', 'bow', 'enchanted_book', 'nautilus_shell'][Math.floor(Math.random() * 5)];
      const it = dropItem(b.x, b.y + 0.3, b.z, IID[loot], 1, [(PL.x - b.x) * 0.1, 0.35 + Math.hypot(PL.x - b.x, PL.z - b.z) * 0.02, (PL.z - b.z) * 0.1], 0);
      if (it && loot === 'enchanted_book') { const keys = Object.keys(ENCH), k = keys[Math.floor(Math.random() * keys.length)]; it.stack.e = { [k]: 1 + Math.floor(Math.random() * ENCH[k][1]) }; }
      spawnXP(PL.x, PL.y + 1, PL.z, 1 + Math.floor(Math.random() * 6)); play('splash', { vol: 0.5 });
    }
    removeEnt(b); damageItem(INV.slots, INV.sel, 1); return;
  }
  const [dx, dy, dz] = lookDir();
  const e = Ent('bobber', PL.x + dx * .4, PL.y + PL.eyeH - .1, PL.z + dz * .4); e.kind = 'bobber'; e.w = 0.12; e.h = 0.25; e.vx = dx * 0.6; e.vy = dy * 0.6 + 0.15; e.vz = dz * 0.6; e.bite = 0; e.wait = 100 + Math.floor(Math.random() * 400);
  e.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xd83030 }));
  e.tick = bobberTick; e.render = (e, x, y, z) => e.mesh.position.set(x, y + 0.06, z);
  addEnt(e); play('bow', { vol: 0.3 });
}
function bobberTick(e) {
  const inW = fluidAt(e.x, e.y + 0.1, e.z) === 1;
  if (inW) { e.vy += 0.05; e.vy *= 0.6; e.vx *= 0.8; e.vz *= 0.8; if (--e.wait <= 0 && !e.bite) { e.bite = 30; play('splash', { vol: 0.4 }); for (let i = 0; i < 8; i++) R.simpleParticle(e.x, e.y + 0.3, e.z, [0.8, 0.9, 1], { size: 0.08, vy: 1.5 }); e.vy = -0.2; } if (e.bite > 0 && --e.bite === 0) e.wait = 100 + Math.floor(Math.random() * 400); }
  else e.vy -= 0.04;
  physMove(e, e.vx, e.vy, e.vz); e.vx *= 0.92; e.vz *= 0.92;
  const h = PL.held(); if (!h || h.id !== IID.fishing_rod || Math.hypot(e.x - PL.x, e.z - PL.z) > 32 || PL.dead) removeEnt(e);
}
function elytraTick() {
  const el = INV.armor[1] && INV.armor[1].id === IID.elytra && (INV.armor[1].d || 0) < ITEMS[IID.elytra].dur - 1;
  if (!el || PL.onGround || PL.inWater || PL.flying || PL.riding) { PL.gliding = false; return false; }
  if (!PL.gliding) { if (IN.jump && !IN.jumpWas && PL.vy < 0) { PL.gliding = true; play('bow', { vol: 0.2 }); } return false; }
  // Java's elytra flight model (pitch positive = looking down there)
  const [lx, ly, lz] = lookDir(), pitch = -PL.pitch, hor = Math.hypot(lx, lz), spd = Math.hypot(PL.vx, PL.vz);
  let f = Math.cos(pitch); f = f * f * Math.min(1, Math.hypot(lx, ly, lz) / 0.4);
  PL.vy += -0.08 + f * 0.06;
  if (PL.vy < 0 && hor > 0) { const d = PL.vy * -0.1 * f; PL.vx += lx * d / hor; PL.vy += d; PL.vz += lz * d / hor; }
  if (pitch < 0 && hor > 0) { const d = spd * -Math.sin(pitch) * 0.04; PL.vy += d * 3.2; PL.vx -= lx * d / hor; PL.vz -= lz * d / hor; }
  if (hor > 0) { PL.vx += (lx / hor * spd - PL.vx) * 0.1; PL.vz += (lz / hor * spd - PL.vz) * 0.1; }
  PL.vx *= 0.99; PL.vy *= 0.98; PL.vz *= 0.99;
  fireworkBoost();
  physMove(PL, PL.vx, PL.vy, PL.vz, 0);
  if (PL.hitH && spd > 0.5) hurtPlayer(Math.floor((spd - 0.5) * 10), 'fall');
  PL.fallDist = 0;
  if (W.tickN % 20 === 0 && !creative()) damageItem(INV.armor, 1, 1);
  return true;
}

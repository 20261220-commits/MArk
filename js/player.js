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

function selShape(id, m) {
  const rt = RTYPE[id];
  if (rt === RT.CROSS) { if (id === BID.sugar_cane) return [[2, 0, 2, 14, 16, 14]]; if (id === BID.cobweb) return null; if (id === BID.amethyst_cluster) return [[3, 0, 3, 13, 7, 13]]; if (id === BID.pointed_dripstone) return [[5, 0, 5, 11, 16, 11]]; return [[3, 0, 3, 13, 13, 13]]; }
  if (rt === RT.TORCH) { if (m >= 1 && m <= 4) { const d = DIRS[m - 1]; const ox = d[0] * 5, oz = d[2] * 5; return [[5.5 + ox, 3, 5.5 + oz, 10.5 + ox, 13, 10.5 + oz]]; } return [[6, 0, 6, 10, 10, 10]]; }
  if (rt === RT.CROP) return [[0, 0, 0, 16, 2 + (m & 7) * 2, 16]];
  if (rt === RT.BOX) return S.shapes(id, m);
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
    if (e.kind !== 'mob' || e.dead || e.deathT) continue;
    const h = rayBox(ox, oy, oz, dx, dy, dz, [e.x - e.w - .05, e.y, e.z - e.w - .05, e.x + e.w + .05, e.y + e.h, e.z + e.w + .05]);
    const lim = creative() ? 5 : 3;
    if (h && h[0] <= lim && (!best || h[0] < best.t)) best = { type: 'ent', e, t: h[0] };
  }
  return best;
}

// ---------- damage & stats ----------
function armorPoints() { let p = 0, t = 0; for (const s of INV.armor) if (s) { const a = ITEMS[s.id].armor; p += a.pts; t += a.tough; } return [p, t]; }
function hurtPlayer(dmg, cause, attacker) {
  if (PL.dead || spectator()) return false;
  if (creative() && cause !== 'void' && cause !== 'kill') return false;
  if (PL.inv > 0 && cause !== 'void' && cause !== 'kill') return false;
  if (dmg <= 0) return false;
  if (cause === 'mob' || cause === 'arrow' || cause === 'explosion') {
    const [pts, tough] = armorPoints();
    dmg = dmg * (1 - Math.min(20, Math.max(pts / 5, pts - dmg / (2 + tough / 4))) / 25);
    const epf = INV.armor.reduce((a, s) => a + enchLv(s, 'protection'), 0); dmg *= 1 - Math.min(20, epf) * 0.04; // protection
    for (let i = 0; i < 4; i++) if (INV.armor[i]) damageItem(INV.armor, i, Math.max(1, Math.floor(dmg / 4)));
  }
  if (PL.absorb > 0) { const a = Math.min(PL.absorb, dmg); PL.absorb -= a; dmg -= a; }
  PL.health = Math.max(0, PL.health - dmg); PL.hurtT = 10; PL.inv = 10; PL.exh += 0.1; PL.lastHurtBy = cause;
  if (attacker) PL.hurtDir = Math.atan2(attacker.z - PL.z, attacker.x - PL.x) - PL.yaw; else PL.hurtDir = 0;
  play('hurt');
  if (PL.health <= 0) die(cause);
  UI.hudDirty = true;
  return true;
}
const DEATH_MSG = { fall: '높은 곳에서 떨어졌습니다', mob: '몹에게 살해당했습니다', arrow: '화살에 맞았습니다', explosion: '폭발했습니다', drown: '익사했습니다', lava: '용암에서 수영하려 했습니다', fire: '불에 타 죽었습니다', starve: '굶어 죽었습니다', void: '세계 밖으로 떨어졌습니다', suffocate: '벽 속에서 질식했습니다', cactus: '선인장에 찔려 죽었습니다', kill: '죽었습니다' };
function die(cause) {
  PL.dead = true; PL.sleeping = 0;
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
  if (PL.sleeping) { PL.sleeping++; if (PL.sleeping > 100) { W.time = Math.ceil(W.time / 24000) * 24000; W.rain = 0; W.rainTarget = 0; PL.sleeping = 0; UI.flash('좋은 아침이에요!'); UI.advance('sleep'); } return; }
  const spec = spectator();
  const feet = fluidAt(PL.x, PL.y + 0.05, PL.z), waist = fluidAt(PL.x, PL.y + 0.6, PL.z), eyeF = fluidAt(PL.x, PL.y + PL.eyeH, PL.z);
  const inWater = !spec && (feet === 1 || waist === 1), inLava = !spec && (feet === 2 || waist === 2);
  PL.inWater = inWater; PL.eyeFluid = spec ? 0 : eyeF;
  let web = false, snowB = false, ladder = false;
  if (!spec) inBlock(b => { if (b === BID.cobweb) web = true; if (b === BID.powder_snow) snowB = true; if (b === BID.ladder) ladder = true; });
  if (snowB && INV.armor[3] && INV.armor[3].id === IID.leather_boots && !PL.sneaking && getBlock(Math.floor(PL.x), Math.floor(PL.y - 0.01), Math.floor(PL.z)) === BID.powder_snow) { snowB = false; UI.advance('snow'); }
  PL.inSnow = snowB && getBlock(Math.floor(PL.x), Math.floor(PL.y + PL.eyeH), Math.floor(PL.z)) === BID.powder_snow;
  // input
  let f = IN.f, s = IN.s;
  const using = USE.kind === 'eat' || USE.kind === 'bow';
  PL.sneaking = IN.sneak && !PL.flying && !spec;
  if (PL.sneaking) { f *= 0.3; s *= 0.3; }
  if (using) { f *= 0.2; s *= 0.2; }
  const canSprint = (PL.food > 6 || creative()) && !PL.sneaking && !using && f > 0.8 && !web;
  if ((IN.sprintKey || IN.wTap) && canSprint) PL.sprinting = true;
  if (PL.sprinting && (f < 0.8 || !canSprint || (PL.hitH && !inWater))) PL.sprinting = false;
  if (f <= 0) IN.wTap = false;
  const sp = 0.1 * (PL.sprinting ? 1.3 : 1);
  const len = Math.hypot(f, s), fn = len > 1 ? f / len : f, sn = len > 1 ? s / len : s;
  const sin = Math.sin(PL.yaw), cos = Math.cos(PL.yaw);
  const accel = (a) => { PL.vx += (-sin * fn + cos * sn) * a * 0.98; PL.vz += (-cos * fn - sin * sn) * a * 0.98; };
  if (spec || (PL.flying && (creative() || spec))) {
    accel(PL.sprinting ? 0.1 : 0.05);
    if (IN.jump) PL.vy += 0.15; if (IN.sneak) PL.vy -= 0.15;
    if (spec) { PL.x += PL.vx; PL.y += PL.vy; PL.z += PL.vz; PL.onGround = false; }
    else { physMove(PL, PL.vx, PL.vy, PL.vz, 0); if (PL.onGround && !spec) PL.flying = false; }
    PL.vx *= 0.91; PL.vz *= 0.91; PL.vy *= 0.6; PL.fallDist = 0;
  } else if (inWater || inLava) {
    accel(0.02 * (inWater && PL.sprinting ? 2 : 1));
    if (IN.jump) PL.vy += 0.04;
    physMove(PL, PL.vx, PL.vy, PL.vz, 0.6);
    const fr = inWater ? 0.8 : 0.5;
    PL.vx *= fr; PL.vz *= fr; PL.vy *= fr; PL.vy -= 0.02;
    if (PL.hitH && noCollision(PL.x + PL.vx, PL.y + 0.6, PL.z + PL.vz) && !fluidAt(PL.x, PL.y + 1.2, PL.z)) PL.vy = 0.3; // climb out of water onto a ledge
    PL.fallDist = 0;
  } else {
    const slipB = blockUnder(), slip = PL.onGround ? (slipB === BID.ice ? 0.98 : 0.6) : 1;
    const fr = slip * 0.91;
    accel(PL.onGround ? sp * (0.21600002 / (fr * fr * fr)) : (PL.sprinting ? 0.026 : 0.02));
    if (ladder) { PL.vx = Math.max(-0.15, Math.min(0.15, PL.vx)); PL.vz = Math.max(-0.15, Math.min(0.15, PL.vz)); PL.vy = Math.max(PL.vy, PL.sneaking ? 0 : -0.15); PL.fallDist = 0; }
    if (IN.jump && PL.onGround && USE.jumpCd <= 0) {
      PL.vy = 0.42; USE.jumpCd = 10;
      if (PL.sprinting) { PL.vx += -sin * 0.2; PL.vz += -cos * 0.2; PL.exh += 0.2; } else PL.exh += 0.05;
    }
    let mx = PL.vx, my = PL.vy, mz = PL.vz;
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
    PHYS.snowSolid = !!(INV.armor[3] && INV.armor[3].id === IID.leather_boots) && !PL.sneaking;
    physMove(PL, mx, my, mz, 0.6); PHYS.snowSolid = false;
    if (web || snowB) { if (PL.vx) PL.vx = mx; if (PL.vz) PL.vz = mz; }
    if (ladder && PL.hitH) PL.vy = 0.2;
    if (PL.onGround) {
      if (PL.fallDist > 3 && !creative()) { const dmg = Math.ceil((PL.fallDist - 3) * (1 - Math.min(0.8, enchLv(INV.armor[3], 'feather_falling') * 0.12 + INV.armor.reduce((a, s) => a + enchLv(s, 'protection'), 0) * 0.04))); const lb = blockUnder(); if (lb !== BID.hay_block) hurtPlayer(dmg, 'fall'); else hurtPlayer(Math.ceil(dmg * 0.2), 'fall'); if (dmg > 0) play('hit'); }
      PL.fallDist = 0;
    } else if (PL.y < oy) PL.fallDist += oy - PL.y;
    PL.vy = (PL.vy - 0.08) * 0.98;
    PL.vx *= fr; PL.vz *= fr;
  }
  if (USE.jumpCd > 0) USE.jumpCd--;
  if (!IN.jump) USE.jumpCd = 0;
  // walking stats & sounds
  const moved = Math.hypot(PL.x - PL.px, PL.z - PL.pz);
  if (PL.onGround && !inWater) { PL.bob += moved; PL.stepDist += moved; if (PL.stepDist > 1.7) { PL.stepDist = 0; const b = blockUnder(); if (b) play('step', { mat: soundMat(b), vol: PL.sneaking ? 0.3 : 0.8 }); } }
  if (PL.sprinting && PL.onGround) PL.exh += moved * 0.1; else if (inWater) PL.exh += moved * 0.01;
  // eye height (sneak)
  const targetEye = PL.sneaking ? 1.27 : 1.62; PL.eyeH += (targetEye - PL.eyeH) * 0.5;
  if (!spec) survivalTick(inWater, inLava, eyeF);
  interactTick();
}
function survivalTick(inWater, inLava, eyeF) {
  // air
  if (eyeF === 1) { PL.air--; if (PL.air <= -20) { PL.air = 0; hurtPlayer(2, 'drown'); } }
  else PL.air = Math.min(300, PL.air + 4);
  // fire & lava
  if (inLava) { PL.fire = 300; if (W.tickN % 10 === 0) hurtPlayer(4, 'lava'); }
  if (inWater || (W.rain > 0.5 && (getLight(Math.floor(PL.x), Math.floor(PL.y + 1.8), Math.floor(PL.z)) >> 4) === 15)) PL.fire = 0;
  if (PL.fire > 0) { PL.fire--; if (PL.fire % 20 === 0 && !inLava) hurtPlayer(1, 'fire'); }
  // contact damage
  inBlock(b => { if (b === BID.cactus) { hurtPlayer(1, 'cactus'); return true; } });
  const around = (dx, dz) => getBlock(Math.floor(PL.x + dx), Math.floor(PL.y + 0.5), Math.floor(PL.z + dz)) === BID.cactus;
  if (around(PL.w + 0.05, 0) || around(-PL.w - 0.05, 0) || around(0, PL.w + 0.05) || around(0, -PL.w - 0.05)) hurtPlayer(1, 'cactus');
  // suffocation
  const hb = getBlock(Math.floor(PL.x), Math.floor(PL.y + PL.eyeH), Math.floor(PL.z));
  if (OPQ[hb] && SOLID[hb] && hb !== BID.powder_snow && W.tickN % 10 === 0) hurtPlayer(1, 'suffocate');
  if (PL.y < -64) hurtPlayer(4, 'void');
  if (PL.inSnow && W.tickN % 40 === 0 && PL.mode !== 'creative') hurtPlayer(1, 'fire');
  if (creative()) return;
  // hunger
  if (PL.difficulty === 0) { if (W.tickN % 20 === 0 && PL.health < 20) PL.health = Math.min(20, PL.health + 1); if (W.tickN % 20 === 0 && PL.food < 20) PL.food++; }
  if (PL.exh >= 4) { PL.exh -= 4; if (PL.sat > 0) PL.sat = Math.max(0, PL.sat - 1); else if (PL.difficulty > 0) PL.food = Math.max(0, PL.food - 1); UI.hudDirty = true; }
  if (PL.regen > 0) { PL.regen--; if (PL.regen % 50 === 0 && PL.health < 20) PL.health = Math.min(20, PL.health + 1); }
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
  TARGET = raycast(reach(), held && (held.id === IID.bucket));
  if (MINE.cd > 0) MINE.cd--;
  if (USE.placeCd > 0) USE.placeCd--;
  // mining
  if (IN.attack && !PL.sleeping && TARGET && TARGET.type === 'block' && MINE.cd <= 0) {
    const t = TARGET;
    if (creative()) { breakBlock(t.x, t.y, t.z); MINE.cd = 5; }
    else {
      if (MINE.x !== t.x || MINE.y !== t.y || MINE.z !== t.z || MINE.id !== t.id) { MINE.x = t.x; MINE.y = t.y; MINE.z = t.z; MINE.id = t.id; MINE.prog = 0; MINE.ticks = 0; }
      const need = breakTicks(t.id, held, PL.onGround || PL.flying, PL.eyeFluid === 1);
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
  const h = PL.held(), tool = h && ITEMS[h.id] && ITEMS[h.id].tool;
  const sharp = enchLv(h, 'sharpness'), base = (tool ? tool.dmg : 1) + (sharp ? 0.5 * sharp + 0.5 : 0), as = tool ? tool.as : 4;
  const p = Math.min(1, (PL.attackT + 0.5) / (20 / as));
  let dmg = base * (0.2 + p * p * 0.8);
  const crit = p > 0.9 && PL.vy < 0 && !PL.onGround && !PL.inWater;
  if (crit) { dmg *= 1.5; for (let i = 0; i < 10; i++) R.simpleParticle(e.x + (Math.random() - .5) * .6, e.y + e.h * .6, e.z + (Math.random() - .5) * .6, [0.9, 0.9, 0.8], { size: 0.08, vy: 1 }); }
  PL.attackT = 0;
  const kb = (PL.sprinting && p > 0.9 ? 1.6 : 1) + enchLv(h, 'knockback') * 0.8;
  const s = Math.sin(PL.yaw), c = Math.cos(PL.yaw);
  if (hurtMob(e, dmg, PL, -s * kb, -c * kb, 'player')) { PL.exh += 0.1; if (PL.sprinting) PL.sprinting = false; play('hit'); }
  if (tool) damageItem(INV.slots, INV.sel, tool.type === S.TOOL.SWORD ? 1 : 2);
}
function breakBlock(x, y, z) {
  const id = getBlock(x, y, z), m = getMeta(x, y, z); if (!id || BLOCKS[id].hard < 0 && !creative()) return;
  if (BLOCKS[id].hard < 0) return;
  const held = PL.held();
  play('break', { mat: soundMat(id) });
  R.blockParticles(x, y, z, id, 24, lightBright(x + .5, y + 1, z + .5));
  // multi-block
  if (id === BID.oak_door) { const oy = m & 8 ? -1 : 1; if (getBlock(x, y + oy, z) === id) setBlock(x, y + oy, z, 0, 0, { noUpdate: true }); }
  if (id === BID.red_bed) { const d = DIRS[m & 3], s = (m & 4) ? -1 : 1; if (getBlock(x + d[0] * s, y, z + d[2] * s) === id) setBlock(x + d[0] * s, y, z + d[2] * s, 0, 0, { noUpdate: true }); }
  let repl = 0;
  if (id === BID.ice && !creative() && SOLID[getBlock(x, y - 1, z)]) repl = 27;
  setBlock(x, y, z, repl);
  if (!creative()) {
    const d = blockDrops(id, m, held);
    if (id === BID.oak_door && (m & 8)) d.items.length = 0, d.items.push([BID.oak_door, 1]);
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
  if (h.id === IID.milk_bucket) { PL.regen = 0; INV.slots[INV.sel] = creative() ? h : { id: IID.bucket, n: 1 }; play('burp'); return; }
  if (!d.food) return;
  PL.food = Math.min(20, PL.food + d.food[0]); PL.sat = Math.min(PL.food, PL.sat + d.food[0] * d.food[1] / d.food[0] * 1);
  PL.sat = Math.min(PL.food, PL.sat);
  if (d.regen) { PL.regen = 100; PL.absorb = 4; }
  if (h.id === IID.rotten_flesh && Math.random() < 0.8) PL.exh += 4;
  play('burp');
  if (!creative()) { h.n--; if (h.n <= 0) INV.slots[INV.sel] = d.leaves ? { id: IID[d.leaves], n: 1 } : null; else if (d.leaves) INV.add({ id: IID[d.leaves], n: 1 }); }
  UI.hudDirty = true;
}
function onUsePress() {
  const h = PL.held(), d = h && ITEMS[h.id];
  if (PL.sleeping) return;
  // eat / drink
  if (d && (d.food || h.id === IID.milk_bucket) && (PL.food < 20 || d.always || creative() || h.id === IID.milk_bucket || PL.difficulty === 0)) {
    if (!(TARGET && TARGET.type === 'block' && interactBlock(TARGET, true))) { USE.kind = 'eat'; USE.t = 0; return; }
  }
  if (d && h.id === IID.bow) { if (creative() || INV.count(IID.arrow) > 0) { USE.kind = 'bow'; USE.t = 0; } return; }
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
      shootArrow(PL.x + dx * 0.4, PL.y + PL.eyeH - 0.1, PL.z + dz * 0.4, dx * v, dy * v, dz * v, PL, 2 * (pw ? 1 + 0.25 * (pw + 1) : 1));
      if (!creative()) { if (!enchLv(bowSt, 'infinity')) INV.remove(IID.arrow, 1); damageItem(INV.slots, INV.sel, 1); }
    }
  }
  if (USE.kind === 'eat') R.hand.eat = 0;
  USE.kind = null; USE.t = 0; R.hand.bow = 0; R.hand.spy = false; R.hand.eat = 0;
}
function interactBlock(t, dry) {
  if (PL.sneaking && PL.held()) return false;
  const { x, y, z, id, m } = t;
  switch (id) {
    case BID.crafting_table: if (!dry) UI.openScreen('craft', { x, y, z }); return true;
    case BID.enchanting_table: if (!dry) UI.openScreen('enchant', { x, y, z }); return true;
    case BID.furnace: case BID.lit_furnace: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, newFurnace()); UI.openScreen('furnace', { x, y, z }); } return true;
    case BID.chest: if (!dry) { if (!getTile(x, y, z)) setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) }); UI.openScreen('chest', { x, y, z }); } return true;
    case BID.oak_door: if (!dry) { const oy = m & 8 ? -1 : 1; setMeta(x, y, z, m ^ 4); if (getBlock(x, y + oy, z) === id) setMeta(x, y + oy, z, getMeta(x, y + oy, z) ^ 4); play('door'); } return true;
    case BID.red_bed: if (!dry) trySleep(x, y, z); return true;
    case BID.tnt: { const h = PL.held(); if (h && h.id === IID.flint_and_steel) { if (!dry) { setBlock(x, y, z, 0); primeTNT(x, y, z); damageItem(INV.slots, INV.sel, 1); } return true; } return false; }
  }
  return false;
}
function trySleep(x, y, z) {
  const t = ((W.time % 24000) + 24000) % 24000;
  PL.spawn = [x, y + 1, z]; UI.flash('리스폰 지점이 설정되었습니다');
  if (t < 12542 || t > 23460) { if (W.rain < 0.5) { UI.flash('밤이나 뇌우 때만 잘 수 있어요'); return; } }
  if (ENT.some(e => e.kind === 'mob' && !e.dead && e.def.hostile && Math.abs(e.x - x) < 8 && Math.abs(e.y - y) < 5 && Math.abs(e.z - z) < 8)) { UI.flash('주변에 몬스터가 있어 잠들 수 없어요'); return; }
  PL.sleeping = 1; PL.x = x + .5; PL.z = z + .5; PL.y = y + 0.6; PL.vx = PL.vy = PL.vz = 0;
}
function newFurnace() { return { type: 'furnace', items: [null, null, null], burn: 0, burnMax: 0, cook: 0, xp: 0 }; }
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
  if (t && t.type === 'ent') {
    const e = t.e;
    if (d && h.id === IID.shears && e.type === 'sheep' && !e.sheared && !e.baby) { setSheared(e); dropItem(e.x, e.y + 1, e.z, BID.white_wool, 1 + Math.floor(Math.random() * 3)); damageItem(INV.slots, INV.sel, 1); swing(); return; }
    if (d && h.id === IID.bucket && e.type === 'cow' && !e.baby) { consume(); INV.add({ id: IID.milk_bucket, n: 1 }) && dropItem(PL.x, PL.y + 1, PL.z, IID.milk_bucket, 1); swing(); return; }
    if (d && e.def.food && h.id === IID[e.def.food] && !e.baby && e.love <= 0) { e.love = 600; consume(); for (let i = 0; i < 5; i++) R.simpleParticle(e.x, e.y + e.h + .3, e.z, [1, 0.3, 0.4], { size: 0.15, vy: 1, grav: 0 }); swing(); return; }
    return;
  }
  if (t && t.type === 'block') {
    if (first && interactBlock(t, false)) { swing(); return; }
    const { x, y, z, id } = t;
    if (d) {
      // tools on blocks
      const tool = d.tool;
      if (tool && tool.type === S.TOOL.HOE && (id === 2 || id === 3) && getBlock(x, y + 1, z) === 0) { setBlock(x, y, z, BID.farmland); play('place', { mat: 'gravel' }); damageItem(INV.slots, INV.sel, 1); swing(); return; }
      if (tool && tool.type === S.TOOL.SHOVEL && id === 2 && getBlock(x, y + 1, z) === 0) { return; }
      if (tool && tool.type === S.TOOL.AXE && BLOCKS[id].scrape) { setBlock(x, y, z, BLOCKS[id].scrape); for (let i = 0; i < 8; i++) R.simpleParticle(x + Math.random(), y + 1.05, z + Math.random(), [0.9, 0.9, 0.9], { size: 0.08, vy: 0.5 }); damageItem(INV.slots, INV.sel, 1); swing(); return; }
      if (h.id === IID.bone_meal) { if (boneMeal(x, y, z, id)) { consume(); swing(); } return; }
      if (h.id === IID.flint_and_steel) { return; }
      if (h.id === IID.bucket) { if (FLUID[id] && getMeta(x, y, z) === 0) { setBlock(x, y, z, 0); consume(); const it = { id: id === 27 ? IID.water_bucket : IID.lava_bucket, n: 1 }; if (creative()) {} else if (!PL.held()) INV.slots[INV.sel] = it; else if (INV.add(it)) dropStack(PL.x, PL.y + 1, PL.z, it); play('splash'); swing(); } else if (id === BID.powder_snow) { setBlock(x, y, z, 0); consume(); const it = { id: IID.powder_snow_bucket, n: 1 }; if (!PL.held()) INV.slots[INV.sel] = it; else INV.add(it); swing(); } return; }
      if (h.id === IID.water_bucket || h.id === IID.lava_bucket || h.id === IID.powder_snow_bucket) {
        const [px, py, pz] = REPL[id] && !FLUID[id] ? [x, y, z] : [x + t.nx, y + t.ny, z + t.nz];
        const cur = getBlock(px, py, pz); if (cur && !REPL[cur] && !FLUID[cur]) return;
        const fl = h.id === IID.water_bucket ? 27 : h.id === IID.lava_bucket ? 28 : BID.powder_snow;
        setBlock(px, py, pz, fl, 0); schedule(px, py, pz, 1);
        if (!creative()) INV.slots[INV.sel] = { id: IID.bucket, n: 1 };
        play('splash'); swing(); return;
      }
      if (h.id === IID.snowball || h.id === IID.egg) { throwItem(h.id); return; }
      if (d.place != null) { placeBlock(t, d); return; }
    }
  } else if (d && (h.id === IID.snowball || h.id === IID.egg)) { throwItem(h.id); return; }
}
function throwItem(id) {
  const [dx, dy, dz] = lookDir();
  const e = shootArrow(PL.x + dx * .4, PL.y + PL.eyeH - .1, PL.z + dz * .4, dx * 1.5, dy * 1.5 + 0.1, dz * 1.5, PL, 0);
  e.thrown = id; scene.remove(e.mesh); e.mesh = R.itemMesh(id); e.mesh.scale.setScalar(0.3); scene.add(e.mesh);
  consume(); swing();
}
function boneMeal(x, y, z, id) {
  for (let i = 0; i < 8; i++) R.simpleParticle(x + Math.random(), y + 0.5 + Math.random() * .5, z + Math.random(), [0.4, 0.9, 0.3], { size: 0.08, vy: 0.4, grav: 0 });
  if (id === BID.wheat) { setMeta(x, y, z, Math.min(7, getMeta(x, y, z) + 2 + Math.floor(Math.random() * 4))); return true; }
  if (id >= 38 && id <= 40) { if (Math.random() < 0.45) growTreeAt(x, y, z, id === 38 ? 0 : id === 40 ? 2 : 3); return true; }
  if (id === 2) { for (let k = 0; k < 40; k++) { const tx = x + Math.floor((Math.random() - .5) * 7), tz = z + Math.floor((Math.random() - .5) * 7); for (let ty = y + 2; ty >= y - 2; ty--) if (getBlock(tx, ty, tz) === 2 && getBlock(tx, ty + 1, tz) === 0) { setBlock(tx, ty + 1, tz, Math.random() < 0.85 ? 29 : [31, 32, 33, 34][Math.floor(Math.random() * 4)]); break; } } return true; }
  return false;
}
function placeBlock(t, d) {
  let id = d.place, meta = 0;
  let x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
  const tgt = getBlock(t.x, t.y, t.z);
  if (REPL[tgt] && !FLUID[tgt] && !(tgt === BID.snow && id === BID.snow)) { x = t.x; y = t.y; z = t.z; }
  // slab merging / snow stacking
  if (d.block && BLOCKS[id].slab && tgt === id && ((t.ny === 1 && !(t.m & 1)) || (t.ny === -1 && (t.m & 1)))) { setBlock(t.x, t.y, t.z, BLOCKS[id].slab); consume(); play('place', { mat: soundMat(id) }); swing(); return; }
  if (id === BID.snow && tgt === BID.snow && (t.m & 7) < 7) { setBlock(t.x, t.y, t.z, BID.snow, t.m + 1); consume(); swing(); return; }
  if (y < 0 || y >= CH) return;
  const cur = getBlock(x, y, z); if (cur && !REPL[cur]) return;
  if (cur === id && BLOCKS[id].slab) { setBlock(x, y, z, BLOCKS[id].slab); consume(); swing(); return; }
  const below = getBlock(x, y - 1, z), fd = facingDir();
  const b = BLOCKS[id];
  // placement rules
  if (b.plant) {
    const ok = b.plant === 1 ? (below === 2 || below === 3 || below === BID.farmland || below === BID.moss_block) : b.plant === 2 ? (below === 9 || below === 3 || below === 2) : b.plant === 3 ? (below === id || ((below === 2 || below === 3 || below === 9) && N6.some(([dx, dy, dz]) => !dy && getBlock(x + dx, y - 1, z + dz) === 27))) : b.plant === 4 ? (below === id || below === 9) : b.plant === 5 ? below === BID.farmland : OPQ[below];
    if (!ok) return;
    if (id === BID.cactus && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => SOLID[getBlock(x + dx, y, z + dz)])) return;
  }
  if (id === BID.torch) { if (t.ny === 1 && supportedBy(below)) meta = 0; else if (t.ny === 0) { meta = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dz]) => dx === -t.nx && dz === -t.nz) + 1; if (!OPQ[getBlock(x - t.nx, y, z - t.nz)]) return; } else return; }
  if (id === BID.ladder) { if (t.ny !== 0) return; meta = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dz]) => dx === -t.nx && dz === -t.nz); if (!OPQ[getBlock(x - t.nx, y, z - t.nz)]) return; }
  if (id === BID.lantern) meta = t.ny === -1 ? 1 : 0;
  if (id === BID.glow_lichen) { meta = t.ny === 1 ? 0 : t.ny === -1 ? 1 : t.nz === 1 ? 2 : t.nz === -1 ? 3 : t.nx === 1 ? 4 : 5; }
  if (b.facing) meta = (fd + 2) & 3;
  if (S.LOGAX[id]) meta = t.nx ? 1 : t.nz ? 2 : 0;
  if (b.slab) meta = t.ny === -1 || (t.ny === 0 && t.hy > 0.5) ? 1 : 0;
  if (b.stairs) meta = fd | (t.ny === -1 || (t.ny === 0 && t.hy > 0.5) ? 4 : 0);
  if (b.leaves) meta = 1;
  if (id === BID.pointed_dripstone) meta = t.ny === -1 ? 0 : 1;
  if (id === BID.oak_door) {
    if (getBlock(x, y + 1, z) && !REPL[getBlock(x, y + 1, z)] || !supportedBy(below)) return;
    if (entityBlocks(x, y, z) || entityBlocks(x, y + 1, z)) return;
    meta = (fd + 2) & 3;
    setBlock(x, y, z, id, meta, { noUpdate: true }); setBlock(x, y + 1, z, id, meta | 8);
    consume(); play('place', { mat: 'wood' }); swing(); return;
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
  if (id === BID.chest) setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) });
  consume(); play('place', { mat: soundMat(id) }); swing();
}
function pickBlock() {
  const t = TARGET; if (!t || t.type !== 'block') return;
  let id = t.id; if (id === BID.lit_furnace) id = BID.furnace; if (id === BID.wheat) id = IID.wheat_seeds; if (id === BID.farmland) id = BID.dirt;
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
  dropItem(PL.x, PL.y + PL.eyeH - 0.3, PL.z, h.id, n, [dx * 0.3, dy * 0.3 + 0.1, dz * 0.3], 40, h.d);
  h.n -= n; if (h.n <= 0) INV.slots[INV.sel] = null; swing(); UI.hudDirty = true;
}
// ---------- furnaces ----------
function furnaceTick() {
  for (const c of W.chunks.values()) for (const [i, t] of c.tiles) {
    if (t.type !== 'furnace') continue;
    const [inp, fuel, out] = t.items;
    const r = inp && SMELT[inp.id];
    const canOut = r && (!out || (out.id === r[0] && out.n < maxStack(r[0])));
    const wasLit = t.burn > 0;
    if (t.burn > 0) t.burn--;
    if (t.burn <= 0 && canOut && fuel && ITEMS[fuel.id].fuel) {
      t.burn = t.burnMax = ITEMS[fuel.id].fuel; fuel.n--;
      if (fuel.n <= 0) t.items[1] = fuel.id === IID.lava_bucket ? { id: IID.bucket, n: 1 } : null;
      c.modified = c.edited = true;
    }
    if (t.burn > 0 && canOut) { t.cook++; if (t.cook >= 200) { t.cook = 0; inp.n--; if (inp.n <= 0) t.items[0] = null; if (out) out.n++; else t.items[2] = { id: r[0], n: 1 }; t.xp += r[1]; c.modified = c.edited = true; } }
    else if (t.cook > 0) t.cook = Math.max(0, t.cook - 2);
    const lit = t.burn > 0;
    if (lit !== wasLit) { const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15); const b = c.blocks[i]; if (b === BID.furnace || b === BID.lit_furnace) setBlock(x, y, z, lit ? BID.lit_furnace : BID.furnace, c.meta[i], { keepTile: true }); }
  }
}

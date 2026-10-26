// Nether, End and village mobs, the ender dragon fight, boats, projectiles and A* pathfinding.
// Hooks into entities.js through MOBDEF entries (ai / anim / onHurt) and generic entity kinds (tick / render).
const solidBox = (c) => mobCanvas(g => { g.fillStyle = c; g.fillRect(0, 0, 64, 64); });
const BOXPARTS = (w, h, d) => [['body', [0, 0, 0], [-w / 2, 0, -d / 2, w, h, d], [0, 0]]];
Object.assign(MOBDEF, {
  zombified_piglin: { hp: 20, w: 0.3, h: 1.95, speed: 0.12, hostile: 1, neutral: 1, dmg: 8, xp: 5, snd: 'groan', fireproof: 1, armsOut: 1, nether: 1,
    drops: [['rotten_flesh', 0, 1], ['gold_nugget', 0, 1]], extraDrop: [['gold_ingot', 0.025]], parts: HUMAN(4), tex: () => solidBox('#d89a8a') },
  ghast: { hp: 10, w: 2, h: 4, speed: 0.03, hostile: 1, fly: 1, xp: 5, snd: 'ghast', fireproof: 1, drops: [['ghast_tear', 0, 1], ['gunpowder', 0, 2]], parts: BOXPARTS(16, 16, 16), tex: () => solidBox('#f0f0f0'), ai: ghastAI },
  blaze: { hp: 20, w: 0.3, h: 1.8, speed: 0.07, hostile: 1, xp: 10, snd: 'blaze', fireproof: 1, waterHurt: 1, drops: [['blaze_rod', 0, 1]], parts: BOXPARTS(8, 8, 8), tex: () => solidBox('#f0c030'), ai: blazeAI, anim: blazeAnim },
  magma_cube: { hp: 16, w: 1, h: 2, speed: 0.1, hostile: 1, xp: 4, snd: 'slime', fireproof: 1, slime: 1, drops: [['magma_cream', 0, 1]], parts: BOXPARTS(8, 8, 8), tex: () => solidBox('#602010'), ai: slimeAI, anim: slimeAnim },
  slime: { hp: 16, w: 1, h: 2, speed: 0.1, hostile: 1, xp: 4, snd: 'slime', slime: 1, drops: [['slime_ball', 0, 2]], parts: BOXPARTS(8, 8, 8), tex: () => solidBox('#70c060'), ai: slimeAI, anim: slimeAnim },
  enderman: { hp: 40, w: 0.3, h: 2.9, speed: 0.15, hostile: 1, neutral: 1, dmg: 7, xp: 5, snd: 'enderman', waterHurt: 1, drops: [['ender_pearl', 0, 1]], parts: HUMAN(2), tex: () => solidBox('#161616'), ai: endermanAI },
  villager: { hp: 20, w: 0.3, h: 1.95, speed: 0.07, xp: 0, snd: 'hmm', drops: [], parts: HUMAN(4), tex: () => solidBox('#b0805a'), villager: 1 },
  iron_golem: { hp: 100, w: 0.7, h: 2.7, speed: 0.06, xp: 0, snd: 'golem', drops: [['iron_ingot', 3, 5], ['poppy', 0, 2]], parts: HUMAN(4), tex: () => solidBox('#d8d0c8'), ai: golemAI, anim: golemAnim, kbRes: 1 },
  end_crystal: { hp: 1, w: 1, h: 2, speed: 0, xp: 0, snd: 'click', drops: [], parts: BOXPARTS(8, 8, 8), tex: () => solidBox('#c080ff'), ai: crystalAI, anim: crystalAnim, onHurt: crystalHurt, noPush: 1 },
  ender_dragon: { hp: 200, w: 4, h: 4, speed: 0, hostile: 1, boss: 1, xp: 0, snd: 'growl', fireproof: 1, drops: [], parts: BOXPARTS(16, 16, 16), tex: () => solidBox('#202020'), ai: dragonAI, anim: dragonAnim, onHurt: dragonHurt, noPush: 1 },
});
MOBDEF.ghast.anim = (e, P, now) => { const t = e.shooting ? packTexture('ghast_shooting') : packTexture('ghast'); if (t && e.mesh.userData.own) for (const m of e.mesh.userData.own) if (m.map !== t) { m.map = t; } for (let i = 0; i < 9; i++) if (P['t' + i]) P['t' + i].rotation.x = Math.sin(now / 300 + i) * 0.3 + 0.3; };
// ---- ender dragon model (Java DragonModel, simplified pose; 256x256 texture) ----
(() => {
  const P = [];
  P.push({ n: 'body', o: [0, 4, 8], b: [[0, 0, -12, 0, -16, 24, 24, 64], [220, 53, -1, -6, -10, 2, 6, 12], [220, 53, -1, -6, 10, 2, 6, 12], [220, 53, -1, -6, 30, 2, 6, 12]] });
  for (let i = 0; i < 5; i++) P.push({ n: 'neck' + i, o: [0, 13 - i * 1.5, -3 - i * 10], b: [[192, 104, -5, -5, -5, 10, 10, 10], [48, 0, -1, -9, -3, 2, 4, 6]] });
  P.push({ n: 'head', o: [0, 6, -54], b: [[112, 30, -8, -8, -10, 16, 16, 16], [176, 44, -6, -1, -24, 12, 5, 16], [112, 0, -5, -3, -22, 2, 2, 4], [112, 0, 3, -3, -22, 2, 2, 4, 0, 1], [0, 0, -5, -12, -4, 2, 4, 6], [0, 0, 3, -12, -4, 2, 4, 6, 0, 1]] });
  P.push({ n: 'jaw', p: 'head', o: [0, 4, -8], b: [[176, 65, -6, 0, -16, 12, 4, 16]] });
  for (let i = 0; i < 12; i++) P.push({ n: 'tail' + i, o: [0, 10 + i * 0.6, 77 + i * 10], b: [[192, 104, -5, -5, -5, 10, 10, 10], [48, 0, -1, -9, -3, 2, 4, 6]] });
  for (const s of [1, -1]) {
    const k = s > 0 ? 'l' : 'r';
    P.push({ n: k + 'wing', o: [12 * s, 5, 2], b: s > 0 ? [[112, 88, 0, -4, -4, 56, 8, 8, 0, 1], [-56, 88, 0, 0, 2, 56, 0, 56, 0, 1]] : [[112, 88, -56, -4, -4, 56, 8, 8], [-56, 88, -56, 0, 2, 56, 0, 56]] });
    P.push({ n: k + 'tip', p: k + 'wing', o: [56 * s, 0, 0], b: s > 0 ? [[112, 136, 0, -2, -2, 56, 4, 4, 0, 1], [-56, 144, 0, 0, 2, 56, 0, 56, 0, 1]] : [[112, 136, -56, -2, -2, 56, 4, 4], [-56, 144, -56, 0, 2, 56, 0, 56]] });
    P.push({ n: k + 'fleg', o: [12 * s, 20, 2], r: [1.3, 0, 0], b: [[112, 104, -4, -4, -4, 8, 24, 8]] });
    P.push({ n: k + 'rleg', o: [16 * s, 16, 42], r: [1.0, 0, 0], b: [[0, 0, -8, -4, -8, 16, 32, 16]] });
  }
  MCMODELS.ender_dragon = { tex: 'dragon', eyes: 'dragon_eyes', tw: 256, th: 256, big: 1, parts: P.map(p => p.n === 'head' ? { ...p, e: 1 } : p) };
})();
// ---- small helpers ----
const plTargetable = () => PL.mode !== 'creative' && PL.mode !== 'spectator' && !PL.dead;
function faceTo(e, tx, tz) { e.yawTarget = Math.atan2(-(tx - e.x), -(tz - e.z)); }
function turn(e, k = 0.35) { if (e.yawTarget == null) return; let dy = e.yawTarget - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += Math.max(-k, Math.min(k, dy)); }
function flyMove(e, k = 0.91) { physMove(e, e.vx, e.vy, e.vz, 0); e.vx *= k; e.vy *= k; e.vz *= k; }
// ---------- A* pathfinding for walking mobs ----------
const PF = { budget: 0 };
function pfWalkable(x, y, z, h) {
  const b = getBlock(x, y, z); if (SOLID[b] || b === BID.lava || b === BID.fire || b === BID.cactus || b === BID.magma_block) return false;
  for (let k = 1; k < h; k++) if (SOLID[getBlock(x, y + k, z)]) return false;
  const u = getBlock(x, y - 1, z); return SOLID[u] && u !== BID.cactus && u !== BID.magma_block || u === BID.water || b === BID.water;
}
function findPath(e, tx, ty, tz, maxN = 360) {
  const h = Math.ceil(e.h), sx = Math.floor(e.x), sy = Math.floor(e.y + 0.01), sz = Math.floor(e.z);
  tx = Math.floor(tx); ty = Math.floor(ty); tz = Math.floor(tz);
  const key = (x, y, z) => ((x - sx + 512) * 1024 + (z - sz + 512)) * 512 + y;
  const open = [], came = new Map(), g = new Map(), H = (x, y, z) => Math.abs(x - tx) + Math.abs(y - ty) * 1.5 + Math.abs(z - tz);
  const push = n => { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p].f <= n.f) break; open[i] = open[p]; i = p; } open[i] = n; };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < open.length && open[l].f < (m === i ? last.f : open[m].f)) m = l; if (r < open.length && open[r].f < (m === i ? last.f : open[m].f)) m = r; if (m === i) break; open[i] = open[m]; i = m; } open[i] = last; } return top; };
  push({ x: sx, y: sy, z: sz, f: H(sx, sy, sz) }); g.set(key(sx, sy, sz), 0);
  let best = null, bestH = Infinity, n = 0;
  while (open.length && n++ < maxN) {
    const c = pop(), ck = key(c.x, c.y, c.z), cg = g.get(ck), ch = H(c.x, c.y, c.z);
    if (ch < bestH) { bestH = ch; best = c; }
    if (ch < 1.5) { best = c; break; }
    for (const [dx, , dz] of DIRS) {
      const nx = c.x + dx, nz = c.z + dz;
      let ny = null;
      if (pfWalkable(nx, c.y, nz, h)) ny = c.y;
      else if (pfWalkable(nx, c.y + 1, nz, h) && !SOLID[getBlock(c.x, c.y + h, c.z)]) ny = c.y + 1;
      else if (!SOLID[getBlock(nx, c.y, nz)] && !SOLID[getBlock(nx, c.y + 1, nz)]) { for (let d = 1; d <= 3; d++) if (pfWalkable(nx, c.y - d, nz, h)) { ny = c.y - d; break; } }
      if (ny == null) continue;
      const nk = key(nx, ny, nz), ng = cg + 1 + (ny !== c.y ? 0.5 : 0);
      if (g.has(nk) && g.get(nk) <= ng) continue;
      g.set(nk, ng); came.set(nk, c); push({ x: nx, y: ny, z: nz, f: ng + H(nx, ny, nz) });
    }
  }
  if (!best) return null;
  const path = []; let c = best; while (c) { path.push([c.x + 0.5, c.y, c.z + 0.5]); c = came.get(key(c.x, c.y, c.z)); }
  path.reverse(); path.shift();
  return path.length ? path : null;
}
// returns a unit direction toward the target, following an A* path around obstacles when needed
function pathDir(e, tx, ty, tz) {
  const ddx = tx - e.x, ddz = tz - e.z, dl = Math.hypot(ddx, ddz) || 1;
  const direct = dl < 2.5 || (Math.abs(ty - e.y) < 1.5 && !e.hitH && canSee(e.x, e.y + 0.5, e.z, tx, ty + 0.5, tz) && pfWalkable(Math.floor(e.x + ddx / dl), Math.floor(e.y + .01), Math.floor(e.z + ddz / dl), Math.ceil(e.h)));
  if (direct && !e.path) return [ddx / dl, ddz / dl];
  const moved = !e.pathT || Math.hypot(e.pathT[0] - tx, e.pathT[2] - tz) > 2.5;
  if ((!e.path || moved || e.age - (e.pathAge || 0) > 60) && PF.budget > 0) { PF.budget--; e.path = findPath(e, tx, ty, tz); e.pathT = [tx, ty, tz]; e.pathAge = e.age; e.pathI = 0; }
  if (!e.path) return [ddx / dl, ddz / dl];
  let p = e.path[e.pathI];
  while (p && Math.hypot(p[0] - e.x, p[2] - e.z) < 0.45 && Math.abs(p[1] - e.y) < 1.2) { e.pathI++; p = e.path[e.pathI]; }
  if (!p) { e.path = null; return direct ? [ddx / dl, ddz / dl] : [0, 0]; }
  const px = p[0] - e.x, pz = p[2] - e.z, pl = Math.hypot(px, pz) || 1;
  if (p[1] > e.y + 0.5 && e.onGround && e.jumpCd <= 0) { e.vy = 0.42; e.jumpCd = 10; }
  return [px / pl, pz / pl];
}
// ---------- projectiles ----------
function spawnFireball(x, y, z, dx, dy, dz, owner, small) {
  const e = Ent('fireball', x, y, z); e.kind = 'fireball'; e.hittable = !small; e.small = small; e.owner = owner; e.w = small ? 0.16 : 0.5; e.h = small ? 0.32 : 1;
  const l = Math.hypot(dx, dy, dz) || 1; e.ax = dx / l * 0.1; e.ay = dy / l * 0.1; e.az = dz / l * 0.1;
  e.mesh = R.itemMesh(IID.fire_charge); e.mesh.scale.setScalar(small ? 0.3 : 1); e.tick = fireballTick; e.render = spinRender; e.onHit = fireballDeflect;
  play(small ? 'blaze' : 'fireball', { vol: 0.6 }); return addEnt(e);
}
function fireballDeflect(e) { const [dx, dy, dz] = lookDir(); e.ax = dx * 0.1; e.ay = dy * 0.1; e.az = dz * 0.1; e.vx = dx; e.vy = dy; e.vz = dz; e.owner = PL; play('hit'); }
function fireballTick(e) {
  e.vx = (e.vx + e.ax) * 0.95; e.vy = (e.vy + e.ay) * 0.95; e.vz = (e.vz + e.az) * 0.95;
  if (Math.random() < 0.5) R.simpleParticle(e.x, e.y + e.h / 2, e.z, [0.4, 0.4, 0.4], { kind: 'smoke', size: e.small ? 0.15 : 0.4, vy: 0.1, grav: 0, life: 0.4 });
  const steps = Math.max(1, Math.ceil(Math.hypot(e.vx, e.vy, e.vz) / 0.3));
  for (let s = 0; s < steps; s++) {
    const nx = e.x + e.vx / steps, ny = e.y + e.vy / steps, nz = e.z + e.vz / steps, cy = ny + e.h / 2;
    let hit = SOLID[getBlock(Math.floor(nx), Math.floor(cy), Math.floor(nz))];
    if (!hit && e.owner !== PL && !PL.dead && Math.abs(PL.x - nx) < 0.3 + e.w && Math.abs(PL.z - nz) < 0.3 + e.w && cy > PL.y && cy < PL.y + PL.h) hit = 'pl';
    if (!hit) for (const o of ENT) if (o.kind === 'mob' && !o.dead && o !== e.owner && Math.abs(o.x - nx) < o.w + e.w && Math.abs(o.z - nz) < o.w + e.w && cy > o.y && cy < o.y + o.h) { hit = o; break; }
    if (hit) {
      removeEnt(e);
      if (e.small) {
        if (hit === 'pl') { if (hurtPlayer(5 * DIFF_MUL(), 'fire', e.owner)) PL.fire = Math.max(PL.fire, 100); }
        else if (typeof hit === 'object') { hurtMob(hit, 5, e.owner === PL ? PL : null); if (!hit.def.fireproof) hit.fire = 100; }
        else { const bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z); if (!getBlock(bx, by, bz) && SOLID[getBlock(bx, by - 1, bz)]) setBlock(bx, by, bz, BID.fire); }
      } else {
        if (typeof hit === 'object') { HURTPROJ = { fireball: true }; hurtMob(hit, hit.type === 'ghast' && e.owner === PL ? 1000 : 6, e.owner === PL ? PL : null, 0, 0, e.owner === PL ? 'player' : null); HURTPROJ = null; }
        if (hit === 'pl') hurtPlayer(6 * DIFF_MUL(), 'explosion', e.owner);
        explode(nx, cy, nz, 1, true);
      }
      return;
    }
    e.x = nx; e.y = ny; e.z = nz;
  }
  if (e.age > 400) removeEnt(e);
}
function spinRender(e, x, y, z, br, now) { e.mesh.position.set(x, y + e.h / 2, z); e.mesh.rotation.set(0, now / 200, now / 300); e.mesh.traverse(o => { if (o.isMesh) R.setMeshLight(o, 1.4); }); }
// thrown items: snowballs, eggs and ender pearls break on impact; eyes of ender fly toward a stronghold
function onThrownHit(e, x, y, z, hitMob) {
  const td = ITEMS[e.thrown];
  if (td && td.splash) { splashPotion(e.thrown, x, y, z, hitMob); return; }
  if (td && td.lingering) { play('break', { mat: 'glass' }); potionBurst(x, y, z, POTION[td.potion].col); spawnCloud(x, Math.floor(y) + 0.05, z, td.potion); return; }
  if (e.thrown === IID.ender_pearl && Math.random() < 0.05) spawnMob('endermite', x, y, z);
  if (e.thrown === IID.ender_pearl && e.owner === PL && !PL.dead) {
    for (let i = 0; i < 16; i++) R.simpleParticle(x + (Math.random() - .5), y + Math.random() * 2, z + (Math.random() - .5), [0.6, 0.2, 0.9], { kind: 'portal', size: 0.12, vy: 0.5, grav: 0 });
    PL.x = x; PL.y = y + 0.05; PL.z = z; PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.vx = PL.vy = PL.vz = 0; PL.fallDist = 0;
    hurtPlayer(5, 'fall'); play('teleport');
  }
  if (hitMob) { if (e.thrown === IID.snowball) hurtMob(hitMob, hitMob.type === 'blaze' ? 3 : 0.001, e.owner === PL ? PL : null, e.vx, e.vz); else if (e.thrown === IID.egg) hurtMob(hitMob, 0.001, null, e.vx, e.vz); }
  if (e.thrown === IID.egg && Math.random() < 0.125) spawnMob('chicken', x, y, z, { baby: true });
  if (e.thrown === IID.experience_bottle) { spawnXP(x, y + 0.3, z, 3 + Math.floor(Math.random() * 9)); play('break', { mat: 'glass' }); for (let i = 0; i < 10; i++) R.simpleParticle(x, y + 0.3, z, [0.4, 0.5, 1], { kind: 'splash', size: 0.1, vy: 1 }); }
  for (let i = 0; i < 6; i++) R.simpleParticle(x, y, z, e.thrown === IID.snowball ? [1, 1, 1] : [0.9, 0.85, 0.7], { size: 0.1, vy: 1 });
}
function throwEye() {
  const sh = S.strongholdsOf(W.seed); let best = null, bd = Infinity;
  for (const p of sh) { const d = Math.hypot(p[0] - PL.x, p[2] - PL.z); if (d < bd) { bd = d; best = p; } }
  if (!best || W.dim !== 0) return false;
  const e = Ent('eye', PL.x, PL.y + PL.eyeH - 0.2, PL.z); e.kind = 'eye'; e.w = 0.1; e.h = 0.1; e.tx = best[0] + .5; e.tz = best[2] + .5; e.ty = PL.y + 8;
  e.mesh = R.itemMesh(IID.ender_eye); e.mesh.scale.setScalar(0.4); e.tick = eyeTick; e.render = spinRender;
  play('portal', { vol: 0.3 }); addEnt(e); return true;
}
function eyeTick(e) {
  const dx = e.tx - e.x, dz = e.tz - e.z, d = Math.hypot(dx, dz), sp = Math.min(0.5, d);
  if (e.age < 70) { e.x += dx / (d || 1) * sp * 0.6; e.z += dz / (d || 1) * sp * 0.6; e.y += (e.ty - e.y) * 0.05; }
  R.simpleParticle(e.x, e.y, e.z, [0.6, 0.2, 0.9], { kind: 'portal', size: 0.1, vy: 0, grav: 0, life: 0.6 });
  if (e.age > 80) { removeEnt(e); if (Math.random() < 0.8) dropItem(e.x, e.y, e.z, IID.ender_eye, 1); else play('break', { mat: 'glass' }); }
}
// ---------- boats ----------
function placeBoat(x, y, z, yaw, wood) {
  const e = Ent('boat', x, y, z); e.kind = 'boat'; e.w = 0.69; e.h = 0.56; e.hittable = true; e.yaw = yaw; e.hp = 4; e.wood = wood || 'oak';
  const tex = e.wood !== 'oak' && packTexture('boat_' + e.wood);
  e.mesh = tex ? buildMCModel('boat', MCMODELS.boat, tex) : buildModel('boat'); e.tick = boatTick; e.render = boatRender; e.onHit = boatHit; return addEnt(e);
}
function boatHit(e) { if (creative()) { removeEnt(e); if (PL.riding === e) dismount(); return; } e.hp--; e.hurt = 8; play('hit', { vol: 0.5 }); if (e.hp <= 0) { removeEnt(e); if (PL.riding === e) dismount(); dropItem(e.x, e.y + 0.5, e.z, IID[e.wood + '_boat'] || IID.oak_boat, 1); } }
function mount(e) { if (e.rider) return; PL.riding = e; e.rider = PL; PL.flying = false; PL.sneaking = false; play('boat'); }
function dismount() {
  const e = PL.riding; PL.riding = null; if (!e) return; e.rider = null;
  for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0, 0]]) { const x = e.x + dx, z = e.z + dz; if (!SOLID[getBlock(Math.floor(x), Math.floor(e.y + 0.6), Math.floor(z))] && !SOLID[getBlock(Math.floor(x), Math.floor(e.y + 1.6), Math.floor(z))]) { PL.x = x; PL.y = e.y + 0.6; PL.z = z; break; } }
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.vx = PL.vy = PL.vz = 0;
}
function boatTick(e) {
  const inW = fluidAt(e.x, e.y + 0.1, e.z) === 1, deep = fluidAt(e.x, e.y + 0.45, e.z) === 1, under = getBlock(Math.floor(e.x), Math.floor(e.y - 0.1), Math.floor(e.z));
  if (e.hurt > 0) e.hurt--;
  if (e.rider) {
    e.yaw -= IN.s * 0.055; // A/D steer
    const th = IN.f > 0 ? 0.04 : IN.f < 0 ? -0.005 : 0;
    e.vx += -Math.sin(e.yaw) * th; e.vz += -Math.cos(e.yaw) * th;
    if (IN.sneak) { dismount(); }
  }
  if (deep) e.vy = Math.min(e.vy + 0.06, 0.12); else if (inW) { e.vy *= 0.5; if (e.vy < 0) e.vy = 0; } else e.vy -= 0.04;
  physMove(e, e.vx, e.vy, e.vz, 0);
  const fr = inW || deep ? 0.9 : under === BID.ice ? 0.98 : 0.5;
  e.vx *= fr; e.vz *= fr; e.vy *= 0.98;
  if (e.rider) { PL.x = e.x; PL.y = e.y + 0.18; PL.z = e.z; PL.vx = e.vx; PL.vz = e.vz; PL.vy = 0; PL.fallDist = 0; PL.onGround = true; }
  if (e.y < -40) removeEnt(e);
}
function boatRender(e, x, y, z, br) {
  e.mesh.position.set(x, y - 0.95, z);
  const yaw = e.pyaw + (((e.yaw - e.pyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  e.mesh.rotation.set(0, yaw + Math.PI / 2, e.hurt > 0 ? Math.sin(e.hurt) * 0.1 : 0);
  for (const m of e.mesh.userData.mats) m.color.setScalar(br);
}
function rideTick() {
  const e = PL.riding;
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z;
  if (!e || e.dead) { PL.riding = null; return; }
  PL.x = e.x; PL.y = e.y + (e.rideY != null ? e.rideY : 0.18); PL.z = e.z; PL.sprinting = false; PL.eyeH += (1.62 - PL.eyeH) * 0.5;
}
// ---------- spawning in each dimension ----------
function mobsForDimension(x, y, z, b, below) {
  if (W.dim === -1) {
    const ex = netherExtra(x, y, z); if (ex) return [ex];
    const bio = biomeAt(x, z);
    if (bio === S.NETHER_BIO.SOUL) return Math.random() < 0.7 ? ['skeleton'] : ['ghast'];
    if (bio === S.NETHER_BIO.BASALT) return Math.random() < 0.6 ? ['magma_cube'] : ['ghast'];
    if (bio === S.NETHER_BIO.WARPED) return ['enderman'];
    const v = Math.random();
    return v < 0.62 ? ['zombified_piglin'] : v < 0.85 ? ['ghast'] : v < 0.97 ? ['magma_cube'] : ['enderman'];
  }
  if (W.dim === 1) return below === BID.end_stone ? ['enderman'] : null;
  return null;
}
function trySpawnDimension() {
  const cap = W.dim === 1 ? 14 : 18;
  if (PL.difficulty === 0 || countMobs(e => e.def.hostile && !e.def.boss) >= cap) return;
  for (let a = 0; a < 3; a++) {
    const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * Math.max(8, Math.min(R.rd * 16, 72) - 24);
    const x = Math.floor(PL.x + Math.cos(ang) * r), z = Math.floor(PL.z + Math.sin(ang) * r);
    if (!isLoaded(x, z)) continue;
    const y0 = W.dim === 1 ? topY(x, z) + 1 : 32 + Math.floor(Math.random() * 90);
    let y = y0; while (y > 2 && !SOLID[getBlock(x, y - 1, z)]) y--;
    const below = getBlock(x, y - 1, z);
    if (!SOLID[below] || below === BID.bedrock || SOLID[getBlock(x, y, z)] || SOLID[getBlock(x, y + 1, z)] || FLUID[getBlock(x, y, z)]) continue;
    if ((getLight(x, y, z) & 15) > 11) continue;
    const types = mobsForDimension(x, y, z, getBlock(x, y, z), below); if (!types) continue;
    const t = types[0];
    if (t === 'ghast') { if (SOLID[getBlock(x, y + 4, z)] || countMobs(e => e.type === 'ghast') >= 4) continue; spawnMob(t, x + .5, y + 2, z + .5); }
    else if (t === 'magma_cube') spawnMob(t, x + .5, y, z + .5, { size: [1, 2, 4][Math.floor(Math.random() * 3)] });
    else { const n = t === 'zombified_piglin' ? 1 + Math.floor(Math.random() * 3) : 1; for (let i = 0; i < n; i++) spawnMob(t, x + .5 + i * 0.3, y, z + .5); }
    break;
  }
}
const MOON_SIZE = [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75], moonPhase = () => Math.floor(W.time / 24000) % 8; // 0 full moon, 4 new moon
// overworld extras: endermen at night and slimes in swamps and slime chunks
function overworldExtra(x, y, z) { // swamp slimes follow the moon: most at full moon, none at new moon
  const b = biomeBase(x, z);
  if (Math.random() < 0.08) return 'enderman';
  const slimeChunk = S.hash32(W.seed, x >> 4, z >> 4, 99) % 10 === 0;
  if ((b === S.BIO.SWAMP && y > 50 && y < 70 && Math.random() < 0.5 && Math.random() < MOON_SIZE[moonPhase()]) || (slimeChunk && y < 40 && Math.random() < 0.3)) return 'slime';
  return null;
}
// ---------- AI routines ----------
function ghastAI(e, dist) {
  if (!e.goal || Math.random() < 0.01 || Math.hypot(e.goal[0] - e.x, e.goal[1] - e.y, e.goal[2] - e.z) < 1) e.goal = [e.x + (Math.random() - .5) * 32, Math.max(40, Math.min(110, e.y + (Math.random() - .5) * 16)), e.z + (Math.random() - .5) * 32];
  const gx = e.goal[0] - e.x, gy = e.goal[1] - e.y, gz = e.goal[2] - e.z, gl = Math.hypot(gx, gy, gz) || 1;
  e.vx += gx / gl * 0.01; e.vy += gy / gl * 0.01; e.vz += gz / gl * 0.01;
  if (e.hitH || e.hitV) e.goal = null;
  const see = plTargetable() && dist < 64 && canSee(e.x, e.y + 2, e.z, PL.x, PL.y + 1.6, PL.z);
  if (see) { faceTo(e, PL.x, PL.z); e.charge = (e.charge || 0) + 1; if (e.charge === 10) play('ghast', { vol: 0.8 }); if (e.charge >= 20) { e.charge = -40; const sx = e.x - Math.sin(e.yaw) * 2, sz = e.z - Math.cos(e.yaw) * 2; spawnFireball(sx, e.y + 2, sz, PL.x - sx, PL.y + 1 - e.y - 2.5, PL.z - sz, e, false); } }
  else { e.charge = Math.max(0, (e.charge || 0) - 1); e.yawTarget = Math.atan2(-e.vx, -e.vz); }
  e.shooting = e.charge > 10;
  turn(e, 0.2); flyMove(e);
}
function blazeAI(e, dist) {
  const see = plTargetable() && dist < 48 && canSee(e.x, e.y + 1.5, e.z, PL.x, PL.y + 1.6, PL.z);
  if (see) e.target = PL; else if (dist > 48) e.target = null;
  if (e.target) {
    faceTo(e, PL.x, PL.z);
    const want = PL.y + 2.5 - e.y; e.vy += Math.sign(want) * 0.02;
    if (dist > 6) { const l = Math.hypot(PL.x - e.x, PL.z - e.z) || 1; e.vx += (PL.x - e.x) / l * 0.02; e.vz += (PL.z - e.z) / l * 0.02; }
    e.atk = (e.atk || 0) + 1;
    if (dist < 2.5 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, 6, 0, 0); }
    if (e.atk > 60 && (e.atk - 60) % 6 === 0 && see) { const sx = e.x, sy = e.y + 1.4, sz = e.z; spawnFireball(sx, sy, sz, PL.x - sx + (Math.random() - .5) * dist * 0.1, PL.y + 1 - sy, PL.z - sz + (Math.random() - .5) * dist * 0.1, e, true); }
    if (e.atk > 78) e.atk = 0;
  } else { e.vy -= 0.01; if (e.onGround) e.vy = 0; if (Math.random() < 0.01) { e.vx += (Math.random() - .5) * 0.2; e.vz += (Math.random() - .5) * 0.2; } }
  e.vy = Math.max(e.vy, -0.06);
  turn(e); flyMove(e, 0.85);
  if (Math.random() < 0.4) R.simpleParticle(e.x + (Math.random() - .5) * .6, e.y + Math.random() * 1.8, e.z + (Math.random() - .5) * .6, [0.4, 0.4, 0.4], { kind: 'smoke', size: 0.2, vy: 0.4, grav: 0, life: 0.5 });
}
function slimeAI(e, dist) {
  const sz = e.size || 1;
  const hostileNow = plTargetable() && dist < 16;
  if (e.onGround) {
    e.vx *= 0.6; e.vz *= 0.6;
    if (--e.jumpCd <= 0) {
      e.jumpCd = (hostileNow ? 10 : 20) + Math.floor(Math.random() * 20); if (e.type === 'magma_cube') e.jumpCd = Math.floor(e.jumpCd / 2);
      if (hostileNow) faceTo(e, PL.x, PL.z); else e.yawTarget = Math.random() * Math.PI * 2;
      e.yaw = e.yawTarget;
      const sp = (e.type === 'magma_cube' ? 0.2 : 0.15) + sz * 0.02;
      e.vx = -Math.sin(e.yaw) * sp; e.vz = -Math.cos(e.yaw) * sp; e.vy = e.type === 'magma_cube' ? 0.42 + sz * 0.1 : 0.42; e.squish = 1; play('slime', { vol: 0.4 });
    }
  }
  if (hostileNow && sz > 1 || (hostileNow && e.type === 'magma_cube')) { if (dist < 0.6 + sz * 0.5 && Math.abs(PL.y - e.y) < 1.5 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, e.type === 'magma_cube' ? sz * 2 + 1 : sz, 0, 0); } }
  physMove(e, e.vx, e.vy, e.vz, 0);
  e.vy = (e.vy - 0.08) * 0.98;
  if (!e.onGround) { e.vx *= 0.98; e.vz *= 0.98; }
  e.squish = (e.squish || 0) * 0.85;
}
function endermanAI(e, dist) {
  const d = e.def;
  // looking at an enderman's head provokes it
  if (!e.target && plTargetable() && dist < 64) {
    const [lx, ly, lz] = lookDir(), hx = e.x - PL.x, hy = e.y + 2.6 - (PL.y + PL.eyeH), hz = e.z - PL.z, hl = Math.hypot(hx, hy, hz);
    if ((lx * hx + ly * hy + lz * hz) / hl > 1 - 0.025 / hl * 4 && canSee(PL.x, PL.y + PL.eyeH, PL.z, e.x, e.y + 2.6, e.z)) { e.stare = (e.stare || 0) + 1; if (e.stare > 5) { e.target = PL; play('enderman'); } }
  }
  if (e.target && (!plTargetable() || dist > 48)) e.target = null;
  if ((W.dim === 0 && W.rain > 0.5 && (getLight(Math.floor(e.x), Math.floor(e.y + 2), Math.floor(e.z)) >> 4) === 15) || e.inWater) { if (e.age % 20 === 0) { if (e.inWater) hurtMob(e, 1, null); endermanTeleport(e); } }
  let mx = 0, mz = 0, speed = d.speed;
  if (e.target) {
    faceTo(e, PL.x, PL.z); [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); speed = 0.25;
    if (dist < 1.6 && Math.abs(PL.y - e.y) < 2.5 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, d.dmg, mx, mz); }
    if (dist > 12 && Math.random() < 0.02) endermanTeleport(e, PL.x, PL.z);
  } else {
    if (!e.goal && Math.random() < 1 / 100) e.goal = [e.x + (Math.random() - .5) * 14, e.z + (Math.random() - .5) * 14];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  walkPhysics(e, mx, mz, speed);
}
function endermanTeleport(e, cx = e.x, cz = e.z) {
  for (let k = 0; k < 16; k++) {
    const x = Math.floor(cx + (Math.random() - .5) * 32), z = Math.floor(cz + (Math.random() - .5) * 32); if (!isLoaded(x, z)) continue;
    let y = Math.floor(e.y + (Math.random() - .5) * 16); for (let i = 0; i < 16 && y > 1 && !SOLID[getBlock(x, y - 1, z)]; i++) y--;
    if (!SOLID[getBlock(x, y - 1, z)] || FLUID[getBlock(x, y, z)] || SOLID[getBlock(x, y, z)] || SOLID[getBlock(x, y + 1, z)] || SOLID[getBlock(x, y + 2, z)]) continue;
    for (let i = 0; i < 12; i++) R.simpleParticle(e.x + (Math.random() - .5), e.y + Math.random() * 3, e.z + (Math.random() - .5), [0.6, 0.2, 0.9], { kind: 'portal', size: 0.12, vy: 0.3, grav: 0 });
    e.x = e.px = x + .5; e.y = e.py = y; e.z = e.pz = z + .5; e.path = null; play('teleport', { vol: 0.5 }); return true;
  }
  return false;
}
function walkPhysics(e, mx, mz, speed) {
  const inF = e.inWater || e.inLava, acc = e.onGround ? 0.5 : inF ? 0.2 : 0.1;
  e.vx += (mx * speed - e.vx) * acc; e.vz += (mz * speed - e.vz) * acc;
  if ((mx || mz) && e.hitH && e.onGround && e.jumpCd <= 0) { e.vy = 0.42; e.jumpCd = 10; }
  if (inF) { e.vy = Math.max(e.vy - 0.02, -0.1); if (mx || mz) e.vy += 0.04; e.vy *= 0.8; }
  turn(e);
  physMove(e, e.vx, e.vy, e.vz, 0.6);
  if (!inF) e.vy = (e.vy - 0.08) * 0.98;
  if (!e.onGround) { e.vx *= 0.91; e.vz *= 0.91; } else { e.vx *= 0.6; e.vz *= 0.6; }
  const hs = Math.hypot(e.vx, e.vz); e.walkAmt += (Math.min(1, hs * 8) - e.walkAmt) * 0.3; e.walk += hs * 6;
}
function golemAI(e, dist) {
  if (e.target && (e.target.dead || (e.target !== PL && Math.hypot(e.target.x - e.x, e.target.z - e.z) > 20) || (e.target === PL && (!plTargetable() || dist > 24)))) e.target = null;
  if (!e.target && e.age % 20 === 0) { let best = null, bd = 16; for (const o of ENT) if (o.kind === 'mob' && !o.dead && o.def.hostile && !o.def.boss && o.type !== 'creeper') { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; best = o; } } e.target = best; }
  let mx = 0, mz = 0;
  if (e.target) {
    const t = e.target; faceTo(e, t.x, t.z); [mx, mz] = pathDir(e, t.x, t.y, t.z);
    const td = Math.hypot(t.x - e.x, t.z - e.z);
    if (td < e.w + (t.w || 0.3) + 1 && Math.abs(t.y - e.y) < 2 && e.attackCd <= 0) {
      e.attackCd = 20; e.swing = 10; play('golem'); const dmg = 7 + Math.random() * 14;
      if (t === PL) { if (hurtPlayer(dmg * DIFF_MUL(), 'mob', e)) PL.vy = 0.6; } else { hurtMob(t, dmg, e, 0, 0); t.vy = 0.6; }
    }
  } else {
    if (!e.goal && Math.random() < 1 / 200) e.goal = [e.x + (Math.random() - .5) * 12, e.z + (Math.random() - .5) * 12];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.8) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  if (e.swing > 0) e.swing--;
  walkPhysics(e, mx, mz, e.target ? 0.1 : 0.05);
}
function golemAnim(e, P) { if (P.rarm) { const s = e.swing > 0 ? -1.6 * Math.sin(e.swing / 10 * Math.PI) : 0; P.rarm.rotation.x = s - Math.sin(e.walk) * 0.5 * e.walkAmt; P.larm.rotation.x = s + Math.sin(e.walk) * 0.5 * e.walkAmt; } }
function crystalAI(e) { e.vx = e.vy = e.vz = 0; e.walk += 0.05; }
function crystalAnim(e, P, now) { if (P.glass) { P.glass.rotation.y = now / 400; P.glass.position.y = (24 - 8) / 16 + Math.sin(now / 300) * 0.3; } if (P.base) P.base.visible = true; }
function crystalHurt(e) { if (e.dead) return false; removeEnt(e); explode(e.x, e.y + 1, e.z, 6); const dr = ENT.find(o => o.type === 'ender_dragon' && !o.dead); if (dr && dr.healFrom === e) dr.healFrom = null; return true; }
function blazeAnim(e, P, now) {
  const t = now / 1000 * 2;
  for (let i = 0; i < 12; i++) {
    const p = P['rod' + i]; if (!p) continue;
    const ring = (i / 4) | 0, a = t * (ring === 1 ? -1 : 1) * (1 - ring * 0.2) + (i % 4) * Math.PI / 2 + ring * 0.6, r = [9, 7, 5][ring] / 16;
    p.position.set(Math.cos(a) * r, (24 - [-2, 2, 11][ring] - Math.cos(t * 1.5 + i)) / 16, Math.sin(a) * r);
  }
}
function slimeAnim(e, P) { const s = 1 + (e.squish || 0) * 0.4, k = (e.size || 1); (e.mesh.userData.inner || e.mesh.children[0]).scale.set(k / s, k * s, k / s); }
// ---------- ender dragon fight ----------
let bossEl = null;
function bossBar(e, name) {
  if (!bossEl) { bossEl = document.createElement('div'); bossEl.id = 'bossbar'; bossEl.innerHTML = '<div class="bn">엔더 드래곤</div><div class="bb"><i></i></div>'; document.body.appendChild(bossEl); }
  bossEl.hidden = !e; if (e) bossEl.querySelector('.bn').textContent = name || '엔더 드래곤'; if (e) bossEl.querySelector('i').style.width = Math.max(0, e.hp / e.def.hp * 100) + '%';
}
function dragonHurt(e, dmg, attacker) {
  if (e.phase === 'dying' || e.inv > 0) return false;
  dmg = e.phase === 'perch' ? dmg : dmg / 4 + 1;
  e.hp -= dmg; e.hurt = 10; e.inv = 10; play('growl', { vol: 0.6 });
  if (e.phase === 'perch' && Math.random() < 0.3) e.phaseT = 0;
  if (e.hp <= 0) { e.hp = 0; e.phase = 'dying'; e.phaseT = 0; }
  return true;
}
function dragonAI(e) {
  const C = [0, S.END_PORTAL_Y, 0];
  e.phaseT = (e.phaseT || 0) + 1;
  if (!e.phase) { e.phase = 'circle'; e.ang = Math.atan2(e.z, e.x); }
  // crystals heal the dragon
  if (e.phase !== 'dying') {
    if (!e.healFrom || e.healFrom.dead) { e.healFrom = null; if (e.age % 10 === 0) { let bd = 32; for (const o of ENT) if (o.type === 'end_crystal' && !o.dead) { const d = Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z); if (d < bd) { bd = d; e.healFrom = o; } } } }
    if (e.healFrom && e.age % 10 === 0) e.hp = Math.min(e.def.hp, e.hp + 1);
  }
  let tx, ty, tz, sp = 0.45;
  switch (e.phase) {
    case 'circle':
      e.ang += 0.012; tx = Math.cos(e.ang) * 60; tz = Math.sin(e.ang) * 60; ty = 80 + Math.sin(e.ang * 3) * 12;
      if (e.phaseT > 300 && Math.random() < 0.01) { const r = Math.random(); e.phase = r < 0.45 && plTargetable() && W.dim === 1 ? 'charge' : r < 0.75 ? 'land' : 'circle'; e.phaseT = 0; if (e.phase === 'charge') play('growl'); }
      break;
    case 'charge':
      tx = PL.x; ty = PL.y + 1; tz = PL.z; sp = 0.65;
      if (Math.hypot(PL.x - e.x, PL.y - e.y, PL.z - e.z) < 5) { if (hurtPlayer(10 * DIFF_MUL(), 'mob', e)) { const l = Math.hypot(PL.x - e.x, PL.z - e.z) || 1; PL.vx += (PL.x - e.x) / l * 2; PL.vz += (PL.z - e.z) / l * 2; PL.vy = 0.8; } e.phase = 'circle'; e.phaseT = 0; e.ang = Math.atan2(e.z, e.x); }
      if (e.phaseT > 200 || !plTargetable()) { e.phase = 'circle'; e.phaseT = 0; e.ang = Math.atan2(e.z, e.x); }
      break;
    case 'land': tx = C[0]; ty = C[1] + 12; tz = C[2] + 0.5; sp = 0.35; if (Math.hypot(e.x - tx, e.z - tz) < 3) { e.phase = 'descend'; e.phaseT = 0; } break;
    case 'descend': tx = C[0]; ty = C[1] + 4; tz = C[2] + 0.5; sp = 0.12; if (e.y < C[1] + 4.6) { e.phase = 'perch'; e.phaseT = 0; play('growl'); } break;
    case 'perch':
      tx = e.x; ty = C[1] + 4; tz = e.z; sp = 0;
      if (plTargetable()) { faceTo(e, PL.x, PL.z); const d = Math.hypot(PL.x - e.x, PL.z - e.z); if (d < 9 && Math.abs(PL.y - e.y) < 6 && e.age % 30 === 0) { attackPlayer(e, 10, (PL.x - e.x) / d, (PL.z - e.z) / d); e.bite = 10; } }
      if (e.phaseT === 70 || e.phaseT === 170) { const a = Math.atan2(PL.z - e.z, PL.x - e.x); spawnCloud(e.x + Math.cos(a) * 5, C[1] + 1.05, e.z + Math.sin(a) * 5, 'harming', { breath: true, col: 0xb43cd2, r: 3, dur: 400 }); play('fireball', { vol: 0.6 }); } // dragon's breath
      if (e.phaseT > 260) { e.phase = 'takeoff'; e.phaseT = 0; }
      break;
    case 'takeoff': tx = e.x + Math.cos(e.ang) * 30; ty = 90; tz = e.z + Math.sin(e.ang) * 30; sp = 0.3; if (e.y > 82) { e.phase = 'circle'; e.phaseT = 0; e.ang = Math.atan2(e.z, e.x); } break;
    case 'dying':
      e.vx *= 0.9; e.vz *= 0.9; e.vy = 0.03; e.y += e.vy;
      if (e.phaseT % 5 === 0) for (let i = 0; i < 4; i++) R.simpleParticle(e.x + (Math.random() - .5) * 8, e.y + Math.random() * 4, e.z + (Math.random() - .5) * 8, [1, 0.9, 0.6], { size: 1.2, vy: 1, grav: 0, life: 0.6 });
      if (e.phaseT % 10 === 0) spawnXP(e.x, e.y + 2, e.z, W.meta.dragonKilled ? 25 : 300);
      if (e.phaseT === 1) play('growl');
      if (e.phaseT >= 200) { dragonDefeated(e); }
      bossBar(e); return;
  }
  if (e.phase !== 'perch') {
    const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, l = Math.hypot(dx, dy, dz) || 1;
    e.vx += (dx / l * sp - e.vx) * 0.06; e.vy += (dy / l * sp * 0.7 - e.vy) * 0.06; e.vz += (dz / l * sp - e.vz) * 0.06;
    e.yawTarget = Math.atan2(-e.vx, -e.vz);
  } else { e.vx *= 0.5; e.vy = (ty - e.y) * 0.2; e.vz *= 0.5; }
  turn(e, 0.08);
  e.x += e.vx; e.y += e.vy; e.z += e.vz;
  // the body smashes through anything that is not end stone, obsidian or bedrock
  if (e.age % 4 === 0 && e.phase !== 'perch' && e.phase !== 'descend') for (let k = 0; k < 6; k++) {
    const bx = Math.floor(e.x + (Math.random() - .5) * 6), by = Math.floor(e.y + Math.random() * 3), bz = Math.floor(e.z + (Math.random() - .5) * 6), b = getBlock(bx, by, bz);
    if (b && b !== BID.end_stone && b !== BID.obsidian && b !== BID.bedrock && b !== BID.iron_bars && b !== BID.end_portal && !FLUID[b] && BLOCKS[b].hard >= 0) setBlock(bx, by, bz, 0);
  }
  // touching the body hurts
  if (plTargetable() && Math.abs(PL.x - e.x) < 3 && Math.abs(PL.z - e.z) < 3 && PL.y > e.y - 1 && PL.y < e.y + 3 && e.attackCd <= 0) { e.attackCd = 10; attackPlayer(e, 5, Math.sign(PL.x - e.x), Math.sign(PL.z - e.z)); }
  if (e.age % 140 === 0) play('growl', { vol: 0.5 });
  bossBar(e);
}
function dragonAnim(e, P, now) {
  const f = Math.sin(now / 260), g = Math.sin(now / 260 - 0.8), perch = e.phase === 'perch';
  if (P.lwing) { P.lwing.rotation.z = perch ? -0.9 : f * 0.6; P.rwing.rotation.z = perch ? 0.9 : -f * 0.6; P.ltip.rotation.z = perch ? 1.8 : g * 0.5 - 0.2; P.rtip.rotation.z = perch ? -1.8 : -g * 0.5 + 0.2; }
  for (let i = 0; i < 12; i++) if (P['tail' + i]) { P['tail' + i].position.x = Math.sin(now / 600 + i * 0.4) * i * 0.06; P['tail' + i].position.y = (24 - 10 - i * 0.6) / 16 + Math.sin(now / 500 + i * 0.5) * i * 0.03; }
  for (let i = 0; i < 5; i++) if (P['neck' + i]) P['neck' + i].position.y = (24 - 13 + i * 1.5) / 16 + (perch ? -i * 0.25 : Math.sin(now / 400 + i * 0.4) * 0.05 * i);
  if (P.head) { P.head.position.y = (24 - 6) / 16 + (perch ? -1.4 : Math.sin(now / 400 + 2) * 0.25); }
  if (P.jaw) P.jaw.rotation.x = e.bite > 0 ? -0.5 : -Math.max(0, Math.sin(now / 900)) * 0.15;
  if (e.bite > 0) e.bite--;
  e.mesh.rotation.x = e.phase === 'dying' ? 0 : -Math.max(-0.4, Math.min(0.4, e.vy * 1.5));
}
function dragonDefeated(e) {
  removeEnt(e); bossBar(null);
  const y = S.END_PORTAL_Y;
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const d2 = x * x + z * z; if (d2 <= 6 && (x || z)) setBlock(x, y, z, BID.end_portal, 0, { noUpdate: true }); }
  setBlock(0, y + 4, 0, BID.dragon_egg, 0, { noUpdate: true });
  // an end gateway to the outer islands
  const ga = Math.random() * Math.PI * 2, gx = Math.round(Math.cos(ga) * 96), gz = Math.round(Math.sin(ga) * 96);
  for (const dy of [-1, 1]) setBlock(gx, 75 + dy, gz, BID.bedrock, 0, { noUpdate: true });
  setBlock(gx, 75, gz, BID.end_portal, 1, { noUpdate: true });
  W.meta.dragonKilled = true; UI.advance && UI.advance('dragon'); chatMsg('엔더 드래곤을 물리쳤습니다!', '#ff55ff');
  play('levelup');
}
function ensureDragon() {
  if (W.dim !== 1 || W.meta.dragonKilled || ENT.some(o => o.type === 'ender_dragon' && !o.dead) || !isLoaded(0, 0)) return;
  const e = spawnMob('ender_dragon', 40, 85, 0); e.persistent = true; e.phase = 'circle'; e.ang = 0;
}
// ---------- villagers & trading ----------
const TRADES = {
  farmer: [[['wheat', 20], ['emerald', 1]], [['emerald', 1], ['bread', 6]], [['emerald', 1], ['apple', 4]], [['pumpkin', 6], ['emerald', 1]], [['emerald', 3], ['golden_apple', 1]], [['melon', 4], ['emerald', 1]]],
  librarian: [[['paper', 24], ['emerald', 1]], [['emerald', 9], ['bookshelf', 1]], [['book', 4], ['emerald', 1]], [['emerald', 1], ['lantern', 1]], [['emerald', 5], ['glass', 4]], [['emerald', 20], ['enchanted_book', 1]]],
  armorer: [[['emerald', 36], ['bell', 1]], [['emerald', 5], ['chainmail_chestplate', 1]], [['emerald', 3], ['chainmail_helmet', 1]], [['coal', 15], ['emerald', 1]], [['emerald', 7], ['iron_helmet', 1]], [['emerald', 9], ['iron_chestplate', 1]], [['iron_ingot', 4], ['emerald', 1]], [['emerald', 8], ['diamond_boots', 1]]],
  toolsmith: [[['coal', 15], ['emerald', 1]], [['emerald', 1], ['stone_axe', 1]], [['emerald', 1], ['stone_pickaxe', 1]], [['iron_ingot', 4], ['emerald', 1]], [['emerald', 13], ['diamond_pickaxe', 1]]],
  weaponsmith: [[['coal', 15], ['emerald', 1]], [['emerald', 3], ['iron_axe', 1]], [['emerald', 7], ['iron_sword', 1]], [['flint', 24], ['emerald', 1]], [['emerald', 13], ['diamond_sword', 1]]],
  butcher: [[['chicken', 14], ['emerald', 1]], [['porkchop', 7], ['emerald', 1]], [['emerald', 1], ['cooked_porkchop', 5]], [['emerald', 1], ['cooked_chicken', 8]], [['coal', 15], ['emerald', 1]]],
  cleric: [[['rotten_flesh', 32], ['emerald', 1]], [['emerald', 1], ['redstone', 2]], [['gold_ingot', 3], ['emerald', 1]], [['emerald', 1], ['lapis_lazuli', 1]], [['emerald', 4], ['glowstone', 1]], [['emerald', 5], ['ender_pearl', 1]]],
  fletcher: [[['stick', 32], ['emerald', 1]], [['emerald', 1], ['arrow', 16]], [['gravel', 10], ['flint', 10]], [['string', 14], ['emerald', 1]], [['emerald', 2], ['bow', 1]]],
  shepherd: [[['white_wool', 18], ['emerald', 1]], [['emerald', 2], ['shears', 1]], [['emerald', 3], ['red_bed', 1]], [['emerald', 1], ['white_wool', 1]]],
  mason: [[['clay_ball', 10], ['emerald', 1]], [['emerald', 1], ['bricks', 10]], [['stone', 20], ['emerald', 1]], [['emerald', 1], ['stone_bricks', 4]], [['emerald', 1], ['quartz_block', 1]]],
  leatherworker: [[['leather', 6], ['emerald', 1]], [['emerald', 3], ['leather_leggings', 1]], [['emerald', 7], ['leather_chestplate', 1]], [['flint', 26], ['emerald', 1]], [['emerald', 6], ['saddle', 1]]],
  cartographer: [[['paper', 24], ['emerald', 1]], [['emerald', 1], ['glass_pane', 8]], [['emerald', 7], ['spyglass', 1]], [['glass_pane', 11], ['emerald', 1]]],
  fisherman: [[['string', 20], ['emerald', 1]], [['coal', 10], ['emerald', 1]], [['emerald', 1], ['cooked_chicken', 6]], [['emerald', 2], ['oak_boat', 1]]],
};
const PROF_NAME = { farmer: '농부', librarian: '사서', armorer: '갑옷 제조인', toolsmith: '도구 대장장이', weaponsmith: '무기 대장장이', butcher: '도살업자', cleric: '성직자', fletcher: '화살 제조인', shepherd: '양치기', mason: '석공', leatherworker: '가죽 세공인', cartographer: '지도 제작자', fisherman: '어부', nitwit: '멍청이' };
function villagerOffers(e) {
  if (!e.trades) {
    const pool = TRADES[e.prof] || TRADES.farmer, r = S.rng(e.id * 7919 + 13), picked = [];
    const pick = (list, n) => list.map((_, i) => i).sort(() => r() - 0.5).slice(0, Math.min(list.length, n)).map(i => list[i]);
    const offers = e.prof === 'wandering' ? [...pick(pool, 5), ...pick(TRADES.wandering_rare, 1)] : pick(pool, 4 + r.int(2));
    for (const [[a, an], [b, bn]] of offers) { if (b.endsWith('explorer_map')) { picked.push({ a: IID[a], an, b: IID.filled_map, bn: 1, special: b, uses: 0, max: 12 }); continue; } if (IID[a] == null || IID[b] == null) continue; picked.push({ a: IID[a], an, b: IID[b], bn, ench: b === 'enchanted_book', uses: 0, max: 12 }); }
    e.trades = picked;
  }
  return e.trades;
}
function villagerAIExtra(e) {
  // villagers wander near home, gaze at the player and stay inside at night
  if (plTargetable() && Math.hypot(PL.x - e.x, PL.z - e.z) < 4 && !e.panic) { faceTo(e, PL.x, PL.z); e.goal = null; }
  if (e.trading) e.goal = null;
  villagerFlee(e);
}
// ---------- per-mob hooks used by entities.js ----------
function mobExtraTick(e, dist) {
  const d = e.def;
  if (d.waterHurt && (e.inWater || (W.dim === 0 && W.rain > 0.5 && e.age % 20 === 0 && (getLight(Math.floor(e.x), Math.floor(e.y + e.h), Math.floor(e.z)) >> 4) === 15))) { if (e.age % 10 === 0) hurtMob(e, 1, null); }
  if (d.villager) villagerAIExtra(e);
  if (e.hasTrident) drownedTrident(e, dist);
  if (e.type === 'zombie_villager') zombieVillagerTick(e);
  swimAssist(e);
}
// slimes and magma cubes split when they die
function slimeDeath(e) {
  const sz = e.size || 1; if (sz <= 1) return;
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) spawnMob(e.type, e.x + (Math.random() - .5) * sz * 0.5, e.y + 0.5, e.z + (Math.random() - .5) * sz * 0.5, { size: sz / 2 });
}
// ---------- nether portals ----------
function tryLightPortal(x, y, z) {
  for (const axis of [0, 1]) {
    const dx = axis ? 0 : 1, dz = axis ? 1 : 0;
    let by = y; while (by > y - 22 && getBlock(x, by - 1, z) !== BID.obsidian) { const b = getBlock(x, by - 1, z); if (b && b !== BID.fire) break; by--; }
    if (getBlock(x, by - 1, z) !== BID.obsidian) continue;
    let x0 = x, z0 = z;
    for (let k = 0; k < 22; k++) { const b = getBlock(x0 - dx, by, z0 - dz); if (b === BID.obsidian) break; if (b && b !== BID.fire) { x0 = null; break; } x0 -= dx; z0 -= dz; }
    if (x0 == null || getBlock(x0 - dx, by, z0 - dz) !== BID.obsidian) continue;
    let w = 0; while (w < 22) { const b = getBlock(x0 + dx * w, by, z0 + dz * w); if (b === BID.obsidian) break; if (b && b !== BID.fire) { w = 99; break; } w++; }
    if (w < 2 || w > 21) continue;
    let h = 0; while (h < 22) { const b = getBlock(x0, by + h, z0); if (b === BID.obsidian) break; if (b && b !== BID.fire) { h = 99; break; } h++; }
    if (h < 3 || h > 21) continue;
    let ok = true;
    for (let i = 0; i < w && ok; i++) { if (getBlock(x0 + dx * i, by - 1, z0 + dz * i) !== BID.obsidian || getBlock(x0 + dx * i, by + h, z0 + dz * i) !== BID.obsidian) ok = false; for (let j = 0; j < h && ok; j++) { const b = getBlock(x0 + dx * i, by + j, z0 + dz * i); if (b && b !== BID.fire) ok = false; } }
    for (let j = 0; j < h && ok; j++) if (getBlock(x0 - dx, by + j, z0 - dz) !== BID.obsidian || getBlock(x0 + dx * w, by + j, z0 + dz * w) !== BID.obsidian) ok = false;
    if (!ok) continue;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) setBlock(x0 + dx * i, by + j, z0 + dz * i, BID.nether_portal, axis, { noUpdate: true });
    play('portal', { vol: 0.6 });
    return true;
  }
  return false;
}
function portalIntact(x, y, z) { // a portal block needs portal or obsidian on both sides of its axis and above/below
  const m = getMeta(x, y, z), dx = m & 1 ? 0 : 1, dz = m & 1 ? 1 : 0;
  const ok = b => b === BID.nether_portal || b === BID.obsidian;
  return ok(getBlock(x, y - 1, z)) && ok(getBlock(x, y + 1, z)) && ok(getBlock(x + dx, y, z + dz)) && ok(getBlock(x - dx, y, z - dz));
}
function checkEndPortal(x, y, z) {
  for (let cx = x - 2; cx <= x + 2; cx++) for (let cz = z - 2; cz <= z + 2; cz++) {
    let all = true;
    for (let i = -2; i <= 2 && all; i++) for (let j = -2; j <= 2 && all; j++) { const edge = (Math.abs(i) === 2) !== (Math.abs(j) === 2); if (!edge) continue; const b = getBlock(cx + i, y, cz + j); if (b !== BID.end_portal_frame || !(getMeta(cx + i, y, cz + j) & 4)) all = false; }
    if (!all) continue;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) setBlock(cx + i, y, cz + j, BID.end_portal, 0, { noUpdate: true });
    play('portal', { trigger: true }); return true;
  }
  return false;
}

// Nether, End and village mobs, the ender dragon fight, boats, projectiles and A* pathfinding.
// Hooks into entities.js through MOBDEF entries (ai / anim / onHurt) and generic entity kinds (tick / render).
const solidBox = (c) => mobCanvas(g => { g.fillStyle = c; g.fillRect(0, 0, 64, 64); });
const BOXPARTS = (w, h, d) => [['body', [0, 0, 0], [-w / 2, 0, -d / 2, w, h, d], [0, 0]]];
Object.assign(MOBDEF, {
  zombified_piglin: { hp: 20, w: 0.3, h: 1.95, speed: 0.12, sinks: 1, hostile: 1, neutral: 1, dmg: 8, xp: 5, snd: 'groan', fireproof: 1, armsOut: 1, nether: 1,
    drops: [['rotten_flesh', 0, 1], ['gold_nugget', 0, 1]], extraDrop: [['gold_ingot', 0.025]], parts: HUMAN(4), tex: () => solidBox('#d89a8a') },
  ghast: { hp: 10, w: 2, h: 4, speed: 0.03, hostile: 1, fly: 1, xp: 5, snd: 'ghast', fireproof: 1, drops: [['ghast_tear', 0, 1], ['gunpowder', 0, 2]], parts: BOXPARTS(16, 16, 16), tex: () => solidBox('#f0f0f0'), ai: ghastAI },
  blaze: { hp: 20, w: 0.3, h: 1.8, speed: 0.07, hostile: 1, xp: 10, snd: 'blaze', fireproof: 1, waterHurt: 1, drops: [['blaze_rod', 0, 1]], parts: BOXPARTS(8, 8, 8), tex: () => solidBox('#f0c030'), ai: blazeAI, anim: blazeAnim },
  magma_cube: { hp: 16, w: 1, h: 2, speed: 0.1, hostile: 1, xp: 4, snd: 'slime', fireproof: 1, slime: 1, drops: [['magma_cream', 0, 1]], parts: BOXPARTS(8, 8, 8), tex: () => solidBox('#602010'), ai: slimeAI, anim: slimeAnim },
  slime: { hp: 16, w: 1, h: 2, speed: 0.1, hostile: 1, xp: 4, snd: 'slime', slime: 1, drops: [['slime_ball', 0, 2]], parts: BOXPARTS(8, 8, 8), tex: () => solidBox('#70c060'), ai: slimeAI, anim: slimeAnim },
  enderman: { hp: 40, w: 0.3, h: 2.9, speed: 0.15, hostile: 1, neutral: 1, dmg: 7, xp: 5, snd: 'enderman', waterHurt: 1, drops: [['ender_pearl', 0, 1]], parts: HUMAN(2), tex: () => solidBox('#161616'), ai: endermanAI },
  villager: { hp: 20, w: 0.3, h: 1.95, speed: 0.07, xp: 0, snd: 'hmm', drops: [], parts: HUMAN(4), tex: () => solidBox('#b0805a'), villager: 1 },
  iron_golem: { hp: 100, w: 0.7, h: 2.7, speed: 0.06, sinks: 1, xp: 0, snd: 'golem', drops: [['iron_ingot', 3, 5], ['poppy', 0, 2]], parts: HUMAN(4), tex: () => solidBox('#d8d0c8'), ai: golemAI, anim: golemAnim, kbRes: 1 },
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
// Java's WalkNodeEvaluator, roughly: the eight neighbours (a diagonal only when both sides are clear, so no corner is cut),
// a step up of one block, drops of up to three; cobwebs, berry bushes and powder snow cost more (Java's maluses), so they're
// gone around when there's another way. Up to 800 nodes (Java: 16 per block of follow range), so a wall is walked around to
// a gap well to the side instead of being pressed against.
const PF_COST = () => PF.cost || (PF.cost = new Map([[BID.cobweb, 8], [BID.sweet_berry_bush, 8], [BID.powder_snow, 8], [BID.water, 2], [BID.wither_rose, 8]].filter(([k]) => k != null)));
function findPath(e, tx, ty, tz, maxN = 800) {
  const h = Math.ceil(e.h), sx = Math.floor(e.x), sy = Math.floor(e.y + 0.01), sz = Math.floor(e.z);
  tx = Math.floor(tx); ty = Math.floor(ty); tz = Math.floor(tz);
  const key = (x, y, z) => ((x - sx + 512) * 1024 + (z - sz + 512)) * 512 + y;
  const H = (x, y, z) => { const ax = Math.abs(x - tx), az = Math.abs(z - tz); return (ax + az + (Math.SQRT2 - 2) * Math.min(ax, az)) * 1.001 + Math.abs(y - ty) * 1.5; }; // (octile distance; the hair over 1 breaks ties toward the goal)
  const open = [], came = new Map(), g = new Map(), cost = PF_COST();
  const push = n => { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p].f <= n.f) break; open[i] = open[p]; i = p; } open[i] = n; };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < open.length && open[l].f < (m === i ? last.f : open[m].f)) m = l; if (r < open.length && open[r].f < (m === i ? last.f : open[m].f)) m = r; if (m === i) break; open[i] = open[m]; i = m; } open[i] = last; } return top; };
  push({ x: sx, y: sy, z: sz, f: H(sx, sy, sz) }); g.set(key(sx, sy, sz), 0);
  let best = null, bestH = Infinity, n = 0;
  const step = (c, nx, nz) => { // the height a neighbour column is stood on, or null
    if (pfWalkable(nx, c.y, nz, h)) return c.y;
    if (pfWalkable(nx, c.y + 1, nz, h) && !SOLID[getBlock(c.x, c.y + h, c.z)]) return c.y + 1;
    if (!SOLID[getBlock(nx, c.y, nz)] && !SOLID[getBlock(nx, c.y + 1, nz)]) for (let d = 1; d <= 3; d++) { if (pfWalkable(nx, c.y - d, nz, h)) return c.y - d; if (SOLID[getBlock(nx, c.y - d, nz)]) break; }
    return null;
  };
  const NB = [[0, -1, 1], [1, 0, 1], [0, 1, 1], [-1, 0, 1], [1, -1, Math.SQRT2], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (open.length && n++ < maxN) {
    const c = pop(), ck = key(c.x, c.y, c.z), cg = g.get(ck), ch = H(c.x, c.y, c.z);
    if (cg == null || c.f > cg + ch + 1e-6) continue; // (an entry left from before a cheaper way was found)
    if (ch < bestH) { bestH = ch; best = c; }
    if (ch < 1.5) { best = c; break; }
    for (const [dx, dz, len] of NB) {
      const nx = c.x + dx, nz = c.z + dz;
      let ny;
      if (dx && dz) { if (!pfWalkable(c.x + dx, c.y, c.z, h) || !pfWalkable(c.x, c.y, c.z + dz, h) || !pfWalkable(nx, c.y, nz, h)) continue; ny = c.y; } // diagonals on the level only, both sides clear
      else { ny = step(c, nx, nz); if (ny == null) continue; }
      const nk = key(nx, ny, nz), ng = cg + len + (ny > c.y ? 0.5 : ny < c.y ? 0.3 * (c.y - ny) : 0) + (cost.get(getBlock(nx, ny, nz)) || 0);
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
function spawnFireball(x, y, z, dx, dy, dz, owner, small, dragon) {
  const e = Ent('fireball', x, y, z); e.kind = 'fireball'; e.hittable = !small && !dragon; e.small = small; e.dragon = !!dragon; e.owner = owner; e.w = small ? 0.16 : 0.5; e.h = small ? 0.32 : 1;
  const l = Math.hypot(dx, dy, dz) || 1; e.ax = dx / l * 0.1; e.ay = dy / l * 0.1; e.az = dz / l * 0.1;
  e.mesh = R.itemMesh(IID.fire_charge); e.mesh.scale.setScalar(small ? 0.45 : 1.5); e.tick = fireballTick; e.render = spinRender; e.onHit = fireballDeflect; if (e.hittable) e.pickR = 1; /* (Java's Fireball.getPickRadius: a block further out all round, so it can be hit back) */
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
        if (hit === 'pl') { if (hurtPlayer(diffDmg(5), 'fire', e.owner)) PL.fire = Math.max(PL.fire, 100); }
        else if (typeof hit === 'object') { hurtMob(hit, 5, e.owner === PL ? PL : null); if (!hit.def.fireproof) hit.fire = 100; }
        else { const bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z); if (!getBlock(bx, by, bz) && SOLID[getBlock(bx, by - 1, bz)]) setBlock(bx, by, bz, BID.fire); }
      } else if (e.dragon) { // the dragon's fireball: no blast, a lingering cloud of dragon's breath where it lands
        spawnCloud(nx, Math.floor(cy) + (hit === true ? 1.05 : 0.05), nz, 'harming', { breath: true, col: 0xb43cd2, r: 3, dur: 600 }); play('fizz', { vol: 0.6 });
      } else {
        if (typeof hit === 'object') { HURTPROJ = { fireball: true }; hurtMob(hit, hit.type === 'ghast' && e.owner === PL ? 1000 : 6, e.owner === PL ? PL : null, 0, 0, e.owner === PL ? 'player' : null); HURTPROJ = null; }
        if (hit === 'pl') hurtPlayer(diffDmg(6), 'fireball', e.owner, { x: e.x, y: e.y, z: e.z });
        MOB_BLAST = e.owner && e.owner.kind === 'mob' ? e.owner : false; try { explode(hit === true ? e.x : nx, hit === true ? e.y + e.h / 2 : cy, hit === true ? e.z : nz, 1, true); } finally { MOB_BLAST = false; } // (against a block: from just outside it, so the blast isn't spent inside the block it hit)
      }
      return;
    }
    e.x = nx; e.y = ny; e.z = nz;
  }
  if (e.age > 400) removeEnt(e);
}
function spinRender(e, x, y, z, br, now) { e.mesh.position.set(x, y + e.h / 2, z); if (e.kind === 'fireball' && typeof camera !== 'undefined') e.mesh.quaternion.copy(camera.quaternion); else e.mesh.rotation.set(0, now / 200, now / 300); /* fireballs face you, as Java draws them */ e.mesh.traverse(o => { if (o.isMesh) R.setMeshLight(o, 1.4); }); }
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
function boatHit(e) { if (creative()) { removeEnt(e); if (PL.riding === e) dismount(); return; } const h = PL.held(), t = h && ITEMS[h.id] && ITEMS[h.id].tool; e.dmgAcc = (e.dmgAcc || 0) + (t ? t.dmg : 1) * 10; e.hurt = 10; play('hit', { vol: 0.5 }); /* Java: damage x10 builds up and wears off; over 40 breaks it (a fist: five quick hits, a sword: one) */ if (e.dmgAcc > 40) { removeEnt(e); if (PL.riding === e) dismount(); dropItem(e.x, e.y + 0.5, e.z, IID[e.wood + '_boat'] || IID.oak_boat, 1); } }
const seat2Busy = e => !!(e.mob || e.rider2 || e.seat2Other || (e.mpRider2 && performance.now() - e.mpRider2At < 1500));
function mount(e) {
  if (PL.sleeping && typeof wakeUp === 'function') wakeUp(); // still in bed (a guest whose morning message came late): up first, or riding never ticks
  if (e.rider || (e.mpRider && performance.now() - e.mpRideAt < 1500)) { // someone is driving (multiplayer): a boat has a back seat
    if (e.kind !== 'boat' || seat2Busy(e)) return;
    PL.riding = e; e.rider2 = PL; PL.flying = false; PL.sneaking = false; play('boat'); return;
  }
  PL.riding = e; e.rider = PL; PL.flying = false; PL.sneaking = false; play('boat'); }
function dismount() {
  const e = PL.riding; PL.riding = null; if (!e) return; if (e.rider2 === PL) e.rider2 = null; else e.rider = null;
  for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0, 0]]) { const x = e.x + dx, z = e.z + dz; if (!SOLID[getBlock(Math.floor(x), Math.floor(e.y + 0.6), Math.floor(z))] && !SOLID[getBlock(Math.floor(x), Math.floor(e.y + 1.6), Math.floor(z))]) { PL.x = x; PL.y = e.y + 0.6; PL.z = z; break; } }
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.vx = PL.vy = PL.vz = 0;
}
// which way still and flowing water runs here (Java's FlowingFluid.getFlow): toward the lower neighbouring water levels
function waterFlowAt(x, y, z) {
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), lvl = (a, b, c) => { const id = getBlock(a, b, c); if (id !== 27) return null; const m = getMeta(a, b, c); return m >= 8 ? 1 : (8 - m) / 9; };
  const h = lvl(bx, by, bz); if (h == null) return [0, 0];
  let fx = 0, fz = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let n = lvl(bx + dx, by, bz + dz); if (n == null) { const nb = getBlock(bx + dx, by, bz + dz); if (SOLID[nb]) continue; n = lvl(bx + dx, by - 1, bz + dz) != null ? h - 0.8889 : 0; if (n === 0) continue; } const d = h - n; fx += dx * d; fz += dz * d; }
  const l = Math.hypot(fx, fz); return l > 1e-4 && getMeta(bx, by, bz) !== 0 ? [fx / l, fz / l] : [0, 0];
}
function boatTick(e) {
  const inW = fluidAt(e.x, e.y + 0.1, e.z) === 1, deep = fluidAt(e.x, e.y + 0.45, e.z) === 1, under = getBlock(Math.floor(e.x), Math.floor(e.y - 0.1), Math.floor(e.z));
  if (e.hurt > 0) e.hurt--; if (e.dmgAcc > 0) e.dmgAcc = Math.max(0, e.dmgAcc - 1);
  // Java's BoatEntity: the hull's momentum is 0.9 on water or in the air, 0.45 under water, and on land the slipperiness of
  // what it sits on (0.6, ice and packed ice 0.98, blue ice 0.989); A/D add a degree a tick to a turn that keeps going and
  // eases off with the same momentum, W pushes 0.04 a tick, S 0.005 back, and turning alone creeps forward
  const sl = BLOCKS[under] && BLOCKS[under].slip, mom = deep ? 0.45 : inW || !under ? 0.9 : sl === 2 ? 0.989 : sl ? 0.98 : 0.6;
  e.drot = e.drot || 0;
  const rowL = e.rider === PL && ((IN.s > 0 && !(IN.s < 0)) || IN.f > 0), rowR = e.rider === PL && ((IN.s < 0) || IN.f > 0); // Java: a turn rows one paddle, forward both
  e.row = e.row || [0, 0]; e.row[0] = rowL ? e.row[0] + Math.PI / 8 : 0; e.row[1] = rowR ? e.row[1] + Math.PI / 8 : 0;
  if ((rowL || rowR) && e.age % 16 === 0 && inW) play('splash', { vol: 0.15 });
  if (inW) { const fl = waterFlowAt(e.x, e.y + 0.3, e.z); e.vx += fl[0] * 0.014; e.vz += fl[1] * 0.014; } // a current carries the boat along
  if (e.age % 2 === 0) for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0, 0]]) { const lx = Math.floor(e.x + dx), ly = Math.floor(e.y + 0.4), lz = Math.floor(e.z + dz); if (getBlock(lx, ly, lz) === BID.lily_pad && (!MP.on || MP.role !== 'guest')) { setBlock(lx, ly, lz, 0); dropItem(lx + .5, ly + .3, lz + .5, BID.lily_pad, 1); } } // a boat breaks lily pads it meets
  if (e.rider === PL) {
    e.drot -= IN.s * Math.PI / 180;
    const th = (IN.f > 0 ? 0.04 : IN.f < 0 ? -0.005 : 0) + (IN.s && !IN.f ? 0.005 : 0);
    e.vx += -Math.sin(e.yaw) * th; e.vz += -Math.cos(e.yaw) * th;
    if (IN.sneak) { dismount(); }
  }
  e.yaw += e.drot; if (PL.riding === e) { PL.yaw += e.drot; e.viewYaw = e.yaw; } e.drot *= mom; // (the view turns in the same tick)
  if (deep) e.vy = Math.min(e.vy + 0.06, 0.12); else if (inW) { e.vy *= 0.5; if (e.vy < 0) e.vy = 0; } else e.vy -= 0.04;
  const oy = e.y; physMove(e, e.vx, e.vy, e.vz, 0);
  if (!inW && !deep && e.y < oy) e.fall = (e.fall || 0) + oy - e.y;
  else if (e.onGround && e.fall > 3 && !fluidAt(e.x, e.y + 0.1, e.z)) { // a fall of more than three blocks onto land breaks it into planks and sticks (Java)
    if (!MP.on || MP.role !== 'guest') { removeEnt(e); for (const r of [e.rider, e.rider2]) if (r === PL) dismount(); if (gr('doEntityDrops')) { dropItem(e.x, e.y + .3, e.z, IID[(e.wood || 'oak') + '_planks'] || IID.oak_planks, 3); dropItem(e.x, e.y + .3, e.z, IID.stick, 2); } return; } }
  else if (inW || e.onGround) e.fall = 0;
  e.vx *= mom; e.vz *= mom; e.vy *= 0.98;
  if (e.rider === PL) { const f = seat2Busy(e) ? 0.2 : 0; PL.x = e.x - Math.sin(e.yaw) * f; PL.y = e.y - 0.45; PL.z = e.z - Math.cos(e.yaw) * f; PL.vx = e.vx; PL.vz = e.vz; PL.vy = 0; PL.fallDist = 0; PL.onGround = true; } // with two aboard, the driver sits forward
  if (e.y < voidY()) removeEnt(e);
}
function boatRender(e, x, y, z, br) {
  e.mesh.position.set(x, y, z);
  const P = e.mesh.userData.parts; if (P && P.lpaddle && P.rpaddle) { // Java's BoatModel.animatePaddle
    if (!(e.rider === PL)) { const mv = Math.hypot(x - (e.lastRX ?? x), z - (e.lastRZ ?? z)) > 0.02; e.row = e.row || [0, 0]; e.row[0] = mv ? e.row[0] + 0.15 : 0; e.row[1] = e.row[0]; } e.lastRX = x; e.lastRZ = z; // someone else rowing: by how it moves
    const cl = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
    for (const [k, i] of [['lpaddle', 0], ['rpaddle', 1]]) { const f = (e.row && e.row[i]) || 0, p = P[k]; p.rotation.x = -cl(-Math.PI / 3, -Math.PI / 12, (Math.sin(-f) + 1) / 2); const yr = cl(-Math.PI / 4, Math.PI / 4, (Math.sin(-f + 1) + 1) / 2); p.rotation.y = -(i ? Math.PI - yr : yr); } // (Java's angles turned into ours as buildBones does: x and y change sign, or the blades point up into the air)
  } // the model's origin is the boat's position, as Java draws it (the hull's floor 3/16 up)
  const yaw = e.pyaw + (((e.yaw - e.pyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  e.mesh.rotation.set(0, yaw + Math.PI / 2, e.hurt > 0 ? Math.sin(e.hurt) * 0.1 : 0);
  for (const m of e.mesh.userData.mats) m.color.setScalar(br);
}
function rideTick() {
  const e = PL.riding;
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z;
  if (!e || e.dead) { PL.riding = null; return; }
  if (e.kind === 'boat') { if (e.viewYaw != null && PL.viewBoat === e) PL.yaw += e.yaw - e.viewYaw; e.viewYaw = e.yaw; PL.viewBoat = e; } // the view turns with the boat (Java)
  if (e.rider2 === PL) { // the back seat of a boat: rides along, can't steer; takes the front when the driver gets off
    if (!e.rider && !(e.mpRider && performance.now() - e.mpRideAt < 1500)) { e.rider2 = null; e.rider = PL; }
    else { PL.x = e.x + Math.sin(e.yaw) * 0.6; PL.y = e.y - 0.45; PL.z = e.z + Math.cos(e.yaw) * 0.6; PL.vx = PL.vy = PL.vz = 0; PL.fallDist = 0; PL.onGround = true; PL.sprinting = false; PL.eyeH += (1.62 - PL.eyeH) * 0.5; if (IN.sneak) dismount(); return; }
  }
  const f = e.kind === 'boat' && seat2Busy(e) ? 0.2 : 0;
  PL.x = e.x - Math.sin(e.yaw || 0) * f; PL.y = e.y + (e.rideY != null ? e.rideY : e.kind === 'boat' ? -0.45 : 0.18); /* in a boat: Java's -0.1 seat and a player's -0.35 */ PL.z = e.z - Math.cos(e.yaw || 0) * f; PL.sprinting = false; PL.eyeH += (1.62 - PL.eyeH) * 0.5;
}
// ---------- spawning in each dimension ----------
// Java 1.18's nether spawn lists: [mob, weight, smallest group, largest group]
const NETHER_SPAWNS = {
  wastes: [['ghast', 50, 4, 4], ['zombified_piglin', 100, 4, 4], ['magma_cube', 2, 4, 4], ['enderman', 1, 4, 4], ['piglin', 15, 4, 4]],
  crimson: [['zombified_piglin', 1, 2, 4], ['hoglin', 9, 3, 4], ['piglin', 5, 3, 4]],
  warped: [['enderman', 1, 4, 4]],
  soul: [['skeleton', 20, 5, 5], ['ghast', 50, 4, 4], ['enderman', 1, 4, 4]],
  basalt: [['ghast', 40, 1, 1], ['magma_cube', 100, 2, 5]],
  fortress: [['blaze', 10, 2, 3], ['zombified_piglin', 5, 4, 4], ['wither_skeleton', 8, 5, 5], ['skeleton', 2, 5, 5], ['magma_cube', 3, 4, 4]],
};
const pickSpawn = list => { let t = list.reduce((a, e) => a + e[1], 0), r = Math.random() * t; for (const e of list) if ((r -= e[1]) < 0) return e; return list[0]; };
function inFortress(x, y, z) {
  return S.inFortressPieces(W.seed, x, y, z); // (inside one of the fortress's pieces: Java's spawn override)
}
function mobsForDimension(x, y, z, b, below) {
  if (W.dim === -1) {
    const bio = biomeAt(x, z), N = S.NETHER_BIO;
    const list = inFortress(x, y, z) ? NETHER_SPAWNS.fortress /* Java: inside the fortress's pieces only its own mobs */
      : bio === N.SOUL ? NETHER_SPAWNS.soul : bio === N.BASALT ? NETHER_SPAWNS.basalt : bio === N.WARPED ? NETHER_SPAWNS.warped : bio === N.CRIMSON ? NETHER_SPAWNS.crimson : NETHER_SPAWNS.wastes;
    const [t, , lo, hi] = pickSpawn(list); return [t, lo + Math.floor(Math.random() * (hi - lo + 1))];
  }
  if (W.dim === 1) return below === BID.end_stone ? ['enderman', 4] : null;
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
    const t = types[0], group = types[1] || 1;
    if (t === 'ghast') { if (SOLID[getBlock(x, y + 4, z)] || countMobs(e => e.type === 'ghast') >= 4) continue; spawnMob(t, x + .5, y + 2, z + .5); }
    else { // a pack: each member at a free spot nearby on the same kind of ground (Java's group spawning)
      let n = 0; for (let k = 0; k < group * 3 && n < group; k++) {
        const gx = k ? x + Math.floor(Math.random() * 7) - 3 : x, gz = k ? z + Math.floor(Math.random() * 7) - 3 : z; let gy = y + 1; while (gy > y - 4 && !SOLID[getBlock(gx, gy - 1, gz)]) gy--;
        if (!SOLID[getBlock(gx, gy - 1, gz)] || getBlock(gx, gy - 1, gz) === BID.bedrock || SOLID[getBlock(gx, gy, gz)] || SOLID[getBlock(gx, gy + 1, gz)] || FLUID[getBlock(gx, gy, gz)]) continue;
        if (t === 'magma_cube') spawnMob(t, gx + .5, gy, gz + .5, { size: [1, 2, 4][Math.floor(Math.random() * 3)] }); else spawnMob(t, gx + .5, gy, gz + .5); n++;
      }
    }
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
  if (!e.goal || Math.random() < 0.01 || Math.hypot(e.goal[0] - e.x, e.goal[1] - e.y, e.goal[2] - e.z) < 1) e.goal = [e.x + (Math.random() - .5) * 32, Math.max(MINY + 8, Math.min(MAXY - 8, e.y + (Math.random() - .5) * 16)), e.z + (Math.random() - .5) * 32]; // (Java: anywhere within 16 blocks)
  const gx = e.goal[0] - e.x, gy = e.goal[1] - e.y, gz = e.goal[2] - e.z, gl = Math.hypot(gx, gy, gz) || 1;
  e.vx += gx / gl * 0.01; e.vy += gy / gl * 0.01; e.vz += gz / gl * 0.01;
  if (e.hitH || e.hitV) e.goal = null;
  const see = plTargetable() && dist < 64 && canSee(e.x, e.y + 2, e.z, PL.x, PL.y + 1.6, PL.z);
  if (see) { faceTo(e, PL.x, PL.z); e.charge = (e.charge || 0) + 1; if (e.charge === 10) play('ghast', { vol: 0.8 }); if (e.charge >= 20) { e.charge = -40; const sx = e.x - Math.sin(e.yaw) * 4, sz = e.z - Math.cos(e.yaw) * 4, sy = e.y + 2.5; spawnFireball(sx, sy, sz, PL.x - sx, PL.y + 0.9 - sy, PL.z - sz, e, false); } } // (Java: 4 blocks out in front, from half a block over its middle, at the target's middle)
  else { if (e.charge > 0) e.charge--; e.yawTarget = Math.atan2(-e.vx, -e.vz); } // out of sight the charge runs down, but the 2-second wait after a shot stays (it used to be wiped, so a ghast that lost sight for a moment fired again a second later)
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
    if (e.atk > 78) e.atk = -100; // (Java: after the third fireball, 5 seconds before the next charge)
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
  if (hostileNow && sz > 1 || (hostileNow && e.type === 'magma_cube')) { if (dist < 0.6 + sz * 0.5 && Math.abs(PL.y - e.y) < 1.5 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, e.type === 'magma_cube' ? sz + 2 : sz, 0, 0); /* (Java: a slime's size, a magma cube's size + 2: 3, 4, 6 on Normal) */ } }
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
    if (!e.goal && Math.random() < 1 / 100) e.goal = wanderGoal(e, 7);
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  walkPhysics(e, mx, mz, speed);
}
function endermanTeleport(e, cx = e.x, cz = e.z) {
  for (let k = 0; k < 16; k++) {
    const x = Math.floor(cx + (Math.random() - .5) * 32), z = Math.floor(cz + (Math.random() - .5) * 32); if (!isLoaded(x, z)) continue;
    let y = Math.floor(e.y + (Math.random() - .5) * 16); for (let i = 0; i < 16 && y > MINY + 1 && !SOLID[getBlock(x, y - 1, z)]; i++) y--;
    if (!SOLID[getBlock(x, y - 1, z)] || FLUID[getBlock(x, y, z)] || SOLID[getBlock(x, y, z)] || SOLID[getBlock(x, y + 1, z)] || SOLID[getBlock(x, y + 2, z)]) continue;
    for (let i = 0; i < 12; i++) R.simpleParticle(e.x + (Math.random() - .5), e.y + Math.random() * 3, e.z + (Math.random() - .5), [0.6, 0.2, 0.9], { kind: 'portal', size: 0.12, vy: 0.3, grav: 0 });
    e.x = e.px = x + .5; e.y = e.py = y; e.z = e.pz = z + .5; e.path = null; play('teleport', { vol: 0.5 }); return true;
  }
  return false;
}
function walkPhysics(e, mx, mz, speed) {
  const inF = e.inWater || e.inLava, d = e.def;
  if (e.inWater && !d.sinks && !d.swim && !d.water && !e.target && !e.rider && e.age % 20 === 0 && (!e.goal || (e.goal.length === 2 && waterCol(e.goal[0], e.goal[1])))) { const g = landSeek(e); if (g) { e.goal = g; const gx = g[0] - e.x, gz = g[1] - e.z, gl = Math.hypot(gx, gz) || 1; if (!mx && !mz) { mx = gx / gl; mz = gz / gl; speed = speed || d.speed; } } } // out of the water, to a bank (Java's float and stroll goals)
  // the same good sense the common mobs have (entities.js): a stroll to a far spot follows a path around walls and holes,
  // no step over a drop of more than three blocks or into lava, fire or cactus, and two seconds against a wall gives up
  // on that spot
  if ((mx || mz) && e.goal && e.goal.length === 2 && !e.target && !d.fly && typeof pathDir === 'function') {
    const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz), ml = Math.hypot(mx, mz);
    if (gl > 2.5 && (gx * mx + gz * mz) / (gl * ml) > 0.8) { const pd = pathDir(e, e.goal[0], e.y, e.goal[1]); if (pd[0] || pd[1]) { mx = pd[0] * ml; mz = pd[1] * ml; e.yawTarget = Math.atan2(-pd[0], -pd[1]); } }
  }
  if ((mx || mz) && e.onGround && !inF && !d.fly && typeof mobSafeAhead === 'function' && !mobSafeAhead(e, mx / (Math.hypot(mx, mz) || 1), mz / (Math.hypot(mx, mz) || 1))) { mx = mz = 0; if (!e.target) { e.goal = null; e.path = null; } }
  if ((mx || mz) && e.onGround && !inF && !d.fly && !d.swim && !d.water && !e.target && !(e.panic > 0) && !e.rider && !e.leash && typeof mobWaterAhead === 'function' && mobWaterAhead(e, mx / (Math.hypot(mx, mz) || 1), mz / (Math.hypot(mx, mz) || 1))) { mx = mz = 0; e.goal = null; e.path = null; } // (Java: they stroll to dry ground)
  if ((mx || mz) && Math.hypot(e.x - (e.lastX ?? e.x + 1), e.z - (e.lastZ ?? e.z)) < 0.01) { if ((e.stuckT = (e.stuckT || 0) + 1) > 40 && !e.target) { e.goal = null; e.path = null; e.stuckT = 0; } } else e.stuckT = 0;
  e.lastX = e.x; e.lastZ = e.z; if (e.goal && !e.target) { const pr = e.prog || (e.prog = [e.x, e.z, W.tickN]); if (W.tickN - pr[2] >= 40) { if (Math.hypot(e.x - pr[0], e.z - pr[1]) < 0.5) { if (e.onGround && !e.progJ) { e.vy = 0.42; e.progJ = 1; } else { e.goal = null; e.path = null; e.progJ = 0; } } else e.progJ = 0; e.prog = [e.x, e.z, W.tickN]; } } else e.prog = null; /* two seconds with less than half a block gained: a hop, then somewhere else */
  const acc = e.onGround ? 0.5 : inF ? 0.2 : 0.1;
  e.vx += (mx * speed - e.vx) * acc; e.vz += (mz * speed - e.vz) * acc;
  if ((mx || mz) && e.hitH && e.onGround && e.jumpCd <= 0) { e.vy = 0.42; e.jumpCd = 10; }
  if (inF) { e.vy = Math.max(e.vy - 0.02, -0.1); if (!d.sinks && !d.swim) e.vy += 0.04; else if ((mx || mz) && !d.sinks) e.vy += 0.04; if ((mx || mz) && e.hitH) e.vy = Math.max(e.vy, 0.3); e.vy *= 0.8; } // Java's FloatGoal: head above the water, up the bank where it meets one
  turn(e);
  { const hv = Math.hypot(e.vx, e.vz); if (hv > 0.003 && hv < 0.15 && e.onGround && !inF && !d.fly && !(e.hurt > 0) && typeof mobSafeAhead === 'function' && !mobSafeAhead(e, e.vx / hv, e.vz / hv)) { e.vx *= -0.2; e.vz *= -0.2; } }
  physMove(e, e.vx, e.vy, e.vz, 0.6);
  if (!inF) e.vy = (e.vy - 0.08) * 0.98;
  if (!e.onGround) { e.vx *= 0.91; e.vz *= 0.91; } else { e.vx *= 0.6; e.vz *= 0.6; }
  const hs = Math.hypot(e.vx, e.vz); e.walkAmt += (Math.min(1, hs * 8) - e.walkAmt) * 0.3; e.walk += hs * 6; if (typeof mobLimb === 'function') mobLimb(e, hs);
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
      if (t === PL) { if (hurtPlayer(diffDmg(dmg), 'mob', e)) PL.vy = 0.6; } else { hurtMob(t, dmg, e, 0, 0); t.vy = 0.6; }
    }
  } else {
    if (!e.goal && Math.random() < 1 / 200) e.goal = wanderGoal(e, 6);
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.8) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  if (e.swing > 0) e.swing--;
  walkPhysics(e, mx, mz, e.target ? 0.189 : 0.068); // (Java: movement 0.25, a stroll at 0.6 of it)
}
function golemAnim(e, P) { if (P.rarm) { const s = e.swing > 0 ? -1.6 * Math.sin(e.swing / 10 * Math.PI) : 0; P.rarm.rotation.x = s - Math.sin(e.walk) * 0.5 * e.walkAmt; P.larm.rotation.x = s + Math.sin(e.walk) * 0.5 * e.walkAmt; } }
function crystalAI(e) { e.vx = e.vy = e.vz = 0; e.walk += 0.05; }
function crystalAnim(e, P, now) { if (P.glass) { P.glass.rotation.y = now / 400; P.glass.position.y = (24 - 8) / 16 + Math.sin(now / 300) * 0.3; } if (P.base) P.base.visible = true; }
// a crystal blown up: the one healing the dragon hurts it (10, as a blast to the head), and a dragon going round turns on
// whoever did it (or the nearest player within 64) (Java's onCrystalDestroyed)
function crystalHurt(e, dmg, attacker) { if (e.dead) return false; removeEnt(e); explode(e.x, e.y + 1, e.z, 6); const dr = ENT.find(o => o.type === 'ender_dragon' && !o.dead);
  if (dr) { if (dr.healFrom === e) { dr.healFrom = null; dr.inv = 0; dr.headHit = true; dragonHurt(dr, 10, null); }
    if (dr.phase === 'hold' && plTargetable() && (attacker === PL || Math.hypot(PL.x - e.x, PL.y - e.y, PL.z - e.z) < 64)) dragonPhase(dr, 'strafe'); }
  return true; }
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
// The dragon as Java 1.18 flies and fights it (EnderDragon + the dragon phases):
//  - flight (EnderDragon.aiStep): it always pushes forward along its facing (0.06 a tick), turns toward where it is
//    going at a rate that drops as it speeds up, and climbs or dives only gently (more steeply when landing or charging);
//    it passes through blocks, breaking all but end stone, obsidian, bedrock, iron bars and the portal
//  - holding pattern: from node to node of the 24 round the island (12 outer, 8 inner, 4 between; with every crystal
//    gone it keeps to the inner ring), 0-20 above each; at each node it may land (1 in crystals + 3) or go for the
//    player (likelier the nearer the player is to the portal and the fewer the crystals)
//  - strafing: it flies at the player and spits a fireball once it has faced them for a moment; a crystal blown up
//    sends it at whoever did it
//  - landing on the portal's pillar, then sitting: it looks for a player within 20 and turns to them, roars, and
//    breathes a cloud of dragon's breath in front of its head; after four breaths it takes off, or with nobody near for
//    5 seconds it charges the nearest player within 150; a quarter of its health lost while sitting makes it take off
//  - its body hurts: the head and neck hit for 10, the wings throw anyone near them away and hit for 5 (not while it sits)
//  - only the head takes full damage; the rest a quarter (plus up to 1); sitting, arrows glance off
//  - its health is kept in the world (leaving the End or dying there and coming back no longer heals it)
const DRAGON_SIT = { sit_scan: 1, sit_roar: 1, sit_flame: 1 };
const dragonSitting = e => !!DRAGON_SIT[e.phase];
let DRAGON_NODES = null;
function dragonNodes() {
  if (DRAGON_NODES && DRAGON_NODES.ok) return DRAGON_NODES;
  const n = []; let ok = true;
  for (let i = 0; i < 24; i++) { let x, z, j = 5;
    if (i < 12) { const a = 2 * (-Math.PI + 0.2617994 * i); x = Math.floor(60 * Math.cos(a)); z = Math.floor(60 * Math.sin(a)); }
    else if (i < 20) { const a = 2 * (-Math.PI + 0.3926991 * (i - 12)); x = Math.floor(40 * Math.cos(a)); z = Math.floor(40 * Math.sin(a)); j += 10; }
    else { const a = 2 * (-Math.PI + 0.7853982 * (i - 20)); x = Math.floor(20 * Math.cos(a)); z = Math.floor(20 * Math.sin(a)); }
    let top = isLoaded(x >> 4, z >> 4) ? topY(x, z) : null; if (top == null) { ok = false; top = 60; } else if (top < 40) top = 50;
    n.push([x, Math.max(10, top + j), z]); }
  n.ok = ok; return DRAGON_NODES = n;
}
function dragonClosestNode(x, y, z, crystals) {
  const N = dragonNodes(); let bi = 0, bd = 1e18;
  for (let i = crystals === 0 ? 12 : 0; i < 24; i++) { const d = (N[i][0] - x) ** 2 + (N[i][1] - y) ** 2 + (N[i][2] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi;
}
// a node as a target: 0-20 above it
function dragonToNode(e, i) { const nd = dragonNodes()[i]; e.node = i; e.tgt = [nd[0], nd[1] + Math.random() * 20, nd[2]]; }
const dragonCrystals = () => ENT.reduce((n, o) => n + (o.type === 'end_crystal' && !o.dead ? 1 : 0), 0);
const dragonPodium = () => [0, S.END_PORTAL_Y + 4, 0];
function dragonPhase(e, p) { e.phase = p; e.phaseT = 0; e.tgt = null;
  if (p === 'hold') e.pathDone = true;
  if (p === 'sit_scan') e.scanT = 0;
  if (p === 'sit_flame') { e.flames = (e.flames || 0) + 1; e.flameAt = null; }
  if (p === 'sit_roar') play('growl');
  if (p === 'land_approach' || p === 'takeoff') e.pathDone = false;
}
function dragonHurt(e, dmg, attacker) {
  if (e.phase === 'dying' || e.phase === 'death' || e.inv > 0) return false;
  if (attacker && attacker !== PL && attacker.kind === 'mob') return false; // (Java: only players and blasts hurt it)
  if (dragonSitting(e) && HURTPROJ && (HURTPROJ.kind === 'arrow' || HURTPROJ.kind === 'trident')) { HURTPROJ.fire = Math.max(HURTPROJ.fire || 0, 20); return false; } // (sitting: arrows and tridents glance off it)
  const head = e.hitPart === 'head' || (HURTPROJ && dragonPartAt(e, HURTPROJ.x, HURTPROJ.y, HURTPROJ.z, 0.3) === 'head') || e.headHit; e.hitPart = null; e.headHit = false;
  if (!head) dmg = dmg / 4 + Math.min(dmg, 1);
  if (dmg < 0.01) return false;
  e.hp -= dmg; e.hurt = 10; e.inv = 10; play('growl', { vol: 0.6 });
  if (dragonSitting(e)) { e.sitDmg = (e.sitDmg || 0) + dmg; if (e.sitDmg > e.def.hp * 0.25) { e.sitDmg = 0; dragonPhase(e, 'takeoff'); } }
  if (e.hp <= 0) { e.hp = 0; dragonPhase(e, 'dying'); }
  dragonKeep(e);
  return true;
}
// the parts of its body (Java's EnderDragonPart boxes: head, neck, body, wings, tail), placed by its facing
function dragonParts(e) {
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), sx = -fz, sz = fx, hy = dragonSitting(e) ? -1 : Math.max(-2, Math.min(2, -(e.vy || 0) * 10)), B = [];
  const box = (n, cx, cy, cz, w, h) => B.push([n, cx - w / 2, cy, cz - w / 2, cx + w / 2, cy + h, cz + w / 2]);
  box('head', e.x + fx * 6.5, e.y + hy, e.z + fz * 6.5, 1, 1);
  box('neck', e.x + fx * 5.5, e.y + hy, e.z + fz * 5.5, 3, 3);
  box('body', e.x + fx * 0.5, e.y, e.z + fz * 0.5, 5, 3);
  box('wing', e.x + sx * 4.5, e.y + 2, e.z + sz * 4.5, 4, 2); box('wing', e.x - sx * 4.5, e.y + 2, e.z - sz * 4.5, 4, 2);
  for (let k = 0; k < 3; k++) { const d = 1.5 + 2 * (k + 1); box('tail', e.x - fx * d, e.y + 1.5, e.z - fz * d, 2, 2); }
  return B;
}
function dragonPartAt(e, x, y, z, pad = 0) { for (const b of dragonParts(e)) if (x > b[1] - pad && x < b[4] + pad && y > b[2] - pad && y < b[5] + pad && z > b[3] - pad && z < b[6] + pad) return b[0]; return null; }
const plIn = (b, ix, iy, iz) => PL.x + 0.3 > b[1] - ix && PL.x - 0.3 < b[4] + ix && PL.y + 1.8 > b[2] - iy && PL.y < b[5] + iy && PL.z + 0.3 > b[3] - iz && PL.z - 0.3 < b[6] + iz;
// its health and place, kept in the world
function dragonKeep(e) { if (W.meta && !e.dead) W.meta.dragon = { hp: Math.round(e.hp * 10) / 10, x: Math.round(e.x), y: Math.round(e.y), z: Math.round(e.z) }; }
function dragonAI(e) {
  const P = dragonPodium(), tick = W.tickN;
  e.phaseT = (e.phaseT || 0) + 1;
  if (!e.phase || e.phase === 'circle') dragonPhase(e, 'hold');
  e.boxes = dragonParts(e).map(b => b.slice(1)); e.boxParts = dragonParts(e).map(b => b[0]);
  if (e.phaseT % 20 === 0) dragonKeep(e);
  // crystals heal it (Java's checkCrystals)
  if (e.phase !== 'dying' && e.phase !== 'death') {
    if (e.healFrom && e.healFrom.dead) e.healFrom = null;
    if (e.healFrom && e.age % 10 === 0 && e.hp < e.def.hp) e.hp = Math.min(e.def.hp, e.hp + 1);
    if (Math.random() < 0.1) { let bd = 1e9; e.healFrom = null; for (const o of ENT) if (o.type === 'end_crystal' && !o.dead && Math.abs(o.x - e.x) < 34 && Math.abs(o.y - e.y) < 32 && Math.abs(o.z - e.z) < 34) { const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2 + (o.z - e.z) ** 2; if (d < bd) { bd = d; e.healFrom = o; } } }
  }
  const crystals = dragonCrystals(), dPl = Math.hypot(PL.x - e.x, PL.y - e.y, PL.z - e.z), tgtD2 = () => e.tgt ? (e.tgt[0] - e.x) ** 2 + (e.tgt[1] - e.y) ** 2 + (e.tgt[2] - e.z) ** 2 : 0;
  let fly = 0.6, turnK = null;
  switch (e.phase) {
    case 'hold': {
      const d2 = tgtD2();
      if (!e.tgt || d2 < 100 || d2 > 22500) {
        if (e.tgt && e.pathDone) { // a node reached: land, or go for the player
          if (Math.floor(Math.random() * (crystals + 3)) === 0) { dragonPhase(e, 'land_approach'); break; }
          if (plTargetable() && W.dim === 1 && Math.hypot(PL.x - P[0], PL.y - P[1], PL.z - P[2]) < 64) { const dd = ((PL.x - P[0]) ** 2 + (PL.y - P[1]) ** 2 + (PL.z - P[2]) ** 2) / 512;
            if (Math.floor(Math.random() * (Math.abs(Math.floor(dd)) + 2)) === 0 || Math.floor(Math.random() * (crystals + 2)) === 0) { dragonPhase(e, 'strafe'); break; } }
        }
        const i = dragonClosestNode(e.x, e.y, e.z, crystals); let j = i;
        if (Math.random() < 1 / 8) { e.cw = !e.cw; j += 6; }
        j += e.cw ? 1 : -1;
        if (crystals === 0) { j -= 12; j &= 7; j += 12; } else { j %= 12; if (j < 0) j += 12; }
        dragonToNode(e, j); e.pathDone = true;
      }
      break; }
    case 'strafe': {
      if (!plTargetable() || W.dim !== 1 || e.phaseT > 600) { dragonPhase(e, 'hold'); break; }
      const h = Math.hypot(PL.x - e.x, PL.z - e.z); e.tgt = [PL.x, PL.y + Math.min(0.4 + h / 80 - 1, 10), PL.z];
      if (dPl < 64 && canSee(e.x, e.y + 1, e.z, PL.x, PL.y + 1.6, PL.z)) {
        e.fbCharge = (e.fbCharge || 0) + 1;
        const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), ang = Math.acos(Math.max(-1, Math.min(1, (fx * (PL.x - e.x) + fz * (PL.z - e.z)) / (h || 1)))) * 180 / Math.PI + 0.5;
        if (e.fbCharge >= 5 && ang < 10) { const hd = dragonParts(e)[0], hx = (hd[1] + hd[4]) / 2 - fx, hyy = hd[2] + 1, hz = (hd[3] + hd[6]) / 2 - fz;
          spawnFireball(hx, hyy, hz, PL.x - hx, PL.y + 0.9 - hyy, PL.z - hz, e, false, true); play('fireball', { vol: 0.6 }); e.fbCharge = 0; dragonPhase(e, 'hold'); }
      } else if (e.fbCharge > 0) e.fbCharge--;
      break; }
    case 'charge': {
      fly = 3;
      if (!e.tgt) { dragonPhase(e, 'hold'); break; }
      if (e.chargeT > 0 && e.chargeT++ >= 10) { dragonPhase(e, 'hold'); break; }
      { const d2 = tgtD2(); if (d2 < 100 || d2 > 22500) e.chargeT = (e.chargeT || 0) + 1; }
      if (e.phaseT > 400) dragonPhase(e, 'hold');
      break; }
    case 'land_approach': {
      const top = [P[0], P[1] + 6, P[2]];
      if (!e.tgt) e.tgt = [...dragonNodes()[dragonClosestNode(top[0], top[1], top[2], crystals)]];
      if (!e.pathDone && tgtD2() < 100) { e.pathDone = true; e.tgt = top; }
      if (e.pathDone) { e.tgt = top; if (tgtD2() < 100) dragonPhase(e, 'land'); }
      if (e.phaseT > 800) dragonPhase(e, 'land');
      break; }
    case 'land': {
      fly = 1.5; turnK = 'fast'; e.tgt = [P[0], P[1], P[2] + 0.5];
      if (tgtD2() < 1 || e.phaseT > 400) { e.flames = 0; e.sitDmg = 0; e.x = P[0]; e.z = P[2] + 0.5; e.y = P[1]; e.vx = e.vy = e.vz = 0; dragonPhase(e, 'sit_scan'); play('growl'); }
      break; }
    case 'sit_scan': {
      e.scanT++;
      const near = plTargetable() && Math.hypot(PL.x - e.x, PL.z - e.z) < 20 && Math.abs(PL.y - e.y) <= 10;
      if (near) {
        if (e.scanT > 25) dragonPhase(e, 'sit_roar');
        else { const hd = dragonParts(e)[0], hx = (hd[1] + hd[4]) / 2, hz = (hd[3] + hd[6]) / 2, dx = PL.x - hx, dz = PL.z - hz, fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), h = Math.hypot(PL.x - e.x, PL.z - e.z) || 1;
          const ang = Math.acos(Math.max(-1, Math.min(1, (fx * (PL.x - e.x) + fz * (PL.z - e.z)) / h))) * 180 / Math.PI + 0.5;
          if (ang < 0 || ang > 10) { const J = -e.yaw * 180 / Math.PI, want = 180 - Math.atan2(dx, dz) * 180 / Math.PI; let d = ((want - J) % 360 + 540) % 360 - 180; d = Math.max(-100, Math.min(100, d));
            e.yRotA = (e.yRotA || 0) * 0.8; const f2 = Math.hypot(dx, dz) + 1; e.yRotA += d * 0.7 / Math.min(40, f2) / f2; e.yaw = -(J + e.yRotA) * Math.PI / 180; } }
      } else if (e.scanT >= 100) {
        if (plTargetable() && W.dim === 1 && dPl < 150) { dragonPhase(e, 'charge'); e.tgt = [PL.x, PL.y, PL.z]; e.chargeT = 0; play('growl'); }
        else dragonPhase(e, 'takeoff');
      }
      e.yawTarget = e.yaw;
      break; }
    case 'sit_roar': if (e.phaseT >= 40) dragonPhase(e, 'sit_flame'); break;
    case 'sit_flame': {
      const hd = dragonParts(e)[0], hx = (hd[1] + hd[4]) / 2, hz = (hd[3] + hd[6]) / 2, fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      if (e.phaseT < 10 && e.phaseT % 2 === 0) for (let i = 0; i < 6; i++) R.simpleParticle(hx + fx * Math.random() * 2, hd[2] + 0.5, hz + fz * Math.random() * 2, [0.75, 0.25, 0.85], { size: 0.5, vy: 0, grav: 0, life: 0.8 });
      if (e.phaseT === 10) { const cx = hx + fx * 2.5, cz = hz + fz * 2.5; let gy = Math.floor(hd[2] + 0.5); for (let k = 0; k < 12 && gy > MINY && !SOLID[getBlock(Math.floor(cx), gy - 1, Math.floor(cz))]; k++) gy--;
        spawnCloud(cx, gy + 0.05, cz, 'harming', { breath: true, col: 0xb43cd2, r: 5, dur: 200 }); play('fireball', { vol: 0.6 }); }
      if (e.phaseT >= 200) dragonPhase(e, e.flames >= 4 ? 'takeoff' : 'sit_scan');
      break; }
    case 'takeoff': {
      if (!e.tgt) { const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw); dragonToNode(e, dragonClosestNode(fx * 40, 105, fz * 40, crystals)); }
      if (Math.hypot(e.x - P[0], e.y - P[1], e.z - P[2]) >= 10 && e.phaseT > 5) dragonPhase(e, 'hold');
      break; }
    case 'dying': { // (Java's DragonDeathPhase: to the portal, then the death itself)
      e.tgt = [P[0], P[1] + 6, P[2]];
      if (tgtD2() < 100 || e.phaseT >= 200) { dragonPhase(e, 'death'); play('growl'); }
      break; }
    case 'death': {
      e.vx = e.vy = e.vz = 0; e.y += 0.1; e.yaw -= 20 * Math.PI / 180; e.yawTarget = e.yaw;
      if (e.phaseT >= 180 && e.phaseT % 2 === 0) for (let i = 0; i < 3; i++) R.simpleParticle(e.x + (Math.random() - .5) * 8, e.y + 2 + (Math.random() - .5) * 4, e.z + (Math.random() - .5) * 8, [1, 0.9, 0.6], { size: 1.2, vy: 1, grav: 0, life: 0.6 });
      const total = W.meta.dragonDone ? 500 : 12000; // (Java: 8% every 5 ticks after 150, the last 20% at 200)
      if (e.phaseT > 150 && e.phaseT % 5 === 0) spawnXP(e.x, e.y + 2, e.z, Math.floor(total * 0.08));
      if (e.phaseT >= 200) { spawnXP(e.x, e.y + 2, e.z, Math.floor(total * 0.2)); dragonDefeated(e); }
      bossBar(e); return; }
  }
  // flight (EnderDragon.aiStep)
  if (!dragonSitting(e) && e.tgt) {
    const dx = e.tgt[0] - e.x, dz = e.tgt[2] - e.z, h = Math.hypot(dx, dz); let dy = e.tgt[1] - e.y;
    const d3 = dx * dx + dy * dy + dz * dz;
    if (h > 0) dy = Math.max(-fly, Math.min(fly, dy / h));
    e.vy += dy * 0.01;
    const l = Math.sqrt(d3) || 1, fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), vl = Math.hypot(fx, e.vy, fz) || 1;
    const f8 = Math.max(((fx * dx + e.vy * (e.tgt[1] - e.y) + fz * dz) / l / vl + 0.5) / 1.5, 0);
    if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
      const J = -e.yaw * 180 / Math.PI, want = 180 - Math.atan2(dx, dz) * 180 / Math.PI; let d5 = ((want - J) % 360 + 540) % 360 - 180; d5 = Math.max(-50, Math.min(50, d5));
      const sp = Math.hypot(e.vx, e.vz) + 1, ts = turnK === 'fast' ? Math.min(sp, 40) / sp : 0.7 / Math.min(sp, 40) / sp;
      e.yRotA = (e.yRotA || 0) * 0.8 + d5 * ts; e.yaw = -(J + e.yRotA * 0.1) * Math.PI / 180;
    }
    const f19 = 2 / (d3 + 1), th = 0.06 * (f8 * f19 + (1 - f19)), nfx = -Math.sin(e.yaw), nfz = -Math.cos(e.yaw);
    e.vx += nfx * th; e.vz += nfz * th;
    const k = e.inWall ? 0.8 : 1; e.x += e.vx * k; e.y += e.vy * k; e.z += e.vz * k;
    const ml = Math.hypot(e.vx, e.vy, e.vz) || 1, d6 = 0.8 + 0.15 * (((e.vx * nfx + e.vy * e.vy / vl + e.vz * nfz) / ml) + 1) / 2;
    e.vx *= d6; e.vy *= 0.91; e.vz *= d6;
    e.yawTarget = e.yaw;
  } else if (dragonSitting(e)) { e.vx = e.vy = e.vz = 0; e.y = P[1]; }
  // the body breaks through blocks (Java's checkWalls: not end stone, obsidian, bedrock, iron bars or the portal)
  e.inWall = false;
  if (!dragonSitting(e) && gr('mobGriefing')) for (const b of e.boxes) { if (Math.random() < 0.6) continue;
    const bx = Math.floor(b[0] + Math.random() * (b[3] - b[0])), by = Math.floor(b[1] + Math.random() * (b[4] - b[1])), bz = Math.floor(b[2] + Math.random() * (b[5] - b[2])), id = getBlock(bx, by, bz);
    if (!id || FLUID[id]) continue;
    if (id === BID.end_stone || id === BID.obsidian || id === BID.bedrock || id === BID.iron_bars || id === BID.end_portal || id === BID.end_portal_frame || id === BID.crying_obsidian || BLOCKS[id].hard < 0) { if (SOLID[id]) e.inWall = true; }
    else setBlock(bx, by, bz, 0);
  }
  // its body hurts (only while it isn't flashing from a hit, as Java)
  if (plTargetable() && !(e.hurt > 0)) {
    const B = dragonParts(e), bodyX = (B[2][1] + B[2][4]) / 2, bodyZ = (B[2][3] + B[2][6]) / 2;
    for (const b of B) if (b[0] === 'wing' && plIn([0, b[1], b[2] - 2, b[3], b[4], b[5] - 2, b[6]], 4, 2, 4)) {
      const d2 = PL.x - bodyX, d3 = PL.z - bodyZ, d4 = Math.max(d2 * d2 + d3 * d3, 0.1);
      PL.vx += d2 / d4 * 4; PL.vy += 0.2; PL.vz += d3 / d4 * 4;
      if (!dragonSitting(e) && !(PL.dragonHitT > tick - 2)) { PL.dragonHitT = tick; hurtPlayer(diffDmg(5), 'mob', e); }
      break;
    }
    for (const b of [B[0], B[1]]) if (plIn(b, 1, 1, 1)) { const cx = (b[1] + b[4]) / 2, cz = (b[3] + b[6]) / 2; attackPlayer(e, 10, PL.x - cx, PL.z - cz); break; }
  }
  if (e.age % 140 === 0) play('growl', { vol: 0.5 });
  bossBar(e);
}
function dragonAnim(e, P, now) {
  const f = Math.sin(now / 260), g = Math.sin(now / 260 - 0.8), perch = dragonSitting(e);
  if (e.remote) { const B = dragonParts(e); e.boxes = B.map(b => b.slice(1)); e.boxParts = B.map(b => b[0]); } // (another player's dragon: its parts for hitting it)
  if (P.lwing) { P.lwing.rotation.z = perch ? -0.9 : f * 0.6; P.rwing.rotation.z = perch ? 0.9 : -f * 0.6; P.ltip.rotation.z = perch ? 1.8 : g * 0.5 - 0.2; P.rtip.rotation.z = perch ? -1.8 : -g * 0.5 + 0.2; }
  for (let i = 0; i < 12; i++) if (P['tail' + i]) { P['tail' + i].position.x = Math.sin(now / 600 + i * 0.4) * i * 0.06; P['tail' + i].position.y = (24 - 10 - i * 0.6) / 16 + Math.sin(now / 500 + i * 0.5) * i * 0.03; }
  for (let i = 0; i < 5; i++) if (P['neck' + i]) P['neck' + i].position.y = (24 - 13 + i * 1.5) / 16 + (perch ? -i * 0.25 : Math.sin(now / 400 + i * 0.4) * 0.05 * i);
  if (P.head) { P.head.position.y = (24 - 6) / 16 + (perch ? -1.4 : Math.sin(now / 400 + 2) * 0.25); }
  if (P.jaw) P.jaw.rotation.x = e.phase === 'sit_roar' || (e.phase === 'sit_flame' && e.phaseT < 30) || e.bite > 0 ? -0.5 : -Math.max(0, Math.sin(now / 900)) * 0.15;
  if (e.bite > 0) e.bite--;
  e.mesh.rotation.x = e.phase === 'death' || perch ? 0 : -Math.max(-0.4, Math.min(0.4, e.vy * 1.5));
}
function dragonDefeated(e) {
  removeEnt(e); bossBar(null);
  const y = S.END_PORTAL_Y;
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const d2 = x * x + z * z; if (d2 <= 6 && (x || z)) setBlock(x, y, z, BID.end_portal, 0, { noUpdate: true }); }
  if (!W.meta.dragonDone) setBlock(0, y + 4, 0, BID.dragon_egg, 0, { noUpdate: true }); // the egg only after the first fight
  // an end gateway to the outer islands: Java's 20 places on a ring 96 out at y 75, one more each fight, in a shuffled order
  const used = W.meta.gateways || (W.meta.gateways = []), free = [...Array(20).keys()].filter(i => !used.includes(i));
  if (free.length) { const i = free[S.hash32(W.seed, used.length, 0, 7) % free.length], ga = 2 * (-Math.PI + 0.15707963267948966 * i), gx = Math.floor(96 * Math.cos(ga)), gz = Math.floor(96 * Math.sin(ga)); used.push(i);
    for (const dy of [-1, 1]) setBlock(gx, 75 + dy, gz, BID.bedrock, 0, { noUpdate: true });
    setBlock(gx, 75, gz, BID.end_portal, 1, { noUpdate: true }); }
  W.meta.dragon = null; W.meta.dragonKilled = true; W.meta.dragonDone = true; UI.advance && UI.advance('dragon'); chatMsg('엔더 드래곤을 물리쳤습니다!', '#ff55ff');
  play('levelup');
}
// the respawn sequence (four crystals on the exit portal): the pillars are rebuilt with their crystals and cages
function endRespawnPillars() {
  for (const [px, pz, rad, h, cage] of S.END_PILLARS) {
    for (let x = px - rad; x <= px + rad; x++) for (let z = pz - rad; z <= pz + rad; z++) if ((x - px) ** 2 + (z - pz) ** 2 <= rad * rad + 1) for (let y = 40; y <= h; y++) if (getBlock(x, y, z) !== BID.obsidian) setBlock(x, y, z, BID.obsidian, 0, { noUpdate: true });
    for (let x = px - 2; x <= px + 2; x++) for (let z = pz - 2; z <= pz + 2; z++) for (let y = h + 1; y <= h + 4; y++) setBlock(x, y, z, cage && (Math.abs(x - px) === 2 || Math.abs(z - pz) === 2 || y === h + 4) ? BID.iron_bars : 0, 0, { noUpdate: true });
    setBlock(px, h + 1, pz, BID.bedrock, 0, { noUpdate: true }); setBlock(px, h + 2, pz, BID.fire, 0, { noUpdate: true });
    for (const o of ENT) if (o.type === 'end_crystal' && !o.dead && Math.abs(o.x - px - .5) < 1 && Math.abs(o.z - pz - .5) < 1) removeEnt(o);
    const c = spawnMob('end_crystal', px + .5, h + 2, pz + .5); if (c) c.persistent = true;
  }
}
function ensureDragon() {
  if (W.dim !== 1 || W.meta.dragonKilled || ENT.some(o => o.type === 'ender_dragon' && !o.dead) || !isLoaded(0, 0)) return;
  const k = W.meta.dragon, e = spawnMob('ender_dragon', k ? k.x : 40, k ? k.y : 85, k ? k.z : 0); e.persistent = true; dragonPhase(e, 'hold');
  if (k && k.hp > 0) e.hp = Math.min(e.def.hp, k.hp); // (the fight goes on where it was left)
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

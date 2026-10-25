// Hostile mobs that were missing: phantoms (insomnia), cave spiders (mineshaft spawners), witches, and the illagers
// (pillagers, vindicators, evokers with fangs and vexes, ravagers) with patrols, outposts, bad omen and raids.

// ---------- phantoms ----------
const PHANTOM_M = autoModel(() => [
  ['body', [0, 0, 0], [-3, 0, -4, 5, 3, 9], 0x3a4a7a],
  ['head', [0, 0, 0], [-3.5, 0, -9, 7, 3, 5], 0x3a4a7a, 0, { front: (g, x, y) => { px(g, x, y + 1, '#7aff5a', 2, 1); px(g, x + 5, y + 1, '#7aff5a', 2, 1); } }],
  ['rwing', [2, 2, -3], [0, 0, 0, 10, 1, 9], (k, x, y) => hex((x + y) % 4 ? 0x4a5a8a : 0x2a3a6a)], ['lwing', [-3, 2, -3], [-10, 0, 0, 10, 1, 9], (k, x, y) => hex((x + y) % 4 ? 0x4a5a8a : 0x2a3a6a)],
  ['tail', [0, 1, 5], [-1.5, 0, 0, 3, 2, 6], 0x3a4a7a], ['tail2', [0, 1, 11], [-0.5, 0, 0, 1, 1, 6], 0x3a4a7a],
]);
function phantomAI(e, dist) {
  const ok = plTargetable();
  // circles above the player, then swoops down to bite; cats scare phantoms off
  if (!e.anchor || e.age % 200 === 0) e.anchor = [PL.x, PL.y + 12 + Math.random() * 6, PL.z];
  if (e.swoop > 0 && ok && !catNear(e, 16)) {
    e.swoop--; const dx = PL.x - e.x, dy = PL.y + 1 - e.y, dz = PL.z - e.z, l = Math.hypot(dx, dy, dz) || 1;
    e.vx += (dx / l * 0.45 - e.vx) * 0.2; e.vy += (dy / l * 0.45 - e.vy) * 0.2; e.vz += (dz / l * 0.45 - e.vz) * 0.2;
    if (dist < 1.6 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, 2, dx / l, dz / l); e.swoop = 0; }
    if (e.hitH) e.swoop = 0;
  } else {
    e.ang = (e.ang || Math.random() * 6) + 0.04;
    const [ax, ay, az] = e.anchor, gx = ax + Math.cos(e.ang) * 10, gz = az + Math.sin(e.ang) * 10, dx = gx - e.x, dy = ay - e.y, dz = gz - e.z, l = Math.hypot(dx, dy, dz) || 1;
    e.vx += (dx / l * 0.3 - e.vx) * 0.1; e.vy += (dy / l * 0.2 - e.vy) * 0.1; e.vz += (dz / l * 0.3 - e.vz) * 0.1;
    if (ok && Math.random() < 1 / 120 && !catNear(e, 16)) { e.swoop = 60; play('ghast', { pitch: 1.8, vol: 0.4 }); }
  }
  e.yawTarget = Math.atan2(-e.vx, -e.vz); turn(e, 0.3); physMove(e, e.vx, e.vy, e.vz, 0);
  if (!e.persistent && dist > 96) removeEnt(e);
}
function phantomAnim(e, P, now) { const f = Math.sin(now / 120 + e.id) * 0.5; if (P.rwing) { P.rwing.rotation.z = f; P.lwing.rotation.z = -f; } e.mesh.rotation.x = Math.max(-0.7, Math.min(0.7, e.vy * 2)); }
// insomnia: three days without sleep and phantoms come at night, more the longer you stay up
function trySpawnPhantoms() {
  if (!gr('doInsomnia') || W.dim !== 0 || PL.difficulty === 0 || PL.dead || spectator() || dayFactor() > 0.3 || (PL.rest || 0) < 72000 || PL.y < S.SEA) return;
  if ((getLight(Math.floor(PL.x), Math.floor(PL.y + 1.8), Math.floor(PL.z)) >> 4) < 15) return; // only under the open sky
  if (Math.random() > Math.min(0.9, ((PL.rest || 0) - 72000) / 72000 + 0.15)) return;
  const n = 1 + Math.floor(Math.random() * (PL.difficulty + 1));
  for (let i = 0; i < n; i++) spawnMob('phantom', PL.x + (Math.random() - .5) * 20, PL.y + 20 + Math.random() * 14, PL.z + (Math.random() - .5) * 20);
}

// ---------- cave spiders ----------
const CAVE_SPIDER_TEX = () => mobCanvas(g => { const r = r4(); paintBox(g, 0, 12, 10, 8, 12, () => hex(0x1e3a44), r, .2); paintBox(g, 0, 0, 6, 6, 6, () => hex(0x18303a), r, .2);
  paintBox(g, 32, 4, 8, 8, 8, () => hex(0x18303a), r, .2, { front: (g, x, y) => { px(g, x + 1, y + 2, '#d01818', 2, 1); px(g, x + 5, y + 2, '#d01818', 2, 1); px(g, x + 2, y + 4, '#d01818'); px(g, x + 5, y + 4, '#d01818'); } });
  paintBox(g, 18, 0, 16, 2, 2, () => hex(0x14262e), r, .2); });

// ---------- witches ----------
const ILLAGER_BODY = (skin, coat, coat2, extra = []) => [
  ['head', [0, 24, 0], [-4, 0, -4, 8, 10, 8], skin, 0, { front: (g, x, y) => { px(g, x + 1, y + 4, '#2a2a2a', 2, 1); px(g, x + 5, y + 4, '#2a2a2a', 2, 1); px(g, x + 2, y + 3, '#3a3a3a', 4, 1); } }],
  ['nose', [0, 24, 0], [-1, 1, -6, 2, 4, 2], skin],
  ['body', [0, 24, 0], [-4, -12, -3, 8, 12, 6], (k, x, y) => hex(y > 9 ? coat2 : coat)],
  ['rarm', [5, 22, 0], [-2, -10, -2, 4, 12, 4], coat], ['larm', [-5, 22, 0], [-2, -10, -2, 4, 12, 4], coat],
  ['rleg', [2, 12, 0], [-2, -12, -2, 4, 12, 4], coat2], ['lleg', [-2, 12, 0], [-2, -12, -2, 4, 12, 4], coat2],
  ...extra,
];
const WITCH_M = autoModel(() => ILLAGER_BODY(0x9a8a6a, 0x3a2a4a, 0x2a1a34, [
  ['hat', [0, 24, 0], [-5, 10, -5, 10, 2, 10], 0x1a1a1a], ['hat2', [0, 24, 0], [-3, 12, -3, 6, 4, 6], 0x1a1a1a], ['hat3', [0, 24, 0], [-1.5, 16, -1.5, 3, 3, 3], 0x1a1a1a],
  ['wart', [0, 24, 0], [0, 2, -7, 1, 1, 1], 0x5a8a3a],
]), 128, 64);
const WITCH_THROW = { slowness: 'slowness', poison: 'poison', harming: 'harming', weakness: 'weakness' };
function witchAI(e, dist) {
  if (e.target && (e.target.dead || (e.target === PL && (!plTargetable() || dist > 20)))) e.target = null;
  if (!e.target && plTargetable() && dist < 16 && canSee(e.x, e.y + 1.6, e.z, PL.x, PL.y + 1.4, PL.z)) e.target = PL;
  // drinks healing when hurt, fire resistance when burning
  if (e.drinkT > 0) { if (--e.drinkT === 0) { if (e.drinking === 'healing') e.hp = Math.min(e.def.hp, e.hp + 4); else if (e.drinking === 'fire_resistance') e.fire = 0; play('burp'); } walkPhysics(e, 0, 0, 0); return; }
  if (e.hp < e.def.hp / 2 && Math.random() < 0.02) { e.drinkT = 32; e.drinking = 'healing'; return; }
  if (e.fire > 0 && Math.random() < 0.1) { e.drinkT = 32; e.drinking = 'fire_resistance'; return; }
  let mx = 0, mz = 0;
  const t = e.target;
  if (t) {
    const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz) || 1; faceTo(e, t.x, t.z);
    if (d > 8) [mx, mz] = pathDir(e, t.x, t.y, t.z); else if (d < 4) { mx = -dx / d; mz = -dz / d; }
    if (e.attackCd <= 0 && d < 10) {
      e.attackCd = 60;
      const te = t === PL ? PL : t, hasEff = k => te.eff && te.eff[k];
      const k = t !== PL ? 'harming' : d >= 8 && !hasEff('slowness') ? 'slowness' : PL.health >= 8 && !hasEff('poison') ? 'poison' : d <= 3 && !hasEff('weakness') && Math.random() < 0.25 ? 'weakness' : 'harming';
      const pid = POTION[k] && POTION[k].items.splash; if (pid != null) {
        const ty = (t === PL ? PL.y + 1.1 : t.y + t.h / 2) - (e.y + 1.5), hd = Math.hypot(dx, dz), v = 0.75;
        const a = shootArrow(e.x + dx / d * 0.6, e.y + 1.5, e.z + dz / d * 0.6, dx / d * v, (ty + hd * 0.2) / Math.max(1, hd) * v + 0.1, dz / d * v, e, 0);
        a.thrown = pid; scene.remove(a.mesh); a.mesh = R.itemMesh(pid); a.mesh.scale.setScalar(0.3); scene.add(a.mesh);
      }
    }
  } else {
    if (!e.goal && Math.random() < 1 / 100) e.goal = [e.x + (Math.random() - .5) * 12, e.z + (Math.random() - .5) * 12];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
    if (e.raid) raidMarch(e);
  }
  walkPhysics(e, e.raidMove ? e.raidMove[0] : mx, e.raidMove ? e.raidMove[1] : mz, 0.07); e.raidMove = null;
}

// ---------- illagers ----------
const PILLAGER_M = autoModel(() => ILLAGER_BODY(0x9aa0a0, 0x3a3a44, 0x5a4a34), 128, 64);
const VINDICATOR_M = autoModel(() => ILLAGER_BODY(0x9aa0a0, 0x2a2a2a, 0x3a5a5a), 128, 64);
const EVOKER_M = autoModel(() => ILLAGER_BODY(0x9aa0a0, (k, x, y) => hex(x === 3 || x === 4 ? 0xd8b030 : 0x1a1a1a), 0x1a1a1a), 128, 64);
const VEX_M = autoModel(() => [
  ['body', [0, 0, 0], [-2, 3, -1, 4, 5, 2], 0x9ab0c0], ['head', [0, 0, 0], [-2.5, 8, -2.5, 5, 5, 5], 0xb8c8d8, 0, { front: (g, x, y) => { px(g, x + 1, y + 2, '#202020'); px(g, x + 3, y + 2, '#202020'); } }],
  ['rwing', [1, 7, 1], [0, -3, 0, 0.1, 5, 8], () => [220, 230, 240]], ['lwing', [-1, 7, 1], [0, -3, 0, 0.1, 5, 8], () => [220, 230, 240]],
  ['arm', [2.5, 7, 0], [0, -4, -1, 1, 4, 1], 0x9ab0c0], ['tailv', [0, 3, 0], [-1, -3, -1, 2, 3, 2], 0x8aa0b0],
]);
const RAVAGER_M = autoModel(() => [
  ['body', [0, 0, 0], [-7, 13, -10, 14, 16, 20], (k) => hex(k === 'bottom' ? 0x4a4a4a : 0x6a6a6a)],
  ['head', [0, 0, 0], [-8, 18, -24, 16, 16, 14], 0x5a5a5a, 0, { front: (g, x, y) => { px(g, x + 2, y + 4, '#101010', 3, 2); px(g, x + 11, y + 4, '#101010', 3, 2); px(g, x + 4, y + 10, '#2a2a2a', 8, 3); } }],
  ['horn1', [0, 0, 0], [-10, 30, -18, 2, 6, 2], 0x3a3434], ['horn2', [0, 0, 0], [8, 30, -18, 2, 6, 2], 0x3a3434],
  ['jaw', [0, 0, 0], [-6, 16, -26, 12, 3, 10], 0x4a4444],
  ['rleg', [4, 13, -6], [-3, -13, -3, 6, 13, 6], 0x5a5a5a], ['lleg', [-4, 13, -6], [-3, -13, -3, 6, 13, 6], 0x5a5a5a],
  ['rleg2', [4, 13, 7], [-3, -13, -3, 6, 13, 6], 0x5a5a5a], ['lleg2', [-4, 13, 7], [-3, -13, -3, 6, 13, 6], 0x5a5a5a],
], 128, 128);
const IS_RAIDER = new Set(['pillager', 'vindicator', 'evoker', 'ravager', 'witch', 'illusioner']);
// whom illagers fight: the player, villagers, iron golems (and, in a raid, anything of the village)
function illagerTarget(e, dist, range = 16) {
  if (e.target && (e.target.dead || e.target.deathT || (e.target === PL && (!plTargetable() || dist > 32)))) e.target = null;
  if (e.target || e.age % 20) return;
  if (plTargetable() && dist < range && !effLv(PL, 'invisibility') && canSee(e.x, e.y + 1.6, e.z, PL.x, PL.y + 1.4, PL.z)) { e.target = PL; return; }
  let best = null, bd = range;
  for (const o of ENT) if (o.kind === 'mob' && !o.dead && !o.deathT && (o.type === 'villager' || o.type === 'iron_golem')) { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; best = o; } }
  e.target = best;
}
function hitTarget(e, t, dmg, kx, kz) { if (t === PL) attackPlayer(e, dmg, kx, kz); else hurtMob(t, dmg, e, kx, kz); }
function illagerAI(e, dist) {
  const d = e.def; illagerTarget(e, dist);
  if (e.yell > 0) e.yell--;
  let mx = 0, mz = 0, sp = d.speed;
  const t = e.target;
  if (t) {
    const dx = t.x - e.x, dz = t.z - e.z, td = Math.hypot(dx, dz) || 1, ty = t === PL ? PL.y : t.y; faceTo(e, t.x, t.z);
    if (d.crossbow) { // pillagers keep their distance and shoot
      if (td > 9) [mx, mz] = pathDir(e, t.x, ty, t.z); else if (td < 5) { mx = -dx / td; mz = -dz / td; }
      if (e.attackCd <= 0 && td < 16 && canSee(e.x, e.y + 1.6, e.z, t.x, ty + 1.2, t.z)) {
        e.attackCd = 40 + Math.floor(Math.random() * 20); play('bow');
        const sy = e.y + 1.5, ddy = ty + (t === PL ? PL.h : t.h) / 3 - sy, v = 1.9, l = Math.hypot(dx, ddy + td * 0.12, dz);
        const a = shootArrow(e.x + dx / td * 0.6, sy, e.z + dz / td * 0.6, dx / l * v, (ddy + td * 0.12) / l * v, dz / l * v, e, 1.5); a.noPickup = true;
      }
    } else if (d.evoker) {
      if (td < 8) { mx = -dx / td; mz = -dz / td; } else if (td > 12) [mx, mz] = pathDir(e, t.x, ty, t.z);
      if (e.attackCd <= 0 && td < 16) {
        e.attackCd = 100; e.cast = 20;
        const vexes = ENT.filter(o => o.type === 'vex' && !o.dead && o.owner2 === e).length;
        if (vexes < 3 && Math.random() < 0.4) { play('portal', { vol: 0.5 }); for (let i = 0; i < 3; i++) { const v = spawnMob('vex', e.x + (Math.random() - .5) * 2, e.y + 1.5, e.z + (Math.random() - .5) * 2); v.owner2 = e; v.life = 600 + Math.floor(Math.random() * 1800); v.target = t; } }
        else evokerFangs(e, t);
      }
    } else { // vindicators and ravagers fight hand to hand
      [mx, mz] = pathDir(e, t.x, ty, t.z); sp = d.speed * (d.ravager ? 1.2 : 1.3);
      if (td < e.w + (t.w || 0.3) + (d.ravager ? 1.6 : 1.1) && Math.abs(ty - e.y) < 2.5 && e.attackCd <= 0) { e.attackCd = d.ravager ? 30 : 20; e.swing = 10; hitTarget(e, t, d.dmg, dx / td, dz / td); if (d.ravager && t !== PL) { t.vx += dx / td * 1.2; t.vy = 0.5; t.vz += dz / td * 1.2; } }
    }
    if (!e.yell && Math.random() < 0.01) { e.yell = 200; play('hmm', { pitch: 0.6, vol: 0.6 }); }
  } else if (e.raid) raidMarch(e);
  else {
    if (!e.goal && Math.random() < 1 / 120) e.goal = [e.x + (Math.random() - .5) * 14, e.z + (Math.random() - .5) * 14];
    if (e.patrolGoal && !e.captain) { const cap = e.patrolGoal; e.goal = [cap.x + (Math.random() - .5) * 4, cap.z + (Math.random() - .5) * 4]; if (cap.dead) e.patrolGoal = null; }
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  if (e.raidMove) { [mx, mz] = e.raidMove; e.raidMove = null; }
  // ravagers trample crops and tear through leaves
  if (d.ravager && e.hitH) { const fx = Math.floor(e.x + Math.sign(e.vx || mx) * 1.2), fz = Math.floor(e.z + Math.sign(e.vz || mz) * 1.2); for (let dy = 0; dy < 3; dy++) { const b = getBlock(fx, Math.floor(e.y) + dy, fz); if (S.LEAF[b] || RTYPE[b] === RT.CROP) { breakNaturally(fx, Math.floor(e.y) + dy, fz, b, getMeta(fx, Math.floor(e.y) + dy, fz)); } } }
  if (e.cast > 0) { e.cast--; mx = mz = 0; if (e.age % 2) R.simpleParticle(e.x, e.y + 2.2, e.z, [0.6, 0.5, 0.9], { size: 0.12, vy: 0.5, grav: 0 }); }
  walkPhysics(e, mx, mz, sp);
}
function illagerAnim(e, P) {
  if (P.rarm) {
    if (e.def.crossbow && e.target) { P.rarm.rotation.x = -Math.PI / 2; P.larm.rotation.x = -Math.PI / 2; P.larm.rotation.y = 0.5; }
    else if (e.cast > 0) { P.rarm.rotation.z = 2.2; P.larm.rotation.z = -2.2; P.rarm.rotation.x = P.larm.rotation.x = 0; }
    else { P.rarm.rotation.z = P.larm.rotation.z = 0; P.larm.rotation.y = 0; if (e.swing > 0) { P.rarm.rotation.x = -1.6 * Math.sin(e.swing / 10 * Math.PI); e.swing--; } else if (!e.target) { P.rarm.rotation.x = -0.6; P.larm.rotation.x = -0.6; } }
  }
}
// held items: a crossbow for pillagers, an iron axe for vindicators; the patrol captain wears the ominous banner
function illagerGear(e) {
  const P = e.mesh.userData.parts, held = e.def.crossbow ? IID.crossbow : e.type === 'vindicator' ? IID.iron_axe : null;
  if (held != null && P.rarm && !P.heldItem) { const m = R.itemMesh(held); m.scale.setScalar(0.6); m.position.set(0, -0.6, -0.15); m.rotation.set(-Math.PI / 2, 0, Math.PI / 4); P.rarm.add(m); P.heldItem = m; }
  if (e.captain && P.head && !P.banner) { const st = ominousBanner(); const b = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), new THREE.MeshBasicMaterial({ map: bannerTexture(0, st.bp), side: THREE.DoubleSide })); b.position.set(0, 0.4, 0.3); P.head.add(b); P.banner = b; }
}
// evoker fangs: a row of jaws snapping up from the ground toward the target
function evokerFangs(e, t) {
  const dx = t.x - e.x, dz = t.z - e.z, l = Math.hypot(dx, dz) || 1;
  for (let i = 1; i <= 12; i++) {
    const x = e.x + dx / l * i * 1.25, z = e.z + dz / l * i * 1.25; let y = Math.floor(e.y) + 2;
    while (y > e.y - 4 && !SOLID[getBlock(Math.floor(x), y - 1, Math.floor(z))]) y--;
    spawnFang(x, y, z, i * 2, e);
  }
}
const fangGeo = new THREE.BoxGeometry(0.5, 0.6, 0.25), fangMat = new THREE.MeshBasicMaterial({ color: 0x8a9a9a });
function spawnFang(x, y, z, delay, owner) {
  const e = Ent('fang', x, y, z); e.kind = 'fang'; e.delay = delay; e.owner = owner;
  e.mesh = new THREE.Group(); for (const s of [-1, 1]) { const m = new THREE.Mesh(fangGeo, fangMat.clone()); m.position.set(0, 0.3, s * 0.15); e.mesh.add(m); } e.mesh.visible = false;
  e.tick = f => {
    if (--f.delay > 0) return;
    f.mesh.visible = true;
    if (f.delay === 0) { play('click', { pitch: 0.5 }); const hit = o => Math.abs(o.x - f.x) < 0.6 + (o.w || 0.3) && Math.abs(o.z - f.z) < 0.6 + (o.w || 0.3) && o.y < f.y + 0.8 && o.y + (o.h || 1.8) > f.y;
      if (plTargetable() && hit(PL)) hurtPlayer(6, 'magic', f.owner);
      for (const o of ENT) if (o.kind === 'mob' && !o.dead && !IS_RAIDER.has(o.type) && o.type !== 'vex' && hit(o)) hurtMob(o, 6, f.owner); }
    if (f.delay < -20) removeEnt(f);
  };
  e.render = (f, rx, ry, rz, br) => { const k = Math.min(1, Math.max(0, -f.delay / 6)), up = f.delay < -14 ? (20 + f.delay) / 6 : 1; f.mesh.position.set(rx, ry - 0.6 + 0.6 * Math.min(k, up), rz); f.mesh.children.forEach((m, i) => { m.rotation.x = (i ? -1 : 1) * (1 - k) * 0.8; m.material.color.setScalar(br); }); };
  return addEnt(e);
}
// vexes fly through walls and die after a while
function vexAI(e, dist) {
  if (e.life != null && --e.life <= 0) { hurtMob(e, 99, null); return; }
  if (!e.target || e.target.dead) e.target = plTargetable() && dist < 24 ? PL : null;
  const t = e.target, tx = t ? t.x : e.x + (Math.random() - .5) * 4, ty = t ? (t === PL ? PL.y + 1 : t.y + t.h / 2) : e.y, tz = t ? t.z : e.z + (Math.random() - .5) * 4;
  const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, l = Math.hypot(dx, dy, dz) || 1;
  e.vx += (dx / l * 0.25 - e.vx) * 0.15; e.vy += (dy / l * 0.25 - e.vy) * 0.15; e.vz += (dz / l * 0.25 - e.vz) * 0.15;
  e.x += e.vx; e.y += e.vy; e.z += e.vz; e.yawTarget = Math.atan2(-dx, -dz); turn(e, 0.4);
  if (t && l < 1.2 && e.attackCd <= 0) { e.attackCd = 20; hitTarget(e, t, 9, dx / l, dz / l); }
}
function vexAnim(e, P, now) { const f = Math.sin(now / 30) * 0.5; if (P.rwing) { P.rwing.rotation.y = 0.6 + f; P.lwing.rotation.y = -0.6 - f; } }

// ---------- bad omen, patrols ----------
function illagerDeath(e) {
  if (e.captain) {
    if (Math.random() < 1) dropStack(e.x, e.y + .5, e.z, ominousBanner());
    if (e.lastHurtBy === PL || e.killedByPlayer) { const lv = PL.eff && PL.eff.bad_omen ? Math.min(4, PL.eff.bad_omen.lv + 1) : 0; addEffect(PL, 'bad_omen', 120000, lv); }
  }
  if (e.raid && W.raid) W.raid.alive.delete(e.id);
}
function spawnPatrol(x, z, n) {
  const y = topY(Math.floor(x), Math.floor(z)) + 1, cap = spawnMob('pillager', x, y, z, { captain: true });
  for (let i = 1; i < n; i++) { const p = spawnMob(Math.random() < 0.25 ? 'vindicator' : 'pillager', x + (Math.random() - .5) * 4, y, z + (Math.random() - .5) * 4); p.patrolGoal = cap; }
  return cap;
}
// after day 5, every 10-11 minutes a patrol may turn up 24-48 blocks away (not in villages, not underground)
function trySpawnPatrol() {
  if (W.dim !== 0 || PL.difficulty === 0 || W.time < 5 * 24000 || W.raid || PL.dead || spectator()) return;
  if (Math.random() > 0.2) return;
  if (ENT.some(e => e.type === 'villager' && !e.dead && Math.hypot(e.x - PL.x, e.z - PL.z) < 64)) return;
  const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 24, x = Math.floor(PL.x + Math.cos(a) * r), z = Math.floor(PL.z + Math.sin(a) * r);
  if (!isLoaded(x, z) || topY(x, z) < S.SEA || (getLight(x, topY(x, z) + 1, z) >> 4) < 15) return;
  spawnPatrol(x + .5, z + .5, 2 + Math.floor(Math.random() * (PL.difficulty + 2)));
}
// pillager outposts keep spawning pillagers around them
function outpostSpawn() {
  if (W.dim !== 0 || PL.difficulty === 0) return;
  const G = W.genCache || (W.genCache = S.makeGen(W.seed)), rx = Math.floor((PL.x >> 4) / S.OREG), rz = Math.floor((PL.z >> 4) / S.OREG);
  for (let i = rx - 1; i <= rx + 1; i++) for (let j = rz - 1; j <= rz + 1; j++) {
    const o = S.outpostAt(W.seed, G, i, j); if (!o || Math.hypot(o.x - PL.x, o.z - PL.z) > 80 || Math.hypot(o.x - PL.x, o.z - PL.z) < 20) continue;
    if (countMobs(e => e.type === 'pillager' && Math.hypot(e.x - o.x, e.z - o.z) < 40) >= 6) continue;
    const x = Math.floor(o.x + (Math.random() - .5) * 40), z = Math.floor(o.z + (Math.random() - .5) * 40); if (!isLoaded(x, z)) continue;
    const y = topY(x, z) + 1; if (SOLID[getBlock(x, y, z)]) continue;
    spawnMob('pillager', x + .5, y, z + .5).persistent = true;
  }
}

// ---------- raids ----------
// waves by difficulty (easy 3, normal 5, hard 7) plus one bonus wave for bad omen II+; the columns are waves 1-8
const RAID_WAVES = { pillager: [4, 3, 3, 4, 4, 4, 2, 5], vindicator: [0, 2, 0, 1, 4, 2, 5, 5], ravager: [0, 0, 1, 0, 1, 0, 2, 2], witch: [0, 0, 0, 3, 0, 0, 1, 1], evoker: [0, 0, 0, 0, 1, 1, 2, 2] };
let raidEl = null;
function raidBar() {
  const R0 = W.raid;
  if (!raidEl) { raidEl = document.createElement('div'); raidEl.id = 'raidbar'; raidEl.className = 'bossbar2'; raidEl.innerHTML = '<div class="bn"></div><div class="bb"><i></i></div>'; document.body.appendChild(raidEl); }
  const show = R0 && Math.hypot(PL.x - R0.x, PL.z - R0.z) < 96; raidEl.hidden = !show; if (!show) return;
  const n = R0.alive.size, tot = R0.waveTotal || 1;
  raidEl.querySelector('.bn').textContent = R0.state === 'won' ? '습격 - 승리' : R0.state === 'lost' ? '습격 - 패배' : R0.state === 'wait' ? `습격 (${R0.wave}/${R0.waves})` : `습격 - 습격자 ${n}명 남음`;
  raidEl.querySelector('i').style.width = (R0.state === 'active' ? n / tot * 100 : R0.state === 'wait' ? Math.min(100, (300 - R0.t) / 3) : 0) + '%';
}
const VBEDS = trackBlocks(BID.red_bed), VBELLS = trackBlocks(BID.bell);
function villageCentre() { // as in Java, a village is its points of interest: a bell (the meeting point) or beds near the player
  const near = set => [...set].map(k => k.split(',').map(Number)).filter(([x, , z]) => Math.hypot(x - PL.x, z - PL.z) < 48);
  const bells = near(VBELLS); if (bells.length) { const [x, y, z] = bells[0]; return [x + .5, y, z + .5]; }
  const beds = near(VBEDS); if (!beds.length) return null;
  return [beds.reduce((a, b) => a + b[0], 0) / beds.length + .5, beds.reduce((a, b) => a + b[1], 0) / beds.length, beds.reduce((a, b) => a + b[2], 0) / beds.length + .5];
}
function raidTick() {
  if (W.dim !== 0) return;
  const omen = PL.eff && PL.eff.bad_omen;
  if (!W.raid && omen && PL.difficulty > 0 && W.tickN % 20 === 0) {
    const c = villageCentre();
    if (c) { const lv = omen.lv + 1; delete PL.eff.bad_omen; UI.hudDirty = true; W.raid = { x: c[0], y: c[1], z: c[2], level: lv, waves: [0, 3, 5, 7][PL.difficulty] + (lv > 1 ? 1 : 0), wave: 0, state: 'wait', t: 300, alive: new Set(), waveTotal: 0, age: 0 }; play('thunder', { vol: 0.3 }); UI.flash('습격이 시작되었습니다!'); }
  }
  const R0 = W.raid; if (!R0) { if (raidEl) raidEl.hidden = true; return; }
  R0.age++;
  if (R0.state === 'won' || R0.state === 'lost') { if (--R0.t <= 0) W.raid = null; raidBar(); return; }
  if (Math.hypot(PL.x - R0.x, PL.z - R0.z) > 160 || R0.age > 48000) { W.raid = null; raidBar(); return; } // abandoned
  // lost when no villagers are left around the centre
  if (R0.age % 40 === 0 && !ENT.some(e => e.type === 'villager' && !e.dead && !e.deathT && Math.hypot(e.x - R0.x, e.z - R0.z) < 64)) { R0.state = 'lost'; R0.t = 200; UI.flash('습격 패배'); raidBar(); return; }
  for (const id of R0.alive) { const e = ENT.find(o => o.id === id); if (!e || e.dead) R0.alive.delete(id); }
  if (R0.state === 'active' && !R0.alive.size) {
    if (R0.wave >= R0.waves) { R0.state = 'won'; R0.t = 300; addEffect(PL, 'hero_of_the_village', 48000, Math.min(4, R0.level - 1)); UI.flash('습격 승리! 마을의 영웅'); play('levelup'); UI.advance && UI.advance('raid'); }
    else { R0.state = 'wait'; R0.t = 300; }
  }
  if (R0.state === 'wait' && --R0.t <= 0) raidWave(R0);
  if (R0.age % 10 === 0) raidBar();
}
function raidWave(R0) {
  R0.wave++; R0.state = 'active';
  const w = Math.min(7, R0.wave - 1), easy = PL.difficulty === 1;
  let sx = 0, sz = 0;
  for (let k = 0; k < 20; k++) { const a = Math.random() * Math.PI * 2; sx = Math.floor(R0.x + Math.cos(a) * 32); sz = Math.floor(R0.z + Math.sin(a) * 32); if (isLoaded(sx, sz) && topY(sx, sz) > 1) break; }
  play('ghast', { pitch: 0.4, vol: 0.6 }); // the raid horn
  for (const [t, counts] of Object.entries(RAID_WAVES)) {
    let n = counts[w]; if (easy && t !== 'ravager') n = Math.ceil(n * 0.6); if (easy && t === 'evoker') n = 0;
    for (let i = 0; i < n; i++) { const x = sx + (Math.random() - .5) * 6, z = sz + (Math.random() - .5) * 6, e = spawnMob(t, x + .5, topY(Math.floor(x), Math.floor(z)) + 1, z + .5); e.raid = true; e.persistent = true; R0.alive.add(e.id); if (i === 0 && t === 'pillager' && R0.wave === 1) e.captain = true; }
  }
  R0.waveTotal = R0.alive.size;
}
// raiders without a target walk to the village; late in a wave the last ones are revealed
function raidMarch(e) {
  const R0 = W.raid; if (!R0) { e.raid = false; return; }
  const gx = R0.x - e.x, gz = R0.z - e.z, gl = Math.hypot(gx, gz);
  if (gl > 4) { const [mx, mz] = pathDir(e, R0.x, R0.y, R0.z); e.raidMove = [mx, mz]; e.yawTarget = Math.atan2(-gx, -gz); }
  else if (!e.goal) e.goal = [R0.x + (Math.random() - .5) * 30, R0.z + (Math.random() - .5) * 30];
  if (R0.alive.size <= 2 && R0.age % 40 === 0) addEffect(e, 'glowing', 60, 0);
}
// villagers flee from raiders
function villagerFlee(e) {
  if (e.age % 10) return;
  const r = ENT.find(o => o.kind === 'mob' && !o.dead && (IS_RAIDER.has(o.type) || o.type === 'vex' || o.type === 'zombie') && Math.hypot(o.x - e.x, o.z - e.z) < 8);
  if (r) { const dx = e.x - r.x, dz = e.z - r.z, l = Math.hypot(dx, dz) || 1; e.panic = 20; e.goal = [e.x + dx / l * 8, e.z + dz / l * 8]; }
}
// hero of the village: cheaper trades (30% plus 6.25% per level, at least one item)
function tradePrice(o) { const h = PL.eff && PL.eff.hero_of_the_village; return h ? Math.max(1, Math.floor(o.an * (1 - 0.3 - 0.0625 * h.lv))) : o.an; }

const ILL = (m, o) => ({ tw: 128, th: 64, hp: 24, w: 0.3, h: 1.95, speed: 0.1, hostile: 1, xp: 5, snd: 'hmm', raider: 1, parts: m.parts, tex: () => m.tex(0), ai: illagerAI, anim: illagerAnim, onDeath: illagerDeath,
  init: (e, opts) => { if (opts.captain) e.captain = true; illagerGear(e); }, save: e => ({ captain: !!e.captain }), ...o });
Object.assign(MOBDEF, {
  phantom: { hp: 20, w: 0.45, h: 0.5, speed: 0.2, hostile: 1, fly: 1, burn: 1, xp: 5, snd: 'ghast', drops: [['phantom_membrane', 0, 1]], parts: PHANTOM_M.parts, tex: () => PHANTOM_M.tex(0), ai: phantomAI, anim: phantomAnim, fallReduce: 99 },
  cave_spider: { ...MOBDEF.spider, hp: 12, w: 0.35, h: 0.5, scale: 0.7, tex: CAVE_SPIDER_TEX, onHitPlayer: () => { if (PL.difficulty >= 2) addEffect(PL, 'poison', PL.difficulty === 3 ? 300 : 140, 0); } },
  witch: { tw: 128, th: 64, hp: 26, w: 0.3, h: 1.95, speed: 0.07, hostile: 1, xp: 5, snd: 'hmm', raider: 1, parts: WITCH_M.parts, tex: () => WITCH_M.tex(0), ai: witchAI, anim: illagerAnim, onDeath: illagerDeath,
    drops: [['glass_bottle', 0, 1], ['glowstone_dust', 0, 1], ['gunpowder', 0, 1], ['redstone', 0, 1], ['spider_eye', 0, 1], ['sugar', 0, 1], ['stick', 0, 1]] },
  pillager: ILL(PILLAGER_M, { crossbow: 1, drops: [], extraDrop: [['crossbow', 0.085]] }),
  vindicator: ILL(VINDICATOR_M, { dmg: 13, speed: 0.1, axe: 1, drops: [['emerald', 0, 1]], extraDrop: [['iron_axe', 0.085]] }),
  evoker: ILL(EVOKER_M, { evoker: 1, xp: 10, drops: [['totem_of_undying', 1, 1], ['emerald', 0, 1]] }),
  ravager: { hp: 100, w: 0.98, h: 2.2, speed: 0.1, hostile: 1, xp: 20, snd: 'growl', raider: 1, ravager: 1, dmg: 12, kbRes: 1, drops: [['saddle', 1, 1]], parts: RAVAGER_M.parts, tw: 128, th: 128, tex: () => RAVAGER_M.tex(0), ai: illagerAI, onDeath: illagerDeath },
  vex: { hp: 14, w: 0.2, h: 0.8, speed: 0.2, hostile: 1, xp: 3, snd: 'hmm', fly: 1, drops: [], parts: VEX_M.parts, tex: () => VEX_M.tex(0), ai: vexAI, anim: vexAnim, fallReduce: 99, fireproof: 1 },
});
MOBDEF.witch.extraDrop = null;

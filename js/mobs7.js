// The wither: built from four soul sand (or soul soil) in a T with three wither skeleton skulls on top. It charges up
// for 11 seconds, explodes, then flies after the player and other living mobs firing wither skulls. Below half health
// its armour turns arrows away. Drops a nether star (the beacon's ingredient).

const WITHER_M = autoModel(() => [
  ['shoulders', [0, 0, 0], [-10, 34, -1.5, 20, 3, 3], 0x2a2a2a],
  ['spine', [0, 0, 0], [-1.5, 16, -0.5, 3, 18, 3], 0x323232],
  ['rib1', [0, 0, 0], [-6, 30, -1, 12, 2, 2], 0x2a2a2a], ['rib2', [0, 0, 0], [-6, 26, -1, 12, 2, 2], 0x2a2a2a], ['rib3', [0, 0, 0], [-6, 22, -1, 12, 2, 2], 0x2a2a2a],
  ['tail', [0, 0, 0], [-1.5, 6, 0, 3, 10, 3], 0x323232],
  ['head', [0, 0, 0], [-4, 37, -4, 8, 8, 8], 0x1e1e1e, 0, { front: (g, x, y) => { px(g, x + 1, y + 3, '#000', 2, 2); px(g, x + 5, y + 3, '#000', 2, 2); px(g, x + 2, y + 6, '#3a3a3a', 4, 1); } }],
  ['head2', [0, 0, 0], [-12, 33, -3, 6, 6, 6], 0x1e1e1e, 0, { front: (g, x, y) => { px(g, x + 1, y + 2, '#000', 1, 2); px(g, x + 4, y + 2, '#000', 1, 2); } }],
  ['head3', [0, 0, 0], [6, 33, -3, 6, 6, 6], 0x1e1e1e, 0, { front: (g, x, y) => { px(g, x + 1, y + 2, '#000', 1, 2); px(g, x + 4, y + 2, '#000', 1, 2); } }],
  ['armor', [0, 0, 0], [-10, 16, -2, 20, 21, 4], (k, x, y) => (x + y) % 3 ? null : [120, 160, 255], 0.6],
], 128, 64);
const isSoul = b => b === BID.soul_sand || b === BID.soul_soil;
// a wither skeleton skull was placed at (x,y,z): look for the full T and summon
function witherCheck(x, y, z) {
  for (const [ax, az] of [[1, 0], [0, 1]]) for (let o = -1; o <= 1; o++) {
    const mx = x - ax * o, mz = z - az * o, row = [-1, 0, 1].map(k => [mx + ax * k, mz + az * k]);
    if (!row.every(([a, c]) => getBlock(a, y, c) === BID.wither_skeleton_skull && isSoul(getBlock(a, y - 1, c)))) continue;
    if (!isSoul(getBlock(mx, y - 2, mz))) continue;
    if (SOLID[getBlock(mx - ax, y - 2, mz - az)] || SOLID[getBlock(mx + ax, y - 2, mz + az)]) continue; // the corners under the arms must be clear
    for (const [a, c] of row) { setBlock(a, y, c, 0); setBlock(a, y - 1, c, 0); } setBlock(mx, y - 2, mz, 0);
    const w = spawnMob('wither', mx + .5, y - 2, mz + .5); w.charge = 220; w.hp = 1; w.persistent = true; play('ghast', { pitch: 0.3, vol: 1 });
    return true;
  }
  return false;
}
function witherAI(e, dist) {
  const d = e.def;
  // charging: grows its health, then explodes
  if (e.charge > 0) { e.charge--; e.hp = Math.min(d.hp, e.hp + d.hp / 220); e.mesh.rotation.y += 0.1; if (e.charge === 0) { explode(e.x, e.y + 1.5, e.z, 7); play('ghast', { pitch: 0.2 }); } bossBar(e, '위더'); return; }
  if (e.age % 20 === 0 && e.hp < d.hp) e.hp = Math.min(d.hp, e.hp + 1); // regenerates
  bossBar(dist < 64 ? e : null, '위더');
  if (e.target && (e.target.dead || e.target.deathT || (e.target === PL && (!plTargetable() || dist > 48)))) e.target = null;
  if (!e.target && e.age % 20 === 0) {
    if (plTargetable() && dist < 40) e.target = PL;
    else { let best = null, bd = 20; for (const o of ENT) if (o.kind === 'mob' && o !== e && !o.dead && !o.deathT && !UNDEAD.has(o.type) && o.type !== 'wither' && !o.def.boss) { const dd = Math.hypot(o.x - e.x, o.z - e.z); if (dd < bd) { bd = dd; best = o; } } e.target = best; }
  }
  const t = e.target, tx = t ? t.x : e.x, ty = t ? (t === PL ? PL.y : t.y) + 5 : e.y, tz = t ? t.z : e.z;
  // hover above the target, circling a little
  e.ang = (e.ang || 0) + 0.02;
  const gx = tx + Math.cos(e.ang) * 6, gz = tz + Math.sin(e.ang) * 6, dx = gx - e.x, dy = ty - e.y, dz = gz - e.z, l = Math.hypot(dx, dy, dz) || 1;
  e.vx += (dx / l * 0.25 - e.vx) * 0.08; e.vy += (dy / l * 0.2 - e.vy) * 0.08; e.vz += (dz / l * 0.25 - e.vz) * 0.08;
  if (t) { faceTo(e, t.x, t.z); turn(e, 0.2); }
  physMove(e, e.vx, e.vy, e.vz, 0);
  // stuck or hurt: smashes blocks around it (not bedrock, obsidian or end portal parts)
  if ((e.hitH || e.smash > 0) && e.age % 20 === 0) {
    e.smash = 0; let broke = false;
    for (let x = Math.floor(e.x - 1); x <= Math.floor(e.x + 1); x++) for (let y = Math.floor(e.y); y <= Math.floor(e.y + 3); y++) for (let z = Math.floor(e.z - 1); z <= Math.floor(e.z + 1); z++) {
      const b = getBlock(x, y, z); if (!b || FLUID[b] || b === BID.bedrock || b === BID.obsidian || b === BID.end_portal_frame || b === BID.crying_obsidian || BLOCKS[b].hard < 0) continue;
      breakNaturally(x, y, z, b, getMeta(x, y, z)); broke = true;
    }
    if (broke) play('explode', { vol: 0.5 });
  }
  // wither skulls: the middle head aims at the target, every 2 seconds; one in ten is a blue (dangerous) skull
  if (t && e.attackCd <= 0 && Math.hypot(t.x - e.x, t.z - e.z) < 32) {
    e.attackCd = 40;
    const sx = e.x, sy = e.y + 2.6, sz = e.z, ax = t.x - sx, ay = (t === PL ? PL.y + 1 : t.y + t.h / 2) - sy, az = t.z - sz, al = Math.hypot(ax, ay, az) || 1;
    spawnWitherSkull(sx, sy, sz, ax / al, ay / al, az / al, e, Math.random() < 0.1);
    if (Math.random() < 0.3) { e.attackCd2 = 10; }
  }
  if (e.attackCd2 > 0 && --e.attackCd2 === 0 && t) { const s = Math.random() < 0.5 ? -1 : 1, sx = e.x + s * 0.8, sy = e.y + 2.3, ax = t.x - sx, ay = (t === PL ? PL.y + 1 : t.y) - sy, az = t.z - e.z, al = Math.hypot(ax, ay, az) || 1; spawnWitherSkull(sx, sy, e.z, ax / al, ay / al, az / al, e, false); }
}
function witherAnim(e, P, now) {
  const armored = e.hp < e.def.hp / 2 && !(e.charge > 0);
  hidePart(e, 'armor', armored);
  if (P.tail) P.tail.rotation.x = 0.3 + Math.sin(now / 400) * 0.1;
  if (e.charge > 0) e.mesh.position.y += Math.sin(now / 50) * 0.05;
}
function witherHurt(e, dmg, attacker, src) {
  if (e.charge > 0 || e.inv > 0 || (!attacker && !src)) return false; // not while it charges up; fire and other unattributed damage do not hurt it, explosions (TNT) do
  e.hp -= dmg; e.hurt = 10; e.inv = 10; e.smash = 1; play('hurt', { vol: 0.8, pitch: 0.6 });
  if (attacker === PL) { e.target = PL; e.plHit = true; }
  if (e.hp <= 0) {
    e.deathT = 20; bossBar(null);
    explode(e.x, e.y + 1.5, e.z, 4); // the blast first, so it does not destroy the star
    dropItem(e.x, e.y + 1, e.z, IID.nether_star, 1); spawnXP(e.x, e.y + 1, e.z, 50); UI.advance && UI.advance('wither');
  }
  return true;
}
// wither skulls: fly straight, explode on contact, wither whatever they hit
const skullGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
function spawnWitherSkull(x, y, z, dx, dy, dz, owner, blue) {
  const e = Ent('wskull', x, y, z); e.kind = 'wskull'; e.owner = owner; e.blue = blue; e.w = 0.15; e.h = 0.3;
  const sp = blue ? 0.35 : 0.6; e.vx = dx * sp; e.vy = dy * sp; e.vz = dz * sp;
  e.mesh = new THREE.Mesh(skullGeo, new THREE.MeshBasicMaterial({ color: blue ? 0x6a8aff : 0x2a2a2a }));
  e.tick = witherSkullTick; e.render = (s, rx, ry, rz) => { s.mesh.position.set(rx, ry, rz); s.mesh.rotation.y += 0.2; };
  return addEnt(e);
}
function witherSkullTick(e) {
  if (e.age > 200) { removeEnt(e); return; }
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    const nx = e.x + e.vx / steps, ny = e.y + e.vy / steps, nz = e.z + e.vz / steps;
    let hit = SOLID[getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))] ? 'block' : null, who = null;
    if (!hit && plTargetable() && Math.abs(PL.x - nx) < 0.5 && Math.abs(PL.z - nz) < 0.5 && ny > PL.y && ny < PL.y + 1.8) { hit = 'ent'; who = PL; }
    if (!hit) for (const o of ENT) if (o.kind === 'mob' && o !== e.owner && !o.dead && Math.abs(o.x - nx) < o.w + .2 && Math.abs(o.z - nz) < o.w + .2 && ny > o.y && ny < o.y + o.h) { hit = 'ent'; who = o; break; }
    if (hit) {
      removeEnt(e);
      const dur = PL.difficulty === 3 ? 800 : PL.difficulty === 2 ? 200 : 0;
      if (who === PL) { hurtPlayer(8 * DIFF_MUL(), 'wither', e.owner); if (dur) addEffect(PL, 'wither', dur, 1); }
      else if (who) { hurtMob(who, 8, e.owner); if (dur) addEffect(who, 'wither', dur, 1); if (who.hp <= 0 && !who.dead) witherRose(who); }
      explode(e.x, e.y, e.z, e.blue ? 1.5 : 1);
      return;
    }
    e.x = nx; e.y = ny; e.z = nz;
  }
  if (e.age % 2 === 0) R.simpleParticle(e.x, e.y, e.z, [0.2, 0.2, 0.2], { size: 0.12, vy: 0, grav: 0, life: 0.4 });
}
function witherRose(mob) { // a mob killed by the wither leaves a wither rose
  const x = Math.floor(mob.x), y = Math.floor(mob.y), z = Math.floor(mob.z);
  if (!getBlock(x, y, z) && (getBlock(x, y - 1, z) === 2 || getBlock(x, y - 1, z) === 3)) setBlock(x, y, z, BID.flowers2, 8);
}

Object.assign(MOBDEF, {
  wither: { hp: 300, w: 0.45, h: 3.5, speed: 0.1, hostile: 1, boss: 1, xp: 0, snd: 'ghast', fly: 1, fireproof: 1, kbRes: 1, fallReduce: 999, drops: [], parts: WITHER_M.parts, tw: 128, th: 64, tex: () => WITHER_M.tex(0),
    ai: witherAI, anim: witherAnim, onHurt: witherHurt, arrowImmune: e => e.hp < e.def.hp / 2 },
});
MOBDEF.wither_skeleton.extraDrop = [['wither_skeleton_skull', 0.025]];

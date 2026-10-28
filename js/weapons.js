// Shield, crossbow and trident (Java Edition). There is no off hand, so the shield blocks while held in the
// main hand with the use button down.

// ---------- shield ----------
const shieldUp = () => USE.kind === 'shield' && USE.t >= 5 && !(PL.shieldCd > 0); // 5 ticks to raise it
// called by hurtPlayer: true when the hit came from the front and the shield took it
function shieldBlocks(dmg, cause, attacker, from) {
  if (!shieldUp() || (cause !== 'mob' && cause !== 'player' && cause !== 'arrow' && cause !== 'explosion' && cause !== 'fireball')) return false;
  const src = from || attacker; if (!src) return false;
  const dx = src.x - PL.x, dz = src.z - PL.z, l = Math.hypot(dx, dz) || 1, fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw);
  if ((dx * fx + dz * fz) / l < 0) return false; // only what is in front of you
  if (dmg >= 3) damageItem(INV.slots, INV.sel, 1 + Math.floor(dmg));
  play('hit', { vol: 0.7 }); play('door', { vol: 0.4 }); if (from && typeof advGrant === 'function') advGrant('story/deflect_arrow');
  if (attacker && attacker.kind === 'mob' && cause === 'mob') { attacker.vx += dx / l * 0.5; attacker.vz += dz / l * 0.5; if (attacker.def.axe) { PL.shieldCd = 100; USE.kind = null; play('break', { mat: 'wood' }); } } // axes knock the shield away for 5 s
  return true;
}

// ---------- crossbow ----------
const crossbowCharge = st => Math.max(0, 25 - 5 * enchLv(st, 'quick_charge'));
function crossbowRelease(h) { // let go of the button: load if fully drawn
  if (USE.t < crossbowCharge(h)) return;
  const fw = offItem(); if (fw && fw.id === IID.firework_rocket) { h.ch = IID.firework_rocket; h.chFw = fw.fw || { flight: 1 }; if (!creative()) { fw.n--; if (!fw.n) INV.off = null; } play('click', { pitch: 0.6 }); UI.hudDirty = true; return; } // a rocket in the off hand loads instead of an arrow
  const ai = arrowSlot(); if (ai < 0 && !creative()) return;
  const ast = ai >= 0 ? INV.slots[ai] : { id: IID.arrow, n: 1 };
  h.ch = ast.id; play('click', { pitch: 0.6 });
  if (!creative()) { ast.n--; if (!ast.n) INV.slots[ai] = null; }
  UI.hudDirty = true;
}
function crossbowFire(h) {
  const [dx, dy, dz] = lookDir(), ms = enchLv(h, 'multishot'), pierce = enchLv(h, 'piercing'), d = ITEMS[h.ch];
  const angles = ms ? [0, -0.17, 0.17] : [0];
  for (const a of angles) {
    const c = Math.cos(a), s = Math.sin(a), vx = dx * c - dz * s, vz = dx * s + dz * c;
    if (h.ch === IID.firework_rocket) { launchRocket(PL.x + vx * 0.6, PL.y + PL.eyeH - 0.1, PL.z + vz * 0.6, { fw: h.chFw }, false, [vx * 1.6, dy * 1.6, vz * 1.6]); continue; }
    const e = shootArrow(PL.x + vx * 0.4, PL.y + PL.eyeH - 0.1, PL.z + vz * 0.4, vx * 3.15, dy * 3.15, vz * 3.15, PL, 2);
    if (d && d.tipped != null) { e.potion = d.tipped; e.item = h.ch; }
    if (a) e.noPickup = true; // the extra multishot arrows cannot be picked up
    if (pierce) { e.pierce = pierce; e.hitSet = new Set(); }
    e.crossbow = true;
  }
  h.ch = null; h.chFw = null; play('bow'); if (typeof advGrant === 'function') advGrant('adventure/ol_betsy'); damageItem(INV.slots, INV.sel, ms ? 3 : 1); UI.hudDirty = true;
}

// ---------- trident ----------
const AQUATIC = new Set(['squid', 'glow_squid', 'cod', 'salmon', 'tropical_fish', 'axolotl', 'dolphin', 'turtle']);
function tridentRelease(h) {
  if (USE.t < 10) return;
  const rip = enchLv(h, 'riptide');
  if (rip) { // only works in water or rain: launches the player instead of the trident
    const wet = PL.inWater || (W.dim === 0 && W.rain > 0.5 && (getLight(Math.floor(PL.x), Math.floor(PL.y + 1.8), Math.floor(PL.z)) >> 4) === 15);
    if (!wet) return;
    const [dx, dy, dz] = lookDir(), v = 3 * (1 + rip) / 4;
    PL.vx = dx * v; PL.vy = dy * v + (PL.onGround ? 0.4 : 0); PL.vz = dz * v; PL.fallDist = 0; PL.riptideT = 20;
    damageItem(INV.slots, INV.sel, 1); play('splash'); return;
  }
  const [dx, dy, dz] = lookDir();
  const e = shootArrow(PL.x + dx * 0.4, PL.y + PL.eyeH - 0.1, PL.z + dz * 0.4, dx * 2.5, dy * 2.5, dz * 2.5, PL, 0);
  e.trident = { ...h, n: 1 }; e.slot = INV.sel; scene.remove(e.mesh); e.mesh = R.itemMesh(IID.trident); e.mesh.scale.setScalar(0.8); scene.add(e.mesh);
  if (!creative()) { INV.slots[INV.sel] = null; damageItem([e.trident], 0, 1); } play('bow');
  UI.hudDirty = true;
}
// hit by a thrown trident: 8 damage, impaling vs water mobs, channeling calls lightning in a thunderstorm
function tridentHit(e, o) {
  const st = e.trident;
  let dmg = 8; if (st && AQUATIC.has(o.type)) dmg += 2.5 * enchLv(st, 'impaling');
  if (o === PL) { if (!creative()) hurtPlayer(dmg * DIFF_MUL(), 'arrow', e.owner, e); }
  else { HURTPROJ = e; if (e.owner === PL && typeof ADVT !== 'undefined') ADVT.hitByPlayer(o, e); hurtMob(o, dmg, e.owner === PL ? PL : null, e.vx, e.vz, e.owner === PL ? 'player' : null); HURTPROJ = null; }
  if (st && enchLv(st, 'channeling') && o.type === 'villager' && W.thunder > 0.5 && W.dim === 0 && e.owner === PL && typeof advGrant === 'function') advGrant('adventure/very_very_frightening');
  if (st && enchLv(st, 'channeling') && W.thunder > 0.5 && W.dim === 0 && (getLight(Math.floor(o.x), Math.floor(o.y + 1), Math.floor(o.z)) >> 4) === 15) strikeLightning(Math.floor(o.x), Math.floor(o.y), Math.floor(o.z), false);
  e.vx *= -0.1; e.vy = 0.1; e.vz *= -0.1; e.hitDone = true;
}
// every tick for thrown tridents: loyalty brings it back, otherwise it lies where it landed until picked up
function tridentTick(e) {
  const st = e.trident; if (!st) return false;
  const loyal = st && e.owner === PL ? enchLv(st, 'loyalty') : 0;
  if ((e.stuck || e.hitDone || e.y < voidY() + 54) && loyal) {
    const dx = PL.x - e.x, dy = PL.y + 1.2 - e.y, dz = PL.z - e.z, d = Math.hypot(dx, dy, dz) || 1, sp = 0.05 * loyal + 0.3;
    e.stuck = false; e.x += dx / d * sp; e.y += dy / d * sp; e.z += dz / d * sp; e.vx = e.vy = e.vz = 0;
    if (d < 1.2) { tridentPickup(e); }
    return true;
  }
  if (e.stuck && e.owner === PL && !PL.dead && Math.hypot(PL.x - e.x, PL.y + 1 - e.y, PL.z - e.z) < 1.5 && e.age > 10) tridentPickup(e);
  return false;
}
function tridentPickup(e) {
  removeEnt(e); if (creative()) return;
  const st = e.trident; if (!INV.slots[e.slot]) INV.slots[e.slot] = st; else if (INV.add(st)) dropStack(PL.x, PL.y + 1, PL.z, st);
  play('pop', { vol: 0.5 }); UI.hudDirty = true;
}
// drowned: some carry a trident and throw it from range
function drownedTrident(e, dist) {
  if (!e.hasTrident || !e.target || dist > 15 || dist < 3 || e.attackCd > 0 || !e.inWater && Math.random() < 0.5) return;
  if (!canSee(e.x, e.y + 1.6, e.z, PL.x, PL.y + 1.4, PL.z)) return;
  e.attackCd = 40;
  const dx = PL.x - e.x, dy = PL.y + 1.2 - (e.y + 1.6), dz = PL.z - e.z, d = Math.hypot(dx, dy, dz) || 1;
  const t = shootArrow(e.x, e.y + 1.6, e.z, dx / d * 1.6, dy / d * 1.6 + 0.08, dz / d * 1.6, e, 0);
  t.trident = { id: IID.trident, n: 1 }; t.noPickup = true; scene.remove(t.mesh); t.mesh = R.itemMesh(IID.trident); t.mesh.scale.setScalar(0.8); scene.add(t.mesh);
}

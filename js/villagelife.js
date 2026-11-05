// ---------- a villager's day, as Java's villager brain runs it ----------
// The schedule (VILLAGER_DEFAULT): idle until 2000, work at the job site until 9000, meet at the bell until 11000,
// idle, then from 12000 rest in its own bed. Babies (VILLAGER_BABY) play 3000-6000 and 10000-12000. Each villager
// claims a bed (a HOME point of interest) and knows its bell (MEETING); wooden doors are opened on the way and shut
// behind. Gossip as Java keeps it: kinds with their weights, caps, daily decay and what is lost passing it on; the
// opinion of a player is what prices and iron golems go by. Villagers hand food to the ones short of it, farmers
// harvest and replant ripe crops near them, and frightened or chatting villagers summon an iron golem when none is
// about (3 panicking, 5 at the bell).
trackBlocks(BID.red_bed); trackBlocks(BID.bell);
const VL = { beds: new Map(), doors: new Map() };
const vDay = () => ((W.time % 24000) + 24000) % 24000;
function vActivity(e) {
  const t = vDay();
  if (e.baby > 0) return t < 3000 ? 'idle' : t < 6000 ? 'play' : t < 10000 ? 'idle' : t < 12000 ? 'play' : 'rest';
  return t < 2000 ? 'idle' : t < 9000 ? (e.prof && e.prof !== 'none' && e.prof !== 'nitwit' && e.job ? 'work' : 'idle') : t < 11000 ? 'meet' : t < 12000 ? 'idle' : 'rest';
}
// ---------- gossip ----------
// weight, cap, lost each day, lost when told to another villager
const GOSSIP = { mjn: [-5, 100, 10, 10], mnn: [-1, 200, 20, 20], mnp: [1, 200, 1, 1], mjp: [5, 100, 0, 100], trd: [1, 25, 2, 20] };
function vRep(e) { const g = e.gos; if (!g) return 0; let r = 0; for (const k in GOSSIP) r += (g[k] || 0) * GOSSIP[k][0]; return r; }
function vGossip(e, kind, n) { const g = e.gos || (e.gos = {}); g[kind] = Math.min(GOSSIP[kind][1], (g[kind] || 0) + n); e.rep = vRep(e); }
function vGossipShare(a, b) { // each keeps the larger of what it knew and what it was told
  for (const [from, to] of [[a, b], [b, a]]) { if (!from.gos) continue; for (const k in from.gos) { const v = from.gos[k] - GOSSIP[k][3]; if (v > 0 && v > ((to.gos && to.gos[k]) || 0)) { (to.gos || (to.gos = {}))[k] = v; } } to.rep = vRep(to); }
}
function vGossipDecay(e) { const day = Math.floor(W.time / 24000); if (e.gosDay == null) { e.gosDay = day; return; } if (day <= e.gosDay || !e.gos) return; const n = day - e.gosDay; e.gosDay = day;
  for (const k in e.gos) { e.gos[k] = Math.max(0, e.gos[k] - GOSSIP[k][2] * n); if (!e.gos[k]) delete e.gos[k]; } e.rep = vRep(e); }
// what was a plain number of opinion becomes gossip: the old saves, and the places that still add to it
function vRepToGossip(e) { if (e.gos || !e.rep) return; e.gos = {}; if (e.rep > 0) e.gos.mnp = Math.min(200, e.rep); else e.gos.mnn = Math.min(200, -e.rep); e.rep = vRep(e); }
// ---------- beds, the bell, doors ----------
function vClaimBed(e) {
  if (e.bed) { const [x, y, z] = e.bed; if (isLoaded(x, z) && (getBlock(x, y, z) !== BID.red_bed || !(getMeta(x, y, z) & 4))) e.bed = null; }
  if (e.bed || e.age % 100) return;
  let best = null, bd = 48;
  for (const k of trackBlocks(BID.red_bed)) { const [x, y, z] = k.split(',').map(Number); if (!(getMeta(x, y, z) & 4)) continue; const o = VL.beds.get(k); if (o && o !== e && !o.dead) continue; const d = Math.hypot(x + .5 - e.x, y - e.y, z + .5 - e.z); if (d < bd) { bd = d; best = [x, y, z]; } }
  if (best) { e.bed = best; VL.beds.set(best.join(','), e); }
}
function vFindBell(e) {
  if (e.bell && isLoaded(e.bell[0], e.bell[2]) && getBlock(e.bell[0], e.bell[1], e.bell[2]) !== BID.bell) e.bell = null;
  if (e.bell || e.age % 200) return;
  let best = null, bd = 48; for (const k of trackBlocks(BID.bell)) { const [x, y, z] = k.split(',').map(Number), d = Math.hypot(x + .5 - e.x, y - e.y, z + .5 - e.z); if (d < bd) { bd = d; best = [x, y, z]; } }
  e.bell = best;
}
// the way through a wooden door: open it in passing (Java's InteractWithDoor), and it shuts again once nobody is in it
function vDoors(e) {
  if (!(Math.hypot(e.vx, e.vz) > 0.01 || e.goal)) return;
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  for (const r of [0.5, 0.9]) { const x = Math.floor(e.x + fx * r), y = Math.floor(e.y + 0.01), z = Math.floor(e.z + fz * r);
    if (getBlock(x, y, z) !== BID.oak_door) continue; const m = getMeta(x, y, z); if (m & 4) { VL.doors.set(x + ',' + y + ',' + z, W.tickN); continue; }
    const by = m & 8 ? y - 1 : y; setMeta(x, by, z, getMeta(x, by, z) | 4); if (getBlock(x, by + 1, z) === BID.oak_door) setMeta(x, by + 1, z, getMeta(x, by + 1, z) | 4); play('door', { vol: 0.5 }); VL.doors.set(x + ',' + by + ',' + z, W.tickN); }
}
function vDoorsClose() {
  for (const [k, t] of VL.doors) { if (W.tickN - t < 40) continue; const [x, y, z] = k.split(',').map(Number);
    if (ENT.some(o => o.kind === 'mob' && !o.dead && Math.abs(o.x - x - .5) < 1.2 && Math.abs(o.z - z - .5) < 1.2 && Math.abs(o.y - y) < 2) || (Math.abs(PL.x - x - .5) < 1 && Math.abs(PL.z - z - .5) < 1 && Math.abs(PL.y - y) < 2)) { VL.doors.set(k, W.tickN); continue; }
    VL.doors.delete(k); if (getBlock(x, y, z) !== BID.oak_door) continue; const m = getMeta(x, y, z); if (!(m & 4)) continue;
    setMeta(x, y, z, m & ~4); if (getBlock(x, y + 1, z) === BID.oak_door) setMeta(x, y + 1, z, getMeta(x, y + 1, z) & ~4); play('door', { vol: 0.4, pitch: 0.9 }); }
}
// villagers' paths may go through wooden doors (others stop at a closed one)
{ const pw = pfWalkable; pfWalkable = function (x, y, z, h) { if (PF.door && getBlock(x, y, z) === BID.oak_door) { const u = getBlock(x, y - 1, z); return !!SOLID[u] && u !== BID.oak_door; } return pw(x, y, z, h); };
  const fp = findPath; findPath = function (e) { PF.door = e && e.type === 'villager'; try { return fp.apply(this, arguments); } finally { PF.door = false; } }; }
// ---------- sleeping ----------
function vSleep(e) { const [x, y, z] = e.bed; e.sleeping = true; e.sleptAt = W.time; e.goal = null; e.path = null; e.x = x + .5; e.z = z + .5; e.y = y + 0.5625; e.vx = e.vz = 0; }
function vWake(e) { e.sleeping = false; if (e.bed) { e.y = e.bed[1] + 0.6; } }
function vSleepHold(e) { const [x, y, z] = e.bed; e.x = e.px = x + .5; e.z = e.pz = z + .5; e.y = Math.max(e.y, y + 0.5625); e.vx = e.vz = 0; e.goal = null; e.panic = 0; e.yawTarget = e.yaw; }
// drawn lying on the bed, head on the pillow
{ const d = MOBDEF.villager, anim = d.anim; d.anim = function (e, P, now) { if (anim) anim(e, P, now);
    if (!e.sleeping || !e.bed) { if (e.mesh.rotation.order !== 'XYZ') e.mesh.rotation.order = 'XYZ'; return; }
    const [x, y, z] = e.bed, dd = DIRS[getMeta(x, y, z) & 3], fx = x + .5 - dd[0], fz = z + .5 - dd[2]; // the foot block's centre; the head lies toward the head block
    e.mesh.rotation.order = 'YXZ'; e.mesh.rotation.set(-Math.PI / 2, Math.atan2(-dd[0], -dd[2]), 0);
    e.mesh.position.set(fx - dd[0] * 0.3, y + 0.62, fz - dd[2] * 0.3);
    for (const n of ['rleg', 'lleg', 'rarm', 'larm']) if (P[n]) P[n].rotation.x = 0; }; }
// ---------- the schedule ----------
const nearA = (e, a, r) => a && Math.hypot(a[0] + .5 - e.x, a[2] + .5 - e.z) <= r && Math.abs(a[1] - e.y) < 3;
function vNearGoal(e, a, r) { e.goal = [a[0] + .5 + (Math.random() - .5) * r * 2, a[2] + .5 + (Math.random() - .5) * r * 2]; e.path = null; }
function vShelter(e) { // no bed: under a roof for the night
  const sky = (x, y, z) => getLight(Math.floor(x), Math.floor(y), Math.floor(z)) >> 4; if (sky(e.x, e.y + 1.5, e.z) < 15 || e.age % 40) return;
  for (let i = 0; i < 10; i++) { const gx = Math.floor(e.x + (Math.random() - .5) * 32), gz = Math.floor(e.z + (Math.random() - .5) * 32), gy = Math.floor(e.y) + Math.floor(Math.random() * 7) - 3; if (pfWalkable(gx, gy, gz, 2) && sky(gx, gy + 1, gz) < 15) { e.goal = [gx + .5, gz + .5]; e.path = null; return; } }
}
function villagerDay(e) {
  if (e.remote) return;
  vRepToGossip(e); vGossipDecay(e); vClaimBed(e); vFindBell(e);
  if (e.bed) VL.beds.set(e.bed.join(','), e);
  if (ENT.some(o => o.type === 'iron_golem' && !o.dead && Math.abs(o.x - e.x) < 16 && Math.abs(o.z - e.z) < 16) && e.age % 20 === 0) e.golemSeen = W.time;
  const act = vActivity(e); e.act = act;
  if (e.sleeping) { if (act !== 'rest' || e.panic > 0 || !e.bed || e.hurt > 0) vWake(e); else { vSleepHold(e); return; } }
  if (e.panic > 0 || e.trading || e.rider) return;
  vDoors(e);
  if (act === 'work') {
    if (!nearA(e, e.job, 2.2)) { if (!e.goal || Math.hypot(e.goal[0] - e.job[0] - .5, e.goal[1] - e.job[2] - .5) > 2) { e.goal = [e.job[0] + .5, e.job[2] + .5]; e.path = null; } }
    else { if (e.goal && Math.hypot(e.goal[0] - e.job[0] - .5, e.goal[1] - e.job[2] - .5) > 4) e.goal = null; if (!e.goal && Math.random() < 0.01) vNearGoal(e, e.job, 2); if (Math.random() < 0.02) faceTo(e, e.job[0] + .5, e.job[2] + .5); e.atJob = W.tickN; }
    if (e.prof === 'farmer') farmerWork(e);
  } else if (act === 'meet' && e.bell) {
    if (!nearA(e, e.bell, e.atBell ? 6 : 3)) { e.atBell = 0; if (!e.goal || Math.hypot(e.goal[0] - e.bell[0] - .5, e.goal[1] - e.bell[2] - .5) > 3) vNearGoal(e, e.bell, 1.5); }
    else { e.atBell = 1; if (e.goal && Math.hypot(e.goal[0] - e.bell[0] - .5, e.goal[1] - e.bell[2] - .5) > 5) e.goal = null; }
  } else if (act === 'rest') {
    if (e.bed) { const [x, y, z] = e.bed, d = Math.hypot(x + .5 - e.x, z + .5 - e.z);
      if (d < 1.1 && Math.abs(y - e.y) < 1.5) vSleep(e); else if (!e.goal || Math.hypot(e.goal[0] - x - .5, e.goal[1] - z - .5) > 0.5) { e.goal = [x + .5, z + .5]; e.path = null; } }
    else { if (e.goal && Math.random() < 0.05) e.goal = null; vShelter(e); }
  } else if (act === 'play') { if (!e.goal && Math.random() < 0.05) { const g = wanderGoal(e, 6); if (g) e.goal = g; } }
}
// ---------- farmers ----------
const vRipe = (b, m) => (b === BID.wheat || b === BID.crops2) && (m & 7) === 7;
function farmerWork(e) {
  if (e.crop) { const [x, y, z] = e.crop;
    if (!vRipe(getBlock(x, y, z), getMeta(x, y, z))) { e.crop = null; return; }
    if (Math.hypot(x + .5 - e.x, z + .5 - e.z) < 1.6 && Math.abs(y - e.y) < 2) {
      const b = getBlock(x, y, z), m = getMeta(x, y, z); play('break', { mat: 'grass' }); for (let i = 0; i < 6; i++) R.simpleParticle(x + .5, y + .4, z + .5, [0.6, 0.7, 0.3], { size: 0.08, vy: 1 });
      if (b === BID.wheat) e.wheat = (e.wheat || 0) + 1; else e.vfood = (e.vfood || 0) + 1 + Math.floor(Math.random() * 3);
      setBlock(x, y, z, b, m & ~7); e.crop = null; // harvested and the seed put back
      while ((e.wheat || 0) >= 3) { e.wheat -= 3; e.vfood = (e.vfood || 0) + 4; } // three wheat make a loaf (bread counts 4)
    } else if (!e.goal || Math.hypot(e.goal[0] - x - .5, e.goal[1] - z - .5) > 0.6) { e.goal = [x + .5, z + .5]; e.path = null; }
    return; }
  if (e.age % 40) return;
  const x0 = Math.floor(e.x), y0 = Math.floor(e.y), z0 = Math.floor(e.z);
  for (let r = 1; r <= 8 && !e.crop; r++) for (let dx = -r; dx <= r && !e.crop; dx++) for (let dz = -r; dz <= r && !e.crop; dz++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    for (let dy = -1; dy <= 1; dy++) if (vRipe(getBlock(x0 + dx, y0 + dy, z0 + dz), getMeta(x0 + dx, y0 + dy, z0 + dz))) { e.crop = [x0 + dx, y0 + dy, z0 + dz]; break; } }
}
// ---------- what villagers do among themselves ----------
function villagerSocial(vs) {
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const a = vs[i], b = vs[j]; if (a.sleeping || b.sleeping || Math.hypot(a.x - b.x, a.z - b.z) > 2.5 || Math.abs(a.y - b.y) > 2) continue;
    if (!(a.talkAt > W.tickN - 1200) && !(b.talkAt > W.tickN - 1200)) { a.talkAt = b.talkAt = W.tickN; vGossipShare(a, b); faceTo(a, b.x, b.z); faceTo(b, a.x, a.z); }
    // food for a villager short of it (Java's ShareItems: bread, carrots, potatoes, beetroots tossed over)
    for (const [g, r] of [[a, b], [b, a]]) if ((g.vfood || 0) >= 24 && (r.vfood || 0) < 12 && !(g.giveAt > W.tickN - 200)) { g.giveAt = W.tickN; g.vfood -= 4; const dx = r.x - g.x, dz = r.z - g.z, l = Math.hypot(dx, dz) || 1; dropItem(g.x, g.y + 1.4, g.z, IID.bread, 1, [dx / l * 0.15, 0.2, dz / l * 0.15]); }
  }
}
// an iron golem when villagers want one: none seen for 30 s, slept in the last day; 3 together in a panic, or 5 at the bell
function villagerGolems(vs) {
  const want = v => !v.baby && v.sleptAt != null && W.time - v.sleptAt < 24000 && !(v.golemSeen != null && W.time - v.golemSeen < 600);
  for (const v of vs) {
    const need = v.panic > 0 ? 3 : v.act === 'meet' ? 5 : 0; if (!need || !want(v)) continue;
    const near = vs.filter(o => want(o) && Math.hypot(o.x - v.x, o.y - v.y, o.z - v.z) < 10); if (near.length < need) continue;
    for (let k = 0; k < 10; k++) { const x = Math.floor(v.x + (Math.random() - .5) * 16), z = Math.floor(v.z + (Math.random() - .5) * 16);
      for (let y = Math.floor(v.y) + 6; y >= Math.floor(v.y) - 6; y--) { if (!SOLID[getBlock(x, y - 1, z)] || FLUID[getBlock(x, y - 1, z)]) continue; if (SOLID[getBlock(x, y, z)] || SOLID[getBlock(x, y + 1, z)] || SOLID[getBlock(x, y + 2, z)] || FLUID[getBlock(x, y, z)]) continue;
        const g = spawnMob('iron_golem', x + .5, y, z + .5); if (g) { g.persistent = true; for (const o of near) o.golemSeen = W.time; } return; } }
    return;
  }
}
// a golem turns on a player the villagers around it think badly of (Java's DefendVillageTargetGoal: -100 or worse)
function golemDefend() {
  if (!plTargetable()) return;
  for (const g of ENT) { if (g.type !== 'iron_golem' || g.dead || g.target || g.playerMade) continue;
    for (const v of ENT) if (v.type === 'villager' && !v.dead && Math.abs(v.x - g.x) < 10 && Math.abs(v.z - g.z) < 10 && (v.rep || 0) <= -100 && Math.abs(PL.x - v.x) < 10 && Math.abs(PL.z - v.z) < 10) { g.target = PL; break; } }
}
// ---------- hooked in ----------
{ const vai = villagerAIExtra; villagerAIExtra = function (e) { villagerDay(e); vai(e); }; }
{ const lt = villagerLifeTick; villagerLifeTick = function () { lt.apply(this, arguments);
    if (W.tickN % 20) return; vDoorsClose(); const vs = ENT.filter(e => e.type === 'villager' && !e.dead && !e.remote); villagerSocial(vs); if (W.tickN % 100 === 0) { villagerGolems(vs); golemDefend(); }
    for (const [k, v] of VL.beds) if (v.dead || !ENT.includes(v) || !v.bed || v.bed.join(',') !== k) VL.beds.delete(k); }; }
// a villager killed by a player: everyone who saw it holds it against them (major_negative 25)
{ const hm = hurtMob; hurtMob = function (t, dmg, attacker) { const was = t && !t.dead && !t.deathT, r = hm.apply(this, arguments);
    if (was && t.type === 'villager' && (t.dead || t.deathT) && (attacker === PL || (attacker && attacker.owner === PL))) for (const v of ENT) if (v !== t && v.type === 'villager' && !v.dead && Math.hypot(v.x - t.x, v.z - t.z) < 16) vGossip(v, 'mjn', 25);
    return r; }; }
{ const d = MOBDEF.villager, save = d.save, init = d.init;
  d.save = e => ({ ...(save ? save(e) : {}), bed: e.bed || null, bell: e.bell || null, gos: e.gos || null, gosDay: e.gosDay ?? null, sleptAt: e.sleptAt ?? null, golemSeen: e.golemSeen ?? null, wheat: e.wheat || 0 });
  d.init = (e, o) => { if (init) init(e, o); if (o.bed) e.bed = o.bed; if (o.bell) e.bell = o.bell; if (o.gos) { e.gos = o.gos; e.rep = vRep(e); } if (o.gosDay != null) e.gosDay = o.gosDay; if (o.sleptAt != null) e.sleptAt = o.sleptAt; if (o.golemSeen != null) e.golemSeen = o.golemSeen; if (o.wheat) e.wheat = o.wheat; }; }

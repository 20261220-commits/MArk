// The sea (1.13 Update Aquatic, part of 1.17): placing and growing kelp, seagrass, corals and sea pickles; corals
// die out of water; the conduit; pufferfish, guardians and elder guardians; guardians around ocean monuments.

// ---------- placing ----------
const waterSource = (x, y, z) => getBlock(x, y, z) === BID.water && getMeta(x, y, z) === 0;
// called by placeBlock: returns the meta to place with, or false to refuse
function oceanPlace(x, y, z, id, meta) {
  const wet = waterSource(x, y, z), below = getBlock(x, y - 1, z);
  if (id === BID.kelp) { if (!wet || !(OPQ[below] || below === BID.kelp || below === BID.kelp_plant)) return false; if (below === BID.kelp) setBlock(x, y - 1, z, BID.kelp_plant, 0, { noUpdate: true }); return Math.floor(Math.random() * 20); }
  if (id === BID.seagrass) return wet && OPQ[below] ? 0 : false;
  if (id === BID.coral || id === BID.coral_fan || id === BID.sea_pickle) { if (!supportedBy(below)) return false; return meta | (wet ? 16 : 0); }
  if (id === BID.conduit || id === BID.chest) return meta | (wet ? 16 : 0);
  return meta;
}
// use with a sea pickle on a sea pickle: up to four in one block
function oceanUse(t, h, d) {
  if (d && d.place === BID.sea_pickle && t.id === BID.sea_pickle && (t.m & 3) < 3) { setMeta(t.x, t.y, t.z, t.m + 1); consume(); play('place', { mat: 'slime' }); swing(); return true; }
  return false;
}
// ---------- growth & decay ----------
RANDOM_TICK[BID.kelp] = (x, y, z, b, m) => {
  if (m >= 25 || Math.random() > 0.14 || !waterSource(x, y + 1, z)) return;
  setBlock(x, y + 1, z, BID.kelp, m + 1); setBlock(x, y, z, BID.kelp_plant, 0, { noUpdate: true });
};
const wetAround = (x, y, z) => S.DIR6.some(([dx, dy, dz]) => { const b = getBlock(x + dx, y + dy, z + dz); return FLUID[b] === 1 || S.isWet(b, getMeta(x + dx, y + dy, z + dz)); });
RANDOM_TICK[BID.coral] = RANDOM_TICK[BID.coral_fan] = (x, y, z, b, m) => { if ((m & 15) < 5 && !(m & 16)) setMeta(x, y, z, m + 5); }; // dries out and dies
RANDOM_TICK[BID.coral_block] = (x, y, z, b, m) => { if (m < 5 && !wetAround(x, y, z)) setMeta(x, y, z, m + 5); };

// ---------- the conduit ----------
// frame: prismarine, prismarine bricks, dark prismarine or sea lanterns on the three 5x5 rings around it (42 places);
// 16+ blocks power it: conduit power (water breathing, night vision, haste under water) within 16 blocks per 7 frame
// blocks; a full frame also hurts hostile mobs in the water nearby
const CONDUITS = trackBlocks(BID.conduit);
const isFrame = (b, m) => b === BID.prismarine || b === BID.sea_lantern || (b === BID.deco_stone && (m === 11 || m === 12));
function conduitFrame(x, y, z) {
  let n = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    if ((dx && dy && dz) || Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== 2) continue; // the rings in the three axis planes
    if (isFrame(getBlock(x + dx, y + dy, z + dz), getMeta(x + dx, y + dy, z + dz))) n++;
  }
  return n;
}
function conduitTick() {
  if (W.tickN % 40 || !CONDUITS.size) return;
  for (const k of CONDUITS) {
    const [x, y, z] = k.split(',').map(Number);
    let water = true; for (let dx = -1; dx <= 1 && water; dx++) for (let dy = -1; dy <= 1 && water; dy++) for (let dz = -1; dz <= 1; dz++) { if (!dx && !dy && !dz) continue; const b = getBlock(x + dx, y + dy, z + dz); if (!(FLUID[b] === 1 || S.isWet(b, getMeta(x + dx, y + dy, z + dz)))) { water = false; break; } }
    const n = water ? conduitFrame(x, y, z) : 0, t = getTile(x, y, z) || {}; t.on = n >= 16; t.type = 'conduit'; setTile(x, y, z, t);
    if (!t.on) continue;
    const range = Math.floor(n / 7) * 16;
    if (Math.hypot(PL.x - x - .5, PL.y - y, PL.z - z - .5) < range && (PL.inWater || (W.rain > 0.5 && W.dim === 0))) addEffect(PL, 'conduit_power', 260, 0);
    if (n >= 42) { const foe = ENT.find(e => e.kind === 'mob' && !e.dead && e.def.hostile && e.inWater && Math.hypot(e.x - x, e.y - y, e.z - z) < 8); if (foe) { hurtMob(foe, 4, null); for (let i = 0; i < 6; i++) R.simpleParticle(foe.x, foe.y + foe.h / 2, foe.z, [0.4, 0.8, 1], { size: 0.12, vy: 0.6 }); } }
    if (Math.random() < 0.3) R.simpleParticle(x + .5 + (Math.random() - .5) * 3, y + .5 + (Math.random() - .5) * 3, z + .5 + (Math.random() - .5) * 3, [0.5, 0.8, 0.9], { size: 0.08, vy: 0.2, grav: 0, life: 1 });
  }
}

// ---------- pufferfish ----------
const PUFF_M = autoModel(() => [
  ['body', [0, 0, 0], [-2, 0, -2, 4, 4, 4], (k, x, y) => hex(k === 'bottom' ? 0xe8e0b0 : (x + y) % 3 === 0 ? 0xc8a020 : 0xe8c848), 0, eyes('#101010', 1, 0, 3)],
  ['fin1', [0, 0, 0], [2, 1, -1, 1, 2, 2], 0xd8b030], ['fin2', [0, 0, 0], [-3, 1, -1, 1, 2, 2], 0xd8b030], ['tail', [0, 0, 0], [-1, 1, 2, 2, 2, 2], 0xd8b030],
  ...[[-2.5, 2, 0], [2.5, 2, 0], [0, 4.5, 0], [0, 2, -2.5], [0, 2, 2.5]].map(([x, y, z], i) => ['sp' + i, [0, 0, 0], [x - 0.5, y - 0.5, z - 0.5, 1, 1, 1], 0xf4f0d8]),
]);
function pufferAI(e, dist) {
  const near = !PL.dead && !spectator() && PL.mode !== 'creative' && dist < 2.5;
  const want = near ? 2 : ENT.some(o => o.type === 'axolotl' && !o.dead && Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) < 2.5) ? 2 : 0;
  if (e.age % 10 === 0 && e.puff !== want) { e.puff = (e.puff || 0) + Math.sign(want - (e.puff || 0)); play('splash', { vol: 0.2, pitch: 1.5 }); }
  e.scale = [1, 1.5, 2][e.puff || 0]; e.w = 0.35 * e.scale; e.h = 0.35 * e.scale;
  for (let i = 0; i < 5; i++) hidePart(e, 'sp' + i, e.puff > 0);
  if (e.puff > 0 && near && dist < 1.2 + e.w && e.attackCd <= 0) { e.attackCd = 20; if (hurtPlayer(1 + e.puff, 'mob', e)) addEffect(PL, 'poison', 60 * e.puff, 0); }
  squidTick(e);
}

// ---------- guardians ----------
const GUARD_M = (c1, c2) => autoModel(() => [
  ['body', [0, 0, 0], [-6, 2, -8, 12, 12, 16], (k, x, y) => hex((x * 5 + y * 3) % 9 < 2 ? c2 : c1)],
  ['eye', [0, 0, 0], [-1, 7, -8.3, 2, 2, 1], () => hex(0xf0f0e0), 0, { front: (g, x, y) => px(g, x, y, '#8a3a10') }],
  ['tail1', [0, 8, 8], [-2, -2, 0, 4, 4, 8], c1], ['tail2', [0, 8, 16], [-1.5, -1.5, 0, 3, 3, 7], c1], ['tail3', [0, 8, 23], [-1, -1, 0, 2, 2, 6], c2],
  ...[[-7, 8, 0], [7, 8, 0], [0, 15, 0], [0, 1, 0], [-7, 15, -8], [7, 15, -8], [-7, 1, 8], [7, 1, 8]].map(([x, y, z], i) => ['sp' + i, [0, 0, 0], [x - 1, y - 1, z - 1, 2, 2, 2], 0xf0e8c0]),
], 128, 64);
const GUARDIAN_M = GUARD_M(0x5a9a8a, 0xd8803a), ELDER_M = GUARD_M(0xc8c4b8, 0x8a8a90);
const beamGeoG = new THREE.BoxGeometry(0.08, 0.08, 1); beamGeoG.translate(0, 0, 0.5);
function guardianAI(e, dist) {
  const d = e.def;
  if (!e.inWater) { // flops about on land
    e.vy -= 0.08; physMove(e, e.vx * 0.9, e.vy, e.vz * 0.9, 0); if (e.onGround && Math.random() < 0.1) { e.vy = 0.4; e.vx = (Math.random() - .5) * 0.3; e.vz = (Math.random() - .5) * 0.3; play('splash', { vol: 0.3 }); }
    guardianBeam(e, null); return;
  }
  if (d.elder && e.age % 1200 === 600 && plTargetable() && dist < 50) { addEffect(PL, 'mining_fatigue', 6000, 2); play('ghast', { pitch: 0.6, vol: 0.5 }); UI.flash && UI.flash('엘더 가디언의 저주'); } // mining fatigue III
  if (e.target && (e.target.dead || e.target.deathT || (e.target === PL && (!plTargetable() || dist > 16)))) { e.target = null; e.beam = 0; }
  if (!e.target && e.age % 20 === 0) {
    if (plTargetable() && dist < 16 && canSee(e.x, e.y + e.h / 2, e.z, PL.x, PL.y + 1.4, PL.z)) e.target = PL;
    else e.target = ENT.find(o => (o.type === 'squid' || o.type === 'glow_squid' || o.type === 'axolotl') && !o.dead && Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) < 16) || null;
  }
  const t = e.target;
  if (t) {
    const ty = t === PL ? PL.y + 1.2 : t.y + t.h / 2, l = Math.hypot(t.x - e.x, ty - e.y, t.z - e.z) || 1;
    faceTo(e, t.x, t.z); turn(e, 0.3);
    if (!canSee(e.x, e.y + e.h / 2, e.z, t.x, ty, t.z)) { e.beam = 0; swimToward(e, t.x, ty, t.z, 0.08); }
    else {
      e.beam = (e.beam || 0) + 1; e.vx *= 0.8; e.vy *= 0.8; e.vz *= 0.8; physMove(e, e.vx, e.vy, e.vz, 0);
      if (e.beam >= (d.elder ? 60 : 80)) { e.beam = 0; e.attackCd = 40; if (t === PL) hurtPlayer((d.elder ? 8 : 6) * DIFF_MUL(), 'magic', e); else hurtMob(t, d.elder ? 8 : 6, e); }
    }
    e.spikes = e.beam > 0; // spikes out while it holds still (thorns)
  } else {
    e.beam = 0; e.spikes = false;
    if (!e.goal || Math.random() < 0.01 || Math.hypot(e.goal[0] - e.x, e.goal[1] - e.y, e.goal[2] - e.z) < 1.5) e.goal = waterGoal(e, 10, 38, 62) || [e.x, e.y, e.z];
    swimToward(e, e.goal[0], e.goal[1], e.goal[2], d.elder ? 0.04 : 0.1);
  }
  guardianBeam(e, t && e.beam > 0 ? t : null);
}
// the laser: a thin beam from the eye to the target that brightens as it charges
function guardianBeam(e, t) {
  if (!t) { if (e.beamMesh) { scene.remove(e.beamMesh); e.beamMesh.material.dispose(); e.beamMesh = null; } return; }
  if (!e.beamMesh) { e.beamMesh = new THREE.Mesh(beamGeoG, new THREE.MeshBasicMaterial({ color: 0x8a3aff, transparent: true, opacity: 0.8, depthWrite: false })); scene.add(e.beamMesh); }
  const sy = e.y + e.h * 0.55, ty = t === PL ? PL.y + 1.2 : t.y + t.h / 2, l = Math.hypot(t.x - e.x, ty - sy, t.z - e.z);
  e.beamMesh.position.set(e.x, sy, e.z); e.beamMesh.scale.set(1, 1, l); e.beamMesh.lookAt(t.x, ty, t.z);
  const k = Math.min(1, e.beam / (e.def.elder ? 60 : 80)); e.beamMesh.material.color.setRGB(0.5 + k * 0.5, 0.2 + k * 0.8, 1); e.beamMesh.scale.x = e.beamMesh.scale.y = 1 + k * 2;
}
function guardianAnim(e, P, now) {
  const out = e.spikes ? 1 : 0.4; for (let i = 0; i < 8; i++) { const p = P['sp' + i]; if (p) p.scale.setScalar(out); }
  const s = Math.sin(now / 200 + e.id) * 0.3; if (P.tail1) { P.tail1.rotation.y = s; P.tail2.rotation.y = s * 1.5; P.tail3.rotation.y = s * 2; }
}
// guardians keep spawning in the water around ocean monuments
function monumentSpawn() {
  if (W.dim !== 0 || PL.difficulty === 0 || W.tickN % 100) return;
  const G = W.genCache || (W.genCache = S.makeGen(W.seed)), rx = Math.floor((PL.x >> 4) / 32), rz = Math.floor((PL.z >> 4) / 32);
  for (let i = rx - 1; i <= rx + 1; i++) for (let j = rz - 1; j <= rz + 1; j++) {
    const m = S.monumentAt(W.seed, G, i, j); if (!m || Math.hypot(m.x - PL.x, m.z - PL.z) > 64) continue;
    if (countMobs(e => e.type === 'guardian' && Math.hypot(e.x - m.x, e.z - m.z) < 40) >= 8) continue;
    const x = Math.floor(m.x + (Math.random() - .5) * 56), z = Math.floor(m.z + (Math.random() - .5) * 56), y = 40 + Math.floor(Math.random() * 20);
    if (isLoaded(x, z) && getBlock(x, y, z) === BID.water && getBlock(x, y + 1, z) === BID.water) spawnMob('guardian', x + .5, y, z + .5).persistent = true;
  }
}
function oceanTick() { conduitTick(); monumentSpawn(); }

Object.assign(MOBDEF, {
  pufferfish: { hp: 3, w: 0.35, h: 0.35, speed: 0.04, xp: 1, snd: 'splash', fish: 1, drops: [['pufferfish', 1, 1]], extraDrop: [['bone_meal', 0.05]], parts: PUFF_M.parts, tex: () => PUFF_M.tex(0), ai: pufferAI },
  guardian: { hp: 30, w: 0.425, h: 0.85, speed: 0.1, hostile: 1, xp: 10, snd: 'splash', fallReduce: 99, drops: [['prismarine_shard', 0, 2], ['cod', 0, 1], ['prismarine_crystals', 0, 1]], parts: GUARDIAN_M.parts, tw: 128, th: 64,
    tex: () => GUARDIAN_M.tex(0), ai: guardianAI, anim: guardianAnim, thorns: e => e.spikes, onDeath: e => guardianBeam(e, null) },
  elder_guardian: { hp: 80, w: 1, h: 2, speed: 0.05, hostile: 1, elder: 1, xp: 10, snd: 'splash', scale: 2.35, kbRes: 1, fallReduce: 99, drops: [['wet_sponge', 1, 1], ['prismarine_shard', 0, 2], ['cod', 0, 1], ['prismarine_crystals', 0, 1]], parts: ELDER_M.parts, tw: 128, th: 64,
    tex: () => ELDER_M.tex(0), ai: guardianAI, anim: guardianAnim, thorns: e => e.spikes, onDeath: e => guardianBeam(e, null) },
});
// drowned sometimes come holding a nautilus shell (3%), which they always drop
MOBDEF.drowned.init = e => { if (Math.random() < 0.03) e.nautilus = true; };
MOBDEF.drowned.onDeathDrops = e => { if (e.nautilus) dropItem(e.x, e.y + .5, e.z, IID.nautilus_shell, 1); };

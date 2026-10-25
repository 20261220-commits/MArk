// More mobs (husk, drowned, stray, wither skeleton, piglin, hoglin, strider, shulker, endermite,
// silverfish, wolf, bat, cod, salmon), OptiFine random skins, and the OptiFine night sky.
// Models are Java Edition ModelPart layouts so the Pixel Perfection textures fit exactly.

// ---------- Java models ----------
const LAYER = (parts, inf) => parts.map(p => ({ n: p.n + '_o', p: p.n, o: [0, 0, 0], t: 1, b: p.b.slice(0, 1).map(b => [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], (b[8] || 0) + inf, b[9]]) }));
const SKEL = () => [
  { n: 'head', o: [0, 0, 0], b: [[0, 0, -4, -8, -4, 8, 8, 8]] }, { n: 'body', o: [0, 0, 0], b: [[16, 16, -4, 0, -2, 8, 12, 4]] },
  { n: 'rarm', o: [-5, 2, 0], b: [[40, 16, -1, -2, -1, 2, 12, 2]] }, { n: 'larm', o: [5, 2, 0], b: [[40, 16, -1, -2, -1, 2, 12, 2, 0, 1]] },
  { n: 'rleg', o: [-2, 12, 0], b: [[0, 16, -1, 0, -1, 2, 12, 2]] }, { n: 'lleg', o: [2, 12, 0], b: [[0, 16, -1, 0, -1, 2, 12, 2, 0, 1]] }];
const SEGMENTS = (sizes, texs) => { const out = []; let f = -3.5; sizes.forEach(([sx, sy, sz], i) => { out.push({ n: 'seg' + i, o: [0, 24 - sy, f], b: [[texs[i][0], texs[i][1], -sx / 2, 0, -sz / 2, sx, sy, sz]] }); if (i < sizes.length - 1) f += (sz + sizes[i + 1][2]) * 0.5; }); return out; };
Object.assign(MCMODELS, {
  husk: { tex: 'husk', tw: 64, th: 64, scale: 1.0625, parts: HUM_BODY(false) },
  drowned: { tex: 'drowned', tex2: 'drowned_outer', tw: 64, th: 64, parts: [...HUM_BODY(false), ...LAYER(HUM_BODY(false), 0.25)] },
  stray: { tex: 'stray', tex2: 'stray_overlay', tw: 64, th: 32, parts: [...SKEL(), ...LAYER(SKEL(), 0.25)] },
  wither_skeleton: { tex: 'wither_skeleton', tw: 64, th: 32, scale: 1.2, parts: SKEL() },
  piglin: { tex: 'piglin', tw: 64, th: 64, parts: MCMODELS.zombified_piglin.parts },
  hoglin: { tex: 'hoglin', tw: 128, th: 64, parts: [
    { n: 'body', o: [0, 7, 0], b: [[1, 1, -8, -7, -13, 16, 14, 26]] }, { n: 'mane', p: 'body', o: [0, -14, -5], b: [[90, 33, 0, 0, -9, 0, 10, 19, 0.001]] },
    { n: 'head', o: [0, 2, -12], r: [0.87, 0, 0], b: [[61, 1, -7, -3, -19, 14, 6, 19]] },
    { n: 'rear', p: 'head', o: [-6, -2, -3], r: [0, 0, -0.698], b: [[1, 1, -6, -1, -2, 6, 1, 4]] }, { n: 'lear', p: 'head', o: [6, -2, -3], r: [0, 0, 0.698], b: [[1, 6, 0, -1, -2, 6, 1, 4]] },
    { n: 'rhorn', p: 'head', o: [-7, 2, -12], b: [[10, 13, -1, -11, -1, 2, 11, 2]] }, { n: 'lhorn', p: 'head', o: [7, 2, -12], b: [[1, 13, -1, -11, -1, 2, 11, 2]] },
    { n: 'rleg', o: [-4, 10, -8.5], b: [[66, 42, -3, 0, -3, 6, 14, 6]] }, { n: 'lleg', o: [4, 10, -8.5], b: [[41, 42, -3, 0, -3, 6, 14, 6]] },
    { n: 'rleg2', o: [-5, 13, 10], b: [[21, 45, -2.5, 0, -2.5, 5, 11, 5]] }, { n: 'lleg2', o: [5, 13, 10], b: [[0, 45, -2.5, 0, -2.5, 5, 11, 5]] }] },
  strider: { tex: 'strider', tw: 64, th: 128, parts: [
    { n: 'body', o: [0, 1, 0], b: [[0, 0, -8, -6, -8, 16, 14, 16]] },
    { n: 'bristle0', p: 'body', o: [-8, -5, -8], r: [0, 0, 1.2217], b: [[16, 65, -12, 0, 0, 12, 0, 16, 0, 1]] }, { n: 'bristle1', p: 'body', o: [8, -5, -8], r: [0, 0, -1.2217], b: [[16, 65, 0, 0, 0, 12, 0, 16]] },
    { n: 'rleg', o: [-4, 8, 0], b: [[0, 32, -2, 0, -2, 4, 16, 4]] }, { n: 'lleg', o: [4, 8, 0], b: [[0, 55, -2, 0, -2, 4, 16, 4]] }] },
  shulker: { tex: 'shulker', tw: 64, th: 64, parts: [
    { n: 'base', o: [0, 24, 0], b: [[0, 28, -8, -8, -8, 16, 8, 16]] }, { n: 'lid', o: [0, 24, 0], b: [[0, 0, -8, -16, -8, 16, 12, 16]] }, { n: 'head', o: [0, 12, 0], b: [[0, 52, -3, 0, -3, 6, 6, 6]] }] },
  endermite: { tex: 'endermite', tw: 64, th: 32, parts: SEGMENTS([[4, 3, 2], [6, 4, 5], [3, 3, 1], [1, 2, 1]], [[0, 0], [0, 5], [0, 14], [0, 18]]) },
  silverfish: { tex: 'silverfish', tw: 64, th: 32, parts: SEGMENTS([[3, 2, 2], [4, 3, 2], [6, 4, 3], [3, 3, 3], [2, 2, 3], [2, 1, 2], [1, 1, 2]], [[0, 0], [0, 4], [0, 9], [0, 16], [0, 22], [11, 0], [13, 4]]) },
  wolf: { tex: 'wolf', tw: 64, th: 32, parts: [
    { n: 'head', o: [-1, 13.5, -7], b: [[0, 0, -2, -3, -2, 6, 6, 4], [16, 14, -2, -5, 0, 2, 2, 1], [16, 14, 2, -5, 0, 2, 2, 1], [0, 10, -0.5, 0, -5, 3, 3, 4]] },
    { n: 'body', o: [0, 14, 2], r: [Math.PI / 2, 0, 0], b: [[18, 14, -3, -2, -3, 6, 9, 6]] },
    { n: 'mane', o: [-1, 14, -3], r: [Math.PI / 2, 0, 0], b: [[21, 0, -3, -3, -3, 8, 6, 7]] },
    { n: 'rleg2', o: [-2.5, 16, 7], b: [[0, 18, 0, 0, -1, 2, 8, 2]] }, { n: 'lleg2', o: [0.5, 16, 7], b: [[0, 18, 0, 0, -1, 2, 8, 2]] },
    { n: 'rleg', o: [-2.5, 16, -4], b: [[0, 18, 0, 0, -1, 2, 8, 2]] }, { n: 'lleg', o: [0.5, 16, -4], b: [[0, 18, 0, 0, -1, 2, 8, 2]] },
    { n: 'tail', o: [-1, 12, 8], r: [0.9, 0, 0], b: [[9, 18, 0, 0, -1, 2, 8, 2]] }] },
  bat: { tex: 'bat', tw: 64, th: 64, scale: 0.35, parts: [
    { n: 'head', o: [0, 0, 0], b: [[0, 0, -3, -3, -3, 6, 6, 6], [24, 0, -4, -6, -2, 3, 4, 1], [24, 0, 1, -6, -2, 3, 4, 1, 0, 1]] },
    { n: 'body', o: [0, 0, 0], b: [[0, 16, -3, 4, -3, 6, 12, 6], [0, 34, -5, 16, 0, 10, 6, 1]] },
    { n: 'rwing', o: [0, 0, 0], b: [[42, 0, -12, 1, 1.5, 10, 16, 1]] }, { n: 'rtip', p: 'rwing', o: [-12, 1, 1.5], b: [[24, 16, -8, 1, 0, 8, 12, 1]] },
    { n: 'lwing', o: [0, 0, 0], b: [[42, 0, 2, 1, 1.5, 10, 16, 1, 0, 1]] }, { n: 'ltip', p: 'lwing', o: [12, 1, 1.5], b: [[24, 16, 0, 1, 0, 8, 12, 1, 0, 1]] }] },
  cod: { tex: 'cod', tw: 32, th: 32, parts: [
    { n: 'body', o: [0, 22, 0], b: [[0, 0, -1, -2, 0, 2, 4, 7], [11, 0, -1, -2, -3, 2, 4, 3]] }, { n: 'nose', o: [0, 22, -3], b: [[0, 0, -1, -2, -1, 2, 3, 1]] },
    { n: 'tail', o: [0, 22, 7], b: [[22, 3, 0, -2, 0, 0, 4, 4]] }, { n: 'fin', o: [0, 20, 0], b: [[20, -6, 0, -1, -1, 0, 1, 6]] }] },
  salmon: { tex: 'salmon', tw: 32, th: 32, parts: [
    { n: 'body', o: [0, 20, 0], b: [[0, 0, -1.5, -2.5, 0, 3, 5, 8], [22, 0, -1, -2, -3, 2, 4, 3]] }, { n: 'back', p: 'body', o: [0, 0, 8], b: [[0, 13, -1.5, -2.5, 0, 3, 5, 8]] },
    { n: 'tail', p: 'back', o: [0, 0, 8], b: [[20, 10, 0, -2.5, 0, 0, 5, 6]] }] },
});
// ---------- OptiFine random entity skins (optifine/random/entity/*.properties) ----------
const RANDOM_SKINS = {
  zombie: [['zombie', 'r_zombie12', 'r_zombie13']], husk: [['husk', 'r_husk2', 'r_husk3', 'r_husk4']], drowned: [['drowned', 'r_drowned3', 'r_drowned4']],
  skeleton: [['skeleton', 'r_skeleton2', 'r_skeleton3', 'r_skeleton4'], [10, 10, 1, 10]], stray: [['stray', 'r_stray2']], wither_skeleton: [['wither_skeleton', 'r_wither_skeleton2', 'r_wither_skeleton3']],
  cow: [['cow', 'r_cow2']],
};
function pickSkin(type, e) {
  const h = (S.hash32(W.seed, e.id, Math.floor(e.x), Math.floor(e.z)) >>> 0) / 4294967296;
  if (type === 'creeper') return e.y < 55 ? 'r_creeper3' : h < 0.5 ? 'creeper' : 'r_creeper2'; // creeper.properties: skins 1-2 above y55, skin 3 below
  const r = RANDOM_SKINS[type]; if (!r) return null;
  const [list, w] = r, ws = w || list.map(() => 1), tot = ws.reduce((a, b) => a + b, 0); let acc = 0;
  for (let i = 0; i < list.length; i++) { acc += ws[i] / tot; if (h < acc) return PACKPX.ent[list[i]] ? list[i] : list[0]; }
  return list[0];
}
// ---------- definitions ----------
const ZDEF = MOBDEF.zombie, SKDEF = MOBDEF.skeleton;
Object.assign(MOBDEF, {
  husk: { ...ZDEF, burn: 0, drops: [['rotten_flesh', 0, 2]] },
  drowned: { ...ZDEF, burn: 1, swim: 1, drops: [['rotten_flesh', 0, 2]], extraDrop: [['copper_ingot', 0.11]] },
  stray: { ...SKDEF, drops: [['bone', 0, 2], ['arrow', 0, 2]], extraDrop: [['slowness_arrow', 0.5]] },
  wither_skeleton: { ...SKDEF, ranged: 0, h: 2.4, w: 0.35, dmg: 8, burn: 0, fireproof: 1, armsOut: 0, drops: [['coal', 0, 1], ['bone', 0, 2]] },
  piglin: { hp: 16, w: 0.3, h: 1.95, speed: 0.11, hostile: 1, neutral: 1, dmg: 5, xp: 5, snd: 'groan', fireproof: 1, drops: [], parts: HUMAN(4), tex: () => solidBox('#e0a080'), ai: piglinAI },
  hoglin: { hp: 40, w: 0.7, h: 1.4, speed: 0.1, hostile: 1, dmg: 6, xp: 5, snd: 'growl', drops: [['porkchop', 2, 4], ['leather', 0, 1]], parts: BOXPARTS(16, 14, 26), tex: () => solidBox('#c08060'), food: 'crimson_fungus' },
  strider: { hp: 20, w: 0.45, h: 1.7, speed: 0.06, xp: 2, snd: 'hmm', fireproof: 1, drops: [['string', 2, 5]], parts: BOXPARTS(16, 14, 16), tex: () => solidBox('#a04040'), ai: striderAI, food: 'warped_fungus' },
  shulker: { hp: 30, w: 0.5, h: 1, speed: 0, hostile: 1, xp: 5, snd: 'click', drops: [['shulker_shell', 0, 1]], parts: BOXPARTS(16, 16, 16), tex: () => solidBox('#9a6aa0'), ai: shulkerAI, anim: shulkerAnim, noPush: 1, kbRes: 1 },
  endermite: { hp: 8, w: 0.2, h: 0.3, speed: 0.12, hostile: 1, dmg: 2, xp: 3, snd: 'spider', drops: [], parts: BOXPARTS(6, 4, 8), tex: () => solidBox('#302040') },
  silverfish: { hp: 8, w: 0.2, h: 0.3, speed: 0.12, hostile: 1, dmg: 1, xp: 5, snd: 'spider', drops: [], parts: BOXPARTS(6, 4, 10), tex: () => solidBox('#8a8a8a') },
  wolf: { hp: 8, w: 0.3, h: 0.85, speed: 0.12, xp: 2, snd: 'bleat', drops: [], parts: BOXPARTS(6, 6, 10), tex: () => solidBox('#d0d0d0'), ai: wolfAI, anim: wolfAnim, food: 'bone' },
  bat: { hp: 6, w: 0.25, h: 0.9, speed: 0.05, xp: 0, snd: 'click', drops: [], parts: BOXPARTS(6, 6, 6), tex: () => solidBox('#4a3a2a'), ai: batAI, anim: batAnim },
  cod: { hp: 3, w: 0.25, h: 0.3, speed: 0.04, xp: 1, snd: 'splash', water: 1, fish: 1, drops: [['cod', 1, 1]], extraDrop: [['bone_meal', 0.05]], parts: BOXPARTS(2, 4, 7), tex: () => solidBox('#a08060') },
  salmon: { hp: 3, w: 0.35, h: 0.4, speed: 0.04, xp: 1, snd: 'splash', water: 1, fish: 1, drops: [['salmon', 1, 1]], extraDrop: [['bone_meal', 0.05]], parts: BOXPARTS(3, 5, 8), tex: () => solidBox('#b04040') },
});
MOBDEF.drowned.drops = [['rotten_flesh', 0, 2]];
// ---------- AI ----------
const wearsGold = () => INV.armor.some(s => s && ITEMS[s.id].armor && ITEMS[s.id].armor.mat === 'golden');
const BARTER = [['ender_pearl', 2, 4, 2], ['string', 3, 9, 5], ['obsidian', 1, 1, 10], ['crying_obsidian', 1, 3, 10], ['fire_charge', 1, 1, 10], ['leather', 2, 4, 10], ['soul_sand', 2, 8, 10],
  ['nether_brick', 2, 8, 10], ['gravel', 8, 16, 10], ['blackstone', 8, 16, 10], ['iron_nugget', 10, 36, 5], ['quartz', 8, 16, 10], ['glowstone_dust', 5, 12, 10], ['magma_cream', 2, 6, 10], ['spectral', 0, 0, 0]];
function piglinAI(e, dist) {
  // piglins leave players in gold armour alone; they barter for gold ingots
  if (!e.target && !wearsGold() && plTargetable() && dist < 12 && canSee(e.x, e.y + 1.6, e.z, PL.x, PL.y + 1.6, PL.z)) e.target = PL;
  if (e.target === PL && (wearsGold() && !e.angry || !plTargetable() || dist > 24)) e.target = null;
  if (e.barter > 0) {
    e.barter--; e.yawTarget = e.yaw;
    if (e.barter === 0) { const pool = BARTER.filter(b => b[3]), tot = pool.reduce((a, b) => a + b[3], 0); let r = Math.random() * tot; for (const [k, lo, hi, w] of pool) { r -= w; if (r <= 0) { const n = lo + Math.floor(Math.random() * (hi - lo + 1)); if (IID[k] != null) dropItem(e.x, e.y + 1.2, e.z, IID[k], n, [(PL.x - e.x) * 0.05, 0.3, (PL.z - e.z) * 0.05]); break; } } play('hmm'); }
    walkPhysics(e, 0, 0, 0); return;
  }
  // pick up gold ingots lying nearby
  if (!e.target) for (const it of ENT) if (it.kind === 'item' && !it.dead && it.stack.id === IID.gold_ingot && Math.hypot(it.x - e.x, it.z - e.z) < 1.2 && Math.abs(it.y - e.y) < 1.5) { it.stack.n--; if (!it.stack.n) removeEnt(it); e.barter = 120; if (it.byPlayer) advGrant('nether/distract_piglin', 'distract_piglin'); return; }
  let mx = 0, mz = 0;
  if (e.target) { faceTo(e, PL.x, PL.z); [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); if (dist < 1.6 && Math.abs(PL.y - e.y) < 2 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, e.def.dmg, mx, mz); } }
  else if (PL.held() && PL.held().id === IID.gold_ingot && dist < 8 && plTargetable()) { faceTo(e, PL.x, PL.z); if (dist > 2) [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); }
  else { if (!e.goal && Math.random() < 1 / 120) e.goal = [e.x + (Math.random() - .5) * 12, e.z + (Math.random() - .5) * 12]; if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } } }
  walkPhysics(e, mx, mz, e.target ? 0.12 : 0.06);
}
function striderAI(e) {
  const inLava = fluidAt(e.x, e.y + 0.3, e.z) === 2, onLava = getBlock(Math.floor(e.x), Math.floor(e.y - 0.05), Math.floor(e.z)) === BID.lava;
  e.cold = !inLava && !onLava;
  if (!e.goal || Math.random() < 0.01) e.goal = [e.x + (Math.random() - .5) * 16, e.z + (Math.random() - .5) * 16];
  const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz) || 1; e.yawTarget = Math.atan2(-gx, -gz);
  const sp = e.cold ? 0.03 : 0.07;
  e.vx += (gx / gl * sp - e.vx) * 0.3; e.vz += (gz / gl * sp - e.vz) * 0.3;
  if (inLava) e.vy = Math.min(e.vy + 0.05, 0.1); else if (onLava) e.vy = Math.max(e.vy, 0); else e.vy = (e.vy - 0.08) * 0.98;
  turn(e); physMove(e, e.vx, e.vy, e.vz, 0.6);
  if (onLava && e.vy < 0) { e.vy = 0; e.y = Math.ceil(e.y - 0.05); }
  const hs = Math.hypot(e.vx, e.vz); e.walkAmt += (Math.min(1, hs * 8) - e.walkAmt) * 0.3; e.walk += hs * 6;
}
function shulkerAI(e, dist) {
  e.vx = e.vy = e.vz = 0;
  e.peekT = (e.peekT || 0) - 1;
  if (e.peekT <= 0) { e.peekWant = Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 0.3 : 1; e.peekT = 40 + Math.floor(Math.random() * 80); }
  const see = plTargetable() && dist < 16 && canSee(e.x, e.y + 0.6, e.z, PL.x, PL.y + 1.2, PL.z);
  if (see) { e.peekWant = 1; e.atk = (e.atk || 0) + 1; if (e.atk % (20 + Math.floor(Math.random() * 40)) === 0) spawnShulkerBullet(e); }
  e.peek = (e.peek || 0) + ((e.peekWant || 0) - (e.peek || 0)) * 0.1;
}
function shulkerAnim(e, P) { if (P.lid) { P.lid.position.y = (24 - 24) / 16 + (e.peek || 0) * 0.5; P.lid.rotation.y = (e.peek || 0) * 0.5; } if (P.head) P.head.position.y = (24 - 12) / 16 + (e.peek || 0) * 0.3; }
function shulkerHurtMul(e) { return (e.peek || 0) < 0.2 ? 0.2 : 1; } // closed shells are armoured
function spawnShulkerBullet(owner) {
  const b = Ent('bullet', owner.x, owner.y + 0.6, owner.z); b.kind = 'bullet'; b.w = 0.15; b.h = 0.3; b.owner = owner; b.hittable = true;
  b.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xf8f0d0 }));
  b.tick = bulletTick; b.render = (e, x, y, z, br, now) => { e.mesh.position.set(x, y + 0.15, z); e.mesh.rotation.set(now / 100, now / 130, 0); };
  b.onHit = e => { removeEnt(e); play('hit', { vol: 0.4 }); };
  addEnt(b); play('click', { pitch: 0.6 });
}
function bulletTick(e) {
  if (e.age > 300 || PL.dead) { removeEnt(e); return; }
  const dx = PL.x - e.x, dy = PL.y + 1 - e.y, dz = PL.z - e.z, d = Math.hypot(dx, dy, dz) || 1, sp = 0.18; // homing, axis-ish like Java
  e.vx += (dx / d * sp - e.vx) * 0.15; e.vy += (dy / d * sp - e.vy) * 0.15; e.vz += (dz / d * sp - e.vz) * 0.15;
  e.x += e.vx; e.y += e.vy; e.z += e.vz;
  if (SOLID[getBlock(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z))]) { removeEnt(e); return; }
  if (d < 0.8) { removeEnt(e); if (hurtPlayer(4 * DIFF_MUL(), 'mob', e.owner)) addEffect(PL, 'levitation', 200, 0); }
  if (Math.random() < 0.3) R.simpleParticle(e.x, e.y + 0.15, e.z, [1, 1, 0.9], { size: 0.08, vy: 0, grav: 0, life: 0.3 });
}
function wolfAI(e, dist) {
  const tame = e.owner === 'player';
  if (!tame && e.target === PL && (!plTargetable() || dist > 24)) e.target = null;
  if (tame && e.target === PL) e.target = null;
  // a tame wolf fights whatever hurt its owner or whatever the owner hits
  if (tame && !e.target && PL.lastAttacked && !PL.lastAttacked.dead && PL.lastAttacked !== e && Math.hypot(PL.lastAttacked.x - e.x, PL.lastAttacked.z - e.z) < 16) e.target = PL.lastAttacked;
  if (e.target && e.target !== PL && e.target.dead) e.target = null;
  let mx = 0, mz = 0, sp = 0.1;
  if (e.sitting) { walkPhysics(e, 0, 0, 0); return; }
  if (e.target) {
    const t = e.target, tx = t.x, tz = t.z; faceTo(e, tx, tz); [mx, mz] = pathDir(e, tx, t.y, tz); sp = 0.15;
    if (Math.hypot(tx - e.x, tz - e.z) < 1.2 + (t.w || 0.3) && Math.abs(t.y - e.y) < 1.5 && e.attackCd <= 0) { e.attackCd = 20; if (t === PL) attackPlayer(e, 3, mx, mz); else hurtMob(t, tame ? 4 : 2, e, mx, mz); }
  } else if (tame && dist > 4) {
    if (dist > 14 && PL.onGround) { e.x = e.px = PL.x + (Math.random() - .5); e.y = e.py = PL.y; e.z = e.pz = PL.z + (Math.random() - .5); e.path = null; }
    else { faceTo(e, PL.x, PL.z); [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); sp = 0.13; }
  } else if (!tame) { if (!e.goal && Math.random() < 1 / 120) e.goal = [e.x + (Math.random() - .5) * 12, e.z + (Math.random() - .5) * 12]; if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } } }
  walkPhysics(e, mx, mz, sp);
}
function wolfAnim(e, P) {
  if (P.tail) P.tail.rotation.x = -(e.owner ? 1.2 : 0.6) - (e.hp / e.def.hp) * 0.3;
  if (e.sitting) { e.mesh.position.y -= 0.25; for (const n of ['rleg2', 'lleg2']) if (P[n]) P[n].rotation.x = 1.4; }
  const want = e.owner === 'player' ? 'wolf_tame' : e.target ? 'wolf_angry' : 'wolf';
  if (e.wTex !== want) { const t = packTexture(want); if (t) { e.wTex = want; for (const m of e.mesh.userData.own || []) m.map = t; } }
}
function batAI(e) {
  if (!e.goal || Math.random() < 0.02 || Math.hypot(e.goal[0] - e.x, e.goal[1] - e.y, e.goal[2] - e.z) < 1) e.goal = [e.x + (Math.random() - .5) * 10, e.y + (Math.random() - .5) * 6, e.z + (Math.random() - .5) * 10];
  const gx = e.goal[0] - e.x, gy = e.goal[1] - e.y, gz = e.goal[2] - e.z, gl = Math.hypot(gx, gy, gz) || 1;
  e.vx += (gx / gl * 0.1 - e.vx) * 0.1; e.vy += (gy / gl * 0.1 - e.vy) * 0.1; e.vz += (gz / gl * 0.1 - e.vz) * 0.1;
  e.yawTarget = Math.atan2(-e.vx, -e.vz); turn(e, 0.3); physMove(e, e.vx, e.vy, e.vz, 0);
  if (e.hitH || e.hitV) e.goal = null;
  if (!e.persistent && Math.hypot(PL.x - e.x, PL.z - e.z) > 48) removeEnt(e);
}
function batAnim(e, P, now) { const f = Math.sin(now / 40) * 1.1; if (P.rwing) { P.rwing.rotation.y = f; P.lwing.rotation.y = -f; P.rtip.rotation.y = f * 0.5; P.ltip.rotation.y = -f * 0.5; } }
// drowned swim toward their target; fish wiggle
function swimAssist(e) { if (e.def.swim && e.inWater && e.target) { e.vy += Math.sign(PL.y - e.y) * 0.03; e.vy = Math.max(-0.12, Math.min(0.12, e.vy)); } }
// ---------- player interaction with the new mobs ----------
function mobInteract(e, h, d) {
  if (e.def.interact && e.def.interact(e, h, d)) return true;
  if (e.type === 'piglin' && d && h.id === IID.gold_ingot && !e.target && !e.barter) { advGrant('nether/distract_piglin', 'distract_piglin_directly'); e.barter = 120; consume(); swing(); play('hmm'); return true; }
  if (e.type === 'wolf') {
    if (e.owner === 'player') { if (d && h.id === IID.bone && e.hp < e.def.hp) { e.hp = Math.min(e.def.hp, e.hp + 4); consume(); } else e.sitting = e.sitting ? 0 : 1; swing(); return true; }
    if (d && h.id === IID.bone && !e.target) { consume(); swing(); if (Math.random() < 1 / 3) { e.owner = 'player'; e.persistent = true; e.hp = e.def.hp = 20; e.sitting = 1; for (let i = 0; i < 7; i++) R.simpleParticle(e.x, e.y + 1, e.z, [1, 0.3, 0.4], { size: 0.15, vy: 1, grav: 0 }); ADVT.tamed(e); } else for (let i = 0; i < 7; i++) R.simpleParticle(e.x, e.y + 1, e.z, [0.3, 0.3, 0.3], { size: 0.15, vy: 1, grav: 0 }); return true; }
  }
  return false;
}
// ---------- spawning ----------
function overworldReplace(t, x, y, z) {
  const b = biomeAt(x, z);
  if (t === 'zombie' && (b === S.BIO.DESERT || b === S.BIO.BADLANDS) && Math.random() < 0.8 && (getLight(x, y, z) >> 4) > 8) return 'husk';
  if (t === 'skeleton' && (b === S.BIO.TUNDRA || b === S.BIO.SNOWY_TAIGA || b === S.BIO.FROZEN_OCEAN) && Math.random() < 0.8) return 'stray';
  if (t === 'zombie' && FLUID[getBlock(x, y, z)] === 1) return 'drowned';
  if (t === 'zombie' && Math.random() < 0.05) return 'witch';
  if (t === 'zombie' && Math.random() < 0.05) return 'zombie_villager';
  if (t === 'spider' && y < 50 && Math.random() < 0.1) return 'silverfish';
  return t;
}
function netherExtra(x, y, z) {
  const bio = biomeAt(x, z), below = getBlock(x, y - 1, z);
  if (below === BID.nether_bricks) return Math.random() < 0.7 ? 'wither_skeleton' : 'blaze';
  if (bio === S.NETHER_BIO.CRIMSON) return Math.random() < 0.45 ? 'piglin' : Math.random() < 0.5 ? 'hoglin' : null;
  if (bio === S.NETHER_BIO.WASTES && Math.random() < 0.2) return 'piglin';
  return null;
}
function trySpawnStrider() {
  if (W.dim !== -1 || countMobs(e => e.type === 'strider') >= 4) return;
  const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 40, x = Math.floor(PL.x + Math.cos(a) * r), z = Math.floor(PL.z + Math.sin(a) * r);
  if (!isLoaded(x, z)) return;
  if (getBlock(x, 31, z) === BID.lava && getBlock(x, 32, z) === 0) spawnMob('strider', x + .5, 32, z + .5);
}
function trySpawnAmbient() {
  if (W.dim !== 0 || countMobs(e => e.type === 'bat') >= 3) return;
  const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 24, x = Math.floor(PL.x + Math.cos(a) * r), z = Math.floor(PL.z + Math.sin(a) * r), y = 10 + Math.floor(Math.random() * 40);
  if (!isLoaded(x, z) || getBlock(x, y, z) || getBlock(x, y + 1, z) || (getLight(x, y, z) & 15) > 3 || (getLight(x, y, z) >> 4) > 0) return;
  spawnMob('bat', x + .5, y, z + .5);
}
// chunk-load spawns: wolf packs in forests/taigas, fish in water
function spawnExtraForChunk(c) {
  const R0 = S.rng(S.hash32(W.seed, c.cx, c.cz, 19)), b = c.biome[8 * 16 + 8];
  if ((b === S.BIO.TAIGA || b === S.BIO.SNOWY_TAIGA || b === S.BIO.FOREST) && R0() < 0.03) {
    for (let i = 0; i < 2 + R0.int(3); i++) { const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12); let y = CH - 2; while (y > 1 && !SOLID[c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]]) y--; if (c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] === 2) spawnMob('wolf', x + .5, y + 1, z + .5); }
  }
  if ((S.isOceanBio(b) || b === S.BIO.RIVER) && R0() < 0.08) {
    const t = b === S.BIO.RIVER || b === S.BIO.FROZEN_OCEAN || b === S.BIO.COLD_OCEAN ? 'salmon' : 'cod';
    for (let i = 0; i < 3 + R0.int(4); i++) { const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12), y = 50 + R0.int(10); if (c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] === 27) spawnMob(t, x + .5, y, z + .5); }
  }
}
// ---------- OptiFine custom night sky (optifine/sky/world0/nightbox.png) ----------
let skyBox = null;
function buildSkyBox() {
  const sk = PACKPX.sky; if (!sk) return null;
  const tex = new THREE.DataTexture(sk.px, sk.w, sk.h, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  // OptiFine sky layout: 3x2 cells — row 0: down, up, north; row 1: south, west, east
  const cell = (cx, cy) => [cx / 3, 1 - cy / 2, (cx + 1) / 3, 1 - (cy + 1) / 2];
  const faces = [[[0, -1, 0], cell(0, 0)], [[0, 1, 0], cell(1, 0)], [[0, 0, -1], cell(2, 0)], [[0, 0, 1], cell(0, 1)], [[-1, 0, 0], cell(1, 1)], [[1, 0, 0], cell(2, 1)]];
  const pos = [], uv = [], R0 = 300;
  for (const [n, [u0, v0, u1, v1]] of faces) {
    const a = n[0] ? [0, 0, 1] : [1, 0, 0], b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
    const c = (s, t) => [(n[0] + a[0] * s + b[0] * t) * R0, (n[1] + a[1] * s + b[1] * t) * R0, (n[2] + a[2] * s + b[2] * t) * R0];
    const q = [[c(-1, -1), [u0, v1]], [c(1, -1), [u1, v1]], [c(1, 1), [u1, v0]], [c(-1, 1), [u0, v0]]];
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(...q[k][0]); uv.push(...q[k][1]); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, opacity: 0 }));
  m.renderOrder = -9; m.frustumCulled = false; scene.add(m); return m;
}
// faded in 17:30-18:00 and out 5:30-6:00 like sky2.properties, rotating with the stars
function updateSkyBox() {
  if (skyBox === null) skyBox = buildSkyBox() || false;
  if (!skyBox) return;
  const t = (((W.time % 24000) + 24000) % 24000 + 6000) % 24000 / 1000; // hours (0 = midnight)
  const fade = W.dim ? 0 : t >= 18 || t < 5.5 ? Math.min(1, t >= 18 ? (t - 17.5) * 2 : 1) : t < 6 ? (6 - t) * 2 : t >= 17.5 ? (t - 17.5) * 2 : 0;
  skyBox.visible = fade > 0.01 && !W.pano;
  skyBox.material.opacity = Math.max(0, Math.min(1, fade)) * (1 - W.rain);
  skyBox.position.copy(camera.position); skyBox.rotation.y = celestial() * Math.PI * 2;
}

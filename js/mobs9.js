// Finer mob behaviour: parrots on the player's shoulders and dancing to records, panda personalities, llamas that
// spit, wear carpets and walk in caravans, zombie horses.

// ---------- parrots ----------
const SHOULDER = { l: null, r: null };
function parrotPerch(e) {
  const side = e === SHOULDER.l ? -1 : 1, s = Math.sin(PL.yaw), c = Math.cos(PL.yaw);
  e.x = PL.x + c * 0.38 * side; e.z = PL.z - s * 0.38 * side; e.y = PL.y + (PL.sneaking ? 1.15 : 1.42); e.yaw = PL.yaw; e.vx = e.vy = e.vz = 0; e.flying = false;
}
function parrotOff(e) { if (SHOULDER.l === e) SHOULDER.l = null; if (SHOULDER.r === e) SHOULDER.r = null; e.perched = false; e.perchCd = 100; } // ShoulderEntity: 100 ticks before it may land again
const nearJukebox = e => { for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++) { const x = Math.floor(e.x) + dx, y = Math.floor(e.y) + dy, z = Math.floor(e.z) + dz; if (getBlock(x, y, z) === BID.jukebox) { const t = getTile(x, y, z); if (t && t.playing) return true; } } return false; };
const parrotBaseAI = MOBDEF.parrot.ai;
MOBDEF.parrot.ai = (e, dist) => {
  if (e.perched) {
    // PlayerEntity.dropShoulderEntities: falling more than half a block (a jump), water, flying, sleeping, powder snow or being hurt
    if (PL.dead || PL.inWater || PL.flying || PL.sleeping || PL.hurtT > 0 || e.owner !== 'player' || PL.gliding || (PL.fallDist || 0) > 0.5 || PL.inSnowBody) parrotOff(e); else { parrotPerch(e); return; }
  }
  if (e.perchCd > 0) e.perchCd--;
  // LandOnOwnersShoulderGoal: a tamed parrot that is not sitting flies to its owner and lands on a free shoulder on touching
  if (e.owner === 'player' && !e.sitting && !e.perchCd && !e.leashed && (!SHOULDER.l || !SHOULDER.r) && PL.mode !== 'spectator' && !PL.flying && !PL.inWater && !PL.inSnowBody && dist < 16) {
    if (Math.hypot(e.x - PL.x, e.z - PL.z) < 0.6 && e.y > PL.y && e.y < PL.y + 2.2) { /* bounding boxes touch */ if (!SHOULDER.l) SHOULDER.l = e; else SHOULDER.r = e; e.perched = true; play('hmm', { pitch: 1.9, vol: 0.4 }); parrotPerch(e); return; }
    const dx = PL.x - e.x, dy = PL.y + 1.4 - e.y, dz = PL.z - e.z, l = Math.hypot(dx, dy, dz) || 1, sp = Math.min(0.25, 0.08 + l * 0.02);
    e.vx += (dx / l * sp - e.vx) * 0.25; e.vy += (dy / l * sp - e.vy) * 0.25; e.vz += (dz / l * sp - e.vz) * 0.25; e.flying = true;
    if (e.climbT > 0) { e.climbT--; e.vy = 0.15; }
    e.yawTarget = Math.atan2(-dx, -dz); turn(e, 0.3); const ox = e.x, oz = e.z; physMove(e, e.vx, e.vy, e.vz); if (Math.hypot(e.x - ox, e.z - oz) < sp * 0.3) e.climbT = 12; return; // blocked: fly up over it
  }
  if (e.age % 20 === 0) e.dancing = nearJukebox(e);
  if (e.dancing && !e.sitting) { walkPhysics(e, 0, 0, 0); return; }
  // now and then a parrot imitates a monster close by
  if (e.age % 200 === 0 && Math.random() < 0.3) { const m = ENT.find(o => o.kind === 'mob' && o.def.hostile && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 20); if (m) play(m.def.snd || 'hmm', { pitch: 1.8, vol: 0.4 }); }
  parrotBaseAI(e, dist);
};
const parrotBaseAnim = MOBDEF.parrot.anim;
MOBDEF.parrot.anim = (e, P, now) => {
  parrotBaseAnim(e, P, now);
  if (P.body && P.head) { const d = e.dancing ? Math.sin(now / 120) * 0.35 : 0; P.head.rotation.z = d; P.body.rotation.z = d * 0.5; }
};

// ---------- pandas: each has a main gene that sets its manner ----------
const PANDA_GENES = ['normal', 'lazy', 'worried', 'playful', 'aggressive', 'weak', 'brown'];
// Java's genetics: a main and a hidden gene; brown and weak are recessive and only show when both genes match
const PANDA_WEIGHT = { normal: 5, lazy: 1, worried: 1, playful: 1, aggressive: 1, weak: 1, brown: 1 };
const pandaRandomGene = () => { let t = Math.random() * 11; for (const g of PANDA_GENES) { t -= PANDA_WEIGHT[g]; if (t < 0) return g; } return 'normal'; };
const pandaShown = e => (e.gene === 'brown' || e.gene === 'weak') && e.gene2 !== e.gene ? 'normal' : e.gene;
function pandaGenes(e) { if (!e.gene) { e.gene = e.variant === 1 ? 'brown' : pandaRandomGene(); e.gene2 = e.variant === 1 ? 'brown' : pandaRandomGene(); } }
const PANDA_GENE_KO = { normal: '보통', lazy: '게으름', worried: '걱정 많음', playful: '장난기', aggressive: '공격적', weak: '약함', brown: '갈색' };
const pandaBaseAI = MOBDEF.panda.ai;
MOBDEF.panda.ai = (e, dist) => {
  pandaGenes(e); const g = pandaShown(e);
  if (e.roll > 0) { e.roll--; walkPhysics(e, -Math.sin(e.yaw) * 0.6, -Math.cos(e.yaw) * 0.6, 0.05); return; }
  if (e.lying > 0) { e.lying--; walkPhysics(e, 0, 0, 0); return; }
  if (g === 'aggressive' && e.panic > 0 && plTargetable() && dist < 12) { e.panic = 0; e.angry = 200; } // hits back instead of fleeing
  if (e.angry > 0) {
    e.angry--; faceTo(e, PL.x, PL.z); const [mx, mz] = pathDir(e, PL.x, PL.y, PL.z);
    if (dist < 1.8 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, 6, mx, mz); }
    walkPhysics(e, mx, mz, 0.08); if (!plTargetable()) e.angry = 0; return;
  }
  if (g === 'worried' && (W.thunder > 0.5 || ENT.some(o => o.kind === 'mob' && o.def.hostile && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8))) { e.lying = 40; return; } // hides its face
  if (g === 'lazy' && Math.random() < 1 / 300) { e.lying = 200 + Math.floor(Math.random() * 200); return; }
  if (g === 'playful' && Math.random() < 1 / 400) { e.roll = 30; play('hmm', { pitch: 0.8, vol: 0.4 }); return; }
  if ((g === 'weak' || e.baby) && Math.random() < (g === 'weak' ? 1 / 2000 : 0)) { dropItem(e.x, e.y + 0.5, e.z, IID.slime_ball, 1); play('hmm', { pitch: 2 }); } // weak pandas sneeze
  return pandaBaseAI(e, dist);
};
MOBDEF.panda.anim = (e, P) => {
  if (!P.body) return;
  P.body.rotation.x = e.roll > 0 ? (e.roll / 30) * Math.PI * 2 : 0;
  P.body.rotation.z = e.lying > 0 ? 0.9 : 0; // lies on its side
  if (P.head) P.head.rotation.z = e.lying > 0 ? 0.9 : 0;
};
{ const save = MOBDEF.panda.save, init = MOBDEF.panda.init;
  MOBDEF.panda.save = e => ({ ...(save ? save(e) : {}), gene: e.gene, gene2: e.gene2 }); MOBDEF.panda.init = (e, o) => { if (init) init(e, o); if (o.gene) { e.gene = o.gene; e.gene2 = o.gene2 || o.gene; } };
  // a cub takes one gene from each parent at random, each with a 1/32 chance to mutate
  MOBDEF.panda.onBred = (kid, a, b) => { pandaGenes(a); pandaGenes(b); const pick = p => Math.random() < 1 / 32 ? pandaRandomGene() : Math.random() < 0.5 ? p.gene : p.gene2; kid.gene = pick(a); kid.gene2 = pick(b); }; }

// ---------- llamas ----------
function llamaSpit(e, t) {
  const dx = t.x - e.x, dy = (t.y + (t.h || 1.6) * 0.6) - (e.y + 1.6), dz = t.z - e.z, d = Math.hypot(dx, dy, dz) || 1, v = 1.2;
  const s = shootArrow(e.x + dx / d * 0.6, e.y + 1.6, e.z + dz / d * 0.6, dx / d * v, dy / d * v + d * 0.015, dz / d * v, e, 0.8);
  s.noPickup = true; s.spit = true; s.age = 1170; s.mesh.scale.setScalar(0.3); s.mesh.material.color.set(0xf0f0e8);
  play('splash', { vol: 0.3, pitch: 1.6 });
}
function llamaExtras(e, dist) {
  // spits at wolves, and at a player who hurt it
  if (e.panic > 0 && plTargetable() && dist < 10 && !e.rider) { e.spitAt = PL; e.panic = 0; }
  if (!e.spitAt && e.age % 40 === 0) e.spitAt = ENT.find(o => o.type === 'wolf' && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 10) || null;
  if (e.spitAt) {
    const t = e.spitAt, d = Math.hypot(t.x - e.x, t.z - e.z);
    if (t.dead || d > 14 || (t === PL && !plTargetable())) e.spitAt = null;
    else { faceTo(e, t.x, t.z); if (e.attackCd <= 0) { e.attackCd = 40; llamaSpit(e, t); } walkPhysics(e, 0, 0, 0); return true; }
  }
  // caravans: a llama near a led llama follows it, up to ten in a line
  if (!e.leash && !e.rider) {
    if (e.age % 20 === 0) { const lead = ENT.find(o => o !== e && (o.type === 'llama' || o.type === 'trader_llama') && !o.dead && (o.leash || o.caravanOf) && o.caravanBy !== e && Math.hypot(o.x - e.x, o.z - e.z) < 8 && (o.caravanLen || 0) < 9); e.caravanOf = lead || null; if (lead) { lead.caravanBy = e; e.caravanLen = (lead.caravanLen || 0) + 1; } }
    const l = e.caravanOf;
    if (l && !l.dead && Math.hypot(l.x - e.x, l.z - e.z) > 2.5) { faceTo(e, l.x, l.z); const [mx, mz] = pathDir(e, l.x, l.y, l.z); walkPhysics(e, mx, mz, 0.09); return true; }
  }
  return false;
}
for (const k of ['llama', 'trader_llama']) {
  const d = MOBDEF[k], base = d.ai, inter = d.interact, save = d.save, init = d.init, drops = d.onDeathDrops;
  d.ai = (e, dist) => { if (llamaExtras(e, dist)) return; if (base) base(e, dist); else genericAnimal(e, dist); };
  // a carpet on a tamed llama: right-click with any carpet (shears take it off)
  d.interact = (e, h, dd) => {
    const key = h && ITEMS[h.id].key;
    if (key && key.endsWith('_carpet') && e.owner === 'player' && !e.baby) { if (e.carpet != null) dropItem(e.x, e.y + 1, e.z, IID[S.COLORS[e.carpet] + '_carpet'], 1); e.carpet = S.COLORS.indexOf(key.slice(0, -7)); consume(); play('place', { mat: 'wool' }); swing(); return true; }
    return inter ? inter(e, h, dd) : false;
  };
  d.save = e => ({ ...(save ? save(e) : {}), carpet: e.carpet }); d.init = (e, o) => { if (init) init(e, o); if (o.carpet != null) e.carpet = o.carpet; };
  d.onDeathDrops = e => { if (drops) drops(e); if (e.carpet != null) dropItem(e.x, e.y + .5, e.z, IID[S.COLORS[e.carpet] + '_carpet'], 1); };
}
// a box coloured through vertex colours, so the mob lighting (which sets material colours) shades it correctly
function tintedBox(w, h, d, col) {
  const g = new THREE.BoxGeometry(w, h, d), n = g.attributes.position.count, c = new Float32Array(n * 3), [r, gg, b] = hex(col).map(v => v / 255);
  for (let i = 0; i < n; i++) { const f = i < 8 ? 0.85 : i < 16 ? 1 : 0.9; c[i * 3] = r * f; c[i * 3 + 1] = gg * f; c[i * 3 + 2] = b * f; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}
function llamaCarpetTick() {
  if (W.tickN % 10) return;
  for (const e of ENT) {
    if (e.kind !== 'mob' || (e.type !== 'llama' && e.type !== 'trader_llama') || !e.mesh || e.mesh.userData.mc) continue; // Java models paint the carpet on
    const want = e.carpet != null ? e.carpet : -1;
    if ((e.carpetMesh ? e.carpetMesh.userData.c : -1) === want) continue;
    if (e.carpetMesh) { e.mesh.remove(e.carpetMesh); e.carpetMesh = null; }
    if (want >= 0) { const m = tintedBox(0.8, 0.07, 1.15, BANNER_DYE[want]); m.position.set(0, 1.35, 0.05); m.userData.c = want; e.mesh.add(m); e.carpetMesh = m; }
  }
}

// ---------- zombie horses (summoned only, as in Java): undead, cannot be tamed ----------
HORSE_COL.push(0x4a6a3a);
MOBDEF.zombie_horse = { ...HORSE_DEF('horse', '좀비 말'), drops: [['rotten_flesh', 0, 2]], food: null, variant: () => HORSE_COL.length - 1, interact: () => false, ride: null };

function mobs9Tick() { llamaCarpetTick(); }

// The remaining animals: mooshrooms (mushroom fields), pandas (bamboo jungles), polar bears, parrots and ocelots,
// llamas and trader llamas, the wandering trader, and skeleton horse traps in thunderstorms.

// ---------- mooshrooms: red cows with mushrooms; shears turn them into cows, bowls give stew ----------
MCMODELS.mooshroom = { ...MCMODELS.cow, tex: 'mooshroom' };
function mooshroomTexture() {
  if (entTex.mooshroom) return entTex.mooshroom;
  const base = PACKPX.ent.cow; if (!base) return null;
  const px = new Uint8Array(base.px);
  for (let i = 0; i < px.length; i += 4) { const r = px[i], g = px[i + 1], b = px[i + 2]; if (r > 200 && g > 200 && b > 200) { px[i] = 210; px[i + 1] = 200; px[i + 2] = 190; } else if (r < 120 && g < 100) { px[i] = Math.min(255, r * 2.4 + 40); px[i + 1] = g * 0.45; px[i + 2] = b * 0.4; } }
  const t = new THREE.DataTexture(px, base.w, base.h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return entTex.mooshroom = t;
}
function mooshroomGear(e) {
  const P = e.mesh && e.mesh.userData.parts; if (!P || !P.body || e.sheared || e.mushrooms && e.mushrooms[0].parent) return;
  e.mushrooms = [];
  const add = (parent, x, y, z, ry) => { const m = R.itemMesh(BID.red_mushroom); m.scale.setScalar(0.5); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); e.mushrooms.push(m); };
  add(e.mesh, 0.15, 1.6, 0.15, -0.84); add(e.mesh, -0.1, 1.6, -0.3, 0.73); // on the back (model root space; the back is at y 1.375)
  if (P.head) add(P.head, 0, 0.48, 0.1, -1.36); // and on top of the head
}
function mooshroomUse(e, h) {
  if (!h || e.baby) return false;
  if (h.id === IID.shears) { const x = e.x, y = e.y, z = e.z; removeEnt(e); spawnMob('cow', x, y, z).yaw = e.yaw; dropItem(x, y + 1, z, BID.red_mushroom, 5); damageItem(INV.slots, INV.sel, 1); play('click'); swing(); return true; }
  if (h.id === IID.bowl) { consume(); INV.giveOrDrop({ id: IID.mushroom_stew, n: 1 }); play('splash', { vol: 0.3 }); swing(); return true; }
  return false;
}

// ---------- pandas ----------
const PANDA_M = autoModel(v => {
  const w = v ? 0xb8946a : 0xf0f0ec, k = v ? 0x5a3a1e : 0x1e1e20;
  return [
    ['body', [0, 0, 0], [-6.5, 5, -9.5, 13, 10, 19], (f, x, y, ww, hh) => hex(f === 'top' || f === 'bottom' ? (y < hh * 0.35 ? k : w) : (x < ww * 0.3 ? k : w))],
    ['head', [0, 0, 0], [-4.5, 7, -15, 9, 7, 6], w, 0, { front: (g, x, y) => { px(g, x + 1, y + 2, '#1e1e20', 3, 2); px(g, x + 5, y + 2, '#1e1e20', 3, 2); px(g, x + 3, y + 5, '#1e1e20', 3, 1); } }],
    ['ear1', [0, 0, 0], [-5, 13, -12, 3, 3, 1], k], ['ear2', [0, 0, 0], [2, 13, -12, 3, 3, 1], k],
    ['rleg', [4, 6, -6], [-1.5, -6, -1.5, 3, 6, 3], k], ['lleg', [-4, 6, -6], [-1.5, -6, -1.5, 3, 6, 3], k],
    ['rleg2', [4, 6, 6], [-1.5, -6, -1.5, 3, 6, 3], k], ['lleg2', [-4, 6, 6], [-1.5, -6, -1.5, 3, 6, 3], k],
  ];
}, 128, 64);
function pandaAI(e, dist) {
  // eats bamboo lying around or held out to it; babies sometimes sneeze out a slime ball
  if (e.eating > 0) { e.eating--; walkPhysics(e, 0, 0, 0); return; }
  if (e.baby && Math.random() < 1 / 6000) { dropItem(e.x, e.y + 0.5, e.z, IID.slime_ball, 1); play('hmm', { pitch: 2 }); }
  const it = e.age % 20 === 0 && ENT.find(o => o.kind === 'item' && !o.dead && o.stack.id === IID.bamboo && Math.hypot(o.x - e.x, o.z - e.z) < 1.2);
  if (it) { it.stack.n--; if (!it.stack.n) removeEnt(it); e.eating = 80; return; }
  return 'default';
}

// ---------- polar bears: attack whoever comes near their cubs, or hits them ----------
const BEAR_M = autoModel(() => [
  ['body', [0, 0, 0], [-7, 10, -10, 14, 12, 22], 0xf4f4f0], ['head', [0, 0, 0], [-3.5, 13, -17, 7, 7, 7], 0xf4f4f0, 0, eyes('#101010', 2, 1, 5)],
  ['nose', [0, 0, 0], [-2, 13, -20, 4, 3, 3], 0xe8e8e4, 0, { front: (g, x, y) => px(g, x + 1, y, '#101010', 2, 1) }], ['ear1', [0, 0, 0], [-4, 20, -14, 2, 2, 1], 0xf4f4f0], ['ear2', [0, 0, 0], [2, 20, -14, 2, 2, 1], 0xf4f4f0],
  ['rleg', [4.5, 10, -6], [-2, -10, -2, 4, 10, 4], 0xe8e8e4], ['lleg', [-4.5, 10, -6], [-2, -10, -2, 4, 10, 4], 0xe8e8e4], ['rleg2', [4.5, 10, 7], [-2, -10, -2, 4, 10, 4], 0xe8e8e4], ['lleg2', [-4.5, 10, 7], [-2, -10, -2, 4, 10, 4], 0xe8e8e4],
], 128, 64);
function polarBearAI(e, dist) {
  if (!e.baby && !e.target && plTargetable() && dist < 6 && ENT.some(o => o.type === 'polar_bear' && o.baby && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8)) e.target = PL;
  if (e.target === PL && (!plTargetable() || dist > 20)) e.target = null;
  if (e.target === PL) { faceTo(e, PL.x, PL.z); const [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); if (dist < 2 && e.attackCd <= 0) { e.attackCd = 20; e.rear = 10; attackPlayer(e, 6, mx, mz); } walkPhysics(e, mx, mz, 0.13); return; }
  return 'default';
}

// ---------- parrots: fly about jungles, tamed with seeds, sit when told; cookies poison them ----------
const PARROT_COL = [0xd02020, 0x2a6ad8, 0x40b030, 0x40c8d8, 0xa8a8a8];
const PARROT_M = autoModel(v => { const c = PARROT_COL[v] || PARROT_COL[0]; return [
  ['body', [0, 0, 0], [-1.5, 2, -1.5, 3, 6, 3], c], ['head', [0, 0, 0], [-1, 7, -2, 2, 3, 2], c, 0, eyes('#101010', 1, 0, 1)], ['beak', [0, 0, 0], [-0.5, 7.5, -3, 1, 2, 1], 0xe8a020],
  ['rwing', [1.5, 7, 0], [0, -5, -1.5, 1, 5, 3], (f, x, y) => hex(y > 3 ? 0x2a6ad8 : c)], ['lwing', [-1.5, 7, 0], [-1, -5, -1.5, 1, 5, 3], (f, x, y) => hex(y > 3 ? 0x2a6ad8 : c)],
  ['tail', [0, 2, 1], [-1, -3, 0, 2, 4, 1], c], ['rleg', [0.6, 2, 0], [-0.5, -2, -0.5, 1, 2, 1], 0x404040], ['lleg', [-0.6, 2, 0], [-0.5, -2, -0.5, 1, 2, 1], 0x404040],
]; });
function parrotAI(e, dist) {
  if (e.sitting) { walkPhysics(e, 0, 0, 0); return; }
  const tame = e.owner === 'player';
  if (tame && dist > 3) { if (dist > 16) { e.x = PL.x; e.y = PL.y + 1; e.z = PL.z; } e.goal3 = [PL.x + (Math.random() - .5) * 2, PL.y + 1.5, PL.z + (Math.random() - .5) * 2]; }
  else if (!e.goal3 || Math.random() < 0.01 || Math.hypot(e.goal3[0] - e.x, e.goal3[1] - e.y, e.goal3[2] - e.z) < 1) e.goal3 = [e.x + (Math.random() - .5) * 10, e.y + (Math.random() - .5) * 3, e.z + (Math.random() - .5) * 10];
  const [gx, gy, gz] = e.goal3, dx = gx - e.x, dy = gy - e.y, dz = gz - e.z, l = Math.hypot(dx, dy, dz) || 1, fly = !e.onGround || l > 2;
  if (fly) { e.vx += (dx / l * 0.12 - e.vx) * 0.1; e.vy += (dy / l * 0.12 - e.vy) * 0.1; e.vz += (dz / l * 0.12 - e.vz) * 0.1; e.yawTarget = Math.atan2(-dx, -dz); turn(e, 0.3); physMove(e, e.vx, e.vy, e.vz, 0); if (e.hitH) e.vy += 0.1; e.flying = true; }
  else { e.flying = false; walkPhysics(e, 0, 0, 0); }
}
function parrotUse(e, h) {
  if (h && h.id === IID.cookie) { consume(); addEffect(e, 'poison', 400, 0); hurtMob(e, 999, PL); return true; }
  if (e.owner === 'player') { e.sitting = e.sitting ? 0 : 1; swing(); return true; }
  if (h && (h.id === IID.wheat_seeds || h.id === IID.melon_seeds || h.id === IID.pumpkin_seeds || h.id === IID.beetroot_seeds)) { consume(); swing(); if (Math.random() < 1 / 3) { e.owner = 'player'; e.persistent = true; e.sitting = 1; ADVT.tamed(e); for (let i = 0; i < 6; i++) R.simpleParticle(e.x, e.y + .6, e.z, [1, 0.3, 0.4], { kind: 'heart', size: 0.1, vy: 1, grav: 0 }); } return true; }
  return false;
}
function parrotAnim(e, P, now) { const f = e.flying ? Math.sin(now / 50) * 0.9 : 0; if (P.rwing) { P.rwing.rotation.z = -f; P.lwing.rotation.z = f; } }

// ---------- ocelots: shy jungle cats that come to trust a patient player with fish ----------
CAT_COL.push([0xe8c050, 0x8a5a1a, 0xf0d890]);
const OCELOT_V = CAT_COL.length - 1;
function ocelotAI(e, dist) {
  const held = PL.held(), fish = held && (held.id === IID.cod || held.id === IID.salmon);
  if (!e.trusting && dist < 8 && !(PL.sneaking && fish) && !PL.dead && !spectator() && PL.mode !== 'creative') { const l = Math.hypot(e.x - PL.x, e.z - PL.z) || 1, mx = (e.x - PL.x) / l, mz = (e.z - PL.z) / l; e.yawTarget = Math.atan2(-mx, -mz); walkPhysics(e, mx, mz, 0.16); return; }
  if (fish && PL.sneaking && dist < 8 && dist > 1.5) { faceTo(e, PL.x, PL.z); const [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); walkPhysics(e, mx, mz, 0.05); return; }
  return 'default';
}
function ocelotUse(e, h) {
  if (!h || (h.id !== IID.cod && h.id !== IID.salmon) || e.trusting) return false;
  consume(); swing(); if (Math.random() < 1 / 3) { e.trusting = true; e.persistent = true; for (let i = 0; i < 6; i++) R.simpleParticle(e.x, e.y + .6, e.z, [1, 0.3, 0.4], { kind: 'heart', size: 0.1, vy: 1, grav: 0 }); }
  return true;
}

// ---------- llamas and trader llamas (tamed by riding, carry chests; cannot be steered) ----------
const LLAMA_COL = [0xe8d8b0, 0xf0f0ec, 0x8a6040, 0x9a9a98];
function llamaSpec(trader) {
  return v => { const c = LLAMA_COL[v] || LLAMA_COL[0], d = lighter(c, 0.85); return [
    ['body', [0, 0, 0], [-6, 11, -9, 12, 10, 18], (f) => hex(f === 'top' && trader ? 0x2a4ab8 : c)],
    ['neck', [0, 0, 0], [-4, 18, -12, 8, 14, 6], c], ['head', [0, 0, 0], [-2, 28, -16, 4, 4, 9], d, 0, eyes('#101010', 1, 0, 3)],
    ['ear1', [0, 0, 0], [-4, 32, -11, 3, 3, 2], c], ['ear2', [0, 0, 0], [1, 32, -11, 3, 3, 2], c],
    ['rleg', [3.5, 11, -6], [-2, -11, -2, 4, 11, 4], c], ['lleg', [-3.5, 11, -6], [-2, -11, -2, 4, 11, 4], c], ['rleg2', [3.5, 11, 6], [-2, -11, -2, 4, 11, 4], c], ['lleg2', [-3.5, 11, 6], [-2, -11, -2, 4, 11, 4], c],
    ['rchest', [0, 0, 0], [6, 13, 1, 3, 8, 8], (k, x, y) => hex(y === 2 ? 0x3a2410 : 0xa8743a)], ['lchest', [0, 0, 0], [-9, 13, 1, 3, 8, 8], (k, x, y) => hex(y === 2 ? 0x3a2410 : 0xa8743a)],
    ['saddle', [0, 0, 0], [-6, 21, -5, 12, 1, 9], trader ? 0xd8b030 : 0x7a4a24, 0.15],
    ...HARMOR_KEYS.flatMap((k, i) => [['ab' + i, [0, 0, 0], [-6, 11, -9, 12, 10, 18], () => null, 0.35], ['ah' + i, [0, 0, 0], [-2, 28, -16, 4, 4, 9], () => null, 0.3]]),
  ]; };
}
const LLAMA_M = autoModel(llamaSpec(false), 256, 128), TLLAMA_M = autoModel(llamaSpec(true), 256, 128);
const LLAMA_DEF = (M, name) => ({ ...HORSE_DEF('donkey', name), parts: M.parts, tw: 256, th: 128, tex: () => M.tex(0), vtex: v => M.tex(v), variant: () => (Math.random() * 4) | 0, h: 1.87, w: 0.45, rideY: 1.2, food: ['hay_block', 'wheat'], mates: null, drops: [['leather', 0, 2]] });

// ---------- the wandering trader: turns up now and then with two trader llamas, sells odd goods, leaves after a while ----------
const TRADER_M = autoModel(() => ILLAGER_BODY(0xc89a6a, 0x2a4ab8, 0x1a2a6a), 128, 64);
// vanilla 1.17 wandering trader: five offers from the common list and one from the rare list
TRADES.wandering = [[['emerald', 2], ['sea_pickle', 1]], [['emerald', 4], ['slime_ball', 1]], [['emerald', 2], ['glowstone', 1]], [['emerald', 5], ['nautilus_shell', 1]], [['emerald', 1], ['fern', 1]], [['emerald', 1], ['sugar_cane', 1]], [['emerald', 1], ['pumpkin', 1]], [['emerald', 3], ['kelp', 1]], [['emerald', 3], ['cactus', 1]], [['emerald', 1], ['dandelion', 1]], [['emerald', 1], ['poppy', 1]], [['emerald', 1], ['blue_orchid', 1]], [['emerald', 1], ['allium', 1]], [['emerald', 1], ['azure_bluet', 1]], [['emerald', 1], ['red_tulip', 1]], [['emerald', 1], ['orange_tulip', 1]], [['emerald', 1], ['white_tulip', 1]], [['emerald', 1], ['pink_tulip', 1]], [['emerald', 1], ['oxeye_daisy', 1]], [['emerald', 1], ['cornflower', 1]], [['emerald', 1], ['lily_of_the_valley', 1]], [['emerald', 1], ['wheat_seeds', 1]], [['emerald', 1], ['beetroot_seeds', 1]], [['emerald', 1], ['pumpkin_seeds', 1]], [['emerald', 1], ['melon_seeds', 1]], [['emerald', 5], ['acacia_sapling', 1]], [['emerald', 5], ['birch_sapling', 1]], [['emerald', 5], ['dark_oak_sapling', 1]], [['emerald', 5], ['jungle_sapling', 1]], [['emerald', 5], ['oak_sapling', 1]], [['emerald', 5], ['spruce_sapling', 1]], [['emerald', 1], ['red_dye', 3]], [['emerald', 1], ['white_dye', 3]], [['emerald', 1], ['blue_dye', 3]], [['emerald', 1], ['pink_dye', 3]], [['emerald', 1], ['black_dye', 3]], [['emerald', 1], ['green_dye', 3]], [['emerald', 1], ['light_gray_dye', 3]], [['emerald', 1], ['magenta_dye', 3]], [['emerald', 1], ['yellow_dye', 3]], [['emerald', 1], ['gray_dye', 3]], [['emerald', 1], ['purple_dye', 3]], [['emerald', 1], ['light_blue_dye', 3]], [['emerald', 1], ['lime_dye', 3]], [['emerald', 1], ['orange_dye', 3]], [['emerald', 1], ['brown_dye', 3]], [['emerald', 1], ['cyan_dye', 3]], [['emerald', 3], ['brain_coral_block', 1]], [['emerald', 3], ['bubble_coral_block', 1]], [['emerald', 3], ['fire_coral_block', 1]], [['emerald', 3], ['horn_coral_block', 1]], [['emerald', 3], ['tube_coral_block', 1]], [['emerald', 1], ['vine', 1]], [['emerald', 1], ['brown_mushroom', 1]], [['emerald', 1], ['red_mushroom', 1]], [['emerald', 1], ['lily_pad', 2]], [['emerald', 1], ['small_dripleaf', 2]], [['emerald', 1], ['sand', 8]], [['emerald', 1], ['red_sand', 4]], [['emerald', 1], ['pointed_dripstone', 2]], [['emerald', 1], ['rooted_dirt', 2]], [['emerald', 1], ['moss_block', 2]]];
TRADES.wandering_rare = [[['emerald', 5], ['tropical_fish_bucket', 1]], [['emerald', 5], ['pufferfish_bucket', 1]], [['emerald', 3], ['packed_ice', 1]], [['emerald', 6], ['blue_ice', 1]], [['emerald', 1], ['gunpowder', 1]], [['emerald', 3], ['podzol', 3]], [['emerald', 1], ['acacia_log', 1]], [['emerald', 1], ['birch_log', 1]], [['emerald', 1], ['dark_oak_log', 1]], [['emerald', 1], ['jungle_log', 1]], [['emerald', 1], ['oak_log', 1]], [['emerald', 1], ['spruce_log', 1]]];
PROF_NAME.wandering = '떠돌이 상인';
function traderAI(e, dist) {
  if (--e.life <= 0) { for (const l of ENT) if (l.type === 'trader_llama' && l.leader === e) removeEnt(l); removeEnt(e); return; }
  return 'default';
}
function traderUse(e) { if (e.baby) return false; e.prof = 'wandering'; UI.openScreen('trade', { e }); e.trading = true; play('hmm'); return true; }
function trySpawnTrader() {
  if (W.dim !== 0 || PL.dead || ENT.some(e => e.type === 'wandering_trader' && !e.dead)) return;
  if (Math.random() > 0.25) return;
  const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 24, x = Math.floor(PL.x + Math.cos(a) * r), z = Math.floor(PL.z + Math.sin(a) * r);
  if (!isLoaded(x, z)) return; const y = topY(x, z) + 1; if (FLUID[getBlock(x, y - 1, z)]) return;
  const t = spawnMob('wandering_trader', x + .5, y, z + .5); t.life = 48000; t.persistent = true;
  for (let i = 0; i < 2; i++) { const l = spawnMob('trader_llama', x + 1.5 + i, y, z + .5); l.leader = t; l.persistent = true; }
}
// trader llamas stay with their trader
function traderLlamaAI(e) { if (e.leader && !e.leader.dead && Math.hypot(e.leader.x - e.x, e.leader.z - e.z) > 4) { faceTo(e, e.leader.x, e.leader.z); const [mx, mz] = pathDir(e, e.leader.x, e.leader.y, e.leader.z); walkPhysics(e, mx, mz, 0.1); return; } return 'default'; }

// ---------- skeleton horse traps: rarely, lightning in a storm leaves a skeleton horse; come close and four skeleton horsemen appear ----------
HORSE_COL.push(0xd8d4c8);
function skeletonTrapCheck(x, y, z) {
  if (skeletonTrapCheck.busy || W.thunder < 0.5 || PL.difficulty === 0 || Math.random() > 0.05) return;
  const h = spawnMob('skeleton_horse', x + .5, y + 1, z + .5, { variant: HORSE_COL.length - 1 }); h.trap = true; h.persistent = true;
}
function skeletonHorseAI(e, dist) {
  if (e.trap && dist < 10 && plTargetable()) {
    e.trap = false; skeletonTrapCheck.busy = true; strikeLightning(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z), false); skeletonTrapCheck.busy = false;
    for (let i = 0; i < 3; i++) spawnMob('skeleton_horse', e.x + (Math.random() - .5) * 3, e.y, e.z + (Math.random() - .5) * 3, { variant: HORSE_COL.length - 1 }).owner = 'player';
    for (let i = 0; i < 4; i++) { const s = spawnMob('skeleton', e.x + (Math.random() - .5) * 3, e.y + 1, e.z + (Math.random() - .5) * 3); s.persistent = true; s.target = PL; }
    e.owner = 'player'; e.temper = 100;
  }
  return 'default';
}

// ---------- AI wrappers: a custom step may fall back to the usual animal behaviour ----------
const withDefault = fn => (e, dist, dx, dz) => { if (fn(e, dist) === 'default') genericAnimal(e, dist); };
// the generic wander/breed/panic behaviour used by most animals (a cut-down copy of mobTick's)
function genericAnimal(e, dist) {
  const d = e.def; let mx = 0, mz = 0, sp = d.speed;
  const food = d.food && PL.held() && isFood(d, PL.held().id) && dist < 8 && plTargetable();
  if (e.panic > 0) { if (!e.goal || Math.random() < 0.05) e.goal = [e.x + (Math.random() - .5) * 16, e.z + (Math.random() - .5) * 16]; sp *= 2.2; }
  else if (food) e.goal = dist > 2 ? [PL.x, PL.z] : null;
  else if (e.love > 0) { const mate = ENT.find(o => o !== e && o.type === e.type && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8); if (mate) { e.goal = [mate.x, mate.z]; if (Math.hypot(mate.x - e.x, mate.z - e.z) < 1.5) { e.love = mate.love = 0; { const kid = spawnMob(e.type, e.x, e.y, e.z, { baby: true, variant: Math.random() < 0.5 ? e.variant : mate.variant }); if (e.def.onBred) e.def.onBred(kid, e, mate); } spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); } } }
  else if (!e.goal && Math.random() < 1 / 120) e.goal = [e.x + (Math.random() - .5) * 14, e.z + (Math.random() - .5) * 14];
  if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  walkPhysics(e, mx, mz, sp);
}

Object.assign(MOBDEF, {
  mooshroom: { ...MOBDEF.cow, interact: (e, h) => mooshroomUse(e, h), init: e => mooshroomGear(e), gear: e => mooshroomGear(e) },
  panda: { hp: 20, w: 0.65, h: 1.25, speed: 0.04, xp: 2, snd: 'hmm', drops: [['bamboo', 0, 2]], parts: PANDA_M.parts, tw: 128, th: 64, tex: () => PANDA_M.tex(0), vtex: v => PANDA_M.tex(v), variant: () => Math.random() < 0.02 ? 1 : 0, food: ['bamboo'], ai: withDefault(pandaAI) },
  polar_bear: { hp: 30, w: 0.7, h: 1.4, speed: 0.06, xp: 2, snd: 'growl', neutral: 1, drops: [['cod', 0, 2], ['salmon', 0, 2]], parts: BEAR_M.parts, tw: 128, th: 64, tex: () => BEAR_M.tex(0), ai: withDefault(polarBearAI) },
  parrot: { hp: 6, w: 0.25, h: 0.9, speed: 0.1, xp: 2, snd: 'hmm', fly: 1, fallReduce: 99, drops: [['feather', 1, 2]], parts: PARROT_M.parts, tex: () => PARROT_M.tex(0), vtex: v => PARROT_M.tex(v), variant: () => (Math.random() * 5) | 0, ai: parrotAI, anim: parrotAnim, interact: (e, h) => parrotUse(e, h) },
  ocelot: { ...MOBDEF.cat, drops: [], variant: () => OCELOT_V, ai: withDefault(ocelotAI), interact: (e, h) => ocelotUse(e, h), save: e => ({ trusting: !!e.trusting }), init: (e, o) => { if (o.trusting) e.trusting = true; } },
  llama: LLAMA_DEF(LLAMA_M, '라마'),
  trader_llama: { ...LLAMA_DEF(TLLAMA_M, '상인 라마'), ai: withDefault(traderLlamaAI) },
  wandering_trader: { hp: 20, w: 0.3, h: 1.95, speed: 0.07, xp: 0, snd: 'hmm', drops: [], parts: TRADER_M.parts, tw: 128, th: 64, tex: () => TRADER_M.tex(0), ai: withDefault(traderAI), interact: e => traderUse(e), init: (e, o) => { e.life = o.life || 48000; }, save: e => ({ life: e.life }) },
  skeleton_horse: { ...HORSE_DEF('horse', '스켈레톤 말'), drops: [['bone', 0, 2]], ai: withDefault(skeletonHorseAI), food: null, variant: () => HORSE_COL.length - 1 },
});
MOBDEF.ocelot.vtex = v => CAT_M.tex(v);
// the horse-family defs keep their ride/interact hooks; the ocelot never tames
delete MOBDEF.ocelot.food;

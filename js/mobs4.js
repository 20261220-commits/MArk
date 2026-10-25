// Animals added after 1.12 that were missing: horses, donkeys and mules (taming, saddles, armour, chests, riding),
// cats (village strays, taming, creepers keep away, morning gifts), rabbits and foxes.

// ---------- auto-packed box models ----------
// spec rows: [name, pivot, box, colour (hex or fn(face, x, y, w, h)), inflate, faces]; texture regions are packed in
// rows so models do not need hand-made UV layouts. colours may depend on a variant (spec is a function of it).
function autoModel(specFn, tw = 64, th = tw) {
  const layout = spec => { let u = 0, v = 0, rowH = 0; return spec.map(([name, pivot, box, col, infl, faces]) => {
    const [, , , w, h, d] = box, bw = Math.ceil(2 * (w + d)), bh = Math.ceil(d + h);
    if (u + bw > tw) { u = 0; v += rowH; rowH = 0; }
    const out = { name, pivot, box, uv: [u, v], col, infl, faces }; u += bw; rowH = Math.max(rowH, bh);
    if (v + rowH > th) throw new Error('model texture too small');
    return out;
  }); };
  const base = layout(specFn(0));
  return {
    parts: base.map(p => [p.name, p.pivot, p.box, p.uv, p.infl || 0]),
    tex: (variant = 0, seed = 7) => mobCanvas(g => { const r = trng(seed + variant * 13); layout(specFn(variant)).forEach(p => { const [, , , w, h, d] = p.box; paintBox(g, p.uv[0], p.uv[1], w, h, d, typeof p.col === 'number' ? () => hex(p.col) : p.col, r, 0.1, p.faces); }); }, tw, th),
    tw, th,
  };
}
const eyes = (c = '#101010', y = 2, l = 1, rr = 4) => ({ front: (g, x, y0) => { px(g, x + l, y0 + y, c); px(g, x + rr, y0 + y, c); } });
const hidePart = (e, n, show) => { const p = e.mesh.userData.parts[n]; if (p) { p.visible = !!show; p.scale.setScalar(show ? 1 : 0); } };
const lighter = (c, f) => { const a = hex(c); return (Math.min(255, a[0] * f) << 16) | (Math.min(255, a[1] * f) << 8) | Math.min(255, a[2] * f); };

// ---------- horses, donkeys, mules ----------
const HORSE_COL = [0xe8e4dc, 0xc8a060, 0x9a5a2a, 0x6a4024, 0x2e2622, 0x7a7470, 0x3e2a1a];
const HARMOR = { leather_horse_armor: [3, 0x9a5a32], iron_horse_armor: [5, 0xc8c8c8], golden_horse_armor: [7, 0xe8c840], diamond_horse_armor: [11, 0x5ae0d8] };
const HARMOR_KEYS = Object.keys(HARMOR);
// horse variants: colour in the low 4 bits, markings above (0 none, 1 white socks and blaze, 2 white field, 3 white dots, 4 black dots)
function horseMark(mk, c, part) {
  if (!mk) return null;
  return (k, x, y, w, h) => {
    const n = ((x * 73856093) ^ (y * 19349663) ^ (k.length * 83492791)) >>> 0;
    if (mk === 1) return part === 'leg' && y > 6 ? hex(0xf0ece4) : part === 'head' && k === 'front' && x >= 2 && x <= 3 ? hex(0xf0ece4) : hex(c);
    if (mk === 2) return (n % 7) < 4 && part !== 'leg' ? hex(0xf0ece4) : hex(c);
    if (mk === 3) return n % 11 === 0 ? hex(0xf8f6f0) : hex(c);
    return n % 9 === 0 ? hex(0x1a1614) : hex(c);
  };
}
function horseSpec(kind) {
  return v => {
    const mk = kind === 'horse' ? (v >> 4) & 7 : 0; v &= 15;
    const c = kind === 'donkey' ? 0x8a7e72 : kind === 'mule' ? 0x5a3a24 : HORSE_COL[v] || HORSE_COL[2];
    const mane = kind === 'horse' ? lighter(c, v === 0 ? 0.8 : 0.6) : lighter(c, 0.7), belly = kind === 'donkey' ? 0xb8b0a4 : c;
    const ear = kind === 'horse' ? [1, 2, 1] : [2, 6, 1];
    const parts = [
      ['body', [0, 0, 0], [-5, 11, -11, 10, 10, 22], horseMark(mk, c, 'body') || ((k) => k === 'bottom' ? hex(belly) : hex(c))],
      ['neck', [0, 0, 0], [-2, 18, -13, 4, 10, 6], horseMark(mk, c, 'neck') || c],
      ['head', [0, 0, 0], [-3, 24, -19, 6, 6, 8], horseMark(mk, c, 'head') || c, 0, { front: (g, x, y) => { px(g, x + 1, y + 4, '#2a2220', 1, 1); px(g, x + 4, y + 4, '#2a2220', 1, 1); } , right: (g, x, y) => px(g, x + 6, y + 1, '#101010'), left: (g, x, y) => px(g, x + 1, y + 1, '#101010') }],
      ['ear1', [0, 0, 0], [-3, 30, -13, ...ear], c], ['ear2', [0, 0, 0], [3 - ear[0], 30, -13, ...ear], c],
      ['mane', [0, 0, 0], [-1, 19, -8, 2, 12, 2], mane],
      ['tail', [0, 20, 11], [-1.5, -10, 0, 3, 10, 3], mane],
      ['rleg', [3, 11, -8], [-2, -11, -2, 4, 11, 4], (k, x, y) => y > 8 ? hex(kind === 'horse' ? (mk === 1 ? 0xf0ece4 : 0x2a2420) : lighter(c, 0.6)) : horseMark(mk, c, 'leg') ? horseMark(mk, c, 'leg')(k, x, y) : hex(c)],
      ['lleg', [-3, 11, -8], [-2, -11, -2, 4, 11, 4], (k, x, y) => y > 8 ? hex(kind === 'horse' ? (mk === 1 ? 0xf0ece4 : 0x2a2420) : lighter(c, 0.6)) : horseMark(mk, c, 'leg') ? horseMark(mk, c, 'leg')(k, x, y) : hex(c)],
      ['rleg2', [3, 11, 8], [-2, -11, -2, 4, 11, 4], (k, x, y) => y > 8 ? hex(kind === 'horse' ? (mk === 1 ? 0xf0ece4 : 0x2a2420) : lighter(c, 0.6)) : horseMark(mk, c, 'leg') ? horseMark(mk, c, 'leg')(k, x, y) : hex(c)],
      ['lleg2', [-3, 11, 8], [-2, -11, -2, 4, 11, 4], (k, x, y) => y > 8 ? hex(kind === 'horse' ? (mk === 1 ? 0xf0ece4 : 0x2a2420) : lighter(c, 0.6)) : horseMark(mk, c, 'leg') ? horseMark(mk, c, 'leg')(k, x, y) : hex(c)],
      ['saddle', [0, 0, 0], [-5, 21, -5, 10, 1, 9], (k, x, y) => hex(x === 0 || y === 0 ? 0x4a2a14 : 0x7a4a24), 0.15],
      ['rchest', [0, 0, 0], [5, 13, 1, 3, 8, 8], (k, x, y) => hex(y === 2 ? 0x3a2410 : 0xa8743a)], ['lchest', [0, 0, 0], [-8, 13, 1, 3, 8, 8], (k, x, y) => hex(y === 2 ? 0x3a2410 : 0xa8743a)],
    ];
    if (kind === 'horse') HARMOR_KEYS.forEach((k, i) => { const ac = HARMOR[k][1]; parts.push(['ab' + i, [0, 0, 0], [-5, 11, -11, 10, 10, 22], (f, x, y) => f === 'bottom' ? null : hex((x + y) % 5 ? ac : lighter(ac, 0.8)), 0.35], ['ah' + i, [0, 0, 0], [-3, 24, -19, 6, 6, 8], () => hex(ac), 0.3]); });
    return parts;
  };
}
const HORSE_M = { horse: autoModel(horseSpec('horse'), 256, 256), donkey: autoModel(horseSpec('donkey'), 128, 128), mule: autoModel(horseSpec('mule'), 128, 128) };
function horseInit(e, o) {
  const k = e.type;
  e.temper = o.temper || 0; e.saddle = !!o.saddle; e.harmor = o.harmor || null; e.chest = !!o.chest;
  if (e.chest || k !== 'horse') e.items = o.items || (k !== 'horse' ? new Array(15).fill(null) : null);
  // stats: health 15-30, speed and jump vary per horse (donkeys and mules are slower, jump less)
  e.hpMax = o.hpMax || (k === 'skeleton_horse' || k === 'zombie_horse' ? 15 : 15 + Math.floor(Math.random() * 16));
  // Java attribute ranges: speed 0.1125-0.3375 (about 42 m/s per unit), jump strength 0.4-1.0
  e.spd = o.spd || (k === 'horse' ? 0.1125 + Math.random() * 0.225 : 0.175);
  e.jumpS = o.jumpS || (k === 'horse' ? 0.4 + Math.random() * 0.6 : 0.5);
  e.hp = o.hp != null ? o.hp : e.hpMax;
  if (o.owner) e.temper = 100;
  horseParts(e);
}
function horseParts(e) {
  hidePart(e, 'saddle', e.saddle); hidePart(e, 'rchest', e.chest); hidePart(e, 'lchest', e.chest);
  HARMOR_KEYS.forEach((k, i) => { hidePart(e, 'ab' + i, e.harmor === k); hidePart(e, 'ah' + i, e.harmor === k); });
}
const horseSave = e => ({ temper: e.temper, saddle: e.saddle, harmor: e.harmor, chest: e.chest, items: e.items, hpMax: e.hpMax, spd: e.spd, jumpS: e.jumpS, hp: e.hp });
function horseOnBred(kid, a, b) { // foals average their parents' stats with a random third
  const avg = k => (a[k] + b[k] + (kid[k] || a[k])) / 3;
  kid.hpMax = Math.round(avg('hpMax')); kid.spd = avg('spd'); kid.jumpS = avg('jumpS'); kid.hp = kid.hpMax;
  if (a.owner === 'player') { kid.owner = 'player'; kid.temper = 100; }
}
// ridden: steer with the camera, W/S to move, space to jump; an untamed horse bucks the rider off now and then
function horseRide(e) {
  const d = e.def;
  if (IN.sneak) { dismount(); return; }
  if (e.owner !== 'player') {
    e.vx *= 0.6; e.vz *= 0.6; e.yaw += (Math.random() - .5) * 0.3; walkPhysics(e, 0, 0, 0);
    if (++e.rideT > 30 + Math.random() * 30) {
      e.rideT = 0;
      if (Math.random() * 100 < e.temper) horseTame(e);
      else { dismount(); e.temper = Math.min(100, e.temper + 5); play('hurt', { vol: 0.4 }); for (let i = 0; i < 5; i++) R.simpleParticle(e.x, e.y + e.h, e.z, [0.3, 0.3, 0.3], { size: 0.15, vy: 1, grav: 0 }); }
    }
    return;
  }
  if (!e.saddle) { walkPhysics(e, 0, 0, 0); return; }
  e.yawTarget = PL.yaw; turn(e, 0.5);
  const f = IN.f, s = IN.s * 0.4, sy = Math.sin(PL.yaw), cy = Math.cos(PL.yaw);
  const mx = -sy * f + cy * s, mz = -cy * f - sy * s, l = Math.hypot(mx, mz) || 1;
  if (IN.jump && e.onGround) { e.vy = e.jumpS; e.jumpCd = 10; }
  const sp = (f < 0 ? 0.4 : 1) * e.spd * 4.9; // walkPhysics settles at 0.43 x speed per tick
  walkPhysics(e, f || s ? mx / l : 0, f || s ? mz / l : 0, f || s ? sp : 0);
  e.fallY = null; PL.fallDist = 0;
}
function horseTame(e) { e.owner = 'player'; e.persistent = true; e.temper = 100; for (let i = 0; i < 7; i++) R.simpleParticle(e.x, e.y + e.h, e.z, [1, 0.3, 0.4], { size: 0.15, vy: 1, grav: 0 }); play('hmm', { pitch: 1.4 }); UI.advance && UI.advance('horse'); }
function horseInteract(e, h, d) {
  if (e.baby) { if (d && (h.id === IID.golden_apple || h.id === IID.golden_carrot || h.id === IID.apple || h.id === IID.wheat || h.id === IID.sugar)) { e.baby = Math.max(1, e.baby - 2400); consume(); swing(); return true; } return false; }
  const tame = e.owner === 'player';
  // feeding raises temper (and heals); golden food makes tame horses breed (generic code)
  if (d && (h.id === IID.apple || h.id === IID.wheat || h.id === IID.sugar || h.id === IID.hay_block) && (e.hp < e.hpMax || !tame)) {
    e.hp = Math.min(e.hpMax, e.hp + (h.id === IID.hay_block ? 20 : h.id === IID.apple ? 3 : 2)); if (!tame) e.temper = Math.min(100, e.temper + (h.id === IID.apple ? 3 : 5)); consume(); swing(); play('eat'); return true;
  }
  if (!tame) { if (!d || !d.food) { mount(e); e.rideT = 0; return true; } return false; }
  if (d && h.id === IID.saddle && !e.saddle && e.type !== 'mule' || d && h.id === IID.saddle && !e.saddle) { e.saddle = true; consume(); horseParts(e); play('place', { mat: 'wool' }); swing(); return true; }
  if (d && HARMOR[d.key] && e.type === 'horse' && !e.harmor) { e.harmor = d.key; consume(); horseParts(e); play('place', { mat: 'metal' }); swing(); return true; }
  if (d && h.id === BID.chest && e.type !== 'horse' && !e.chest) { e.chest = true; consume(); horseParts(e); play('place', { mat: 'wood' }); swing(); return true; }
  if (PL.sneaking) { horseInventory(e); return true; }
  if (d && isFood(e.def, h.id)) return false; // breeding
  mount(e); return true;
}
// sneak + use: saddle / armour (and the chest for donkeys and mules) in a screen
function horseInventory(e) {
  e.gear = e.gear || [null, null];
  e.gear[0] = e.saddle ? { id: IID.saddle, n: 1 } : null; e.gear[1] = e.harmor ? { id: IID[e.harmor], n: 1 } : null;
  UI.openScreen('horse', { horse: e, title: e.def.name });
}
function horseGearChanged(e) { e.saddle = !!e.gear[0]; e.harmor = e.gear[1] ? ITEMS[e.gear[1].id].key : null; horseParts(e); if (!e.saddle && PL.riding === e) dismount(); }
function horseDrops(e) {
  if (e.saddle) dropItem(e.x, e.y + .5, e.z, IID.saddle, 1);
  if (e.harmor) dropItem(e.x, e.y + .5, e.z, IID[e.harmor], 1);
  if (e.chest) { dropItem(e.x, e.y + .5, e.z, BID.chest, 1); for (const st of e.items || []) if (st) dropStack(e.x, e.y + .5, e.z, st); }
}
const horseArmorMul = e => e.harmor ? 1 - HARMOR[e.harmor][0] * 0.04 : 1;
function horseAnim(e, P) {
  if (P.tail) P.tail.rotation.x = 0.5 + Math.sin(e.walk * 0.5) * 0.15 * e.walkAmt;
  const hd = e.rider ? -0.1 : (e.walkAmt < 0.1 && (e.age % 400) < 60 ? 0.5 : 0);
  for (const n of ['neck', 'head', 'ear1', 'ear2', 'mane', 'ab0', 'ab1', 'ab2', 'ab3'].slice(0, 5)) { const p = P[n]; if (p) p.rotation.x = 0; }
  for (const n of ['head', 'ah0', 'ah1', 'ah2', 'ah3', 'ear1', 'ear2']) { const p = P[n]; if (p) { p.rotation.x = hd; p.position.y = -hd * 0.3; p.position.z = -hd * 0.3; } }
}
const HORSE_DEF = (kind, name) => ({ hp: 20, w: 0.7, h: 1.6, speed: 0.08, xp: 2, snd: 'hmm', name, drops: [['leather', 0, 2]], parts: HORSE_M[kind].parts, tw: HORSE_M[kind].tw, th: HORSE_M[kind].th,
  tex: () => HORSE_M[kind].tex(kind === 'horse' ? 2 : 0), ...(kind === 'horse' ? { vtex: v => HORSE_M.horse.tex(v), variant: () => ((Math.random() * 7) | 0) | (((Math.random() * 5) | 0) << 4) } : {}), food: ['golden_apple', 'golden_carrot'], tameFirst: 1, ride: horseRide, rideY: 1.0,
  init: horseInit, save: horseSave, onBred: horseOnBred, anim: horseAnim, interact: horseInteract, onDeathDrops: horseDrops, armorMul: horseArmorMul });

// ---------- cats ----------
const CAT_COL = [[0x8a6a48, 0x5a4028, 0xd8c8a8], [0x202020, 0x202020, 0xf0f0f0], [0xe0902a, 0xb8601a, 0xf0d0a0], [0xe8dcc8, 0x5a4434, 0xe8dcc8], [0x7a7a80, 0x6a6a70, 0x9a9aa0],
  [0xf0f0f0, 0xe07a20, 0x2a2a2a], [0xe8d8b0, 0xd8c098, 0xf0e8d8], [0xf0ece4, 0x8a7a6a, 0xf0ece4], [0xf4f4f4, 0xe8e8e8, 0xf4f4f4], [0x2a2a2a, 0x2a2a2a, 0xf0f0f0], [0x101012, 0x101012, 0x101012]];
const CAT_M = autoModel(v => {
  const [a, b, c] = CAT_COL[v] || CAT_COL[0], fur = (k, x, y) => hex((x * 3 + y) % 7 < 2 ? b : a);
  return [
    ['body', [0, 0, 0], [-2, 5, -7, 4, 5, 13], (k, x, y) => k === 'bottom' ? hex(c) : fur(k, x, y)],
    ['head', [0, 0, 0], [-2.5, 7, -11, 5, 4, 5], fur, 0, { front: (g, x, y) => { px(g, x + 1, y + 1, '#3ad040'); px(g, x + 3, y + 1, '#3ad040'); px(g, x + 2, y + 3, '#e8a0a0'); } }],
    ['ear1', [0, 0, 0], [-2.5, 11, -9, 1, 1, 2], a], ['ear2', [0, 0, 0], [1.5, 11, -9, 1, 1, 2], a],
    ['tail', [0, 9, 6], [-0.5, 0, 0, 1, 1, 8], fur],
    ['rleg', [1.1, 5, -5], [-1, -5, -1, 2, 5, 2], c], ['lleg', [-1.1, 5, -5], [-1, -5, -1, 2, 5, 2], c],
    ['rleg2', [1.1, 5, 4], [-1, -5, -1, 2, 5, 2], a], ['lleg2', [-1.1, 5, 4], [-1, -5, -1, 2, 5, 2], a],
  ];
});
function catAI(e, dist) {
  const tame = e.owner === 'player';
  let mx = 0, mz = 0, sp = 0.07;
  if (tame && e.sitting) { walkPhysics(e, 0, 0, 0); return; }
  const held = PL.held(), tempt = held && (held.id === IID.cod || held.id === IID.salmon) && dist < 10 && !PL.dead;
  if (tame && dist > 3) {
    if (dist > 14 && PL.onGround) { e.x = e.px = PL.x + (Math.random() - .5); e.y = e.py = PL.y; e.z = e.pz = PL.z + (Math.random() - .5); e.path = null; }
    else { faceTo(e, PL.x, PL.z); [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); sp = 0.12; }
  } else if (!tame && tempt && PL.sneaking) { faceTo(e, PL.x, PL.z); if (dist > 1.5) [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); sp = 0.06; }
  else if (!tame && dist < 6 && !PL.sneaking && !PL.dead && !spectator()) { const l = Math.hypot(e.x - PL.x, e.z - PL.z) || 1; mx = (e.x - PL.x) / l; mz = (e.z - PL.z) / l; e.yawTarget = Math.atan2(-mx, -mz); sp = 0.13; } // strays keep their distance
  else {
    if (!e.goal && Math.random() < 1 / 100) e.goal = [e.x + (Math.random() - .5) * 10, e.z + (Math.random() - .5) * 10];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  if (e.love > 0) { const mate = ENT.find(o => o !== e && o.type === 'cat' && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8); if (mate) { faceTo(e, mate.x, mate.z); [mx, mz] = pathDir(e, mate.x, mate.y, mate.z); if (Math.hypot(mate.x - e.x, mate.z - e.z) < 1.2) { e.love = mate.love = 0; spawnMob('cat', e.x, e.y, e.z, { baby: true, owner: 'player', variant: Math.random() < 0.5 ? e.variant : mate.variant }); spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); } } }
  walkPhysics(e, mx, mz, sp);
}
function catInteract(e, h, d) {
  if (e.owner === 'player') {
    if (d && (h.id === IID.cod || h.id === IID.salmon) && !e.baby && e.love <= 0) { e.love = 600; consume(); swing(); return true; }
    e.sitting = e.sitting ? 0 : 1; swing(); play('hmm', { pitch: 1.8, vol: 0.4 }); return true;
  }
  if (d && (h.id === IID.cod || h.id === IID.salmon)) {
    consume(); swing();
    if (Math.random() < 1 / 3) { e.owner = 'player'; e.persistent = true; e.sitting = 1; for (let i = 0; i < 7; i++) R.simpleParticle(e.x, e.y + .6, e.z, [1, 0.3, 0.4], { size: 0.12, vy: 1, grav: 0 }); }
    else for (let i = 0; i < 5; i++) R.simpleParticle(e.x, e.y + .6, e.z, [0.3, 0.3, 0.3], { size: 0.12, vy: 1, grav: 0 });
    return true;
  }
  return false;
}
function catAnim(e, P) {
  if (P.tail) P.tail.rotation.x = e.sitting ? -0.2 : -0.7 + Math.sin(e.walk * 0.4) * 0.2;
  if (e.sitting) { e.mesh.position.y -= 0.15; for (const n of ['rleg2', 'lleg2']) if (P[n]) P[n].rotation.x = 1.4; if (P.body) P.body.rotation.x = -0.4; } else if (P.body) P.body.rotation.x = 0;
}
// creepers (and phantoms) keep away from cats
const catNear = (e, r = 6) => ENT.some(o => (o.type === 'cat' || o.type === 'ocelot') && !o.dead && !o.deathT && Math.hypot(o.x - e.x, o.z - e.z) < r && Math.abs(o.y - e.y) < 4);
// waking up next to a tame cat: 70% chance of a morning gift
const CAT_GIFTS = [['rabbit_hide', 16], ['rabbit_foot', 16], ['chicken', 16], ['feather', 16], ['rotten_flesh', 16], ['string', 10], ['phantom_membrane', 2]];
function catGifts() {
  for (const c of ENT) {
    if (c.type !== 'cat' || c.dead || c.owner !== 'player' || c.sitting || Math.hypot(c.x - PL.x, c.z - PL.z) > 10 || Math.random() > 0.7) continue;
    let t = Math.random() * CAT_GIFTS.reduce((a, g) => a + g[1], 0), k = CAT_GIFTS[0][0];
    for (const [g, w] of CAT_GIFTS) { if ((t -= w) < 0) { k = g; break; } }
    if (IID[k] != null) dropItem(PL.x + (Math.random() - .5), PL.y + .5, PL.z + (Math.random() - .5), IID[k], 1);
    c.x = PL.x + 0.8; c.z = PL.z + 0.3; c.y = PL.y;
  }
}

// ---------- rabbits ----------
const RABBIT_COL = [0x8a6040, 0xf0f0f0, 0x2a2a2a, 0xd8b878, 0x6a5a4a, 0xf0f0f0];
const RABBIT_M = autoModel(v => {
  const c = RABBIT_COL[v] || RABBIT_COL[0], sp = v === 5 ? (k, x, y) => hex((x + y * 2) % 5 < 2 ? 0x2a2a2a : c) : c;
  return [
    ['body', [0, 0, 0], [-2.5, 2, -3, 5, 4, 7], sp],
    ['head', [0, 0, 0], [-2, 4, -6, 4, 4, 4], c, 0, { front: (g, x, y) => { px(g, x, y + 1, '#c82828'); px(g, x + 3, y + 1, '#c82828'); px(g, x + 1, y + 3, '#e8a0b0', 2, 1); } }],
    ['ear1', [0, 0, 0], [-2, 8, -4, 1, 4, 1], c], ['ear2', [0, 0, 0], [1, 8, -4, 1, 4, 1], c],
    ['tail', [0, 0, 0], [-1, 4, 4, 2, 2, 1], 0xf0f0f0],
    ['rleg', [1.5, 2, -2], [-0.5, -2, -0.5, 1, 2, 1], c], ['lleg', [-1.5, 2, -2], [-0.5, -2, -0.5, 1, 2, 1], c],
    ['rleg2', [1.5, 2, 2.5], [-1, -2, -1.5, 2, 2, 3], c], ['lleg2', [-1.5, 2, 2.5], [-1, -2, -1.5, 2, 2, 3], c],
  ];
});
function rabbitVariant(e) { const b = biomeAt(Math.floor(e.x), Math.floor(e.z)); return b === S.BIO.DESERT ? 3 : b === S.BIO.TUNDRA || b === S.BIO.SNOWY_TAIGA ? (Math.random() < 0.8 ? 1 : 5) : [0, 0, 2, 4][(Math.random() * 4) | 0]; }
function rabbitAI(e, dist) {
  let mx = 0, mz = 0, sp = 0.09;
  const held = PL.held(), tempt = held && isFood(e.def, held.id) && dist < 8 && !PL.dead;
  if (e.panic > 0 || (dist < 5 && !tempt && !PL.sneaking && !PL.dead && !spectator() && PL.mode !== 'creative')) { const l = Math.hypot(e.x - PL.x, e.z - PL.z) || 1; mx = (e.x - PL.x) / l; mz = (e.z - PL.z) / l; sp = 0.16; }
  else if (tempt) { faceTo(e, PL.x, PL.z); if (dist > 1.5) [mx, mz] = pathDir(e, PL.x, PL.y, PL.z); }
  else if (e.love > 0) { const mate = ENT.find(o => o !== e && o.type === 'rabbit' && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8); if (mate) { [mx, mz] = pathDir(e, mate.x, mate.y, mate.z); if (Math.hypot(mate.x - e.x, mate.z - e.z) < 1) { e.love = mate.love = 0; spawnMob('rabbit', e.x, e.y, e.z, { baby: true, variant: e.variant }); spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); } } }
  else {
    if (!e.goal && Math.random() < 1 / 80) e.goal = [e.x + (Math.random() - .5) * 10, e.z + (Math.random() - .5) * 10];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; } }
    // nibble ripe carrots
    if (e.age % 40 === 0 && Math.random() < 0.1) { const bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z), b = getBlock(bx, by, bz); if (b === BID.crops2 && ((getMeta(bx, by, bz) >> 3) & 3) === 0 && (getMeta(bx, by, bz) & 7) > 0) setMeta(bx, by, bz, getMeta(bx, by, bz) - 1); }
  }
  if (mx || mz) { e.yawTarget = Math.atan2(-mx, -mz); if (e.onGround && e.jumpCd <= 0) { e.vy = 0.3; e.jumpCd = 6; } } // rabbits get around by hopping
  walkPhysics(e, e.onGround ? mx * 0.3 : mx, e.onGround ? mz * 0.3 : mz, sp);
}

// ---------- foxes ----------
const FOX_M = autoModel(v => {
  const c = v ? 0xe8e4e0 : 0xe07a2a, w = 0xf4f0e8, dk = v ? 0xc8c0b8 : 0x3a2418;
  return [
    ['body', [0, 0, 0], [-3, 4, -5, 6, 5, 11], (k) => hex(k === 'bottom' ? w : c)],
    ['head', [0, 0, 0], [-4, 5, -10, 8, 6, 6], (k, x, y) => hex(k === 'front' && y > 2 ? w : c), 0, { front: (g, x, y) => { px(g, x + 1, y + 2, '#101010', 2, 1); px(g, x + 5, y + 2, '#101010', 2, 1); } }],
    ['snout', [0, 0, 0], [-2, 5, -13, 4, 2, 3], w, 0, { front: (g, x, y) => px(g, x + 1, y, '#101010', 2, 1) }],
    ['ear1', [0, 0, 0], [-4, 11, -8, 2, 2, 1], dk], ['ear2', [0, 0, 0], [2, 11, -8, 2, 2, 1], dk],
    ['tail', [0, 7, 6], [-2, -2, 0, 4, 4, 9], (k, x, y, ww, hh) => hex(k === 'back' || y > hh - 2 ? w : c)],
    ['rleg', [1.5, 4, -3], [-1, -4, -1, 2, 4, 2], dk], ['lleg', [-1.5, 4, -3], [-1, -4, -1, 2, 4, 2], dk],
    ['rleg2', [1.5, 4, 4], [-1, -4, -1, 2, 4, 2], dk], ['lleg2', [-1.5, 4, 4], [-1, -4, -1, 2, 4, 2], dk],
  ];
});
const FOX_PREY = new Set(['chicken', 'rabbit', 'cod', 'salmon', 'tropical_fish']);
function foxAI(e, dist) {
  let mx = 0, mz = 0, sp = 0.08;
  const day = dayFactor() > 0.6, trusted = e.owner === 'player';
  // sleeping by day in the shade, unless something is close by
  if (day && !e.target && e.panic <= 0 && (dist > 6 || PL.sneaking || trusted) && e.onGround && (getLight(Math.floor(e.x), Math.floor(e.y + 1), Math.floor(e.z)) >> 4) < 15 - 0 || (day && e.sleeping && dist > 3)) {
    if (e.age % 100 === 0 || e.sleeping) e.sleeping = true;
  } else e.sleeping = false;
  if (e.sleeping) { walkPhysics(e, 0, 0, 0); return; }
  if (!trusted && dist < 8 && !PL.sneaking && !PL.dead && !spectator() && PL.mode !== 'creative') { const l = Math.hypot(e.x - PL.x, e.z - PL.z) || 1; mx = (e.x - PL.x) / l; mz = (e.z - PL.z) / l; sp = 0.15; e.target = null; }
  else if (e.target) {
    const t = e.target; if (t.dead || t.deathT) { e.target = null; } else {
      faceTo(e, t.x, t.z); [mx, mz] = pathDir(e, t.x, t.y, t.z); sp = 0.14;
      const td = Math.hypot(t.x - e.x, t.z - e.z);
      if (td < 3 && td > 1.2 && e.onGround && e.jumpCd <= 0 && Math.random() < 0.1) { e.vy = 0.45; e.jumpCd = 30; } // pounce
      if (td < e.w + t.w + 0.4 && e.attackCd <= 0) { e.attackCd = 20; hurtMob(t, 2, e, mx, mz); }
    }
  } else {
    if (!day && e.age % 40 === 0) { let best = null, bd = 12; for (const o of ENT) if (o.kind === 'mob' && !o.dead && FOX_PREY.has(o.type) && !o.baby) { const d2 = Math.hypot(o.x - e.x, o.z - e.z); if (d2 < bd) { bd = d2; best = o; } } e.target = best; }
    // grab items lying around
    if (!e.mouth && e.age % 10 === 0) { const it = ENT.find(o => o.kind === 'item' && !o.dead && o.pickup <= 0 && Math.hypot(o.x - e.x, o.z - e.z) < 6 && Math.abs(o.y - e.y) < 2); if (it) { if (Math.hypot(it.x - e.x, it.z - e.z) < 0.9) { e.mouth = { ...it.stack, n: 1 }; it.stack.n--; if (it.stack.n <= 0) removeEnt(it); foxMouth(e); } else e.goal = [it.x, it.z]; } }
    // eat sweet berries held in the mouth to heal
    if (e.mouth && e.mouth.id === IID.sweet_berries && e.hp < e.def.hp && Math.random() < 0.01) { e.mouth = null; e.hp = Math.min(e.def.hp, e.hp + 4); play('eat', { vol: 0.5 }); foxMouth(e); }
    if (!e.goal && Math.random() < 1 / 100) e.goal = [e.x + (Math.random() - .5) * 14, e.z + (Math.random() - .5) * 14];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  if (e.love > 0) { const mate = ENT.find(o => o !== e && o.type === 'fox' && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8); if (mate) { [mx, mz] = pathDir(e, mate.x, mate.y, mate.z); if (Math.hypot(mate.x - e.x, mate.z - e.z) < 1) { e.love = mate.love = 0; spawnMob('fox', e.x, e.y, e.z, { baby: true, owner: 'player', variant: e.variant }); spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); } } } // foxes bred by the player trust them
  walkPhysics(e, mx, mz, sp);
}
function foxMouth(e) { // show what the fox carries
  const P = e.mesh.userData.parts, host = P.snout || P.head; if (P.mouthItem) { P.mouthItem.parent && P.mouthItem.parent.remove(P.mouthItem); P.mouthItem = null; }
  if (!e.mouth || !host) return; // the Java model has no separate snout, so the item hangs from the head
  const m = R.itemMesh(e.mouth.id); m.scale.setScalar(m.userData.isBlock ? 0.2 : 0.35); m.position.set(0, 0.3, -0.85); m.rotation.x = Math.PI / 2; host.add(m); P.mouthItem = m;
}
function foxAnim(e, P) {
  if (P.tail) P.tail.rotation.x = e.sleeping ? 0.2 : -0.3 + Math.sin(e.walk * 0.4) * 0.1;
  if (e.sleeping) { e.mesh.position.y -= 0.2; e.mesh.rotation.z = Math.PI / 2 * 0.9; e.mesh.position.y += 0.15; }
  if (P.mouthItem) R.setMeshLight(P.mouthItem, 1);
}

Object.assign(MOBDEF, {
  horse: HORSE_DEF('horse', '말'), donkey: { ...HORSE_DEF('donkey', '당나귀'), h: 1.5, mates: { horse: 'mule' } }, mule: { ...HORSE_DEF('mule', '노새'), h: 1.6, food: null },
  cat: { hp: 10, w: 0.3, h: 0.7, speed: 0.07, xp: 2, snd: 'hmm', drops: [['string', 0, 2]], parts: CAT_M.parts, tex: () => CAT_M.tex(0), vtex: v => CAT_M.tex(v), variant: () => (Math.random() * 10) | 0,
    ai: catAI, anim: catAnim, interact: catInteract },
  rabbit: { hp: 3, w: 0.2, h: 0.5, speed: 0.09, xp: 2, snd: 'hmm', drops: [['rabbit', 0, 1], ['rabbit_hide', 0, 1]], extraDrop: [['rabbit_foot', 0.1]], parts: RABBIT_M.parts, tex: () => RABBIT_M.tex(0), vtex: v => RABBIT_M.tex(v),
    variant: () => 0, initVariant: rabbitVariant, food: ['carrot', 'golden_carrot', 'dandelion'], ai: rabbitAI },
  fox: { hp: 10, w: 0.35, h: 0.7, speed: 0.08, xp: 2, snd: 'hmm', drops: [], parts: FOX_M.parts, tex: () => FOX_M.tex(0), vtex: v => FOX_M.tex(v), variant: () => 0,
    initVariant: e => { const b = biomeAt(Math.floor(e.x), Math.floor(e.z)); return b === S.BIO.SNOWY_TAIGA || b === S.BIO.TUNDRA ? 1 : 0; }, food: ['sweet_berries'], ai: foxAI, anim: foxAnim,
    save: e => ({ mouth: e.mouth || null }), init: (e, o) => { if (o.mouth) { e.mouth = o.mouth; foxMouth(e); } }, onDeathDrops: e => { if (e.mouth) dropStack(e.x, e.y + .5, e.z, e.mouth); } },
});
MOBDEF.mule.drops = MOBDEF.horse.drops;

// ---------- spawning ----------
function spawnMoreForChunk(c) {
  const R0 = S.rng(S.hash32(W.seed, c.cx, c.cz, 27)), b = c.biome[8 * 16 + 8];
  const ground = (x, z) => { let y = CH - 2; while (y > 1 && !SOLID[c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]] && !FLUID[c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]]) y--; const g = c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; return g === 2 || g === 3 || g === 9 || g === 50 || g === 51 || g === 203 || g === 204 || g === 205 ? y + 1 : -1; };
  const group = (t, n, opts) => { const v = opts && opts.variant != null ? opts.variant : null; for (let i = 0; i < n; i++) { const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12), y = ground(x, z); if (y > 0) spawnMob(t, x + .5, y, z + .5, v != null ? { variant: v } : {}); } };
  const B = S.BIO;
  if ((b === B.PLAINS || b === B.SAVANNA) && R0() < 0.02) { if (R0() < 0.75) group('horse', 2 + R0.int(4), { variant: R0.int(7) | (R0.int(5) << 4) }); else group('donkey', 1 + R0.int(2)); }
  if ((b === B.DESERT || b === B.TUNDRA || b === B.SNOWY_TAIGA || b === B.FOREST || b === B.TAIGA) && R0() < 0.025) group('rabbit', 2 + R0.int(2));
  if ((b === B.TAIGA || b === B.SNOWY_TAIGA) && R0() < 0.03) group('fox', 2 + R0.int(2));
  if (b === B.BEACH && R0() < 0.12) group('turtle', 2 + R0.int(4));
  if ((b === B.OCEAN || b === B.WARM_OCEAN || b === B.LUKEWARM_OCEAN || b === B.COLD_OCEAN) && R0() < 0.04) for (let i = 1 + R0.int(3); i > 0; i--) { const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12), y = 56 + R0.int(5); if (c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] === BID.water) spawnMob('dolphin', x + .5, y, z + .5); }
  // stray cats in villages: one per chunk that got villagers
  if (c.hadVillagers && R0() < 0.4) group('cat', 1);
  if (typeof MOBDEF.mooshroom !== 'object') return;
  if (b === B.MUSHROOM && R0() < 0.3) group('mooshroom', 2 + R0.int(4));
  if ((b === B.JUNGLE || b === B.BAMBOO_JUNGLE) && R0() < (b === B.BAMBOO_JUNGLE ? 0.12 : 0.02)) group('panda', 1 + R0.int(2));
  if ((b === B.JUNGLE || b === B.BAMBOO_JUNGLE) && R0() < 0.05) group('parrot', 1 + R0.int(2));
  if ((b === B.JUNGLE || b === B.BAMBOO_JUNGLE) && R0() < 0.03) group('ocelot', 1);
  if ((b === B.ICE_SPIKES || b === B.TUNDRA) && R0() < 0.02) group('polar_bear', 1 + R0.int(2));
  if ((b === B.MOUNTAINS || b === B.SAVANNA) && R0() < 0.025) group('llama', 2 + R0.int(3));
}

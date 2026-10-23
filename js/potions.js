// Brewing and potions (Java Edition): brewing stand, glass bottles, drinkable, splash and lingering potions,
// tipped arrows, lingering clouds (also the ender dragon's breath, bottled into dragon's breath).

// ---------- recipes: base potion -> ingredient -> result ----------
const BREW = {};
const brewRec = (base, ing, out) => { (BREW[base] = BREW[base] || {})[ing] = out; };
for (const i of ['redstone', 'sugar', 'ghast_tear', 'glistering_melon_slice', 'spider_eye', 'magma_cream', 'blaze_powder', 'rabbit_foot']) brewRec('water', i, 'mundane');
brewRec('water', 'nether_wart', 'awkward'); brewRec('water', 'glowstone_dust', 'thick'); brewRec('water', 'fermented_spider_eye', 'weakness');
const AWKWARD = { sugar: 'swiftness', rabbit_foot: 'leaping', blaze_powder: 'strength', glistering_melon_slice: 'healing', spider_eye: 'poison', ghast_tear: 'regeneration', magma_cream: 'fire_resistance',
  pufferfish: 'water_breathing', golden_carrot: 'night_vision', turtle_helmet: 'turtle_master', phantom_membrane: 'slow_falling', fermented_spider_eye: 'weakness' };
for (const k in AWKWARD) brewRec('awkward', k, AWKWARD[k]);
for (const k in POTION) { if (k.startsWith('long_') || k.startsWith('strong_')) continue; if (POTION['long_' + k]) brewRec(k, 'redstone', 'long_' + k); if (POTION['strong_' + k]) brewRec(k, 'glowstone_dust', 'strong_' + k); }
for (const [a, b] of [['swiftness', 'slowness'], ['long_swiftness', 'long_slowness'], ['strong_swiftness', 'slowness'], ['leaping', 'slowness'], ['long_leaping', 'long_slowness'], ['strong_leaping', 'slowness'],
  ['healing', 'harming'], ['strong_healing', 'strong_harming'], ['poison', 'harming'], ['long_poison', 'harming'], ['strong_poison', 'strong_harming'], ['night_vision', 'invisibility'], ['long_night_vision', 'long_invisibility']]) brewRec(a, 'fermented_spider_eye', b);
const BREW_ING = new Set(['gunpowder', 'dragon_breath']); for (const b in BREW) for (const i in BREW[b]) BREW_ING.add(i);
// the item a bottle becomes with this ingredient, or null
function brewResult(st, ingKey) {
  const d = st && ITEMS[st.id]; if (!d || d.potion == null) return null;
  const P = POTION[d.potion];
  if (ingKey === 'gunpowder') return d.drink ? P.items.splash : null;
  if (ingKey === 'dragon_breath') return d.splash ? P.items.lingering : null;
  const out = BREW[d.potion] && BREW[d.potion][ingKey]; if (!out) return null;
  const Q = POTION[out]; return d.drink ? Q.items.potion : d.splash ? Q.items.splash : Q.items.lingering;
}
const isBottle = st => !st || ITEMS[st.id].potion != null || st.id === IID.glass_bottle;
const newBrewing = () => ({ type: 'brewing', items: [null, null, null, null, null], fuel: 0, time: 0 });
// called from furnaceTick for every brewing stand tile: 20 brews per blaze powder, 400 ticks per brew
function brewTick(c, i, t) {
  const [, , , ing, fuel] = t.items;
  if (t.fuel <= 0 && fuel && fuel.id === IID.blaze_powder) { t.fuel = 20; fuel.n--; if (!fuel.n) t.items[4] = null; c.modified = c.edited = true; }
  const ik = ing && ITEMS[ing.id].key, can = ing && t.fuel > 0 && [0, 1, 2].some(k => brewResult(t.items[k], ik) != null);
  if (!can) t.time = 0;
  else {
    if (!t.time) t.time = 400;
    if (--t.time <= 0) {
      for (let k = 0; k < 3; k++) { const r = brewResult(t.items[k], ik); if (r != null) t.items[k] = { id: r, n: 1 }; }
      ing.n--; if (!ing.n) t.items[3] = null; t.fuel--; c.modified = c.edited = true;
      const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15);
      if (Math.hypot(PL.x - x, PL.y - y, PL.z - z) < 16) play('fizz', { vol: 0.5 });
    }
  }
  const bits = (t.items[0] ? 1 : 0) | (t.items[1] ? 2 : 0) | (t.items[2] ? 4 : 0);
  if (c.blocks[i] === BID.brewing_stand && c.meta[i] !== bits) setMeta(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15), bits);
}

// ---------- applying potion effects ----------
// scale: 1 for drinking, distance falloff for splash, 1/4 lingering, 1/8 tipped arrows
function applyPotion(target, type, scale = 1) {
  const P = POTION[type]; if (!P) return;
  for (const [k, dur, lv = 0] of P.eff) {
    if (k === 'instant_health' || k === 'instant_damage') { if (scale >= 0.5 || Math.random() < scale * 2) addEffect(target, k, 1, lv); }
    else { const t = Math.floor(dur * scale); if (t > 20) addEffect(target, k, t, lv); }
  }
}
function potionBurst(x, y, z, col, n = 24) {
  const c = [((col >> 16) & 255) / 255, ((col >> 8) & 255) / 255, (col & 255) / 255];
  for (let i = 0; i < n; i++) R.simpleParticle(x, y + 0.2, z, c, { size: 0.12, vy: 0.5 + Math.random() * 1.5, vx: (Math.random() - .5) * 3, vz: (Math.random() - .5) * 3, grav: 0.4, life: 1 });
}
// splash potion landed: everything within 4 blocks, weaker with distance
function splashPotion(id, x, y, z, direct) {
  const d = ITEMS[id], P = POTION[d.potion];
  play('break', { mat: 'glass' }); potionBurst(x, y, z, P.col, 40);
  const targets = ENT.filter(e => e.kind === 'mob' && !e.dead && !e.deathT);
  if (!PL.dead && !spectator()) targets.push(PL);
  for (const t of targets) {
    const ty = t === PL ? PL.y + 0.9 : t.y + t.h / 2, dist = Math.hypot(t.x - x, ty - y, t.z - z);
    if (Math.abs(t.x - x) > 4.125 || Math.abs(t.z - z) > 4.125 || Math.abs(ty - y) > 2.125) continue;
    const f = t === direct ? 1 : 1 - dist / 4; if (f <= 0) continue; // weaker toward the edge of the 4-block splash
    if (d.potion === 'water') { t.fire = 0; if (t !== PL && t.def.waterHurt) hurtMob(t, 1, null); continue; }
    applyPotion(t, d.potion, f);
  }
  if (d.potion === 'water') for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) { const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz; if (getBlock(bx, by, bz) === BID.fire) setBlock(bx, by, bz, 0); }
}
// ---------- lingering clouds ----------
function spawnCloud(x, y, z, type, opts = {}) {
  const e = Ent('cloud', x, y, z); e.kind = 'cloud'; e.potion = type; e.r = opts.r || 3; e.dur = opts.dur || 600; e.shrink = e.r / e.dur; e.hitT = new Map(); e.col = opts.col != null ? opts.col : POTION[type].col;
  e.breath = !!opts.breath; e.tick = cloudTick; return addEnt(e);
}
function cloudTick(e) {
  e.r -= e.shrink; if (e.r <= 0.4 || e.age > e.dur) { removeEnt(e); return; }
  const c = [((e.col >> 16) & 255) / 255, ((e.col >> 8) & 255) / 255, (e.col & 255) / 255];
  if (Math.hypot(PL.x - e.x, PL.z - e.z) < 48) for (let i = 0; i < Math.ceil(e.r * 2); i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * e.r; R.simpleParticle(e.x + Math.cos(a) * rr, e.y + 0.1, e.z + Math.sin(a) * rr, c, { size: 0.1, vx: 1e-4, vy: 0.15, vz: 1e-4, grav: 0, life: 0.8 }); }
  if (e.age % 5) return;
  const targets = ENT.filter(o => o.kind === 'mob' && !o.dead && !o.deathT); if (!PL.dead && !spectator()) targets.push(PL);
  for (const t of targets) {
    if (Math.hypot(t.x - e.x, t.z - e.z) > e.r || Math.abs(t.y - e.y) > 1.5) continue;
    const last = e.hitT.get(t.id || 'pl'); if (last != null && e.age - last < 20) continue; // each entity at most once a second
    e.hitT.set(t.id || 'pl', e.age);
    if (e.breath) { if (t === PL) hurtPlayer(6, 'magic'); else if (t.type !== 'ender_dragon') { t.inv = 0; hurtMob(t, 6, null); } }
    else applyPotion(t, e.potion, 0.25);
    e.r -= 0.5; // radius on use (Java)
  }
}

// ---------- glass bottles: water, cauldrons, dragon's breath ----------
// returns true when it did something
function bottleUse(t, h) {
  if (h.id === IID.glass_bottle) {
    const cloud = ENT.find(o => o.kind === 'cloud' && o.breath && !o.dead && Math.hypot(PL.x - o.x, PL.z - o.z) < o.r + 2);
    if (cloud) { giveBottle(IID.dragon_breath); cloud.r -= 0.5; return true; }
    if (!t || t.type !== 'block') return false;
    if (t.id === BID.water) { giveBottle(POTION.water.items.potion); play('splash', { vol: 0.5 }); return true; }
    if (t.id === BID.cauldron && (t.m & 3) && ((t.m >> 2) & 3) === 0) { setMeta(t.x, t.y, t.z, (t.m & 3) - 1); giveBottle(POTION.water.items.potion); play('splash', { vol: 0.5 }); return true; }
    return false;
  }
  if (t && t.type === 'block' && t.id === BID.cauldron && h.id === POTION.water.items.potion && (((t.m >> 2) & 3) === 0 || !(t.m & 3)) && (t.m & 3) < 3) {
    setMeta(t.x, t.y, t.z, (t.m & 3) + 1); if (!creative()) INV.slots[INV.sel] = { id: IID.glass_bottle, n: 1 }; play('splash', { vol: 0.5 }); return true;
  }
  return false;
}
function giveBottle(id) {
  const h = PL.held();
  if (!creative()) { h.n--; if (!h.n) INV.slots[INV.sel] = null; }
  const it = { id, n: 1 }; if (!PL.held()) INV.slots[INV.sel] = it; else if (INV.add(it)) dropStack(PL.x, PL.y + 1, PL.z, it);
  swing(); UI.hudDirty = true;
}
// drinking a potion: its effects, then the empty bottle
function drinkPotion(h) {
  const d = ITEMS[h.id]; applyPotion(PL, d.potion, 1); play('burp');
  if (d.potion === 'water') PL.fire = 0;
  if (!creative()) { h.n--; const b = { id: IID.glass_bottle, n: 1 }; if (h.n <= 0) INV.slots[INV.sel] = b; else if (INV.add(b)) dropStack(PL.x, PL.y + 1, PL.z, b); }
  UI.hudDirty = true;
}
// arrows: the first arrow in the hotbar, then the rest of the inventory (Java order without an off hand)
const isArrow = id => id === IID.arrow || (ITEMS[id] && ITEMS[id].tipped != null);
function arrowSlot() { for (let i = 0; i < 36; i++) { const s = INV.slots[i]; if (s && isArrow(s.id)) return i; } return -1; }

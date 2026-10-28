// Status effects (Java Edition): applied by potions, food, beacons, mobs and totems; milk clears them.
// t.eff = { key: { lv, t } }, lv 0 = level I, t = ticks left. Works for the player and for mobs.
// the swirl of particles around anyone with an effect: the effects' colours mixed, stronger ones counting more (Java)
function effSwirlColor(eff) {
  if (!eff) return null; let r = 0, g = 0, b = 0, n = 0;
  for (const k in eff) { const d = EFF[k], e = eff[k]; if (!d || !e || k === 'glowing' || k === 'invisibility' || e.hide) continue; const c = parseInt(d[1].slice(1), 16), w = (e.lv || 0) + 1; r += ((c >> 16) & 255) * w; g += ((c >> 8) & 255) * w; b += (c & 255) * w; n += w; }
  return n ? [+(r / n / 255).toFixed(2), +(g / n / 255).toFixed(2), +(b / n / 255).toFixed(2)] : null;
}
function effSwirl(x, y, z, h, col, dt) { if (Math.random() < dt * 8) R.simpleParticle(x + (Math.random() - .5) * 0.6, y + Math.random() * h, z + (Math.random() - .5) * 0.6, col, { kind: 'effect', size: 0.1, vy: 0.4, grav: 0, life: 0.8 }); }
function effSwirls(dt, px, pz) { // mobs near you, and you yourself when seen from outside
  for (const e of ENT) { if (e.kind !== 'mob' || e.dead || e.deathT || Math.abs(e.x - px) > 32 || Math.abs(e.z - pz) > 32) continue; const c = e.remote ? e.ec : effSwirlColor(e.eff); if (c) effSwirl(e.x, e.y, e.z, e.h, c, dt); }
  if (typeof view !== 'undefined' && view !== 0 && !PL.dead) { const c = effSwirlColor(PL.eff); if (c) effSwirl(PL.x, PL.y, PL.z, 1.8, c, dt); }
}
const EFF = {
  speed: ['신속', '#7cafc6'], slowness: ['구속', '#5a6c81'], haste: ['성급함', '#d9c043'], mining_fatigue: ['채굴 피로', '#4a4217'],
  strength: ['힘', '#932423'], instant_health: ['즉시 회복', '#f82423'], instant_damage: ['즉시 피해', '#430a09'], jump_boost: ['점프 강화', '#22ff4c'],
  nausea: ['멀미', '#551d4a'], regeneration: ['재생', '#cd5cab'], resistance: ['저항', '#99453a'], fire_resistance: ['화염 저항', '#e49a3a'],
  water_breathing: ['수중 호흡', '#2e5299'], invisibility: ['투명화', '#7f8392'], blindness: ['실명', '#1f1f23'], night_vision: ['야간 투시', '#1f1fa1'],
  hunger: ['허기', '#587653'], weakness: ['나약함', '#484d48'], poison: ['독', '#4e9331'], wither: ['시듦', '#352a27'], absorption: ['흡수', '#2552a5'],
  saturation: ['포화', '#f82423'], levitation: ['공중 부양', '#ceffff'], slow_falling: ['느린 낙하', '#f7f8e0'], conduit_power: ['전달체의 힘', '#1dc2d1'],
  dolphins_grace: ['돌고래의 우아함', '#88a3be'], bad_omen: ['흉조', '#0b6138'], hero_of_the_village: ['마을의 영웅', '#44ff44'], glowing: ['발광', '#94a061'],
  health_boost: ['생명력 강화', '#f87d23'], luck: ['행운', '#339900'], unluck: ['불운', '#c0a44d'],
};
// maximum health: 20, plus 4 for each level of health boost
const plMaxHp = () => 20 + 4 * effLv(PL, 'health_boost');
const UNDEAD = new Set(['zombie', 'skeleton', 'husk', 'drowned', 'stray', 'wither_skeleton', 'zombified_piglin', 'zoglin', 'phantom', 'skeleton_horse', 'zombie_horse']);
const effLv = (t, k) => { const e = t && t.eff && t.eff[k]; return e ? e.lv + 1 : 0; }; // 0: none, 1: level I
function addEffect(t, k, dur, lv = 0) {
  if (t === PL && (PL.dead || creative() && (k === 'poison' || k === 'wither' || k === 'instant_damage'))) return;
  if (k === 'instant_health' || k === 'instant_damage') { // undead are hurt by healing and healed by harm
    const heal = (k === 'instant_health') !== (t !== PL && UNDEAD.has(t.type));
    if (heal) { if (t === PL) PL.health = Math.min(plMaxHp(), PL.health + (4 << lv)); else t.hp = Math.min(t.def.hp, t.hp + (4 << lv)); }
    else if (t === PL) hurtPlayer(6 << lv, 'magic'); else { t.inv = 0; hurtMob(t, 6 << lv, null); }
    UI.hudDirty = true; return;
  }
  if (k === 'saturation') { if (t === PL) { PL.food = Math.min(20, PL.food + lv + 1); PL.sat = Math.min(PL.food, PL.sat + (lv + 1) * 2); } return; }
  if (t !== PL && UNDEAD.has(t.type) && (k === 'poison' || k === 'regeneration')) return;
  t.eff = t.eff || {};
  const cur = t.eff[k];
  if (!cur || lv > cur.lv || (lv === cur.lv && dur > cur.t)) t.eff[k] = { lv, t: dur };
  if (k === 'absorption' && t === PL) PL.absorb = Math.max(PL.absorb, 4 * (lv + 1));
  if (t === PL) UI.hudDirty = true;
}
function clearEffects(t) { if (t === PL && effLv(PL, 'absorption')) PL.absorb = 0; t.eff = {}; if (t === PL) UI.hudDirty = true; }
// per tick: periodic healing and damage, timers
function effectTick(t) {
  if (!t.eff) return;
  const me = t === PL;
  for (const k in t.eff) {
    const e = t.eff[k], lv = e.lv;
    if (k === 'regeneration' && e.t % Math.max(1, 50 >> lv) === 0) { if (me) { if (PL.health < plMaxHp()) { PL.health = Math.min(plMaxHp(), PL.health + 1); UI.hudDirty = true; } } else if (t.hp < t.def.hp) t.hp++; }
    else if (k === 'poison' && e.t % Math.max(1, 25 >> lv) === 0) { if (me) { if (PL.health > 1) hurtPlayer(1, 'poison'); } else if (t.hp > 1) { t.inv = 0; hurtMob(t, 1, null); } }
    else if (k === 'wither' && e.t % Math.max(1, 40 >> lv) === 0) { if (me) hurtPlayer(1, 'wither'); else { t.inv = 0; hurtMob(t, 1, null); } }
    else if (k === 'hunger' && me) PL.exh += 0.005 * (lv + 1);
    if (--e.t <= 0) { delete t.eff[k]; if (k === 'absorption' && me) PL.absorb = 0; if (k === 'health_boost' && me) PL.health = Math.min(PL.health, plMaxHp()); if (me) UI.hudDirty = true; }
  }
}
// player modifiers used by movement, combat and mining
const speedMul = () => (1 + 0.2 * effLv(PL, 'speed')) * Math.max(0, 1 - 0.15 * effLv(PL, 'slowness'));
const meleeBonus = () => 3 * effLv(PL, 'strength') - 4 * effLv(PL, 'weakness');
const digMul = () => (1 + 0.2 * effLv(PL, 'haste') + 0.2 * effLv(PL, 'conduit_power')) * Math.pow(0.3, Math.min(4, effLv(PL, 'mining_fatigue')));
// HUD: effects with their level and time left, top right
const ROMAN_E = ['', '', ' II', ' III', ' IV', ' V'];
const EFF_URL = {};
const effIconCss = k => { if (EFF_URL[k] === undefined) { const c = typeof entCanvas === 'function' && entCanvas('effect_' + k); EFF_URL[k] = c ? c.toDataURL() : null; } return EFF_URL[k] ? `background:url(${EFF_URL[k]}) 0 0/100% 100%;image-rendering:pixelated;border:0` : `background:${EFF[k][1]}`; }; // the jar's mob_effect icon
function renderEffects() {
  const el = document.getElementById('effects'); if (!el) return;
  const list = PL.eff ? Object.entries(PL.eff) : [];
  el.innerHTML = list.map(([k, e]) => { const s = Math.ceil(e.t / 20), mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0'); return `<div class="ef"><i style="${effIconCss(k)}"></i>${EFF[k][0]}${ROMAN_E[e.lv + 1] != null ? ROMAN_E[e.lv + 1] : ' ' + (e.lv + 1)} <b>${e.t > 32767 * 20 ? '**:**' : mm + ':' + ss}</b></div>`; }).join('');
}
// mending: picked-up experience repairs a damaged mending item first (2 durability per point)
function mendWithXP(v) {
  const cands = [];
  [INV.slots[INV.sel], ...INV.armor].forEach(s => { if (s && s.d > 0 && enchLv(s, 'mending')) cands.push(s); });
  if (!cands.length) return v;
  const s = cands[(Math.random() * cands.length) | 0], fix = Math.min(s.d, v * 2);
  s.d -= fix; UI.hudDirty = true;
  return v - Math.ceil(fix / 2);
}

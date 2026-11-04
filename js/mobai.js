// ---------- Java's numbers for the monsters' senses and legs ----------
// Follow range: how far a monster notices a player it can see, and how far it keeps after one (zombies 35, most 16).
const MOB_FOLLOW = { zombie: 35, husk: 35, drowned: 35, zombie_villager: 35, zombified_piglin: 35, piglin: 16, vindicator: 12, evoker: 12, pillager: 32, ravager: 32, witch: 16, enderman: 64 };
function mobFollowRange(e) { return MOB_FOLLOW[e.type] || e.def.follow || 16; }
// what the player looks like from far off: sneaking 0.8 of the range, invisible 0.07 (up to 0.7 with armour on)
function mobSeeScale() {
  let f = PL.sneaking ? 0.8 : 1;
  if (effLv(PL, 'invisibility')) { const worn = INV.armor ? INV.armor.filter(Boolean).length : 0; f *= 0.7 * Math.max(0.1, worn / 4); }
  return f;
}
// a spider's light rule: at a brightness of 0.5 or more (light level 12 and up where it stands) it doesn't start a
// fight, by day in the open or by torchlight; in a dark cave it does, noon or not
function mobBrightLight(e) {
  if (W.dim !== 0) return false;
  const l = getLight(Math.floor(e.x), Math.floor(e.y + e.h * 0.85), Math.floor(e.z));
  return Math.max(l & 15, (l >> 4) - skyDarken()) >= 12;
}
// walking speeds: Java's movement attribute a moves a mob 4.317 x a^2 / 0.1 blocks a second (a zombie 0.23: 2.3);
// here a speed of s gives 14.3 x s blocks a second on the ground
{ const J = { zombie: 0.23, husk: 0.23, drowned: 0.23, zombie_villager: 0.23, skeleton: 0.25, stray: 0.25, wither_skeleton: 0.25, spider: 0.3, cave_spider: 0.3, creeper: 0.25, silverfish: 0.25, endermite: 0.25 };
  for (const t in J) if (MOBDEF[t]) MOBDEF[t].speed = +(4.317 * J[t] * J[t] / 0.1 / 14.3).toFixed(3); }
// the ones with a stroll slower than their charge (Java's speed modifiers on their goals) and their own attack timing
{ const sp = a => +(4.317 * a * a / 0.1 / 14.3).toFixed(3), set = (t, o) => { if (MOBDEF[t]) Object.assign(MOBDEF[t], o); };
  set('hoglin', { speed: sp(0.3 * 0.4), chase: sp(0.3), atkCd: 40 }); set('zoglin', { speed: sp(0.25 * 0.4), chase: sp(0.25), atkCd: 40 });
  set('zombified_piglin', { speed: sp(0.23), chase: sp(0.23) });
  for (const t of ['vindicator', 'pillager']) set(t, { speed: sp(0.35 * 0.6), chase: sp(0.35) });
  set('evoker', { speed: sp(0.5 * 0.6), chase: sp(0.5 * 0.6) }); set('ravager', { speed: sp(0.3 * 0.4), chase: sp(0.3) });
  set('witch', { speed: sp(0.25) }); }

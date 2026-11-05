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
// Java's movement attribute (a) and each goal's speed modifier for the animals that run on the common AI: a stroll,
// a panic after a hit, following food in a hand, a baby keeping up with a grown-up
function mobJSpeed(a) { return 4.317 * a * a / 0.1 / 14.3; }
{ const J = { cow: [0.2, 1, 2, 1.25, 1.25], mooshroom: [0.2, 1, 2, 1.25, 1.25], pig: [0.25, 1, 1.25, 1.2, 1.1], sheep: [0.23, 1, 1.25, 1.1, 1.1], chicken: [0.25, 1, 1.4, 1, 1.1],
    goat: [0.2, 1, 2, 1.25, 1.25], villager: [0.5, 0.5, 0.6, 0.5, 0.6], horse: [0.225, 0.7, 1.2, 1.25, 1], donkey: [0.175, 0.7, 1.2, 1.25, 1], mule: [0.175, 0.7, 1.2, 1.25, 1], zombie_horse: [0.2, 0.7, 1.2, 1.25, 1],
    polar_bear: [0.25, 1, 2, 1, 1.25], panda: [0.15, 1, 2, 1, 1.25], ocelot: [0.3, 0.8, 1.33, 0.6, 1.1], llama: [0.175, 0.7, 1.2, 1.25, 1], trader_llama: [0.175, 0.7, 1.2, 1.25, 1], skeleton_horse: [0.2, 0.7, 1.2, 1.25, 1], wandering_trader: [0.5, 0.35, 0.5, 0.5, 0.5] };
  for (const t in J) if (MOBDEF[t]) { const [a, stroll, panic, tempt, parent] = J[t]; MOBDEF[t].jv = { a, stroll, panic, tempt, parent }; } }
// ---------- zombies and villagers (Java's ZombieAttackGoal targets, VillagerPanicTrigger) ----------
const ZOMBIE_PREY = new Set(['villager', 'wandering_trader', 'iron_golem']);
function zombieSeekVillager(e, fr) {
  if (e.target && e.target !== PL) return;
  let best = null, bd = fr; for (const o of ENT) if (o.kind === 'mob' && !o.dead && !o.deathT && ZOMBIE_PREY.has(o.type)) { const d = Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z); if (d < bd && canSee(e.x, e.y + e.h * 0.85, e.z, o.x, o.y + o.h * 0.8, o.z)) { bd = d; best = o; } }
  if (best) e.target = best;
}
// a monster after another mob: walks there and hits it with its own reach and damage
function mobHuntMob(e, d) {
  const t = e.target, dx = t.x - e.x, dz = t.z - e.z, dy = t.y - e.y, l = Math.hypot(dx, dz) || 1;
  e.yawTarget = Math.atan2(-dx, -dz);
  if (dx * dx + dz * dz + dy * dy <= (4 * e.w) ** 2 + 2 * (t.w || 0.3) && e.attackCd <= 0) { e.attackCd = d.atkCd || 20; hurtMob(t, d.dmg || 2, e, dx / l, dz / l); /* (difficulty only scales hits on players) */ }
  return pathDir(e, t.x, t.y, t.z);
}
// villagers run from a zombie within 8 blocks (Java: panic at 0.5 of their speed, here their panic speed)
function villagerFear(e) {
  if (e.type !== 'villager' || e.age % 10) return;
  let z = null, zd = 8; for (const o of ENT) if (o.kind === 'mob' && !o.dead && (ZOMBIE_KIND.has(o.type) || IS_RAIDER_SET.has(o.type))) { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < zd) { zd = d; z = o; } }
  if (z) { e.panic = Math.max(e.panic || 0, 30); e.fleeFrom = [z.x, z.z]; if (!e.goal || Math.random() < 0.3) e.goal = null; }
}
const IS_RAIDER_SET = new Set(['pillager', 'vindicator', 'evoker', 'ravager', 'illusioner', 'vex']);
{ const me = mobExtraTick; mobExtraTick = function (e, dist) { villagerFear(e); return me.apply(this, arguments); }; }

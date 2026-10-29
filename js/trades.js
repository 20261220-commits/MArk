// Villager trades as in Java 1.17 (TradeOffers): each profession has five levels (novice, apprentice, journeyman,
// expert, master) with their own pool; a villager unlocks 2 offers of a level when it reaches it, gains experience from
// each trade (10 / 70 / 150 / 250 to level up), restocks at its job site twice a day, and its prices rise with demand.
// An offer: a / an (first price, adjusted), a2 / an2 (an optional second item), b / bn (what it sells), max uses,
// xp (villager experience), mult (price multiplier: 0.05, or 0.2 for enchanted things), demand.
const VLEVEL_NAME = ['초보자', '견습생', '숙련자', '전문가', '달인'], VLEVEL_XP = [0, 10, 70, 150, 250];
const DYES16 = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
// buy: the player gives n of key for one emerald; sell: price emeralds for n of key; proc: inN of inKey + price emeralds
const VBUY = (key, n, max, xp) => ({ a: key, an: n, b: 'emerald', bn: 1, max, xp, mult: 0.05 });
const VS = (key, price, n, max, xp, mult = 0.05) => ({ a: 'emerald', an: price, b: key, bn: n, max, xp, mult });
const VSD = (key, price, xp) => ({ ...VS(key, price, 1, 12, xp), dye: 1 }); // Java's SellDyedArmorFactory: one random dye, maybe a second and a third
const VP = (inKey, inN, price, key, n, max, xp) => ({ a: inKey, an: inN, a2: 'emerald', an2: price, b: key, bn: n, max, xp, mult: 0.05 });
const VE = (key, base, xp) => ({ a: 'emerald', an: base, b: key, bn: 1, max: 3, xp, mult: 0.2, enchant: 1 }); // enchanted at level 5..19, the price grows by the level
const VBOOK = xp => ({ a: 'emerald', an: 0, a2: 'book', an2: 1, b: 'enchanted_book', bn: 1, max: 12, xp, mult: 0.2, book: 1 });
const VMAP = (price, map, xp) => ({ a: 'emerald', an: price, a2: 'compass', an2: 1, b: map, bn: 1, max: 12, xp, mult: 0.2, map: 1 });
const vEach = (f, list = DYES16) => list.map(f);
const VTRADES = {
  farmer: [[VBUY('wheat', 20, 16, 2), VBUY('potato', 26, 16, 2), VBUY('carrot', 22, 16, 2), VBUY('beetroot', 15, 16, 2), VS('bread', 1, 6, 16, 1)],
    [VBUY('pumpkin', 6, 12, 10), VS('pumpkin_pie', 1, 4, 12, 5), VS('apple', 1, 4, 16, 5)],
    [VS('cookie', 3, 18, 12, 10), VBUY('melon', 4, 12, 20)],
    [VS('cake', 1, 1, 12, 15), ...[['night_vision', 100], ['jump_boost', 160], ['weakness', 140], ['blindness', 120], ['poison', 280], ['saturation', 7]].map(s => ({ ...VS('suspicious_stew', 1, 1, 12, 15), stew: s }))],
    [VS('golden_carrot', 3, 3, 12, 30), VS('glistering_melon_slice', 4, 3, 12, 30)]],
  fisherman: [[VBUY('string', 20, 16, 2), VBUY('coal', 10, 16, 2), VP('cod', 6, 1, 'cooked_cod', 6, 16, 1), VS('cod_bucket', 3, 1, 16, 1)],
    [VBUY('cod', 15, 16, 10), VP('salmon', 6, 1, 'cooked_salmon', 6, 16, 5), VS('campfire', 2, 1, 12, 5)],
    [VBUY('salmon', 13, 16, 20), VE('fishing_rod', 3, 10)],
    [VBUY('tropical_fish', 6, 12, 30)],
    [VBUY('pufferfish', 4, 12, 30), { ...VBUY('oak_boat', 1, 12, 30), boat: 1 }]],
  shepherd: [[VBUY('white_wool', 18, 16, 2), VBUY('brown_wool', 18, 16, 2), VBUY('black_wool', 18, 16, 2), VBUY('gray_wool', 18, 16, 2), VS('shears', 2, 1, 12, 1)],
    [...vEach(c => VBUY(c + '_dye', 12, 16, 10), ['white', 'gray', 'black', 'light_blue', 'lime']), ...vEach(c => VS(c + '_wool', 1, 1, 16, 5)), ...vEach(c => VS(c + '_carpet', 1, 4, 16, 5))],
    [...vEach(c => VBUY(c + '_dye', 12, 16, 20), ['yellow', 'light_gray', 'orange', 'red', 'pink']), ...vEach(c => VS(c + '_bed', 3, 1, 12, 10))],
    [...vEach(c => VBUY(c + '_dye', 12, 16, 30), ['brown', 'purple', 'blue', 'green', 'magenta', 'cyan']), ...vEach(c => VS(c + '_banner', 3, 1, 12, 15))],
    [VS('painting', 2, 3, 12, 30)]],
  fletcher: [[VBUY('stick', 32, 16, 2), VS('arrow', 1, 16, 12, 1), VP('gravel', 10, 1, 'flint', 10, 12, 1)],
    [VBUY('flint', 26, 12, 10), VS('bow', 2, 1, 12, 5)],
    [VBUY('string', 14, 16, 20), VS('crossbow', 3, 1, 12, 10)],
    [VBUY('feather', 24, 16, 30), VE('bow', 2, 15)],
    [VBUY('tripwire_hook', 8, 12, 30), VE('crossbow', 3, 15), { ...VP('arrow', 5, 2, 'tipped_arrow', 5, 12, 30), tipped: 1 }]],
  librarian: [[VBUY('paper', 24, 16, 2), VBOOK(1), VS('bookshelf', 9, 1, 12, 1)],
    [VBUY('book', 4, 12, 10), VBOOK(5), VS('lantern', 1, 1, 12, 5)],
    [VBUY('ink_sac', 5, 12, 20), VBOOK(10), VS('glass', 1, 4, 12, 10)],
    [VBUY('writable_book', 2, 12, 30), VBOOK(15), VS('clock', 5, 1, 12, 15), VS('compass', 4, 1, 12, 15)],
    [VS('name_tag', 20, 1, 12, 30)]],
  cartographer: [[VBUY('paper', 24, 16, 2), VS('map', 7, 1, 12, 1)],
    [VBUY('glass_pane', 11, 16, 10), VMAP(13, 'ocean_explorer_map', 5)],
    [VBUY('compass', 1, 12, 20), VMAP(14, 'woodland_explorer_map', 10)],
    [VS('item_frame', 7, 1, 12, 15), ...vEach(c => VS(c + '_banner', 3, 1, 12, 15))],
    [VS('globe_banner_pattern', 8, 1, 12, 30)]],
  cleric: [[VBUY('rotten_flesh', 32, 16, 2), VS('redstone', 1, 2, 12, 1)],
    [VBUY('gold_ingot', 3, 12, 10), VS('lapis_lazuli', 1, 1, 12, 5)],
    [VBUY('rabbit_foot', 2, 12, 20), VS('glowstone', 4, 1, 12, 10)],
    [VBUY('scute', 4, 12, 30), VBUY('glass_bottle', 9, 12, 30), VS('ender_pearl', 5, 1, 12, 15)],
    [VBUY('nether_wart', 22, 12, 30), VS('experience_bottle', 3, 1, 12, 30)]],
  armorer: [[VBUY('coal', 15, 16, 2), VS('iron_leggings', 7, 1, 12, 1), VS('iron_boots', 4, 1, 12, 1), VS('iron_helmet', 5, 1, 12, 1), VS('iron_chestplate', 9, 1, 12, 1)],
    [VBUY('iron_ingot', 4, 12, 10), VS('bell', 36, 1, 12, 5), VS('chainmail_boots', 1, 1, 12, 5), VS('chainmail_leggings', 3, 1, 12, 5)],
    [VBUY('lava_bucket', 1, 12, 20), VBUY('diamond', 1, 12, 20), VS('chainmail_helmet', 1, 1, 12, 10), VS('chainmail_chestplate', 4, 1, 12, 10), VS('shield', 5, 1, 12, 10)],
    [VE('diamond_leggings', 14, 15), VE('diamond_boots', 8, 15)],
    [VE('diamond_helmet', 8, 30), VE('diamond_chestplate', 16, 30)]],
  weaponsmith: [[VBUY('coal', 15, 16, 2), VS('iron_axe', 3, 1, 12, 1), VE('iron_sword', 2, 1)],
    [VBUY('iron_ingot', 4, 12, 10), VS('bell', 36, 1, 12, 5)],
    [VBUY('flint', 24, 12, 20)],
    [VBUY('diamond', 1, 12, 30), VE('diamond_axe', 12, 15)],
    [VE('diamond_sword', 8, 30)]],
  toolsmith: [[VBUY('coal', 15, 16, 2), VS('stone_axe', 1, 1, 12, 1), VS('stone_shovel', 1, 1, 12, 1), VS('stone_pickaxe', 1, 1, 12, 1), VS('stone_hoe', 1, 1, 12, 1)],
    [VBUY('iron_ingot', 4, 12, 10), VS('bell', 36, 1, 12, 5)],
    [VBUY('flint', 30, 12, 20), VE('iron_axe', 1, 10), VE('iron_shovel', 2, 10), VE('iron_pickaxe', 3, 10), VS('diamond_hoe', 4, 1, 3, 10)],
    [VBUY('diamond', 1, 12, 30), VE('diamond_axe', 12, 15), VE('diamond_shovel', 5, 15)],
    [VE('diamond_pickaxe', 13, 30)]],
  butcher: [[VBUY('chicken', 14, 16, 2), VBUY('porkchop', 7, 16, 2), VBUY('rabbit', 4, 16, 2), VS('rabbit_stew', 1, 1, 12, 1)],
    [VBUY('coal', 15, 16, 2), VS('cooked_porkchop', 1, 5, 16, 5), VS('cooked_chicken', 1, 8, 16, 5)],
    [VBUY('mutton', 7, 16, 20), VBUY('beef', 10, 16, 20)],
    [VBUY('dried_kelp_block', 10, 12, 30)],
    [VBUY('sweet_berries', 10, 12, 30)]],
  leatherworker: [[VBUY('leather', 6, 16, 2), VSD('leather_leggings', 3, 1), VSD('leather_chestplate', 7, 1)],
    [VBUY('flint', 26, 12, 10), VSD('leather_helmet', 5, 5), VSD('leather_boots', 4, 5)],
    [VBUY('rabbit_hide', 9, 12, 20), VSD('leather_chestplate', 7, 10)],
    [VBUY('scute', 4, 12, 30), VS('leather_horse_armor', 6, 1, 12, 15)],
    [VS('saddle', 6, 1, 12, 30), VSD('leather_helmet', 5, 30)]],
  mason: [[VBUY('clay_ball', 10, 16, 2), VS('brick', 1, 10, 16, 1)],
    [VBUY('stone', 20, 16, 10), VS('chiseled_stone_bricks', 1, 4, 16, 5)],
    [VBUY('granite', 16, 16, 20), VBUY('andesite', 16, 16, 20), VBUY('diorite', 16, 16, 20), VS('polished_andesite', 1, 4, 16, 10), VS('polished_diorite', 1, 4, 16, 10), VS('polished_granite', 1, 4, 16, 10)],
    [VBUY('quartz', 12, 12, 30), ...vEach(c => VS(c + '_terracotta', 1, 1, 12, 15)), ...vEach(c => VS(c + '_glazed_terracotta', 1, 1, 12, 15))],
    [VS('quartz_pillar', 1, 1, 12, 30), VS('quartz_block', 1, 1, 12, 30)]],
};
const BOAT_OF = { plains: 'oak_boat', taiga: 'spruce_boat', snow: 'spruce_boat', desert: 'jungle_boat', jungle: 'jungle_boat', savanna: 'acacia_boat', swamp: 'dark_oak_boat' };
const STEW_DUR = { night_vision: 100, jump_boost: 160, weakness: 140, blindness: 120, poison: 280, saturation: 7 };

// one offer made real: item ids, the enchantment or effect it carries, its price
function makeOffer(t, e, r) {
  const o = { a: IID[t.a], an: t.an, b: IID[t.b], bn: t.bn, uses: 0, max: t.max, xp: t.xp, mult: t.mult, demand: 0 };
  if (t.a2) { o.a2 = IID[t.a2]; o.an2 = t.an2; if (o.a2 == null) return null; }
  if (t.boat) o.a = IID[BOAT_OF[e.vtype] || 'oak_boat'];
  if (t.map) { o.b = IID.filled_map; o.special = t.b; }
  if (t.dye) { const d = [r.int(16)]; if (r() > 0.7) d.push(r.int(16)); if (r() > 0.8) d.push(r.int(16)); o.col = dyeMix(null, d); }
  if (t.stew) { o.stew = [t.stew[0], STEW_DUR[t.stew[0]] || t.stew[1]]; }
  if (t.tipped) { const arrows = Object.keys(IID).filter(k => k.endsWith('_arrow') && k !== 'spectral_arrow' && ITEMS[IID[k]].tipped && ITEMS[IID[k]].tipped !== 'water'); if (!arrows.length) return null; o.b = IID[arrows[r.int(arrows.length)]]; }
  if (t.book) { // Java's EnchantBookFactory: any enchantment a book can be traded with (not soul speed), at a random level
    const keys = Object.keys(ENCH).filter(k => k !== 'soul_speed'), k = keys[r.int(keys.length)], lv = 1 + r.int(ENCH[k][1]);
    o.e = { [k]: lv }; o.an = Math.min(64, 2 + r.int(5 + lv * 10) + 3 * lv) * (ENCH[k][3] ? 2 : 1); if (o.an > 64) o.an = 64;
  }
  if (t.enchant) { const lv = 5 + r.int(15); o.e = rollEnchant(o.b, lv, r.int(1e9)); o.an = Math.min(64, t.an + lv); }
  if (o.a == null || o.b == null) return null;
  return o;
}
function villagerAddLevel(e, lvl) {
  const pool = (VTRADES[e.prof] || [])[lvl - 1]; if (!pool) return;
  const r = S.rng((e.id * 7919 + lvl * 104729 + (e.tseed || 0)) >>> 0), idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = r.int(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  let n = 0; for (const i of idx) { if (n >= 2) break; const o = makeOffer(pool[i], e, r); if (o) { o.lvl = lvl; e.trades.push(o); n++; } }
}
// the villager's offers (a wandering trader keeps its own list)
function villagerOffers(e) {
  if (e.remote) return e.trades || []; // a multiplayer guest shows the runner's list
  if (e.prof === 'wandering') return wanderingOffers(e);
  if (!VTRADES[e.prof]) return [];
  if (!e.trades || !e.tv) { e.trades = []; e.tv = 2; e.vlvl = e.vlvl || 1; e.vxp = e.vxp || 0; for (let l = 1; l <= e.vlvl; l++) villagerAddLevel(e, l); }
  return e.trades;
}
function wanderingOffers(e) {
  if (!e.trades) {
    const r = S.rng(e.id * 7919 + 13), pick = (list, n) => list.map((_, i) => i).sort(() => r() - 0.5).slice(0, Math.min(list.length, n)).map(i => list[i]), picked = [];
    for (const [[a, an], [b, bn]] of [...pick(TRADES.wandering, 5), ...pick(TRADES.wandering_rare, 1)]) if (IID[a] != null && IID[b] != null) picked.push({ a: IID[a], an, b: IID[b], bn, uses: 0, max: 12, xp: 1, mult: 0.05, demand: 0 });
    e.trades = picked;
  }
  return e.trades;
}
// Java's TradeOffer.getAdjustedFirstBuyItem: base + demand bonus + special price (reputation, Hero of the Village)
function tradePrice(o, v = GUI.ctx && GUI.ctx.e) {
  const base = o.an, mult = o.mult != null ? o.mult : 0.05, demand = Math.max(0, Math.floor(base * (o.demand || 0) * mult));
  let special = 0; const rep = v && v.rep ? v.rep : 0; if (rep) special -= Math.floor(rep * mult);
  const h = PL.eff && PL.eff.hero_of_the_village; if (h) special -= Math.max(1, Math.floor((0.3 + 0.0625 * h.lv) * base));
  return Math.max(1, Math.min(maxStack(o.a), base + demand + special));
}
function tradeResult(c) {
  const o = villagerOffers(c.e)[c.sel], p = c.items[0], q = c.items[1];
  if (!o || o.uses >= o.max || !p || p.id !== o.a || p.n < tradePrice(o)) return null;
  if (o.a2 != null && (!q || q.id !== o.a2 || q.n < o.an2)) return null;
  if (o.special) { if (!o.made) o.made = lootSpecial(o.special, c.e.x, c.e.z); return o.made ? { ...o.made } : null; }
  const out = { id: o.b, n: o.bn }; if (o.e) out.e = { ...o.e }; if (o.stew) out.stew = [...o.stew]; if (o.col != null) out.col = o.col;
  return out;
}
function tradeTake(c) {
  const e = c.e, o = villagerOffers(e)[c.sel], p = c.items[0];
  p.n -= tradePrice(o); if (p.n <= 0) c.items[0] = null;
  if (o.a2 != null) { const q = c.items[1]; q.n -= o.an2; if (q.n <= 0) c.items[1] = null; }
  const orbs = 3 + Math.floor(Math.random() * 4) + (tradeCounted(e, o) ? 5 : 0);
  play('trade'); spawnXP(PL.x, PL.y + 1, PL.z, orbs); UI.advance('trade'); if (PL.y >= 319 && typeof advGrant === 'function') advGrant('adventure/trade_at_world_height'); stat('traded_with_villager');
  // refill the payment slots from the inventory, as Java does after a trade
  if (!c.items[0] && INV.count(o.a) > 0) { const n = Math.min(INV.count(o.a), maxStack(o.a)); INV.remove(o.a, n); c.items[0] = { id: o.a, n }; }
  if (o.a2 != null && !c.items[1] && INV.count(o.a2) > 0) { const n = Math.min(INV.count(o.a2), maxStack(o.a2)); INV.remove(o.a2, n); c.items[1] = { id: o.a2, n }; }
  UI.renderScreen();
}
// one trade done with this villager: its stock, its experience (a level-up a moment later: true), the trading gossip
function tradeCounted(e, o) {
  o.uses++; o.made = null; e.traded = true; e.rep = Math.min(150, (e.rep || 0) + 2); // the villager keeps its job from now on
  if (e.prof === 'wandering' || e.remote) return false;
  e.vxp = (e.vxp || 0) + (o.xp || 0);
  if ((e.vlvl || 1) < 5 && e.vxp >= VLEVEL_XP[e.vlvl || 1] && !e.lvlUpT) { e.lvlUpT = 40; return true; }
  return false;
}
function selectTrade(i) {
  const c = GUI.ctx, o = villagerOffers(c.e)[i]; if (!o) return;
  c.sel = i;
  for (const [k, id] of [[0, o.a], [1, o.a2]]) {
    if (c.items[k] && c.items[k].id !== id) { INV.giveOrDrop(c.items[k]); c.items[k] = null; }
    if (id == null) continue;
    const have = INV.count(id), cur = c.items[k] ? c.items[k].n : 0, n = Math.min(have, maxStack(id) - cur);
    if (n > 0) { INV.remove(id, n); c.items[k] = { id, n: cur + n }; }
  }
  UI.renderScreen();
}
// levelling up (a moment after the trade, with the green sparkles) and restocking at the job site twice a day
function tradeTick(e) {
  if (e.lvlUpT > 0 && --e.lvlUpT === 0 && (e.vlvl || 1) < 5) {
    e.vlvl = (e.vlvl || 1) + 1; villagerAddLevel(e, e.vlvl); addEffect(e, 'regeneration', 200, 0); play('levelup', { vol: 0.4 });
    for (let i = 0; i < 10; i++) R.simpleParticle(e.x + (Math.random() - .5), e.y + 1 + Math.random(), e.z + (Math.random() - .5), [0.4, 0.9, 0.3], { kind: 'happy', size: 0.12, vy: 0.6 });
    if (UI.screen === 'trade' && GUI.ctx && GUI.ctx.e === e) UI.renderScreen();
    if (e.vlvl < 5 && e.vxp >= VLEVEL_XP[e.vlvl]) e.lvlUpT = 40;
  }
  if (!e.trades || !e.job || e.prof === 'wandering' || W.tickN % 20) return;
  const t = ((W.time % 24000) + 24000) % 24000, day = Math.floor(W.time / 24000), slot = t >= 2000 && t < 6000 ? 1 : t >= 6000 && t < 9000 ? 2 : 0;
  if (!slot || e.restocked === day * 3 + slot || !e.trades.some(o => o.uses > 0)) return;
  e.restocked = day * 3 + slot;
  for (const o of e.trades) { o.demand = Math.max(0, (o.demand || 0) + o.uses - (o.max - o.uses)); o.uses = 0; } // Java's updateDemandBonus, then the stock is full again
}
{ const vai = villagerAIExtra; villagerAIExtra = function (e) { vai(e); tradeTick(e); }; }
{ const d = MOBDEF.villager, save = d.save, init = d.init; // the level and experience are kept with the villager
  d.save = e => ({ ...(save ? save(e) : {}), vlvl: e.vlvl || 1, vxp: e.vxp || 0, tv: e.tv || 0, restocked: e.restocked || 0 });
  d.init = (e, o) => { if (init) init(e, o); e.vlvl = o.vlvl || 1; e.vxp = o.vxp || 0; e.tv = o.tv || 0; e.restocked = o.restocked || 0; }; }

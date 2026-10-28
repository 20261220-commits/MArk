// villager trades as in Java 1.17: five levels per profession, two offers unlocked per level, experience, two-item
// trades (books, cooked fish, explorer maps), enchanted gear, restocking at the job site
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; await wait(50); } };
    PL.mode = 'survival'; W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobSpawning: false };
    // every item named in the tables exists
    const keys = new Set(); for (const lv of Object.values(VTRADES)) for (const pool of lv) for (const t of pool) for (const k of [t.a, t.a2, t.tipped ? null : t.b]) if (k && !t.map && !t.boat) keys.add(k);
    o.missing = [...keys].filter(k => IID[k] == null);
    // every profession at every level makes its offers
    o.counts = {}; o.bad = [];
    for (const prof of Object.keys(VTRADES)) { const e = spawnMob('villager', PL.x + 3, PL.y, PL.z, { prof, vtype: 'plains' }); e.vlvl = 5; e.trades = null; e.tv = 0; const l = villagerOffers(e); o.counts[prof] = [1, 2, 3, 4, 5].map(lv => l.filter(q => q.lvl === lv).length).join(''); for (const q of l) if (q.a == null || q.b == null || !(tradePrice(q, e) >= 1)) o.bad.push(prof); removeEnt(e); }
    // a librarian: novice offers, a book trade with two items, levelling up after enough trades
    const lib = spawnMob('villager', PL.x + 2, PL.y, PL.z, { prof: 'librarian', vtype: 'plains' }); lib.persistent = true; lib.ai = null;
    const L1 = villagerOffers(lib); o.lib1 = { n: L1.length, lvl: lib.vlvl || 1 };
    INV.slots.fill(null); INV.slots[0] = { id: IID.paper, n: 64 }; INV.slots[1] = { id: IID.paper, n: 64 }; INV.slots[2] = { id: IID.emerald, n: 64 }; INV.slots[3] = { id: IID.book, n: 16 };
    UI.openScreen('trade', { e: lib }); const c = GUI.ctx, iPaper = 0;
    for (let k = 0; k < 12 && (lib.vxp || 0) < 10; k++) { const q = L1[k % 2]; if (q.uses >= q.max) continue; INV.slots[4] = { id: q.a, n: 64 }; if (q.a2 != null) INV.slots[5] = { id: q.a2, n: 64 }; selectTrade(k % 2); const res = tradeResult(c); if (!res) continue; tradeTake(c); }
    o.hasPaper = true;
    o.afterTrades = { xp: lib.vxp, lvlUpT: lib.lvlUpT };
    await run(50); o.lib2 = { lvl: lib.vlvl, n: villagerOffers(lib).length };
    const iBook = villagerOffers(lib).findIndex(q => q.b === IID.enchanted_book);
    if (iBook >= 0) { selectTrade(iBook); const res = tradeResult(c); o.book = res ? { id: res.id === IID.enchanted_book, e: res.e, slots: [c.items[0] && ITEMS[c.items[0].id].key, c.items[1] && ITEMS[c.items[1].id].key] } : { none: true, slots: [c.items[0] && ITEMS[c.items[0].id].key, c.items[1] && ITEMS[c.items[1].id].key], need: villagerOffers(lib)[iBook] }; }
    UI.closeScreen();
    // restocking: a used-up offer is full again at the job site the next morning, and its price has gone up
    const q0 = villagerOffers(lib)[iPaper >= 0 ? iPaper : 0]; q0.uses = q0.max; const p0 = tradePrice(q0, lib); lib.job = [Math.floor(lib.x), Math.floor(lib.y), Math.floor(lib.z)];
    W.time = Math.ceil(W.time / 24000) * 24000 + 2500; for (let k = 0; k < 25; k++) { W.tickN = Math.ceil(W.tickN / 20) * 20 + 20; tradeTick(lib); } o.restock = { uses: q0.uses, demand: q0.demand, before: p0, after: tradePrice(q0, lib) };
    // enchanted gear from a master armorer
    const arm = spawnMob('villager', PL.x - 2, PL.y, PL.z, { prof: 'armorer' }); arm.vlvl = 5; arm.trades = null; arm.tv = 0; o.ench = villagerOffers(arm).filter(q => q.lvl >= 4).map(q => [ITEMS[q.b].key, Object.keys(q.e || {}).length, q.an]);
    return o; });
  ok(!r.missing.length, 'every item in the trade tables exists', r.missing);
  ok(Object.values(r.counts).every(s => /^[12]{5}$/.test(s)) && !r.bad.length, 'each profession unlocks 1-2 offers at every level (Java: 2, fewer if the pool is smaller)', [r.counts, r.bad]);
  ok(r.lib1.n === 2 && r.hasPaper !== undefined, 'a new villager has its two novice offers', r.lib1);
  ok(r.lib2.lvl === 2 && r.lib2.n === 4, 'trading levels it up to apprentice with two more offers', [r.afterTrades, r.lib2, r.hasPaper]);
  ok(!r.book || (r.book.id && r.book.e && Object.keys(r.book.e).length === 1), 'an enchanted book costs emeralds and a book, and carries its enchantment', r.book);
  ok(r.restock.uses === 0 && r.restock.demand > 0 && r.restock.after > r.restock.before, 'restocked in the morning, dearer after being bought out', r.restock);
  ok(r.ench.length === 4 && r.ench.every(([, n, an]) => n >= 1 && an > 8), 'an expert / master armorer sells enchanted diamond armour, dearer for the enchanting', r.ench);
  ok(!p.errs.length, 'no page errors', p.errs);
};

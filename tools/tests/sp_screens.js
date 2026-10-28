// containers and work blocks: chest, furnace, enchanting, anvil, drag splitting, villager trading
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => { const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)); PL.mode = 'survival';
    const all = () => [...INV.slots, ...INV.armor, INV.off, INV.cursor]; const cnt = id => all().reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let y = 0; y < 4; y++) setBlock(X + a, Y + y, Z + c, 0); } PL.x = X + .5; PL.y = Y; PL.z = Z + .5;
    INV.slots.fill(null); for (let i = 0; i < 12; i++) INV.slots[i] = { id: [IID.stone, IID.dirt, IID.diamond, IID.iron_sword][i % 4], n: [64, 17, 5, 1][i % 4] };
    setBlock(X, Y, Z + 3, BID.chest); setTile(X, Y, Z + 3, { type: 'chest', items: new Array(27).fill(null) }); const t = getTile(X, Y, Z + 3); t.items[3] = { id: IID.stone, n: 40 };
    const tot = () => { const m = {}; for (const s of [...all(), ...t.items]) if (s) m[s.id] = (m[s.id] || 0) + s.n; return JSON.stringify(Object.keys(m).sort().map(k => [k, m[k]])); };
    const t0 = tot(); UI.openScreen('chest', { x: X, y: Y, z: Z + 3 }); let seed = 9; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let k = 0; k < 3000; k++) { clickSlot(rnd(GUI.slots.length), rnd(3) === 0 ? 2 : 0, rnd(5) === 0); if (k % 50 === 0) collectToCursor(); }
    UI.closeScreen(); out.chest = tot() === t0;
    setBlock(X + 2, Y, Z + 3, BID.furnace); setTile(X + 2, Y, Z + 3, newFurnace()); const f = getTile(X + 2, Y, Z + 3); f.items = [{ id: IID.raw_iron, n: 3 }, { id: IID.coal, n: 2 }, null];
    for (let i = 0; i < 700; i++) furnaceTick(); out.furnace = [f.items.map(s => s && ITEMS[s.id].key + 'x' + s.n).join(), +f.xp.toFixed(2)];
    f.items = [{ id: IID.raw_iron, n: 5 }, { id: IID.coal, n: 5 }, { id: IID.iron_ingot, n: 63 }]; for (let i = 0; i < 1200; i++) furnaceTick(); out.furnaceFull = f.items.map(s => s && ITEMS[s.id].key + 'x' + s.n).join();
    INV.slots.fill(null); UI.openScreen('inv'); INV.cursor = { id: IID.stone, n: 32 }; const m = GUI.slots.map((s, i) => [s, i]).filter(([s]) => s.group === 'main').slice(0, 3).map(([, i]) => i);
    GUI.drag = { btn: 0, list: m, start: m[0] }; screenUp({}); out.drag = [m.map(i => GUI.slots[i].get() && GUI.slots[i].get().n).join(), INV.cursor && INV.cursor.n]; UI.closeScreen();
    INV.slots.fill(null); INV.slots[0] = { id: IID.diamond_pickaxe, n: 1 }; INV.slots[1] = { id: IID.lapis_lazuli, n: 5 }; PL.level = 30;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) === 2 || Math.abs(dz) === 2) { setBlock(X - 5 + dx, Y, Z + dz, BID.bookshelf); setBlock(X - 5 + dx, Y + 1, Z + dz, BID.bookshelf); }
    setBlock(X - 5, Y, Z, BID.enchanting_table); UI.openScreen('enchant', { x: X - 5, y: Y, z: Z }); const hot = () => GUI.slots.findIndex(s => s.group === 'hot');
    clickSlot(hot(), 0, true); clickSlot(hot() + 1, 0, true); await wait(100); const eb = document.querySelector('[data-ench="2"]'); if (eb) eb.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(100);
    out.ench = { level: PL.level, lapis: GUI.ctx.items[1] ? GUI.ctx.items[1].n : 0, enchanted: !!(GUI.ctx.items[0] && GUI.ctx.items[0].e) }; UI.closeScreen(); out.enchBack = [cnt(IID.lapis_lazuli), cnt(IID.diamond_pickaxe)];
    INV.slots.fill(null); INV.slots[0] = { id: IID.iron_sword, n: 1, d: 200 }; INV.slots[1] = { id: IID.iron_ingot, n: 3 }; PL.level = 10;
    setBlock(X + 5, Y, Z, BID.anvil); UI.openScreen('anvil', { x: X + 5, y: Y, z: Z }); clickSlot(hot(), 0, true); clickSlot(hot() + 1, 0, true); clickSlot(GUI.slots.findIndex(s => s.output), 0, true); UI.closeScreen();
    out.anvil = { level: PL.level, ingots: cnt(IID.iron_ingot), dmg: all().filter(s => s && s.id === IID.iron_sword).map(s => s.d).join() };
    // trading: pick an offer that wants emeralds only and buy it once
    const v = spawnMob('villager', X + 1.5, Y, Z - 2.5); v.prof = 'farmer'; v.persistent = true; INV.slots.fill(null);
    UI.openScreen('trade', { e: v }); const offers = v.trades || []; out.offers = offers.length;
    const k = offers.findIndex(o => o && o.a != null && o.a2 == null && o.a !== o.b && o.max > o.uses); /* novice offers can all be crops for emeralds */ const o = offers[k]; out.offer = o && { a: ITEMS[o.a].key, an: o.an, b: ITEMS[o.b].key, bn: o.bn };
    if (o) { INV.slots[2] = { id: o.a, n: 64 }; const have = () => all().reduce((a, s) => a + (s && s.id === o.a ? s.n : 0), 0) + (GUI.ctx.items || []).reduce((a, s) => a + (s && s.id === o.a ? s.n : 0), 0);
      const before = have(), bBefore = cnt(o.b); selectTrade(k); const res = GUI.slots.findIndex(s => s.output); const got = GUI.slots[res].get(); clickSlot(res, 0, false);
      out.trade = { paid: before - have(), price: tradePrice(o), got: got && got.n, cursor: INV.cursor && INV.cursor.id === o.b ? INV.cursor.n : 0, uses: o.uses };
      INV.giveOrDrop(INV.cursor); INV.cursor = null; }
    UI.closeScreen();
    return out; });
  ok(r.chest, '3000 random chest clicks keep every item');
  ok(r.furnace[0] === ',coalx1,iron_ingotx3' && r.furnace[1] === 2.1, 'a furnace smelts 3 ore with one coal and gives 2.1 experience', r.furnace);
  ok(r.furnaceFull === 'raw_ironx4,coalx5,iron_ingotx64', 'a furnace stops at a full output', r.furnaceFull);
  ok(r.drag[0] === '10,10,10' && r.drag[1] === 2, 'dragging 32 over 3 slots puts 10 in each', r.drag);
  ok(r.ench.level === 27 && r.ench.lapis === 2 && r.ench.enchanted && r.enchBack[0] === 2 && r.enchBack[1] === 1, 'the third enchantment costs 3 lapis and 3 levels', [r.ench, r.enchBack]);
  ok(r.anvil.level === 7 && r.anvil.ingots === 0 && r.anvil.dmg === '14', 'an anvil repairs with 3 ingots for 3 levels', r.anvil);
  ok(r.offers > 0 && r.trade && r.trade.paid === r.trade.price && r.trade.got > 0 && r.trade.cursor === r.trade.got && r.trade.uses === 1, 'a villager trade takes the payment once and hands over the goods', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

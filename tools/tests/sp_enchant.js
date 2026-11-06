// enchanting as Java 1.18: the table only takes an unenchanted tool, armour, bow, rod or a book (a stick gets nothing),
// picks by Java's weights and level ranges (efficiency often, silk touch rarely, never with fortune); a book becomes an
// enchanted book; the anvil puts a book's enchantment only where it fits (anything in creative), combines two books,
// and charges by rarity; frost walker exists; a crossbow loads a rocket from the off hand and the shot rocket hurts
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    for (let a = -10; a <= 10; a++) for (let c = -10; c <= 10; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 6; k++) setBlock(X + a, Y + k, Z + c, 0); }
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.level = 50; await wait(200);
    // the table
    setBlock(X + 2, Y, Z, BID.enchanting_table); const table = (st) => { UI.openScreen('enchant', { x: X + 2, y: Y, z: Z, items: [st, { id: IID.lapis_lazuli, n: 64 }] }); const l = enchantOptions().list; return l; };
    o.stick = table({ id: IID.stick, n: 1 }).length; o.sword = table({ id: IID.iron_sword, n: 1 }).filter(x => Object.keys(x.e).length).length;
    o.enchanted = table({ id: IID.iron_sword, n: 1, e: { sharpness: 1 } }).length;
    const bk = { id: IID.book, n: 1 }, bl = table(bk), best = bl.map((x, i) => x.ok ? i : -1).filter(i => i >= 0).pop(); const btn = document.createElement('div'); btn.dataset.ench = String(best); /* (no shelves: a slot costing less than its number is off, as Java) */ document.getElementById('screen').appendChild(btn); btn.click(); btn.remove();
    o.book = [bk.id === IID.enchanted_book, Object.keys(bk.e || {}).length]; UI.closeScreen();
    // weights and ranges over many rolls
    const cnt = {}; let both = 0, axeSharp = 0;
    for (let i = 0; i < 3000; i++) { const e = rollEnchant(IID.diamond_pickaxe, 30, i * 7 + 1); for (const k in e) cnt[k] = (cnt[k] || 0) + 1; if (e.fortune && e.silk_touch) both++; const a = rollEnchant(IID.diamond_axe, 30, i * 13 + 5); if (a.sharpness || a.smite) axeSharp++; }
    o.roll = { eff: cnt.efficiency || 0, silk: cnt.silk_touch || 0, both, axeSharp, effMax: Math.max(...Array.from({ length: 200 }, (_, i) => rollEnchant(IID.diamond_pickaxe, 30, i).efficiency || 0)) };
    // the anvil
    const anvil = (a, bb) => anvilResult({ items: [a, bb], name: null });
    o.stickSurv = anvil({ id: IID.stick, n: 1 }, { id: IID.enchanted_book, n: 1, e: { knockback: 2 } });
    PL.mode = 'creative'; const sc = anvil({ id: IID.stick, n: 1 }, { id: IID.enchanted_book, n: 1, e: { knockback: 2 } }); o.stickCre = sc && sc.out.e; PL.mode = 'survival';
    const bb = anvil({ id: IID.enchanted_book, n: 1, e: { sharpness: 3 } }, { id: IID.enchanted_book, n: 1, e: { sharpness: 3, unbreaking: 1 } }); o.books = bb && bb.out.e;
    o.axeSharp = (anvil({ id: IID.iron_axe, n: 1 }, { id: IID.enchanted_book, n: 1, e: { sharpness: 2 } }) || {}).out;
    o.cost = [anvil({ id: IID.iron_sword, n: 1 }, { id: IID.enchanted_book, n: 1, e: { sharpness: 5 } }).cost, anvil({ id: IID.iron_sword, n: 1 }, { id: IID.enchanted_book, n: 1, e: { looting: 3 } }).cost];
    INV.slots[INV.sel] = { id: IID.diamond_boots, n: 1 }; o.frost = !!ENCH.frost_walker && runCommand('enchant @s frost_walker 2') !== false && enchLv(INV.slots[INV.sel], 'frost_walker') === 2;
    // a crossbow and a rocket with a star in the off hand
    INV.slots[INV.sel] = { id: IID.crossbow, n: 1 }; INV.off = { id: IID.firework_rocket, n: 3, fw: { flight: 1, stars: [{ shape: 0, colors: [0xff0000] }] } };
    USE.kind = 'crossbow'; USE.t = 30; crossbowRelease(INV.slots[INV.sel]); USE.kind = null; o.loaded = [INV.slots[INV.sel].ch === IID.firework_rocket, INV.off && INV.off.n];
    const z = spawnMob('zombie', X + .5, Y, Z - 5.5); z.persistent = true; z.ai = null; z.def = { ...z.def, ai: (e) => walkPhysics(e, 0, 0, 0) }; const hp0 = z.hp;
    PL.yaw = 0; PL.pitch = -0.05; crossbowFire(INV.slots[INV.sel]);
    for (let i = 0; i < 30; i++) { UI.paused = false; gameTick(); PL.health = 20; if (i % 4 === 0) await wait(2); }
    o.rocket = [+(hp0 - z.hp).toFixed(1), INV.slots[INV.sel].ch || null];
    return o; });
  ok(r.stick === 0 && r.sword >= 1 && r.enchanted === 0, /* (no shelves: the dearer slots can be off, as Java) */ 'the table: nothing for a stick or an enchanted sword, choices for a plain sword', r);
  ok(r.book[0] && r.book[1] >= 1, 'a book on the table becomes an enchanted book', r.book);
  ok(r.roll.eff > r.roll.silk * 3 && r.roll.silk > 0 && r.roll.both === 0 && r.roll.axeSharp === 0 && r.roll.effMax <= 5, 'rolls follow Java\'s weights (efficiency common, silk touch rare, never with fortune; no sharpness on an axe from the table)', r.roll);
  ok(r.stickSurv === null && r.stickCre && r.stickCre.knockback === 2, 'the anvil: a book does nothing to a stick in survival, works in creative (Java)', [r.stickSurv, r.stickCre]);
  ok(r.books && r.books.sharpness === 4 && r.books.unbreaking === 1, 'two books combine', r.books);
  ok(r.axeSharp && r.axeSharp.e && r.axeSharp.e.sharpness === 2, 'sharpness goes on an axe at the anvil', r.axeSharp);
  ok(r.cost[0] === 5 && r.cost[1] === 6, 'anvil cost by rarity: sharpness V 5, looting III 6 (from books)', r.cost);
  ok(r.frost, 'frost walker exists', r.frost);
  ok(r.loaded[0] && r.loaded[1] === 2, 'a crossbow loads the rocket in the off hand', r.loaded);
  ok(r.rocket[0] >= 3 && !r.rocket[1], 'the shot rocket flies straight and its blast hurts the mob it hits', r.rocket);
  ok(!p.errs.length, 'no page errors', p.errs);
};

// the enchanting table as Java 1.18: bookshelves on the ring two out count when the block halfway (offset halved toward
// zero) is air, 15 at most; each slot rolls its own cost (15 shelves: the third slot costs 30); enchanting takes the
// slot's lapis and levels and turns a book into an enchanted book; the book floats and opens for a player close by, and
// glyphs fly from the counted shelves
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv, { w: 800, h: 500 }); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const out = {};
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z) - 3; for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e !== PL) removeEnt(e); W.time = 6000; PL.x = X + .5; PL.y = Y; PL.z = Z + 2.5; PL.yaw = 0; PL.pitch = -0.2; PL.inv = 1e9; UI.paused = false;
    setBlock(X, Y, Z, BID.enchanting_table); const c = { x: X, y: Y, z: Z };
    const ring = []; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if ((Math.abs(dx) === 2 || Math.abs(dz) === 2) && !(dx === 0 && dz === 2)) ring.push([dx, dz]); // (a way in on the south)
    for (const [dx, dz] of ring) setBlock(X + dx, Y, Z + dz, BID.bookshelf);
    out.one = bookshelves(c); // 15 on the bottom ring
    for (const [dx, dz] of ring) setBlock(X + dx, Y + 1, Z + dz, BID.bookshelf);
    out.two = bookshelves(c); // capped at 15
    // a torch in the gap at (1, 0) east blocks (2,-1), (2,0), (2,1) on that level (Java's halfway), not (2, 2)
    for (const [dx, dz] of ring) setBlock(X + dx, Y + 1, Z + dz, 0);
    setBlock(X + 1, Y, Z, BID.torch); out.torch = bookshelves(c); setBlock(X + 1, Y, Z, 0);
    for (const [dx, dz] of ring) setBlock(X + dx, Y + 1, Z + dz, BID.bookshelf);
    // the menu: a book and lapis
    PL.level = 40; UI.openScreen('enchant', c); GUI.ctx.items[0] = { id: IID.book, n: 1 }; GUI.ctx.items[1] = { id: IID.lapis_lazuli, n: 10 };
    const costs = []; for (let s = 0; s < 40; s++) { PL.enchSeed = 1000 + s; costs.push(enchantOptions().list.map(o => o.cost)); }
    out.third30 = costs.every(l => l[2] === 30); out.differ = costs.some(l => l[0] * 2 + 1 !== l[1] && l[0] !== Math.floor(l[1] / 2)); out.costs = costs.slice(0, 4);
    PL.enchSeed = 77; UI.renderScreen(); document.querySelector('[data-ench="2"]').click();
    out.after = { id: GUI.ctx.items[0].id === IID.enchanted_book, e: GUI.ctx.items[0].e, level: PL.level, lapis: GUI.ctx.items[1] && GUI.ctx.items[1].n, seedChanged: PL.enchSeed !== 77 };
    UI.closeScreen();
    for (let i = 0; i < 40; i++) { gameTick(); await new Promise(r => setTimeout(r, 16)); }
    const s = [...ETB.values()][0]; out.book = s ? { open: +s.open.toFixed(2), mesh: !!s.mesh } : null;
    let g = 0; for (let i = 0; i < 400; i++) { gameTick(); g = Math.max(g, GLYPHS.length); } out.glyphs = g;
    return out; });
  await p.evaluate(() => { showMenu(null); UI.paused = false; PL.y += 0.6; PL.pitch = -0.45; }); await p.waitForTimeout(1200); await p.evaluate(() => { showMenu(null); UI.paused = false; }); await p.waitForTimeout(300); await p.screenshot({ path: (process.env.SHOT || '/tmp/ench') + '.png' });
  ok(r.one === 15 && r.two === 15 && r.torch === 12, 'bookshelves: the ring two out, 15 at most; a block in the gap (halfway, toward zero) shuts out the shelves behind it', r);
  ok(r.third30 && r.differ, 'each slot rolls its own cost; with 15 shelves the third costs 30', r.costs);
  ok(r.after.id && Object.keys(r.after.e || {}).length >= 1 && r.after.level === 37 && r.after.lapis === 7 && r.after.seedChanged, 'the third slot takes 3 lapis and 3 levels; a book becomes an enchanted book', r.after);
  ok(r.book && r.book.mesh && r.book.open > 0.9 && r.glyphs > 0, 'the book floats and opens for a player close by; glyphs fly from the shelves', [r.book, r.glyphs]);
};

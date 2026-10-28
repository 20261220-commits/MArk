// every block placed and broken, every item used, every mob spawned, hit, fed and killed; then a tour (all mobs at
// night in a storm, every screen and menu, the three dimensions, far-away biomes) — no page errors anywhere
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => {
    const bad = {}, note = (k, e) => { if (!bad[k]) bad[k] = String(e && e.stack || e).split('\n').slice(0, 2).join(' | ').slice(0, 220); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Z = Math.floor(PL.z), Y = 150;
    const pad = () => { for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { setBlock(X + x, Y - 1, Z + z, BID.stone); for (let y = 0; y < 3; y++) setBlock(X + x, Y + y, Z + z, 0); } };
    PL.x = X + 2.5; PL.y = Y; PL.z = Z + 2.5; PL.flying = false;
    // recipes
    for (const rc of RECIPES) { if (!ITEMS[rc.out]) note('recipe out ' + rc.out, 'missing'); const ing = rc.s || rc.g || []; for (const g of ing) if (g && Array.isArray(g) && g.some(v => v == null || !ITEMS[v])) note('recipe in for ' + (ITEMS[rc.out] && ITEMS[rc.out].key), 'missing ingredient'); }
    for (const k in SMELT) if (!ITEMS[SMELT[k][0]]) note('smelt ' + k, 'missing');
    // blocks
    const blockItems = ITEMS.filter(d => d && d.place != null);
    let n = 0;
    for (const d of blockItems) {
      pad();
      try {
        setBlock(X + 1, Y, Z, BID.stone);
        INV.slots[INV.sel] = { id: d.id, n: 1 };
        TARGET = { type: 'block', x: X, y: Y - 1, z: Z, id: BID.stone, m: 0, nx: 0, ny: 1, nz: 0, hy: 1 };
        placeBlock(TARGET, d);
        if (UI.screen) UI.closeScreen();
        const id = getBlock(X, Y, Z);
        if (id) { const t = { type: 'block', x: X, y: Y, z: Z, id, m: getMeta(X, Y, Z), nx: 0, ny: 1, nz: 0, hy: 1 }; INV.slots[INV.sel] = null; interactBlock(t, true); if (UI.screen) UI.closeScreen(); INV.slots[INV.sel] = { id: IID.diamond_pickaxe, n: 1 }; breakBlock(X, Y, Z); n++; }
        if (UI.screen) UI.closeScreen();
      } catch (e) { note('block ' + d.key, e); if (UI.screen) UI.closeScreen(); }
    }
    // drops for every block/meta
    for (const bl of BLOCKS) if (bl) for (const m of [0, 1, 4, 8, 16]) try { const dr = blockDrops(bl.id, m, { id: IID.diamond_pickaxe, n: 1 }); for (const [iid] of dr.items) if (!ITEMS[iid]) note('drop ' + bl.key, 'unknown item ' + iid); } catch (e) { note('drops ' + bl.key, e); }
    // items: use on block and in air
    for (const d of ITEMS) {
      if (!d || d.place != null) continue;
      pad();
      for (const tgt of [{ type: 'block', x: X, y: Y - 1, z: Z, id: BID.stone, m: 0, nx: 0, ny: 1, nz: 0, hy: 1 }, null]) {
        try { INV.slots[INV.sel] = { id: d.id, n: 1 }; TARGET = tgt; USE.placeCd = 0; useItem(true); if (UI.screen) UI.closeScreen(); } catch (e) { note('use ' + d.key + (tgt ? '' : ' air'), e); if (UI.screen) UI.closeScreen(); }
      }
      try { if (d.food) { INV.slots[INV.sel] = { id: d.id, n: 1 }; PL.food = 10; finishEat(); } } catch (e) { note('eat ' + d.key, e); }
    }
    for (const e of [...ENT]) if (e.kind !== 'mob') removeEnt(e);
    // mobs
    const types = Object.keys(MOBDEF).filter(k => k !== 'player' && k !== 'ender_dragon' && k !== 'wither');
    for (const t of types) {
      try { const m = spawnMob(t, X + 1.5, Y, Z + 1.5); m.persistent = true; for (let i = 0; i < 4; i++) { UI.paused = false; await wait(16); } INV.slots[INV.sel] = { id: IID.wheat, n: 1 }; TARGET = { type: 'ent', e: m }; try { useItem(true); } catch (e) { note('interact ' + t, e); } if (PL.riding) dismount(); if (UI.screen) UI.closeScreen(); m.inv = 0; hurtMob(m, 9999, PL, 0, 0, 'player'); for (let i = 0; i < 3; i++) { UI.paused = false; await wait(16); } } catch (e) { note('mob ' + t, e); }
    }
    await wait(300);
    return { placed: n, blocks: blockItems.length, bad };
  });
  ok(Object.keys(r.bad).length === 0, 'blocks, items and mobs work without errors', r.bad);
  ok(r.placed > 600, 'block items place on a stone floor (the rest need a support, water or a special spot)', [r.placed, r.blocks]);
  const step = async (f, wait = 3000, arg) => { try { await p.evaluate(f, arg); } catch (e) { p.errs.push(String(e.message)); } await p.waitForTimeout(wait); };
  await step(() => { PL.mode = 'creative'; const X = PL.x, Z = PL.z; let i = 0; for (const k of Object.keys(MOBDEF)) { if (k === 'player' || k === 'ender_dragon' || k === 'wither') continue; const a = i++ * 0.7; spawnMob(k, X + Math.cos(a) * (6 + i % 5), PL.y + 2, Z + Math.sin(a) * (6 + i % 5)); } PL.mode = 'survival'; }, 15000);
  await step(() => { W.time = 14000; runCommand('weather thunder'); }, 8000);
  for (const s of ['inv', 'craft', 'enchant', 'anvil', 'smithing', 'loom', 'stonecutter', 'cartography', 'grindstone', 'adv', 'creative']) await step(s => { try { UI.openScreen(s, { x: Math.floor(PL.x), y: Math.floor(PL.y) - 1, z: Math.floor(PL.z) }); UI.renderScreen(); } finally { UI.closeScreen(); } }, 200, s);
  for (const m of ['options', 'controls', 'packs', 'stats', 'pause']) await step(m => { showMenu(m); showMenu(null); }, 200, m);
  await step(() => switchDim(-1, 0.5, 70, 0.5), 10000);
  await step(() => { for (const k of ['piglin', 'hoglin', 'ghast', 'blaze', 'wither_skeleton', 'magma_cube', 'strider', 'zombified_piglin', 'piglin_brute']) spawnMob(k, PL.x + 5, PL.y + 1, PL.z + 3); }, 10000);
  await step(() => switchDim(1, 0.5, 80, 0.5), 12000);
  await step(() => switchDim(0, 0.5, 90, 0.5), 8000);
  await step(() => { PL.x = 3501; PL.z = 151; PL.y = 120; PL.flying = true; }, 10000);
  await step(() => { PL.x = -1301; PL.z = -722; PL.y = 140; }, 10000);
  ok(!p.errs.length, 'no page errors', [...new Set(p.errs)].slice(0, 8));
};

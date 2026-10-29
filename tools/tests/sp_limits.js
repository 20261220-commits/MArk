// dyed leather armour (crafting, washing, the leatherworker's offers) and the Nether's rules (water boils away, lava
// runs 7 blocks, Java's spawn lists)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    // red + yellow on plain leather boots: Java's blend (int averages, brightened to the average brightness)
    const grid = [{ id: IID.leather_boots, n: 1 }, { id: IID.red_dye, n: 1 }, { id: IID.yellow_dye, n: 1 }, null, null, null, null, null, null];
    const out = craftResult(grid, 3); o.col = out && out.col; o.id = out && out.id === IID.leather_boots;
    o.again = (craftResult([out, { id: IID.blue_dye, n: 1 }, null, null], 2) || {}).col;
    o.notHorse = craftResult([{ id: IID.leather_horse_armor, n: 1 }, { id: IID.red_dye, n: 1 }, null, null], 2) == null;
    o.icon = /url\(data:image/.test(icon(out.id, 1, 0, null, out.col));
    // washing it in a water cauldron
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); setBlock(X, Y, Z, BID.cauldron, 3); PL.mode = 'survival';
    INV.slots[INV.sel] = { ...out }; o.washed = interactBlock({ type: 'block', x: X, y: Y, z: Z, id: BID.cauldron, m: 3, nx: 0, ny: 1, nz: 0 });
    o.after = { col: INV.slots[INV.sel].col, lv: getMeta(X, Y, Z) & 3 }; PL.mode = 'creative';
    // a leatherworker's leather armour comes dyed
    const v = spawnMob('villager', PL.x + 2, PL.y, PL.z, { prof: 'leatherworker' }); v.prof = 'leatherworker'; v.vlvl = 5; v.tv = 0; const offs = villagerOffers(v);
    o.dyedOffers = offs.filter(q => /^leather_(helmet|chestplate|leggings|boots)$/.test(ITEMS[q.b].key)).map(q => q.col != null);
    o.horse = offs.filter(q => ITEMS[q.b].key === 'leather_horse_armor').map(q => q.col == null);
    // a piglin in the Overworld turns into a zombified piglin after 15 seconds
    const pg = spawnMob('piglin', PL.x + 3, Y + 1, PL.z); pg.persistent = true; setBlock(Math.floor(pg.x), Y, Math.floor(pg.z), BID.stone);
    for (let i = 0; i < 200 && !pg.dead; i++) { UI.paused = false; await wait(100); } o.zomb = pg.dead && ENT.some(e => e.type === 'zombified_piglin' && !e.dead);
    // the Nether: water boils, lava spreads 7, spawns follow Java's lists
    switchDim(-1, PL.x, 80, PL.z, 'spawn'); for (let i = 0; i < 300 && (UI.menu === 'loading' || W.dim !== -1); i++) await wait(100); showMenu(null); UI.paused = false;
    const x = Math.floor(PL.x), y = 100, z = Math.floor(PL.z);
    for (let a = -10; a <= 10; a++) for (let c = -10; c <= 10; c++) { setBlock(x + a, y - 1, z + c, BID.netherrack); for (let k = 0; k < 3; k++) setBlock(x + a, y + k, z + c, 0); }
    PL.x = x + .5; PL.y = y + 4; PL.z = z + .5; PL.flying = true; PL.mode = 'survival';
    INV.slots[INV.sel] = { id: IID.water_bucket, n: 1 }; TARGET = { type: 'block', x: x + 3, y: y - 1, z, id: BID.netherrack, m: 0, nx: 0, ny: 1, nz: 0, t: 2 }; USE.placeCd = 0; useItem(true);
    o.boiled = { block: getBlock(x + 3, y, z), held: INV.slots[INV.sel] && ITEMS[INV.slots[INV.sel].id].key };
    PL.mode = 'creative'; setBlock(x, y, z, BID.lava, 0); schedule(x, y, z, 1);
    for (let i = 0; i < 160; i++) { UI.paused = false; await wait(100); }
    let far = 0; for (let a = -10; a <= 10; a++) for (let c = -10; c <= 10; c++) if (getBlock(x + a, y, z + c) === BID.lava) far = Math.max(far, Math.abs(a) + Math.abs(c)); o.lavaFar = far;
    setBlock(x + 6, y - 1, z + 6, BID.soul_soil); setBlock(x + 7, y, z + 6, BID.blue_ice); setBlock(x + 6, y, z + 6, BID.lava, 0); schedule(x + 6, y, z + 6, 1);
    for (let i = 0; i < 20; i++) { UI.paused = false; await wait(100); } o.basalt = getBlock(x + 6, y, z + 6) === BID.basalt;
    const kinds = {}; for (let i = 0; i < 400; i++) { const t = mobsForDimension(x, y, z, 0, BID.netherrack); if (t) kinds[t[0]] = (kinds[t[0]] || 0) + 1; } o.kinds = kinds;
    o.fortress = mobsForDimension(x, y, z, 0, BID.nether_bricks)[0];
    return o; });
  ok(r.id && r.col === 0xd78331, 'red and yellow dye on leather boots blend as in Java', r.col && r.col.toString(16));
  ok(r.again != null && r.again !== r.col, 'dyed armour can be dyed again (mixing with its colour)', r.again);
  ok(r.notHorse && r.icon, 'the dyed icon is drawn in its colour (horse armour stays undyed)', r);
  ok(r.washed && r.after.col == null && r.after.lv === 2, 'a water cauldron washes the dye out and loses a level', r.after);
  ok(r.dyedOffers.length >= 4 && r.dyedOffers.every(Boolean) && r.horse.every(Boolean), 'the leatherworker sells dyed leather armour', r.dyedOffers);
  ok(r.boiled.block === 0 && r.boiled.held === 'bucket', 'water poured in the Nether boils away', r.boiled);
  ok(r.lavaFar === 7, 'lava runs 7 blocks in the Nether', r.lavaFar);
  ok(Object.keys(r.kinds).length >= 2 && Object.keys(r.kinds).every(k => ['ghast', 'zombified_piglin', 'magma_cube', 'enderman', 'piglin', 'skeleton', 'hoglin'].includes(k)), 'Nether spawns follow the biome lists', r.kinds);
  ok(['blaze', 'zombified_piglin', 'wither_skeleton', 'skeleton', 'magma_cube'].includes(r.fortress), 'nether bricks spawn fortress mobs', r.fortress);
  ok(r.zomb, 'a piglin brought to the Overworld zombifies', r.zomb);
  ok(r.basalt, 'lava over soul soil beside blue ice turns to basalt', r.basalt);
  ok(!p.errs.length, 'no page errors', p.errs);
};

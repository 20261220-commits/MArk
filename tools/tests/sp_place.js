// every block item can be placed somewhere it belongs: stone floor, dirt, farmland, sand next to water, soul sand,
// a wall, a ceiling, under water, on water
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => { const X = Math.floor(PL.x), Z = Math.floor(PL.z), Y = 150, never = [];
    const pad = (blk) => { for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { setBlock(X + x, Y - 1, Z + z, blk); for (let y = 0; y < 3; y++) setBlock(X + x, Y + y, Z + z, 0); } };
    const T = (x, y, z, n) => ({ type: 'block', x, y, z, id: getBlock(x, y, z), m: getMeta(x, y, z), nx: n[0], ny: n[1], nz: n[2], hy: 1, t: 2 });
    const setups = [[BID.stone], [BID.dirt], [BID.farmland], [BID.soul_sand], [BID.sand, () => setBlock(X + 1, Y - 1, Z, BID.water)], [BID.clay], [BID.end_stone],
      [BID.stone, () => setBlock(X + 1, Y, Z, BID.stone), () => T(X + 1, Y, Z, [-1, 0, 0])], [BID.stone, () => setBlock(X, Y + 1, Z, BID.stone), () => T(X, Y + 1, Z, [0, -1, 0])],
      [BID.dirt, () => { setBlock(X, Y, Z, BID.water); setBlock(X, Y + 1, Z, BID.water); }], [BID.water, null, () => T(X, Y - 1, Z, [0, 1, 0])]];
    for (const d of ITEMS.filter(d => d && d.place != null)) { let placed = false;
      for (const [floor, setup, tgt] of setups) { pad(floor); if (setup) setup(); PL.x = X + .5; PL.z = Z + 3.5; PL.y = Y; PL.yaw = 0; PL.pitch = 0.3; PL.mode = 'survival'; INV.slots[INV.sel] = { id: d.id, n: 1 };
        try { TARGET = tgt ? tgt() : T(X, Y - 1, Z, [0, 1, 0]); USE.placeCd = 0; useItem(true); } catch (e) { never.push(d.key + ' ERR ' + e.message); break; } if (UI.screen) UI.closeScreen();
        for (let dx = -1; dx <= 1 && !placed; dx++) for (let dy = -1; dy <= 2 && !placed; dy++) for (let dz = -1; dz <= 1 && !placed; dz++) if (getBlock(X + dx, Y + dy, Z + dz) === d.place) placed = true;
        if (placed) break; }
      if (!placed) never.push(d.key); }
    return { never, n: ITEMS.filter(d => d && d.place != null).length }; });
  ok(r.never.length === 0, `all ${r.n} block items can be placed somewhere`, r.never);
  ok(!p.errs.length, 'no page errors', p.errs);
};

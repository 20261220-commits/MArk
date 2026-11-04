// bubble columns: water on soul sand lifts the player out of the water (and items and mobs), water on magma drags them
// down; flowing water or another block in between stops the column
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); if (i % 4 === 0) await wait(5); } };
    const X = Math.floor(PL.x), Y = 120, Z = Math.floor(PL.z);
    for (let a = -6; a <= 6; a++) for (let c = -6; c <= 6; c++) for (let y = Y - 12; y <= Y + 6; y++) setBlock(X + a, y, Z + c, y === Y - 12 ? BID.stone : 0);
    // two shafts of water, 10 deep, walled with glass: soul sand under one, magma under the other
    for (const [dx, base] of [[-3, BID.soul_sand], [3, BID.magma_block]]) {
      for (let y = Y - 11; y <= Y; y++) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) setBlock(X + dx + a, y, Z + c, a || c ? BID.glass : y === Y - 11 ? base : BID.water, 0);
    }
    await wait(200);
    o.col = [bubbleCol(X - 3, Y - 5, Z), bubbleCol(X + 3, Y - 5, Z), bubbleCol(X, Y - 5, Z)];
    // the player at the bottom of the lifting shaft
    PL.x = X - 2.5; PL.y = Y - 10; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0; let top = PL.y;
    for (let i = 0; i < 80; i++) { await run(1); top = Math.max(top, PL.y); }
    o.up = { top: +(top - Y).toFixed(2) };
    // the player at the top of the dragging shaft
    PL.x = X + 3.5; PL.y = Y - 0.5; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0; await run(40); o.down = +(PL.y - Y).toFixed(2);
    // an item dropped in the lifting shaft comes up
    const it = dropItem(X - 2.5, Y - 9, Z + .5, IID.stick, 1); const iy0 = it ? it.y : 0; await run(40); o.item = it ? +(it.y - iy0).toFixed(2) : null;
    // a block in the way: no column above it
    setBlock(X - 3, Y - 6, Z, BID.stone); o.blocked = [bubbleCol(X - 3, Y - 7, Z), bubbleCol(X - 3, Y - 3, Z)];
    return o; });
  ok(r.col[0] === 1 && r.col[1] === -1 && r.col[2] === 0, 'soul sand lifts, magma drags, elsewhere nothing', r.col);
  ok(r.up.top > 0.3, 'the player rises up the soul sand column and out of the water', r.up);
  ok(r.down < -6, 'the magma column pulls the player down', r.down);
  ok(r.item > 4, 'an item rises too', r.item);
  ok(r.blocked[0] === 1 && r.blocked[1] === 0, 'a block in the column stops it above', r.blocked);
  ok(!p.errs.length, 'no page errors', p.errs);
};

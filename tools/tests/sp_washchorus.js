// Running water washes away what nothing bumps into (a cobweb leaves string), not ladders or signs; a chorus plant cut
// from its stem breaks, and all that grew on it after
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const o = {}, X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    const T = n => { for (let i = 0; i < n; i++) { W.tickN++; tickScheduled(); } };
    for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 8; k++) setBlock(X + a, Y + k, Z + c, 0); }
    W.sched.clear(); const drops = []; const od = W.onDrop; W.onDrop = (x, y, z, items) => { drops.push(...items.map(i => ITEMS[i[0]] && ITEMS[i[0]].key)); };
    setBlock(X + 1, Y, Z, BID.cobweb); setBlock(X + 2, Y, Z, BID.torch, 0); setBlock(X + 3, Y, Z, BID.rail || 0); setBlock(X - 1, Y, Z, BID.stone); setBlock(X, Y, Z + 1, BID.stone);
    setBlock(X, Y, Z - 1, BID.stone); setBlock(X - 1, Y, Z - 1, BID.stone);
    setBlock(X + 1, Y, Z - 2, BID.stone); setBlock(X + 1, Y, Z - 1, BID.ladder, 0);
    setBlock(X, Y, Z, 27, 0); schedule(X, Y, Z, 1); T(80);
    o.wash = { web: getBlock(X + 1, Y, Z), torch: getBlock(X + 2, Y, Z) === BID.torch, rail: BID.rail ? getBlock(X + 3, Y, Z) === BID.rail : false, ladder: getBlock(X + 1, Y, Z - 1) === BID.ladder, string: drops.includes('string') };
    W.onDrop = od;
    // a chorus plant: a stem 4 high on end stone with a branch, a flower on top
    for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) for (let k = 0; k < 8; k++) setBlock(X + a, Y + k, Z + c, 0);
    W.sched.clear(); setBlock(X, Y - 1, Z, BID.end_stone);
    for (let k = 0; k < 4; k++) setBlock(X, Y + k, Z, BID.chorus_plant, 0, { noUpdate: true }); setBlock(X + 1, Y + 2, Z, BID.chorus_plant, 0, { noUpdate: true }); setBlock(X + 1, Y + 3, Z, BID.chorus_flower, 0, { noUpdate: true }); setBlock(X, Y + 4, Z, BID.chorus_flower, 0, { noUpdate: true });
    T(5); o.stands = [0, 1, 2, 3].every(k => getBlock(X, Y + k, Z) === BID.chorus_plant) && getBlock(X + 1, Y + 2, Z) === BID.chorus_plant;
    setBlock(X, Y, Z, 0); T(20);
    let left = 0; for (let k = 0; k < 6; k++) for (let a = 0; a <= 1; a++) { const b2 = getBlock(X + a, Y + k, Z); if (b2 === BID.chorus_plant || b2 === BID.chorus_flower) left++; } o.left = left;
    return o; });
  console.log(JSON.stringify(r));
  ok(r.wash.web === 27 || r.wash.web === 0, 'running water washes a cobweb away', r.wash);
  ok(r.wash.string, 'and it leaves string', r.wash);
  ok(!r.wash.torch && !r.wash.rail, 'torches and rails are washed away too', r.wash);
  ok(r.wash.ladder, 'a ladder stays', r.wash);
  ok(r.stands && r.left === 0, 'a chorus plant cut at its foot breaks, all of it', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

// water: a source on flat ground spreads 7 blocks (Java), and the whole flow dries up once the source is taken away
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => {
    const X = Math.floor(PL.x), Z = Math.floor(PL.z), Y = 200, wait = ms => new Promise(r => setTimeout(r, ms));
    for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) { setBlock(X + x, Y - 1, Z + z, BID.stone); for (let y = 0; y < 3; y++) setBlock(X + x, Y + y, Z + z, 0); }
    PL.x = X + .5; PL.y = Y + 3; PL.z = Z + .5; PL.flying = true; UI.paused = false;
    const count = () => { let n = 0, far = 0; for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) if (getBlock(X + x, Y, Z + z) === BID.water) { n++; far = Math.max(far, Math.abs(x) + Math.abs(z)); } return { n, far }; };
    setBlock(X, Y, Z, BID.water, 0); schedule(X, Y, Z, 1);
    for (let i = 0; i < 100; i++) { UI.paused = false; await wait(100); }
    const spread = count();
    setBlock(X, Y, Z, 0); for (const [dx, dy, dz] of N6) if (FLUID[getBlock(X + dx, Y + dy, Z + dz)]) schedule(X + dx, Y + dy, Z + dz, 5);
    for (let i = 0; i < 120; i++) { UI.paused = false; await wait(100); }
    const after = count();
    // a falling column: water poured from above lands, spreads, and is gone with its source too
    setBlock(X, Y + 2, Z, BID.water, 0); schedule(X, Y + 2, Z, 1);
    for (let i = 0; i < 80; i++) { UI.paused = false; await wait(100); }
    const fall = count();
    setBlock(X, Y + 2, Z, 0); schedule(X, Y + 1, Z, 5);
    for (let i = 0; i < 140; i++) { UI.paused = false; await wait(100); }
    return { spread, after, fall, fallAfter: count(), colWater: getBlock(X, Y + 1, Z) === BID.water };
  });
  ok(r.spread.n > 50 && r.spread.far === 7, 'a source spreads exactly 7 blocks over flat ground', r.spread);
  ok(r.after.n === 0, 'removing the source dries the whole flow', r.after);
  ok(r.fall.n > 50 && r.fall.far <= 8, 'water poured from above spreads 7 from where it lands (8 from below the source, as in Java)', r.fall);
  ok(r.fallAfter.n === 0 && !r.colWater, 'and dries up once its source is gone', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

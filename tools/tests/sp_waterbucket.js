// Water from a bucket as Java: it always starts flowing at once, and taken back up, the water it spread drains away
// entirely, however the placing and taking are mixed (on the floor, on top of a block, again and again)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const o = {}, X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    const room = () => { for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 5; k++) setBlock(X + a, Y + k, Z + c, 0); } W.sched.clear(); };
    const T = n => { for (let i = 0; i < n; i++) { W.tickN++; tickScheduled(); } };
    const water = () => { let n = 0; for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) for (let k = 0; k < 5; k++) if (getBlock(X + a, Y + k, Z + c) === 27) n++; return n; };
    // the player's own bucket: aim at a face and use it
    const use = (id, x, y, z, ny) => { INV.slots[INV.sel] = { id, n: 1 }; PL.mode = 'survival'; const t = { type: 'block', x, y, z, id: getBlock(x, y, z), m: getMeta(x, y, z), nx: 0, ny: ny == null ? 1 : ny, nz: 0 }; TARGET = t; const rc = raycast; raycast = () => t; try { useItem(true); } finally { raycast = rc; } PL.mode = 'creative'; };
    // 1: placed where a slow tick was already waiting (lava had been there): it still flows at once
    room(); W.sched.set(X + ',' + Y + ',' + Z, W.tickN + 400); use(IID.water_bucket, X, Y - 1, Z); T(12); o.slow = water();
    // 2: placed, spread, taken back: all of it drains
    room(); use(IID.water_bucket, X, Y - 1, Z); T(60); o.spread = water(); use(IID.bucket, X, Y, Z); T(120); o.drained = water();
    // 3: fuzz: placing and taking at random, on the floor and on blocks, then taking every source: nothing left
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296; let left = 0, fails = [];
    for (let run = 0; run < 12; run++) { room(); const pillars = []; for (let i = 0; i < 4; i++) { const px = X + Math.floor(rnd() * 9) - 4, pz = Z + Math.floor(rnd() * 9) - 4; setBlock(px, Y, pz, BID.stone); pillars.push([px, pz]); }
      for (let step = 0; step < 8; step++) { const onPillar = rnd() < 0.4, [px, pz] = onPillar ? pillars[Math.floor(rnd() * 4)] : [X + Math.floor(rnd() * 7) - 3, Z + Math.floor(rnd() * 7) - 3];
        const fy = onPillar ? Y : Y - 1; if (getBlock(px, fy + 1, pz) === 0) use(IID.water_bucket, px, fy, pz); T(Math.floor(rnd() * 25));
        // take one source back now and then
        if (rnd() < 0.6) { const src = []; for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) for (let k = 0; k < 5; k++) if (getBlock(X + a, Y + k, Z + c) === 27 && getMeta(X + a, Y + k, Z + c) === 0) src.push([X + a, Y + k, Z + c]); if (src.length) { const s = src[Math.floor(rnd() * src.length)]; use(IID.bucket, s[0], s[1], s[2]); } T(Math.floor(rnd() * 25)); } }
      for (let guard = 0; guard < 20; guard++) { T(40); let any = false; for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) for (let k = 0; k < 5; k++) if (getBlock(X + a, Y + k, Z + c) === 27 && getMeta(X + a, Y + k, Z + c) === 0) { use(IID.bucket, X + a, Y + k, Z + c); any = true; } if (!any) break; }
      T(300); const w = water(); left += w; if (w) fails.push(run); }
    o.fuzzLeft = left; o.fuzzFails = fails;
    return o; });
  console.log(JSON.stringify(r));
  ok(r.slow > 4, 'water placed where a slow tick was waiting still flows at once', r.slow);
  ok(r.spread > 20 && r.drained === 0, 'placed, spread and taken back: it all drains', [r.spread, r.drained]);
  ok(r.fuzzLeft === 0, 'placing and taking at random, on the floor and on blocks: no water left behind', [r.fuzzLeft, r.fuzzFails]);
  ok(!p.errs.length, 'no page errors', p.errs);
};

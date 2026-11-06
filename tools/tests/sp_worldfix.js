// an old world brought up to today's generator when its saved chunks load: sugar cane the old rule planted goes (cane
// the player planted stays), the Nether's extra old springs close and their running lava goes, and a chest still holding
// its old roll gets the new one (an opened chest keeps what's in it)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); if (i % 10 === 0) await wait(20); } };
    // a chunk near the player where the old cane rule planted cane and the new one doesn't
    let tgt = null; const pcx = Math.floor(PL.x) >> 4, pcz = Math.floor(PL.z) >> 4;
    for (let rr = 0; rr < 6 && !tgt; rr++) for (let cx = pcx - rr; cx <= pcx + rr && !tgt; cx++) for (let cz = pcz - rr; cz <= pcz + rr && !tgt; cz++) {
      S.setLegacy({ cane: 1, springs: 1, loot: 1 }); const o = S.genChunk(W.seed, cx, cz, 0, W.exp); S.setLegacy(null); const n = S.genChunk(W.seed, cx, cz, 0, W.exp);
      let k = 0; for (let i = 0; i < o.blocks.length; i++) if (o.blocks[i] === BID.sugar_cane && n.blocks[i] !== BID.sugar_cane) k++; if (k >= 3) tgt = [cx, cz, o]; }
    if (!tgt) return { none: 1 };
    const [cx, cz, o] = tgt; PL.x = cx * 16 + 8; PL.z = cz * 16 + 8; PL.y = 120; PL.flying = true;
    for (let i = 0; i < 200 && !chunkAt(cx, cz); i++) await run(5);
    let c = chunkAt(cx, cz); c.blocks.set(o.blocks); c.meta.set(o.meta); // the chunk as the old generator made it, saved before the fix
    let canes = 0; for (let i = 0; i < c.blocks.length; i++) if (c.blocks[i] === BID.sugar_cane) canes++;
    // a cane the player planted, by water they dug
    const X = cx * 16 + 3, Z = cz * 16 + 3, Y = 200; setBlock(X, Y - 2, Z, BID.stone); setBlock(X + 1, Y - 2, Z, BID.stone); setBlock(X, Y - 1, Z, BID.dirt); setBlock(X + 1, Y - 1, Z, BID.water); setBlock(X, Y, Z, BID.sugar_cane);
    c.fx = 0; c.modified = c.edited = true; saveChunk(c, false, true); await wait(300);
    unloadChunk(c); await wait(800); await loadChunk(cx, cz); await run(20);
    c = chunkAt(cx, cz); let after = 0; for (let i = 0; i < c.blocks.length; i++) if (c.blocks[i] === BID.sugar_cane) after++;
    out.cane = [canes, after, getBlock(X, Y, Z) === BID.sugar_cane, c.fx];
    // the Nether: a chunk with a spring only the old count made, and lava that ran from it
    switchDim(-1, 0.5, 70, 0.5, 'cmd'); await run(60);
    let nt = null; for (let rr = 0; rr < 5 && !nt; rr++) for (let ax = -rr; ax <= rr && !nt; ax++) for (let az = -rr; az <= rr && !nt; az++) {
      S.setLegacy({ cane: 1, springs: 1, loot: 1 }); const o2 = S.genChunk(W.seed, ax, az, -1, W.exp); S.setLegacy(null); const n2 = S.genChunk(W.seed, ax, az, -1, W.exp);
      for (let i = 0; i < o2.blocks.length; i++) if (o2.blocks[i] === BID.lava && o2.meta[i] === 0 && n2.blocks[i] !== BID.lava) { nt = [ax, az, o2, i]; break; } }
    if (!nt) { out.nether = 'none'; return out; }
    const [ax, az, o2, si] = nt; PL.x = ax * 16 + 8; PL.z = az * 16 + 8; PL.y = 70; PL.flying = true; for (let i = 0; i < 200 && !chunkAt(ax, az); i++) await run(5);
    let c2 = chunkAt(ax, az); c2.blocks.set(o2.blocks); c2.meta.set(o2.meta);
    let fi = -1; for (let i = 256 * 80; i < c2.blocks.length; i++) if (c2.blocks[i] === 0) { c2.blocks[i] = BID.lava; c2.meta[i] = 3; fi = i; break; } // running lava
    c2.fx = 0; c2.modified = c2.edited = true; saveChunk(c2, false, true); await wait(300); unloadChunk(c2); await wait(800); await loadChunk(ax, az); for (let i = 0; i < 20; i++) { UI.paused = false; await wait(20); }
    c2 = chunkAt(ax, az); out.nether = [c2.blocks[si] === BID.lava, c2.blocks[fi] === BID.lava && c2.meta[fi] === 3, c2.fx];
    return out; });
  ok(!r.none, 'found an old cane chunk to test with', r);
  if (r.none) return;
  ok(r.cane[1] < r.cane[0] && r.cane[2] && r.cane[3] === 1, 'old generated cane is gone after loading, the planted cane stays, the chunk is marked fixed', r.cane);
  ok(Array.isArray(r.nether) && !r.nether[0] && !r.nether[1] && r.nether[2] === 1, "an old Nether spring the new count doesn't make is closed and its running lava is gone", r.nether);
};

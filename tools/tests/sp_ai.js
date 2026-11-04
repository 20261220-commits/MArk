// monster AI against Java's: a wall walked around to its gap, a lava trench crossed on its bridge, a skeleton in the
// sun finding shade and staying there, cave spiders fighting in a dark cave at noon (light, not the time of day) and
// wandering under a roof, a zombie seeing a player 30 blocks off (follow range 35), a skeleton not at 20 (16)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const X0 = Math.floor(PL.x), Y = 150, Z0 = Math.floor(PL.z); PL.difficulty = 2;
    const arena = (f, roof) => { for (let a = -22; a <= 22; a++) for (let c = -22; c <= 22; c++) { setBlock(X0 + a, Y - 1, Z0 + c, BID.stone); for (let k = 0; k < 14; k++) setBlock(X0 + a, Y + k, Z0 + c, k === 6 && roof ? BID.stone : 0); } if (f) f(X0, Z0); };
    let hits = 0; const hold = (x, y, z) => { if (PL.health < 20) hits++; PL.x = x; PL.y = y; PL.z = z; PL.vx = PL.vz = 0; PL.health = 20; PL.dead = false; PL.food = 20; PL.fire = 0; PL.eff = null; };
    const run = async (n, f) => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); if (f && f(i)) return i; if (i % 8 === 0) await wait(1); } return -1; };
    const clear = () => { for (const e of [...ENT]) if (e !== PL) removeEnt(e); };
    clear(); arena((X, Z) => { for (let a = -12; a <= 12; a++) if (a !== 7) for (let k = 0; k < 3; k++) setBlock(X + a, Y + k, Z, BID.stone); }); W.time = 18000;
    { const z = spawnMob('zombie', X0 + .5, Y, Z0 - 5.5); z.persistent = true; out.wall = await run(500, () => { hold(X0 + .5, Y, Z0 + 5.5); z.target = PL; return Math.hypot(z.x - PL.x, z.z - PL.z) < 1.6; }); }
    clear(); arena((X, Z) => { for (let a = -15; a <= 15; a++) for (let c = -1; c <= 1; c++) { setBlock(X + a, Y - 1, Z + c, a === 6 ? BID.stone : BID.lava); setBlock(X + a, Y - 2, Z + c, BID.stone); } });
    { const z = spawnMob('zombie', X0 + .5, Y, Z0 - 5.5); z.persistent = true; let burned = false; out.lava = await run(500, () => { hold(X0 + .5, Y, Z0 + 5.5); if (z.fire > 0) burned = true; return Math.hypot(z.x - PL.x, z.z - PL.z) < 1.6; }); out.lavaBurned = burned; }
    clear(); arena((X, Z) => { for (let a = 3; a <= 9; a++) for (let c = -3; c <= 3; c++) setBlock(X + a, Y + 5, Z + c, BID.stone); }); W.time = 6000; W.rain = 0;
    { const s = spawnMob('skeleton', X0 + .5, Y, Z0 + .5); s.persistent = true; await run(400, () => { hold(X0 + 18.5, Y, Z0 + 18.5); PL.mode = 'creative'; }); PL.mode = 'survival'; out.shade = [s.x > X0 + 3 && s.x < X0 + 10 && Math.abs(s.z - Z0) < 4, !s.dead]; }
    clear(); arena(null, true); W.time = 6000;
    { const s = spawnMob('cave_spider', X0 + .5, Y, Z0 - 8.5); s.persistent = true; hits = 0; await run(200, () => { hold(X0 + .5, Y, Z0 + .5); }); out.caveNoon = hits; }
    clear(); { const ms = [0, 1, 2, 3].map(i => { const m = spawnMob('cave_spider', X0 + .5 + i * 4, Y, Z0 + .5); m.persistent = true; return m; }), p0 = ms.map(m => [m.x, m.z]);
      await run(400, () => { hold(X0 + 20, Y + 30, Z0 + 20); PL.mode = 'creative'; }); PL.mode = 'survival'; out.roofWander = ms.filter((m, i) => Math.hypot(m.x - p0[i][0], m.z - p0[i][1]) > 1).length; }
    clear(); arena(); W.time = 18000;
    { const z = spawnMob('zombie', X0 + .5, Y, Z0 - 14.5); z.persistent = true; await run(20, () => hold(X0 + .5, Y, Z0 + 15.5)); out.zombie30 = !!z.target; }
    clear(); { const z = spawnMob('skeleton', X0 + .5, Y, Z0 - 9.5); z.persistent = true; await run(20, () => hold(X0 + .5, Y, Z0 + 10.5)); out.skel20 = !!z.target; }
    clear(); return out; });
  ok(r.wall >= 0, 'a zombie walks around a wall to its gap 7 blocks off', r);
  ok(r.lava >= 0 && !r.lavaBurned, 'a zombie crosses a lava trench on its bridge, not through the lava', r);
  ok(r.shade[0] && r.shade[1], 'a skeleton in the sun finds shade and stays in it', r);
  ok(r.caveNoon >= 3 && r.roofWander >= 2, 'cave spiders fight in a dark cave at noon and wander under a roof', r);
  ok(r.zombie30 && !r.skel20, 'a zombie sees a player 30 blocks off, a skeleton not at 20', r);
};

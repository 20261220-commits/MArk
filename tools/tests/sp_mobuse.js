// using things on mobs: flint and steel sets a creeper off (it blows up whether or not it sees you); a chicken follows
// any of its seeds and a pig a carrot (in creative too), and feeding two makes them breed
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const out = {};
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 6; k++) setBlock(X + a, Y + k, Z + c, 0); }
    const reset = () => { for (const e of [...ENT]) if (e !== PL) removeEnt(e); W.time = 6000; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.yaw = 0; PL.pitch = 0; PL.health = 20; PL.inv = 1e9; UI.paused = false; PL.mode = 'survival'; INV.off = null; INV.sel = 0; };
    const run = async (n, f) => { for (let i = 0; i < n; i++) { UI.paused = false; if (f) f(i); gameTick(); if (i % 5 === 0) await new Promise(r => setTimeout(r, 1)); } };
    const aim = e => { const dx = e.x - PL.x, dy = e.y + e.h / 2 - (PL.y + 1.62), dz = e.z - PL.z; PL.yaw = Math.atan2(-dx, -dz); PL.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
    // creeper behind a wall of glass? simply: creative-invisible to it (no target), lit by hand
    reset(); PL.mode = 'creative'; const c = spawnMob('creeper', X + .5, Y, Z - 2.5); c.persistent = true; INV.slots[0] = { id: IID.flint_and_steel, n: 1 };
    aim(c); gameTick(); out.aimed = !!(TARGET && TARGET.e === c); useItem(true); out.lit = !!c.ignited; await run(40); out.boom = !!c.dead;
    for (let a = -6; a <= 6; a++) for (let c2 = -6; c2 <= 6; c2++) setBlock(X + a, Y - 1, Z + c2, BID.stone);
    for (const [mode, t, item] of [['survival', 'chicken', 'melon_seeds'], ['creative', 'chicken', 'wheat_seeds'], ['survival', 'pig', 'carrot'], ['survival', 'pig', 'wheat']]) {
      reset(); PL.mode = mode; const m = spawnMob(t, X + .5, Y, Z - 7.5); m.persistent = true; m.goal = null; INV.slots[0] = { id: IID[item], n: 8 }; await run(100);
      out[t + ':' + item + ':' + mode] = +Math.hypot(m.x - PL.x, m.z - PL.z).toFixed(1); }
    reset(); const a1 = spawnMob('chicken', X + .5, Y, Z - 2), a2 = spawnMob('chicken', X + 1.5, Y, Z - 2); a1.persistent = a2.persistent = true; INV.slots[0] = { id: IID.pumpkin_seeds, n: 8 };
    for (const m of [a1, a2]) { aim(m); gameTick(); if (TARGET && TARGET.e === m) useItem(true); } out.love = [a1.love > 0, a2.love > 0]; await run(200); out.babies = ENT.filter(e => e.type === 'chicken' && e.baby > 0).length;
    return out; });
  ok(r.aimed && r.lit && r.boom, 'flint and steel sets a creeper off', r);
  ok(r['chicken:melon_seeds:survival'] < 3.5 && r['chicken:wheat_seeds:creative'] < 3.5 && r['pig:carrot:survival'] < 3.5 && r['pig:wheat:survival'] > 2.6, 'a chicken follows its seeds and a pig a carrot (not wheat), in creative too', r);
  ok(r.love[0] && r.love[1] && r.babies >= 1, 'two fed chickens breed', r);
};

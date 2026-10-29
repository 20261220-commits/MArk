// fire spreads to and burns flammable blocks and burns out on stone; lava lights flammable blocks near it; and a player
// steps from a dirt path up through a doorway (the step is only as high as the lintel allows)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), go = async n => { for (let i = 0; i < n; i++) { UI.paused = false; await wait(100); } };
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); W.rain = 0; W.rainTarget = 0;
    const pad = () => { for (let a = -10; a <= 10; a++) for (let c = -10; c <= 10; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 6; k++) setBlock(X + a, Y + k, Z + c, 0); } };
    PL.x = X + .5; PL.y = Y + 10; PL.z = Z + .5; PL.flying = true;
    // the doorway: path outside, a full block under the door, a lintel above
    pad(); for (let a = -3; a <= 1; a++) setBlock(X + a, Y - 1, Z, BID.dirt_path);
    for (let c = -2; c <= 2; c++) for (let k = 0; k < 4; k++) if (c !== 0 || k >= 2) setBlock(X + 2, Y + k, Z + c, BID.oak_planks);
    setBlock(X + 2, Y, Z, BID.oak_door, 1 | 4, { noUpdate: true }); setBlock(X + 2, Y + 1, Z, BID.oak_door, 1 | 4 | 8, { noUpdate: true });
    const e = { x: X + 1.7, y: Y - 1 / 16, z: Z + .5, w: 0.3, h: 1.8, onGround: true }; for (let i = 0; i < 5; i++) physMove(e, 0.1, -0.08, 0, 0.6);
    o.door = { x: +(e.x - X).toFixed(2), y: +(e.y - Y).toFixed(3) };
    // fire on stone alone burns out
    pad(); setBlock(X, Y, Z, BID.fire); await go(80); o.burnsOut = getBlock(X, Y, Z) === 0;
    // fire spreads along a row of planks and burns them
    pad(); for (let a = 1; a <= 6; a++) setBlock(X + a, Y, Z, BID.oak_planks); setBlock(X, Y, Z, BID.fire);
    let maxFire = 0; for (let i = 0; i < 300; i++) { UI.paused = false; await wait(100); let f = 0; for (let a = -1; a <= 8; a++) for (let k = 0; k < 3; k++) for (let c = -1; c <= 1; c++) if (getBlock(X + a, Y + k, Z + c) === BID.fire) f++; maxFire = Math.max(maxFire, f); let left = 0; for (let a = 1; a <= 6; a++) if (getBlock(X + a, Y, Z) === BID.oak_planks) left++; if (left <= 3) break; }
    let left = 0; for (let a = 1; a <= 6; a++) if (getBlock(X + a, Y, Z) === BID.oak_planks) left++; o.spread = { maxFire, left };
    // lava lights flammable blocks near it (random ticks sped up)
    pad(); const gr0 = W.meta.gamerules; W.meta.gamerules = { ...(gr0 || {}), randomTickSpeed: 300 };
    setBlock(X, Y, Z, BID.lava, 0); for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) setBlock(X + dx, Y, Z + dz, BID.oak_planks);
    let lit = false; for (let i = 0; i < 200 && !lit; i++) { UI.paused = false; await wait(100); for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) for (let k = 0; k < 3; k++) if (getBlock(X + a, Y + k, Z + c) === BID.fire) lit = true; }
    W.meta.gamerules = gr0; o.lavaLights = lit;
    return o; });
  ok(r.door.x > 2.1 && Math.abs(r.door.y) < 0.01, 'stepping from a dirt path through a doorway onto a full block', r.door);
  ok(r.burnsOut, 'fire on bare stone burns out', r.burnsOut);
  ok(r.spread.maxFire >= 2 && r.spread.left <= 3, 'fire spreads along planks and burns them up', r.spread);
  ok(r.lavaLights, 'lava sets fire to flammable blocks near it', r.lavaLights);
  ok(!p.errs.length, 'no page errors', p.errs);
};

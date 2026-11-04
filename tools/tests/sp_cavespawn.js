// monsters spawn in the dark caves around you, as Java's: a dark cave room deep under the ground fills with monsters
// even while the night's surface monsters are about, and none spawn in the lit part
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Y = 0, Z = Math.floor(PL.z); PL.difficulty = 2; W.time = 18000;
    // a dark room 61 x 6 x 61 at y 0, with a lit square in the middle where the player stands
    for (let a = -30; a <= 30; a++) for (let c = -30; c <= 30; c++) for (let k = -1; k <= 6; k++) setBlock(X + a, Y + k, Z + c, k === -1 || k === 6 ? BID.stone : 0);
    for (let a = -4; a <= 4; a += 4) for (let c = -4; c <= 4; c += 4) setBlock(X + a, Y, Z + c, BID.torch);
    PL.mode = 'survival'; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.health = 20; await wait(1500);
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e);
    // the night's monsters on the surface far above
    for (let i = 0; i < 12; i++) { const sx = X + 40 + i * 2, sz = Z + 40, sy = topY(sx, sz) + 1; const m = spawnMob('zombie', sx + .5, sy, sz + .5); if (m) m.persistent = true; }
    let n = 0; const seen = new Set();
    for (let i = 0; i < 1200; i++) { UI.paused = false; gameTick(); PL.health = 20; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vx = PL.vz = 0;
      for (const e of ENT) if (e.kind === 'mob' && e.def.hostile && !seen.has(e) && Math.abs(e.y - Y) < 6 && Math.abs(e.x - X) < 31 && Math.abs(e.z - Z) < 31) { seen.add(e); n++; }
      if (i % 6 === 0) await wait(2); }
    const lit = [...seen].filter(e => (getLight(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) & 15) > 0).length;
    return { inRoom: n, lit }; });
  ok(r.inRoom >= 4, 'monsters spawn in the dark cave around the player', r);
  ok(r.lit === 0, 'none where torchlight reaches', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

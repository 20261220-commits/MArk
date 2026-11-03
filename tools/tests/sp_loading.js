// chunks keep up with a moving player: generated trees don't rot (each decay rebuilt a chunk and starved the mesh
// workers), leaves of a felled tree still decay as in Java (6 steps through leaves), and the ground ahead is built
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative', '12345');
  const r = await p.evaluate(async () => {
    const o = {}, X = Math.floor(PL.x), Y = 200, Z = Math.floor(PL.z);
    W.meta.gamerules = { ...(W.meta.gamerules || {}), randomTickSpeed: 300 };
    for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) for (let k = -1; k < 8; k++) setBlock(X + a, Y + k, Z + c, 0);
    for (let k = 0; k < 5; k++) setBlock(X, Y + k, Z, BID.oak_log);
    for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) for (let k = 3; k < 6; k++) if (a || c) setBlock(X + a, Y + k, Z + c, 22, 0);
    setBlock(X + 3, Y + 4, Z, 22, 0); setBlock(X + 4, Y + 4, Z, 22, 0); // 5 and 6 steps from the trunk
    const cnt = () => { let n = 0; for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) for (let k = 0; k < 8; k++) if (S.LEAF[getBlock(X + a, Y + k, Z + c)]) n++; return n; };
    W.leafCheck = null; const n0 = cnt(); for (let i = 0; i < 300; i++) gameTick(); o.kept = [n0, cnt()];
    setBlock(X + 1, Y + 4, Z + 1, 0); for (let i = 0; i < 300; i++) gameTick(); o.keptNear = cnt(); // a leaf broken: the rest still reach the log
    for (let k = 0; k < 5; k++) setBlock(X, Y + k, Z, 0); for (let i = 0; i < 600; i++) gameTick(); o.after = cnt();
    W.meta.gamerules.randomTickSpeed = 3;
    // moving: the chunks ahead are built
    PL.flying = true; PL.y += 30; await new Promise(r => setTimeout(r, 6000)); const v0 = W.verSeq, cov = [];
    for (let s = 0; s < 4; s++) { PL.x += 24; PL.yaw = -Math.PI / 2; PL.vx = 0.5; await new Promise(r => setTimeout(r, 2500));
      const pcx = Math.floor(PL.x) >> 4, pcz = Math.floor(PL.z) >> 4; let m = 0; for (let dx = 1; dx <= R.rd - 1; dx++) for (let dz = -2; dz <= 2; dz++) { const c = chunkAt(pcx + dx, pcz + dz); if (c && c.mesh) m++; } cov.push(m / ((R.rd - 1) * 5)); }
    o.cov = cov; o.meshJobs = W.verSeq - v0;
    return o;
  });
  ok(r.kept[0] === r.kept[1] && r.keptNear === r.kept[0] - 1, 'leaves up to 6 steps from a log stay; generated and untouched leaves never decay', [r.kept, r.keptNear]);
  ok(r.after === 0, 'the leaves of a felled tree decay', r.after);
  ok(Math.min(...r.cov) >= 0.5 && r.meshJobs < 200, 'while moving, the ground ahead is built (no see-through holes) without rebuilding chunks over and over', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

// Walking out of the End (and respawning from it) brings the player to the respawn point as Java does: beside the
// bed, even under a roof (not on top of the house), or the world spawn when the bed is gone
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const toDim = async (d, f) => { f(); for (let i = 0; i < 400 && (UI.menu === 'loading' || W.dim !== d); i++) await wait(100); showMenu(null); };
    const X = W.worldSpawn[0] + 30, Z = W.worldSpawn[2] + 30, Y = topY(X, Z) + 1;
    // a little house: floor, walls, roof, a bed inside
    for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, (Math.abs(a) === 3 || Math.abs(c) === 3 || k === 3) ? BID.oak_planks : 0); }
    setBlock(X, Y, Z, BID.red_bed, 0, { noUpdate: true }); setBlock(X, Y, Z - 1, BID.red_bed, 4);
    PL.spawn = [X, Y + 1, Z]; PL.spawnBed = true; PL.spawnDim = 0; // (as sleeping in it sets it)
    await toDim(1, () => switchDim(1, 100.5, 49, 0.5, 'end')); await wait(500);
    await toDim(0, () => goToRespawn(true)); await wait(500);
    o.bed = { x: PL.x, y: PL.y, z: PL.z, inside: Math.abs(PL.x - X - 0.5) < 3 && Math.abs(PL.z - Z - 0.5) < 3 && PL.y < Y + 2 };
    // the bed gone: the world spawn
    setBlock(X, Y, Z, 0, 0, { noUpdate: true }); setBlock(X, Y, Z - 1, 0, 0, { noUpdate: true });
    await toDim(1, () => switchDim(1, 100.5, 49, 0.5, 'end')); await wait(500);
    await toDim(0, () => goToRespawn(true)); await wait(500);
    o.noBed = { d: Math.hypot(PL.x - W.worldSpawn[0], PL.z - W.worldSpawn[2]), spawn: PL.spawn };
    return o; });
  console.log(JSON.stringify(r));
  ok(r.bed.inside, 'out of the End: beside the bed, inside the house (not on its roof)', r.bed);
  ok(r.noBed.d < 3 && r.noBed.spawn == null, 'the bed gone: the world spawn', r.noBed);
  ok(!p.errs.length, 'no page errors', p.errs);
};

// Another player's view of the runner's mobs: a fast one (the dragon, a block a tick) runs on smoothly between the
// runner's updates (every 2 ticks) instead of moving in jerks and trailing behind
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const steps = []; let e = null, x = PL.x, y = PL.y + 30, z = PL.z;
    const row = () => [7777, 'ender_dragon', +x.toFixed(2), y, z, 0, 0, 0, null, 0, null, null, 0, 0, 0, 0, 0];
    for (let t = 0; t < 60; t++) { W.tickN++; x += 1; if (t % 2 === 0) { MP.allowSpawn = true; try { mpMirrorMobs([row()]); } finally { MP.allowSpawn = false; } }
      e = e || ENT.find(q => q.remote && q.rid === 7777); if (e) { const x0 = e.x; mpPuppetTick(e); if (t > 10) steps.push(+(e.x - x0).toFixed(2)); } }
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length, sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length);
    return { mean: +mean.toFixed(2), sd: +sd.toFixed(2), lag: e ? +(x - e.x).toFixed(2) : null, sample: steps.slice(0, 8) }; });
  console.log(JSON.stringify(r));
  ok(r.sd < 0.1 && Math.abs(r.mean - 1) < 0.05, 'it moves the same each tick (before: 0.67 and 1.33 by turns)', r);
  ok(r.lag != null && Math.abs(r.lag) < 0.5, 'and does not trail behind (before: 1.67 blocks)', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

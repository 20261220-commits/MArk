// mobs moving as Java's do: a zombie's chase at 2.28 blocks/s (43.17 x 0.23^2), the panic dashes (top speed from the
// movement attribute and PanicGoal's modifier, spots within 5 blocks, not a straight run), a skeleton strafing at
// its range and shooting every 40 + 20 ticks on normal
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => { const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) { setBlock(X + a, Y - 1, Z + c, BID.grass_block); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e !== PL) removeEnt(e); W.time = 18000; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.inv = 1e9; UI.paused = false; PL.difficulty = 2;
    const out = {};
    for (const t of ['cow', 'pig', 'chicken']) { const m = spawnMob(t, X + 4.5, Y, Z + .5); m.persistent = true; hurtMob(m, 0.01, PL); let far = 0, mx = 0, px = m.x, pz = m.z;
      for (let i = 0; i < 100; i++) { gameTick(); far = Math.max(far, Math.hypot(m.x - X - 4.5, m.z - Z - .5)); mx = Math.max(mx, Math.hypot(m.x - px, m.z - pz) * 20); px = m.x; pz = m.z; }
      out[t] = { far: +far.toFixed(1), top: +mx.toFixed(2), end: +Math.hypot(m.x - X - 4.5, m.z - Z - .5).toFixed(1) }; removeEnt(m); }
    { const m = spawnMob('skeleton', X + 10.5, Y, Z + .5); m.persistent = true; m.target = PL; const ds = [], shots = []; let n0 = ENT.filter(e => e.kind === 'arrow').length;
      for (let i = 0; i < 200; i++) { gameTick(); PL.health = 20; if (i % 20 === 0) ds.push(+Math.hypot(m.x - PL.x, m.z - PL.z).toFixed(1)); const n = ENT.filter(e => e.kind === 'arrow').length; if (n > n0) shots.push(i); n0 = n; }
      out.skel = { ds, shots }; removeEnt(m); }
    { const m = spawnMob('zombie', X + 12.5, Y, Z + .5); m.persistent = true; m.target = PL; let path = 0, px, pz;
      for (let i = 0; i < 60; i++) { gameTick(); PL.health = 20; if (i === 20) { px = m.x; pz = m.z; } } out.zombie = +(Math.hypot(m.x - px, m.z - pz) / 2).toFixed(2); removeEnt(m); }
    return out; });
  ok(Math.abs(r.zombie - 2.28) < 0.15, 'a zombie chases at 2.28 blocks a second', r.zombie);
  ok(Math.abs(r.cow.top - 6.9) < 0.3 && Math.abs(r.pig.top - 4.22) < 0.3 && Math.abs(r.chicken.top - 5.29) < 0.3, 'panic top speeds: cow 6.9, pig 4.2, chicken 5.3 blocks a second', r);
  const gaps = r.skel.shots.slice(1).map((v, i) => v - r.skel.shots[i]);
  ok(r.skel.shots.length >= 3 && gaps.every(g => g >= 55 && g <= 65) && r.skel.ds.slice(2).every(d => d > 5 && d < 15), 'a skeleton keeps its range strafing and shoots every 60 ticks (normal)', r.skel);
};

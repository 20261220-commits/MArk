// Shulkers fire as Java's ShulkerAttackGoal (a bullet, then 1 to 5.5 seconds to the next), and levitation lifts the
// player about a block a second in place of gravity
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => { const o = {}, X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobSpawning: false };
    for (let a = -10; a <= 10; a++) for (let c = -10; c <= 10; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 6; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e);
    PL.x = X + .5; PL.y = Y; PL.z = Z + 6.5; PL.mode = 'survival'; PL.flying = false; PL.health = 20;
    const sh = spawnMob('shulker', X + .5, Y, Z + .5); sh.persistent = true;
    let shots = 0; const sb = spawnShulkerBullet; window.spawnShulkerBullet = o => { shots++; return sb(o); };
    for (let i = 0; i < 600; i++) { W.tickN++; entityTick(); PL.health = 20; delete PL.eff.levitation; for (const e of [...ENT]) if (e.kind === 'bullet') removeEnt(e); }
    window.spawnShulkerBullet = sb; removeEnt(sh); o.shots = shots;
    // levitation: 2 seconds in the open
    PL.y = Y + 1; PL.vy = 0; PL.onGround = false; addEffect(PL, 'levitation', 200, 0); const y0 = PL.y;
    for (let i = 0; i < 40; i++) playerTick(); o.lift = +(PL.y - y0).toFixed(2); delete PL.eff.levitation;
    return o; });
  console.log(JSON.stringify(r));
  ok(r.shots >= 4 && r.shots <= 18, 'a shulker fires every 1 to 5.5 seconds (about 9 in 30 s), not in bursts', r.shots);
  ok(r.lift > 1 && r.lift < 3, 'levitation lifts about a block a second', r.lift);
  ok(!p.errs.length, 'no page errors', p.errs);
};

// The enderman as Java: a look provokes it; stared at it stands still (and teleports off when close); looked away it
// runs at you and hits for 7 in reach; far off it teleports toward you
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => { const o = {}, X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobSpawning: false };
    for (let a = -40; a <= 40; a++) for (let c = -40; c <= 40; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e);
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.mode = 'survival'; PL.flying = false; PL.health = 20; PL.inv = 0;
    const lookAt = e => { const dx = e.x - PL.x, dy = e.y + 2.55 - (PL.y + PL.eyeH), dz = e.z - PL.z; PL.yaw = Math.atan2(-dx, -dz); PL.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
    const T = n => { for (let i = 0; i < n; i++) { W.tickN++; entityTick(); } };
    const en = spawnMob('enderman', X + .5, Y, Z - 9.5); en.persistent = true; en.yaw = 0;
    // not looked at: calm
    PL.yaw = Math.PI; PL.pitch = 0; T(20); o.calm = !en.target;
    // a look: it comes for you
    lookAt(en); T(10); o.provoked = en.target === PL;
    // still looked at, within 16: it stands still
    const x0 = en.x, z0 = en.z; for (let i = 0; i < 30; i++) { lookAt(en); T(1); } o.frozen = Math.hypot(en.x - x0, en.z - z0) < 0.3;
    // looked away: it runs up and hits for 7
    PL.yaw = Math.PI; PL.pitch = 0; PL.health = 20; let hit = 0; for (let i = 0; i < 120 && !hit; i++) { PL.inv = 0; const h0 = PL.health; T(1); if (PL.health < h0) hit = h0 - PL.health; }
    o.hit = hit; o.reach = +Math.hypot(en.x - PL.x, en.z - PL.z).toFixed(2);
    // close and looked at: it teleports off
    PL.health = 20; lookAt(en); const c0 = [en.x, en.z]; T(2); o.tpClose = Math.hypot(en.x - c0[0], en.z - c0[1]) > 2;
    // far off, not looked at: it teleports toward you
    en.x = en.px = X + 30.5; en.z = en.pz = Z + .5; en.y = Y; en.target = PL; en.tpT = 0; PL.yaw = 0; PL.pitch = 0; const far0 = Math.hypot(en.x - PL.x, en.z - PL.z); T(35); o.towards = [far0, +Math.hypot(en.x - PL.x, en.z - PL.z).toFixed(1)];
    return o; });
  console.log(JSON.stringify(r));
  ok(r.calm && r.provoked, 'not looked at it stays calm; a look provokes it', r);
  ok(r.frozen, 'stared at from within 16 blocks, it stands still', r.frozen);
  ok(r.hit === 7 && r.reach < 1.6, 'looked away, it runs up and hits for 7 within its reach', [r.hit, r.reach]);
  ok(r.tpClose, 'stared at up close, it teleports away', r.tpClose);
  ok(r.towards[1] < r.towards[0] - 6, 'far off and not looked at, it teleports toward you', r.towards);
  ok(!p.errs.length, 'no page errors', p.errs);
};

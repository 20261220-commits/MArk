// ghasts and blazes fire as often as Java's: a ghast every 3 seconds even when it keeps losing sight of you (the wait
// after a shot used to be wiped, so it fired again a second later), its fireball aimed at your middle; a blaze 3
// fireballs then 5 seconds' rest; a ghast high up keeps floating instead of sinking to the ground
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); PL.difficulty = 2;
    for (let a = -30; a <= 30; a++) for (let c = -30; c <= 30; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 20; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e); await wait(300);
    const shots = [], sf = spawnFireball; window.spawnFireball = function (x, y, z, dx, dy, dz, owner, small) { shots.push({ t: W.tickN, small, owner: owner && owner.type }); return sf.apply(this, arguments); };
    const hold = () => { PL.health = 20; PL.dead = false; PL.x = X + .5; PL.z = Z + .5; PL.y = Y; PL.vx = PL.vz = 0; };
    const run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); hold(); if (i % 5 === 0) await wait(2); } };
    // a ghast that loses sight of you for a moment now and then (3 ticks in 28: behind a pillar, the player ducking)
    const g = spawnMob('ghast', X + .5, Y + 8, Z - 20); g.persistent = true; const cs = canSee; let n = 0; window.canSee = function () { return (n++ % 28) >= 3 && cs.apply(this, arguments); };
    const t0 = W.tickN; await run(400); window.canSee = cs;
    const gs = shots.filter(s => s.owner === 'ghast').map(s => s.t), gaps = gs.slice(1).map((t, i) => t - gs[i]);
    o.ghast = { n: gs.length, minGap: Math.min(...gaps), span: W.tickN - t0, y: +(g.y - Y).toFixed(1), ground: !!g.onGround };
    // its fireball reaches you when you stand still
    removeEnt(g); for (const e of [...ENT]) if (e.kind === 'fireball') removeEnt(e);
    const g2 = spawnMob('ghast', X + .5, Y + 6, Z - 16); g2.persistent = true; g2.charge = 15; let hurt = false;
    for (let i = 0; i < 160 && !hurt; i++) { UI.paused = false; PL.health = 20; gameTick(); if (PL.health < 20) hurt = true; PL.x = X + .5; PL.z = Z + .5; if (i % 5 === 0) await wait(2); }
    o.hit = hurt; removeEnt(g2);
    // a blaze: bursts of three
    shots.length = 0; const bz = spawnMob('blaze', X + .5, Y, Z - 10); bz.persistent = true; const tb = W.tickN; await run(500);
    const bs = shots.filter(s => s.owner === 'blaze').map(s => s.t - tb), bursts = []; for (const t of bs) { const l = bursts[bursts.length - 1]; if (l && t - l[l.length - 1] < 20) l.push(t); else bursts.push([t]); }
    o.blaze = { bursts: bursts.map(x => x.length), rest: bursts.slice(1).map((x, i) => x[0] - bursts[i][bursts[i].length - 1]) };
    return o; });
  ok(r.ghast.n >= 2 && r.ghast.minGap >= 55, 'a ghast that keeps losing sight of you still waits 3 seconds between shots', r.ghast);
  ok(!r.ghast.ground && Math.abs(r.ghast.y) > 1.5, 'a ghast high in the sky keeps floating (not sitting on the ground)', r.ghast);
  ok(r.hit, 'a ghast\'s fireball hits a player standing still', r);
  ok(r.blaze.bursts.length >= 2 && r.blaze.bursts.every(n => n <= 3) && r.blaze.rest.every(t => t >= 100), 'a blaze fires three at a time, then rests', r.blaze);
  ok(!p.errs.length, 'no page errors', p.errs);
};

// a shield in the off hand: raised with a sword, an axe (not at a log) or a block (nothing to put it against) in the
// main hand; it stops a zombie's hits, a skeleton's arrows and a creeper's blast from the front, and wears. A ghast's
// fireball blows a hole and sets fires, can be hit back (its hit box a block wider all round) and kills the ghast.
// Dying ends every effect and the fire, and what was after you lets go
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const out = {};
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 8; k++) setBlock(X + a, Y + k, Z + c, 0); }
    const reset = () => { for (const e of [...ENT]) if (e !== PL) removeEnt(e); for (let a = -6; a <= 6; a++) for (let c = -6; c <= 6; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, 0); } W.time = 18000; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.yaw = 0; PL.pitch = 0; PL.health = 20; PL.inv = 0; PL.vx = PL.vz = 0; PL.fire = 0; UI.paused = false; PL.difficulty = 2; PL.dead = false; IN.use = false; onUseRelease(); offhandTick(); TARGET = null; INV.slots[0] = { id: IID.iron_sword, n: 1 }; INV.sel = 0; INV.off = { id: IID.shield, n: 1 }; };
    const run = async (n, f) => { for (let i = 0; i < n; i++) { UI.paused = false; if (f) f(i); gameTick(); if (i % 5 === 0) await new Promise(r => setTimeout(r, 1)); } };
    const raise = async () => { IN.use = true; onUsePress(); await run(8, () => { TARGET = null; }); return shieldUp(); };
    const hold = () => { PL.x = X + .5; PL.z = Z + .5; PL.yaw = 0; PL.pitch = 0; };
    reset(); out.sword = await raise();
    const z = spawnMob('zombie', X + .5, Y, Z - 1.2); z.persistent = true; z.target = PL; await run(60, hold); out.zombieDmg = 20 - PL.health; out.wear = INV.slots[0].d || 0;
    reset(); INV.slots[0] = { id: IID.iron_axe, n: 1 }; out.axe = await raise();
    reset(); INV.slots[0] = { id: IID.cobblestone, n: 8 }; out.block = await raise();
    reset(); INV.slots[0] = { id: IID.bread, n: 1 }; PL.food = 20; out.breadFull = await raise();
    reset(); await raise(); const sk = spawnMob('skeleton', X + .5, Y, Z - 8.5); sk.persistent = true; sk.target = PL; await run(130, hold); out.arrowDmg = 20 - PL.health;
    reset(); await raise(); const c = spawnMob('creeper', X + .5, Y, Z - 2); c.persistent = true; c.target = PL; await run(60, hold); out.creeperDmg = +(20 - PL.health).toFixed(1);
    // unshielded, for comparison
    reset(); INV.off = null; const z2 = spawnMob('zombie', X + .5, Y, Z - 1.2); z2.persistent = true; z2.target = PL; await run(40, hold); out.bare = 20 - PL.health;
    // a fireball into the ground: a hole and fire
    reset(); for (let a = -4; a <= 4; a++) for (let c2 = -4; c2 <= 4; c2++) for (let k = 1; k <= 3; k++) setBlock(X + a, Y - k, Z - 8 + c2, BID.netherrack);
    let holes = 0, fires = 0; for (let t = 0; t < 6; t++) { spawnFireball(X + .5 + (t % 3) - 1, Y + 5, Z - 8 + (t >> 1) - 1, 0, -1, 0, null, false); await run(40, hold); }
    for (let a = -5; a <= 5; a++) for (let c2 = -5; c2 <= 5; c2++) for (let k = -3; k <= 2; k++) { const bb = getBlock(X + a, Y + k, Z - 8 + c2); if (k < 0 && Math.abs(a) <= 4 && Math.abs(c2) <= 4 && !bb) holes++; if (bb === BID.fire) fires++; }
    out.holes = holes; out.fires = fires;
    // hit back: aimed a little beside the ball (inside its pick radius), the ghast dies of its own fireball
    reset(); INV.off = null; const g = spawnMob('ghast', X + .5, Y + 3, Z - 24); g.persistent = true; g.def = { ...g.def, ai: () => {} };
    const f2 = spawnFireball(X + .5, Y + 1.6, Z - 3.2, 0, 0, 1, g, false); f2.vx = f2.vy = f2.vz = 0; f2.ax = f2.ay = f2.az = 0;
    PL.yaw = Math.atan2(-(g.x - PL.x), -(g.z - PL.z)); PL.pitch = Math.atan2(g.y + 2 - (PL.y + 1.62), Math.hypot(g.x - PL.x, g.z - PL.z));
    gameTick(); out.aimed = TARGET && TARGET.type === 'ent' && TARGET.e === f2; onAttackPress(); out.owner = f2.owner === PL;
    await run(80, () => { PL.x = X + .5; PL.z = Z + .5; }); out.ghastDead = !!(g.dead || g.deathT);
    // death
    reset(); addEffect(PL, 'poison', 600, 0); addEffect(PL, 'speed', 600, 1); PL.fire = 100; const z3 = spawnMob('zombie', X + 3.5, Y, Z + .5); z3.persistent = true; z3.target = PL;
    hurtPlayer(100, 'kill'); out.dead = PL.dead; out.eff = Object.keys(PL.eff || {}).length; out.fireAfter = PL.fire; out.target = z3.target === PL;
    await run(30); out.targetLater = z3.target === PL; if (PL.dead) { respawn(); UI.closeScreen && UI.closeScreen(); showMenu(null); }
    return out; });
  ok(r.sword && r.axe && r.block && r.breadFull, 'the off-hand shield goes up with a sword, an axe, a block or food (when full) in the main hand', r);
  ok(r.zombieDmg === 0 && r.arrowDmg === 0 && r.creeperDmg === 0 && r.bare > 0 && r.wear > 0, 'it stops a zombie, arrows and a creeper\'s blast from the front, and wears', r);
  ok(r.holes > 0 && r.fires > 0, 'a ghast\'s fireball blows a hole and sets fires', [r.holes, r.fires]);
  ok(r.aimed && r.owner && r.ghastDead, 'the fireball can be hit back (aimed beside it) and kills the ghast', r);
  ok(r.dead && r.eff === 0 && r.fireAfter === 0 && !r.target && !r.targetLater, 'dying ends every effect and the fire, and what was after you lets go', r);
};

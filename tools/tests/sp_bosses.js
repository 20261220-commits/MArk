// bosses and weapons against Java's rules: the wither's side heads fire too and its blue skulls are rare; a perched
// dragon shrugs off arrows, a flying one takes a quarter (plus up to 1) on its body; no critical hit while sprinting;
// an axe knocks a raised shield away one time in four; melee weapons keep Java's damage and speed
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); PL.difficulty = 2;
    for (let a = -20; a <= 20; a++) for (let c = -20; c <= 20; c++) { setBlock(X + a, Y - 1, Z + c, BID.bedrock); for (let k = 0; k < 16; k++) setBlock(X + a, Y + k, Z + c, 0); }
    await wait(200); for (const e of [...ENT]) if (e !== PL) removeEnt(e);
    const hold = () => { PL.health = 20; PL.dead = false; PL.x = X + .5; PL.z = Z + .5; PL.y = Y; PL.vx = PL.vz = 0; };
    // the wither (past its charge): skulls from all three heads
    const skulls = [], sw = spawnWitherSkull; window.spawnWitherSkull = function (x, y, z, dx, dy, dz, owner, blue) { skulls.push({ t: W.tickN, blue, side: Math.hypot(x - owner.x, z - owner.z) > 0.5 }); return sw.apply(this, arguments); };
    const w = spawnMob('wither', X + .5, Y + 6, Z - 8.5); w.persistent = true; w.charge = 0; const t0 = W.tickN;
    for (let i = 0; i < 300; i++) { UI.paused = false; gameTick(); hold(); if (i % 5 === 0) await wait(2); }
    window.spawnWitherSkull = sw; removeEnt(w); for (const e of [...ENT]) if (e !== PL) removeEnt(e);
    o.wither = { n: skulls.length, side: skulls.filter(s => s.side).length, blue: skulls.filter(s => s.blue).length, span: W.tickN - t0 };
    // the dragon: an arrow at it perched and flying
    const dr = spawnMob('ender_dragon', X + .5, Y + 2, Z - 6.5); dr.ai = null; dr.def = { ...dr.def, ai: () => {} }; dr.hp = 200;
    dr.phase = 'perch'; HURTPROJ = { kind: 'arrow' }; const perched = hurtMob(dr, 9, PL); HURTPROJ = null; o.perch = [perched, dr.hp];
    dr.inv = 0; dr.phase = 'circle'; HURTPROJ = { kind: 'arrow' }; hurtMob(dr, 9, PL); HURTPROJ = null; o.flying = +(200 - dr.hp).toFixed(2); removeEnt(dr);
    // critical hits: falling, not while sprinting
    const z = spawnMob('zombie', X + .5, Y, Z - 1.5); z.persistent = true; z.ai = null; INV.slots[INV.sel] = { id: IID.iron_sword, n: 1 };
    const hit = sprint => { z.hp = 20; z.inv = 0; PL.attackT = 100; PL.onGround = false; PL.vy = -0.2; PL.sprinting = sprint; attackEntity(z); return +(20 - z.hp).toFixed(2); };
    o.crit = { falling: hit(false), sprinting: hit(true) }; PL.sprinting = false; removeEnt(z);
    // an axe-wielding vindicator against a raised shield
    INV.slots[INV.sel] = { id: IID.shield, n: 1 }; let broken = 0; const v = spawnMob('vindicator', X + .5, Y, Z - 1.2); v.persistent = true;
    for (let i = 0; i < 200; i++) { PL.shieldCd = 0; USE.kind = 'shield'; USE.t = 10; PL.yaw = 0; hurtPlayer(13, 'mob', v); if (PL.shieldCd > 0) broken++; PL.health = 20; PL.inv = 0; PL.hurtT = 0; }
    USE.kind = null; o.shield = broken;
    const W8 = k => ITEMS[IID[k]].tool; o.melee = ['wooden_sword', 'netherite_sword', 'wooden_axe', 'iron_axe', 'diamond_axe', 'netherite_axe', 'trident'].map(k => [k, W8(k).dmg, W8(k).as]);
    return o; });
  ok(r.wither.side >= 4 && r.wither.n - r.wither.side >= 3 && r.wither.blue <= 2, 'the wither\'s side heads fire too; blue skulls are rare', r.wither);
  ok(r.perch[0] === false && r.perch[1] === 200, 'a perched dragon shrugs off an arrow', r.perch);
  ok(Math.abs(r.flying - (9 / 4 + 1)) < 0.01, 'a flying dragon\'s body takes a quarter plus up to 1', r.flying);
  ok(Math.abs(r.crit.falling - 6 * 1.5) < 0.01 && Math.abs(r.crit.sprinting - 6) < 0.01, 'a falling hit is critical (x1.5), not while sprinting', r.crit);
  ok(r.shield > 20 && r.shield < 90, 'an axe knocks a shield away about one time in four', r.shield);
  ok(JSON.stringify(r.melee) === JSON.stringify([['wooden_sword', 4, 1.6], ['netherite_sword', 8, 1.6], ['wooden_axe', 7, 0.8], ['iron_axe', 9, 0.9], ['diamond_axe', 9, 1], ['netherite_axe', 10, 1], ['trident', 9, 1.1]]), 'melee weapons keep Java\'s damage and speed', r.melee);
  ok(!p.errs.length, 'no page errors', p.errs);
};

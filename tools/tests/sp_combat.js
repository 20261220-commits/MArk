// hitting as Java does it: a mob's (and the player's) moment of invulnerability, where only a harder hit lands, by the
// difference and without knockback; knockback that halves the old motion and lifts only from the ground; 3 blocks of
// reach to hit a mob in survival; a knockback hit slows the player
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const out = {};
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 5; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e !== PL) removeEnt(e); W.time = 6000; PL.difficulty = 2;
    const z = spawnMob('zombie', X + .5, Y, Z + 2.5); z.persistent = true; z.onGround = true; z.vx = z.vz = z.vy = 0; const hp0 = z.hp;
    out.first = hurtMob(z, 4, PL, 0, 1); out.kb = [+z.vz.toFixed(2), +z.vy.toFixed(2)];
    out.same = hurtMob(z, 4, PL, 0, 1); out.harder = hurtMob(z, 6, PL, 0, 1); out.hpAfter = +(hp0 - z.hp).toFixed(2); out.kbAfterPartial = +z.vz.toFixed(2);
    z.inv = 0; z.onGround = false; z.vy = -0.2; z.vz = 0; hurtMob(z, 1, PL, 0, 1); out.air = [+z.vz.toFixed(2), +z.vy.toFixed(2)];
    // reach: a mob 3.6 blocks off isn't hit in survival, one 2.5 off is
    removeEnt(z); PL.mode = 'survival'; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.yaw = Math.PI; PL.pitch = 0; // (looking toward +z)
    const far = spawnMob('zombie', X + .5, Y, Z + 4.4); far.persistent = true; out.farHit = (() => { const t = raycast(4.5); return !!(t && t.type === 'ent'); })(); removeEnt(far);
    const near = spawnMob('zombie', X + .5, Y, Z + 3); near.persistent = true; out.nearHit = (() => { const t = raycast(4.5); return !!(t && t.type === 'ent'); })(); removeEnt(near);
    // the player's moment of invulnerability
    PL.health = 20; PL.inv = 0; INV.armor.fill(null); hurtPlayer(4, 'mob'); const h1 = PL.health; hurtPlayer(4, 'mob'); const h2 = PL.health; hurtPlayer(6, 'mob'); const h3 = PL.health;
    out.pl = [+(20 - h1).toFixed(2), +(h1 - h2).toFixed(2), +(h2 - h3).toFixed(2), PL.hitPartial];
    // a sprint hit slows the player
    const m = spawnMob('zombie', X + .5, Y, Z + 2.2); m.persistent = true; PL.inv = 0; PL.attackT = 100; PL.sprinting = true; PL.vz = 0.3; PL.vx = 0; attackEntity(m); out.sprint = +PL.vz.toFixed(2);
    // a different item in the hand starts the charge again
    INV.slots[0] = { id: IID.iron_sword, n: 1 }; INV.slots[1] = { id: IID.iron_axe, n: 1 }; INV.sel = 0; UI.paused = false; for (let i = 0; i < 40; i++) gameTick(); const full = PL.attackT; INV.sel = 1; gameTick(); out.swap = [full >= 30, PL.attackT <= 1];
    // the hand drops after a swing and comes back up as the charge returns; a full sword swing on the ground sweeps
    const frames = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    showMenu(null); UI.paused = false; INV.sel = 0; PL.sprinting = false; PL.dead = false; PL.health = 20; PL.mode = 'survival'; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0; PL.yaw = Math.PI; PL.onGround = true; PL.attackT = 100; for (const q of [...ENT]) if (q.kind === 'mob') removeEnt(q);
    const t1 = spawnMob('zombie', X + .5, Y, Z + 2.2); t1.persistent = true; const t2 = spawnMob('zombie', X + 1.2, Y, Z + 2.4); t2.persistent = true; const hp2 = t2.hp;
    PL.attackT = 100; await new Promise(r => setTimeout(r, 1500)); const up = HANDS[0].equip; const n0 = R.particles.length; PL.vy = 0; PL.onGround = true; PL.sprinting = false; PL.attackT = 100; attackEntity(t1); const swept = hp2 - t2.hp, parts = R.particles.length - n0; removeEnt(t1); removeEnt(t2); PL.inv = 100000; // (no more hits on the player while the hand comes back up)
    let down = 1; for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 60)); down = Math.min(down, HANDS[0].equip); } await new Promise(r => setTimeout(r, 2500)); const back = HANDS[0].equip;
    out.hand = [+up.toFixed(2), +down.toFixed(2), +back.toFixed(2)]; out.sweep = [+swept.toFixed(2), parts]; PL.inv = 0;
    // a bow: a full draw flies at 3 blocks a tick with a little wobble, carries the shooter's motion, leaves sparks; in
    // water an arrow slows hard but a trident hardly
    PL.inv = 0; PL.dead = false; PL.health = 20; PL.yaw = Math.PI; PL.pitch = 0; PL.vx = 0.1; PL.vz = 0; INV.slots[2] = { id: IID.bow, n: 1 }; INV.slots[3] = { id: IID.arrow, n: 16 }; INV.sel = 2;
    USE.kind = 'bow'; USE.t = 25; const nA = ENT.length; onUseRelease(); const arr = ENT.slice(nA).find(q => q.kind === 'arrow');
    out.bow = arr ? [+Math.hypot(arr.vx, arr.vy, arr.vz).toFixed(2), +arr.vx.toFixed(3), !!arr.crit] : null;
    const sp0 = R.particles.length; arr && arrowTick(arr); out.spark = R.particles.length > sp0;
    const sh = []; for (let i = 0; i < 6; i++) { USE.kind = 'bow'; USE.t = 25; INV.slots[3] = { id: IID.arrow, n: 16 }; const n1 = ENT.length; onUseRelease(); const q = ENT.slice(n1).find(o => o.kind === 'arrow'); if (q) sh.push(q.vy); } out.wobble = Math.max(...sh) - Math.min(...sh);
    setBlock(X, Y + 3, Z, BID.water); const wa = shootArrow(X + .5, Y + 3.5, Z + .5, 1, 0, 0, null, 2), wt = shootArrow(X + .5, Y + 3.5, Z + .5, 1, 0, 0, null, 0); wt.trident = { id: IID.trident, n: 1 }; wt.tridentT = 0;
    wa.x = wt.x = X + .5; wa.y = wt.y = Y + 3.5; wa.z = wt.z = Z + .5; wa.vx = wt.vx = 0.01; wa.vy = wt.vy = 0; arrowTick(wa); out.water = [+wa.vx.toFixed(4)];
    // shield: raised (5 ticks), an arrow from the front bounces off it and the hit does nothing
    for (const q of [...ENT]) if (q.kind === 'mob' || q.kind === 'arrow') removeEnt(q);
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.yaw = Math.PI; PL.pitch = 0; PL.vx = PL.vy = PL.vz = 0; PL.health = 20; PL.inv = 0; PL.shieldCd = 0;
    INV.slots[4] = { id: IID.shield, n: 1 }; INV.sel = 4; USE.kind = 'shield'; USE.t = 10;
    const sk = spawnMob('skeleton', X + .5, Y, Z + 6.5); sk.persistent = true; const ar = shootArrow(X + .5, Y + 1.4, Z + 3.5, 0, 0, -1.5, sk, 2); const hpS = PL.health;
    for (let i = 0; i < 4; i++) arrowTick(ar); out.shield = [PL.health === hpS, ar.dead ? 'gone' : +ar.vz.toFixed(3)]; USE.kind = null; removeEnt(sk);
    // riptide: the first mob run into takes 8 and the player bounces back
    INV.slots[5] = { id: IID.trident, n: 1, e: { riptide: 3 } }; INV.sel = 5; const zz = spawnMob('zombie', X + .5, Y, Z + 1.2); zz.persistent = true; zz.inv = 0; const hz = zz.hp;
    PL.riptideT = 20; PL.vz = 1.5; UI.paused = false; gameTick(); out.rip = [+(hz - zz.hp).toFixed(1), PL.vz < 0 || PL.riptideT === 0]; removeEnt(zz); PL.riptideT = 0; PL.vz = 0;
    // loyalty: a trident coming back speeds up toward the owner (Java: 0.95 of its motion plus 0.05 a level)
    const tr = shootArrow(X + .5, Y + 1, Z + 10.5, 0, 0, 0, PL, 0); tr.trident = { id: IID.trident, n: 1, e: { loyalty: 1 } }; tr.stuck = true; tr.slot = 6; const sp = [];
    for (let i = 0; i < 6; i++) { tridentTick(tr); sp.push(+Math.hypot(tr.vx, tr.vy, tr.vz).toFixed(3)); } out.loyal = sp; removeEnt(tr);
    // impaling on a trident's stab against a water mob
    INV.slots[5] = { id: IID.trident, n: 1, e: { impaling: 5 } }; INV.sel = 5; PL.attackT = 100; PL.onGround = true; PL.vy = 0; const sq = spawnMob('squid', X + .5, Y, Z + 2); sq.persistent = true; sq.hp = 100; const hq = sq.hp; attackEntity(sq); out.impale = +(hq - sq.hp).toFixed(1); removeEnt(sq);
    return out; });
  ok(r.first && r.kb[0] > 0.35 && r.kb[0] <= 0.41 && r.kb[1] > 0.3 && r.kb[1] <= 0.4, 'a hit knocks a mob 0.4 away and up from the ground (at most 0.4)', r);
  ok(!r.same && r.harder && Math.abs(r.hpAfter - 6) < 0.01 && Math.abs(r.kbAfterPartial - r.kb[0]) < 0.01, 'in its moment of invulnerability the same hit does nothing, a harder one only the difference and no knockback', r);
  ok(r.air[1] < 0 && r.air[0] > 0.35, 'a mob in the air is pushed back but not lifted', r.air);
  ok(!r.farHit && r.nearHit, 'a mob is hit from 3 blocks in survival, not from further', [r.farHit, r.nearHit]);
  ok(r.pl[0] > 0 && r.pl[1] === 0 && r.pl[2] > 0 && r.pl[2] < r.pl[0] && r.pl[3], "the player's moment of invulnerability works the same way", r.pl);
  ok(r.sprint < 0.3 * 0.7, 'a sprinting (knockback) hit slows the player', r.sprint);
  ok(r.swap[0] && r.swap[1], 'changing the item in the hand starts the attack charge again (Java)', r.swap);
  ok(r.hand[0] > 0.8 && r.hand[1] < 0.8 && r.hand[2] > 0.9, 'the held weapon drops after a swing and rises again with the charge (Java)', r.hand);
  ok(r.sweep[0] > 0 && r.sweep[1] > 0, 'a full sword swing sweeps the mob beside the target, with its sweep effect', r.sweep);
  ok(r.bow && r.bow[0] > 2.9 && r.bow[0] < 3.3 && r.bow[1] > 0.05 && r.bow[2], 'a full draw shoots a critical arrow at 3 blocks a tick, carrying the shooter\'s motion', r.bow);
  ok(r.spark && r.wobble > 0 && r.wobble < 0.2, 'a critical arrow leaves sparks; arrows wobble a little, as in Java', [r.spark, r.wobble]);
  ok(r.water[0] < 0.007, 'an arrow in water slows hard (0.6 a tick)', r.water);
  ok(r.shield[0] && r.shield[1] !== 'gone' && r.shield[1] > 0, 'a raised shield takes an arrow from the front, and the arrow bounces off it', r.shield);
  ok(r.rip[0] >= 7.9 && r.rip[1], "riptide's spin hits the first mob run into for 8 and bounces the player back", r.rip);
  ok(r.loyal.every((v, i) => !i || v > r.loyal[i - 1]), 'a loyal trident speeds up as it comes back', r.loyal);
  ok(r.impale >= 9 + 12.5 - 0.1, "impaling adds 2.5 a level to a trident's stab on a water mob", r.impale);
};

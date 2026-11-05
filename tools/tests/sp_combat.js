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
    return out; });
  ok(r.first && r.kb[0] > 0.35 && r.kb[0] <= 0.41 && r.kb[1] > 0.3 && r.kb[1] <= 0.4, 'a hit knocks a mob 0.4 away and up from the ground (at most 0.4)', r);
  ok(!r.same && r.harder && Math.abs(r.hpAfter - 6) < 0.01 && Math.abs(r.kbAfterPartial - r.kb[0]) < 0.01, 'in its moment of invulnerability the same hit does nothing, a harder one only the difference and no knockback', r);
  ok(r.air[1] < 0 && r.air[0] > 0.35, 'a mob in the air is pushed back but not lifted', r.air);
  ok(!r.farHit && r.nearHit, 'a mob is hit from 3 blocks in survival, not from further', [r.farHit, r.nearHit]);
  ok(r.pl[0] > 0 && r.pl[1] === 0 && r.pl[2] > 0 && r.pl[2] < r.pl[0] && r.pl[3], "the player's moment of invulnerability works the same way", r.pl);
  ok(r.sprint < 0.3 * 0.7, 'a sprinting (knockback) hit slows the player', r.sprint);
};

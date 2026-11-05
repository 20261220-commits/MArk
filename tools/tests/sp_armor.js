// armour as Java 1.18 does it: the damage formula (points and toughness), protection counted once (feather falling three a
// level on a fall), fire protection shortening burning, unbreaking rolling for each point of wear, thorns per piece (and
// costing the piece 2 more), and armour put on by right-clicking it in the hand
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => { const out = {};
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -6; a <= 6; a++) for (let c = -6; c <= 6; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 5; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e !== PL) removeEnt(e); W.time = 6000; PL.difficulty = 2; PL.x = X + .5; PL.y = Y; PL.z = Z + .5;
    const hit = (dmg, cause, att) => { PL.health = 20; PL.inv = 0; PL.lastDmg = 0; PL.absorb = 0; hurtPlayer(dmg, cause, att); return +(20 - PL.health).toFixed(3); };
    const full = k => [IID[k + '_helmet'], IID[k + '_chestplate'], IID[k + '_leggings'], IID[k + '_boots']].map(id => ({ id, n: 1 }));
    // diamond: 20 points, 8 toughness; a 10 hit: 10 * (1 - max(4, 20 - 10 / 4) / 25) = 3
    INV.armor = full('diamond'); out.diamond = hit(10, 'mob');
    INV.armor = full('iron'); out.iron = hit(10, 'mob'); // 15 points: 10 * (1 - max(3, 15 - 5) / 25) = 6
    // protection IV on all four (16 epf: -64%) on a fall of 10, counted once; feather falling IV adds 12 (cap 20: -80%)
    INV.armor = [null, null, null, null]; out.fallBare = hit(10, 'fall');
    INV.armor = full('leather').map(s => ({ ...s, e: { protection: 4 } })); out.fallProt = hit(10, 'fall');
    INV.armor[3].e.feather_falling = 4; out.fallFF = hit(10, 'fall');
    out.drownProt = hit(2, 'drown'); // (protection works on drowning too in Java)
    // fire protection IV: burning from fire cut by 60%
    INV.armor = full('leather').map(s => ({ ...s, e: { fire_protection: 4 } })); PL.fire = 0; PL.fireSeen = 0; setBlock(X, Y, Z, BID.fire); UI.paused = false; PL.inv = 100000; gameTick(); setBlock(X, Y, Z, 0); out.fire = PL.fire;
    PL.fire = 0; PL.fireSeen = 0; INV.armor = [null, null, null, null]; setBlock(X, Y, Z, BID.fire); gameTick(); setBlock(X, Y, Z, 0); out.fireBare = PL.fire; PL.fire = 0; PL.inv = 0;
    // blast protection IV: 60% less knockback from explosions
    INV.armor = full('leather').map(s => ({ ...s, e: { blast_protection: 4 } })); out.blastKb = +plBlastKb().toFixed(2);
    // unbreaking III on a chestplate: wear of 100 points comes to about 70 (0.6 + 0.4/4 each), not 0 or 100
    const tot = []; for (let k = 0; k < 4; k++) { INV.armor = [null, { id: IID.diamond_chestplate, n: 1, e: { unbreaking: 3 } }, null, null]; damageItem(INV.armor, 1, 100); tot.push(INV.armor[1].d || 0); } out.unbreak = tot;
    // thorns III on each piece: almost every hit sets one off (1 - 0.55^4); the mob is hurt, a thorns piece wears 2 more
    INV.armor = full('iron').map(s => ({ ...s, e: { thorns: 3 } })); const z = spawnMob('zombie', X + .5, Y, Z + 2); z.persistent = true; z.hp = 1000; let hurt = 0, extra = 0;
    for (let i = 0; i < 20; i++) { const d0 = INV.armor.reduce((a, s) => a + (s ? s.d || 0 : 0), 0), h0 = z.hp; z.inv = 0; hit(4, 'mob', z); if (z.hp < h0) hurt++; extra += INV.armor.reduce((a, s) => a + (s ? s.d || 0 : 0), 0) - d0 - 4; }
    out.thorns = [hurt, extra]; removeEnt(z);
    // right-click with a helmet in the hand puts it on (only into an empty slot)
    INV.armor = [null, null, null, null]; INV.slots[0] = { id: IID.iron_helmet, n: 1 }; INV.sel = 0; TARGET = null; useItem(true);
    out.equip = [INV.armor[0] && INV.armor[0].id === IID.iron_helmet, INV.slots[0] == null];
    INV.slots[0] = { id: IID.diamond_helmet, n: 1 }; useItem(true); out.noSwap = [INV.armor[0].id === IID.iron_helmet, !!INV.slots[0]];
    return out; });
  ok(Math.abs(r.diamond - 3) < 0.01 && Math.abs(r.iron - 6) < 0.01, 'armour points and toughness reduce a hit as in Java (diamond 10 → 3, iron 10 → 6)', [r.diamond, r.iron]);
  ok(r.fallBare === 10 && Math.abs(r.fallProt - 3.6) < 0.01 && Math.abs(r.fallFF - 2) < 0.01, 'protection counts once on a fall, feather falling adds 3 a level, capped at 80%', [r.fallBare, r.fallProt, r.fallFF]);
  ok(Math.abs(r.drownProt - 2 * 0.36) < 0.01, 'protection also softens drowning (Java)', r.drownProt);
  ok(r.fireBare >= 150 && r.fire <= 70 && r.fire > 50, 'fire protection IV makes the fire burn 60% shorter', [r.fire, r.fireBare]);
  ok(Math.abs(r.blastKb - 0.4) < 0.01, 'blast protection IV takes 60% off explosion knockback', r.blastKb);
  ok(r.unbreak.every(v => v > 50 && v < 90), 'unbreaking rolls for each point of wear (armour: 0.6 + 0.4/(level+1))', r.unbreak);
  ok(r.thorns[0] >= 14 && r.thorns[1] >= r.thorns[0] * 2 - 8, 'thorns III on every piece hurts the attacker on most hits, and the piece wears 2 more', r.thorns);
  ok(r.equip[0] && r.equip[1] && r.noSwap[0] && r.noSwap[1], 'right-clicking armour in the hand puts it on, only into an empty slot (1.18)', [r.equip, r.noSwap]);
};

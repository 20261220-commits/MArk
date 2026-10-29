// the End: the dragon and its crystals, the first fight's egg and gateway, the dragon's fireball, and summoning it again
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), go = async n => { for (let i = 0; i < n; i++) { UI.paused = false; await wait(50); } };
    switchDim(1, 100.5, 49, 0.5, 'end'); for (let i = 0; i < 400 && (UI.menu === 'loading' || W.dim !== 1); i++) await wait(100); showMenu(null); UI.paused = false;
    PL.x = 0.5; PL.z = 6.5; PL.y = S.END_PORTAL_Y + 2; PL.flying = true; await go(60);
    const dragon = () => ENT.find(e => e.type === 'ender_dragon' && !e.dead), crystals = () => ENT.filter(e => e.type === 'end_crystal' && !e.dead).length;
    o.dragon = !!dragon(); o.crystals = crystals();
    // a dragon fireball lands as a cloud of dragon's breath (no blast)
    const n0 = ENT.length, clouds = () => ENT.filter(e => e.kind === 'cloud' || e.type === 'cloud' || e.cloud).length, c0 = clouds();
    spawnFireball(PL.x + 3, PL.y + 3, PL.z, 0, -1, 0, dragon(), false, true); await go(40); o.cloud = clouds() > c0 || ENT.some(e => e.breath || (e.opts && e.opts.breath));
    // the first fight ends: egg, gateway, 12000 XP
    const d = dragon(); d.hp = 0; d.phase = 'dying'; d.phaseT = 0; let xp = 0; const sx = spawnXP; spawnXP = (x, y, z, n) => { if (Math.hypot(x - d.x, z - d.z) < 3) xp += n; return sx(x, y, z, n); }; // only the dragon's own orbs
    for (let i = 0; i < 260 && !W.meta.dragonKilled; i++) await go(1); spawnXP = sx;
    const Y = S.END_PORTAL_Y; o.first = { killed: W.meta.dragonKilled, egg: getBlock(0, Y + 4, 0) === BID.dragon_egg, gates: (W.meta.gateways || []).length, xp, portal: getBlock(1, Y, 1) === BID.end_portal };
    // summoning it again with four crystals on the portal's sides
    setBlock(0, Y + 4, 0, 0); for (const e of ENT) if (e.type === 'end_crystal') removeEnt(e);
    PL.mode = 'survival';
    for (const [x, z] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) { const bx = x, bz = z; INV.slots[INV.sel] = { id: IID.end_crystal, n: 1 }; setBlock(bx, Y, bz, BID.bedrock); placeEndCrystal({ x: bx, y: Y, z: bz, nx: 0, ny: 1, nz: 0 }); }
    await wait(3600); await go(20);
    o.again = { dragon: !!dragon(), crystals: crystals(), killed: W.meta.dragonKilled };
    const d2 = dragon(); if (d2) { d2.hp = 0; d2.phase = 'dying'; d2.phaseT = 0; xp = 0; spawnXP = (x, y, z, n) => { if (Math.hypot(x - d2.x, z - d2.z) < 3) xp += n; return sx(x, y, z, n); }; for (let i = 0; i < 260 && !W.meta.dragonKilled; i++) await go(1); spawnXP = sx; }
    o.second = { egg: getBlock(0, Y + 4, 0) === BID.dragon_egg, gates: (W.meta.gateways || []).length, xp };
    return o; });
  ok(r.dragon && r.crystals === 10, 'the End has its dragon and ten crystals on the pillars', r);
  ok(r.cloud, 'a dragon fireball leaves a cloud of dragon\'s breath', r.cloud);
  ok(r.first.killed && r.first.egg && r.first.gates === 1 && r.first.portal && r.first.xp === 12000, 'the first fight: exit portal, egg, a gateway, 12000 XP', r.first);
  ok(r.again.dragon && r.again.crystals >= 10 && !r.again.killed, 'four crystals on the portal summon the dragon again, with the pillars\' crystals back', r.again);
  ok(!r.second.egg && r.second.gates === 2 && r.second.xp === 500, 'later fights: no egg, another gateway, 500 XP', r.second);
  ok(!p.errs.length, 'no page errors', p.errs);
};

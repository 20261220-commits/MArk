// advancement triggers that used to be wrong, and the beacon / bastion ones
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms)); const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    for (let a = -12; a <= 12; a++) for (let c = -12; c <= 12; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let y = 0; y < 5; y++) setBlock(X + a, Y + y, Z + c, 0); }
    PL.x = X + .5; PL.y = Y; PL.z = Z + 2.5; PL.mode = 'survival';
    const use = (item, t) => { INV.slots[INV.sel] = item ? { id: IID[item], n: 4 } : null; TARGET = { type: 'block', ...t, id: getBlock(t.x, t.y, t.z), m: getMeta(t.x, t.y, t.z), t: 2 }; USE.placeCd = 0; useItem(true); };
    use('candle', { x: X, y: Y - 1, z: Z, nx: 0, ny: 1, nz: 0 }); use('candle', { x: X, y: Y, z: Z, nx: 0, ny: 1, nz: 0 }); o.candleWax = advDone('husbandry/wax_on');
    setBlock(X + 1, Y, Z, BID.copper_block); use('honeycomb', { x: X + 1, y: Y, z: Z, nx: 0, ny: 1, nz: 0 }); o.honeycombWax = advDone('husbandry/wax_on');
    const g = spawnMob('ghast', X + 1.5, Y + 3, Z); hurtMob(g, 999, PL, 0, 0, 'player'); o.uneasy = advDone('nether/uneasy_alliance'); o.sender = advDone('nether/return_to_sender');
    ADVT.spyglass({ type: 'ghast' }); o.spyGhast = advDone('adventure/spyglass_at_ghast');
    W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobLoot: false }; const z = spawnMob('husk', X - 1.5, Y, Z); hurtMob(z, 999, PL, 0, 0, 'player'); o.killNoLoot = (W.meta.adv2['adventure/kill_all_mobs'] || { c: {} }).c.husk != null; W.meta.gamerules.doMobLoot = true;
    // a beacon lit far away doesn't count; one lit next to you does
    const pyramid = (bx, bz) => { for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) setBlock(bx + a, Y, bz + c, BID.iron_block); setBlock(bx, Y + 1, bz, BID.beacon); setTile(bx, Y + 1, bz, { type: 'beacon' }); };
    PL.x = X + 0.5; PL.z = Z + 0.5; pyramid(X + 11, Z - 11); PL.x = X - 11; PL.z = Z + 11; for (let i = 0; i < 6; i++) { beaconTick(); await wait(50); } o.beaconFar = advDone('nether/create_beacon');
    PL.x = X - 6.5; PL.z = Z - 6.5; pyramid(X - 9, Z - 9); for (let i = 0; i < 6; i++) { beaconTick(); await wait(50); } o.beaconNear = advDone('nether/create_beacon');
    // a bastion's own loot chest, opened for the first time; a chest someone placed doesn't count
    setBlock(X + 3, Y, Z + 3, BID.chest); setTile(X + 3, Y, Z + 3, { type: 'chest', items: new Array(27).fill(null) }); UI.openScreen('chest', { x: X + 3, y: Y, z: Z + 3 }); UI.closeScreen(); o.lootPlaced = advDone('nether/loot_bastion');
    setBlock(X + 5, Y, Z + 3, BID.chest); setTile(X + 5, Y, Z + 3, { type: 'chest', items: new Array(27).fill(null), lt: 'bastion_treasure' }); UI.openScreen('chest', { x: X + 5, y: Y, z: Z + 3 }); UI.closeScreen(); o.lootBastion = advDone('nether/loot_bastion'); o.ltGone = getTile(X + 5, Y, Z + 3).lt === undefined;
    // 1.18: falling from the build limit to the bottom of the world, a jukebox in a meadow, a trade at the build limit; adventuring time takes the 1.18 biomes
    o.gen = W.gen; o.atHasMeadow = ADVM['adventure/adventuring_time'].crit.includes('meadow');
    const fx = X + 8, fz = Z + 8; for (let y = 318; y > -60; y--) { setBlock(fx, y, fz, 0); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) setBlock(fx + dx, y, fz + dz, BID.glass); } setBlock(fx, -61, fz, BID.water); setBlock(fx, -62, fz, BID.stone); setBlock(fx, -60, fz, 0);
    setBlock(fx, -60, fz, BID.hay_block); setBlock(fx, -61, fz, BID.stone);
    PL.mode = 'creative'; PL.x = fx + .5; PL.z = fz + .5; PL.y = 319.5; PL.vy = 0; PL.fallDist = 0; PL.onGround = false; PL.flying = false; PL.mode = 'survival'; PL.health = 20;
    const dmg0 = hurtPlayer; hurtPlayer = function () {}; for (let i = 0; i < 400 && !(PL.onGround && PL.y < -50); i++) { UI.paused = false; PL.x = fx + .5; PL.z = fz + .5; await wait(20); } hurtPlayer = dmg0; await wait(50);
    o.fellTo = PL.y; o.from = PL.fallFrom; o.caves = advDone('adventure/fall_from_world_height');
    const bm = biomeAt(X - 4, Z), ch = chunkAt((X - 4) >> 4, Z >> 4); ch.biome.fill(S.BIOK.meadow); setBlock(X - 4, Y, Z, BID.jukebox); use('music_disc_cat', { x: X - 4, y: Y, z: Z, nx: 0, ny: 1, nz: 0 }); o.meadow = advDone('adventure/play_jukebox_in_meadows'); ch.biome.fill(bm);
    o.ids = ['adventure/trade_at_world_height', 'adventure/fall_from_world_height', 'adventure/play_jukebox_in_meadows'].every(id => ADVM[id]);
    return o; });
  ok(!r.candleWax && r.honeycombWax, 'stacking candles is not "Wax On"; honeycomb on copper is', r);
  ok(r.uneasy && !r.sender, 'a ghast killed with a sword in the Overworld: "Uneasy Alliance" yes, "Return to Sender" no', r);
  ok(r.spyGhast, 'the spyglass advancements don\'t need the one before');
  ok(r.killNoLoot, 'kills count with doMobLoot off');
  ok(!r.beaconFar && r.beaconNear, 'a beacon counts for players near it when it lights up', r);
  ok(!r.lootPlaced && r.lootBastion && r.ltGone, 'only a bastion\'s own loot chest counts, once', r);
  ok(r.gen === 3 && r.atHasMeadow && r.ids, 'new worlds are 1.18 (gen 3) and have the 1.18 advancements', r);
  ok(r.fellTo < -55 && r.caves, '"Caves & Cliffs": from the build limit to the bottom of the world', r);
  ok(r.meadow, '"Sound of Music": a jukebox playing in a meadow', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

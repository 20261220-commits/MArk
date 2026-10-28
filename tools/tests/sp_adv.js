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
    return o; });
  ok(!r.candleWax && r.honeycombWax, 'stacking candles is not "Wax On"; honeycomb on copper is', r);
  ok(r.uneasy && !r.sender, 'a ghast killed with a sword in the Overworld: "Uneasy Alliance" yes, "Return to Sender" no', r);
  ok(r.spyGhast, 'the spyglass advancements don\'t need the one before');
  ok(r.killNoLoot, 'kills count with doMobLoot off');
  ok(!r.beaconFar && r.beaconNear, 'a beacon counts for players near it when it lights up', r);
  ok(!r.lootPlaced && r.lootBastion && r.ltGone, 'only a bastion\'s own loot chest counts, once', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

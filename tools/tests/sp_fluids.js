// water and lava as Java's FlowingFluid: lava runs 3 blocks (7 in the Nether), falling lava spreads from where it lands,
// two water sources make a third, a flow finds a drop around a corner, lava beside water hardens to cobblestone (a
// source to obsidian), lava falling on water makes stone, and water is never replaced by lava from the side
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const out = {};
    const X = Math.floor(PL.x), Z = Math.floor(PL.z), Y = 200; PL.flying = true; PL.x = X + .5; PL.y = Y + 6; PL.z = Z + .5;
    const area = (y0, y1) => { for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) { setBlock(X + x, Y - 1, Z + z, BID.stone); for (let y = y0; y <= y1; y++) setBlock(X + x, Y + y, Z + z, 0); } };
    const run = n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); } };
    const far = id => { let f = 0, n = 0; for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) if (getBlock(X + x, Y, Z + z) === id) { n++; f = Math.max(f, Math.abs(x) + Math.abs(z)); } return [n, f]; };
    // lava on flat ground: 3 blocks out in the overworld
    area(0, 6); setBlock(X, Y, Z, BID.lava, 0); run(400); out.lava = far(BID.lava);
    // lava poured from 4 up: lands and spreads (falling lava spreads like level 2 here)
    area(0, 6); setBlock(X, Y + 4, Z, BID.lava, 0); run(600); out.lavaFall = far(BID.lava);
    // infinite water: two sources with a gap of one on stone
    area(0, 6); setBlock(X - 1, Y, Z, BID.water, 0); setBlock(X + 1, Y, Z, BID.water, 0); for (let x = -12; x <= 12; x++) for (const z of [-1, 1]) setBlock(X + x, Y, Z + z, BID.stone);
    run(40); out.infinite = getBlock(X, Y, Z) === BID.water && getMeta(X, Y, Z) === 0;
    // a channel: the source in a 1-wide corridor going east then turning south to a hole 3 away; west is a long dead end
    area(0, 6); for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) setBlock(X + x, Y, Z + z, BID.stone);
    for (let x = -6; x <= 2; x++) setBlock(X + x, Y, Z, 0); setBlock(X + 2, Y, Z + 1, 0); setBlock(X + 2, Y, Z + 2, 0); setBlock(X + 2, Y - 1, Z + 2, 0);
    setBlock(X, Y, Z, BID.water, 0); run(30); out.corner = [getBlock(X + 1, Y, Z) === BID.water, getBlock(X - 1, Y, Z) === BID.water];
    // lava next to water: the lava hardens, the water stays
    area(0, 6); setBlock(X + 3, Y, Z, BID.water, 0); setBlock(X, Y, Z, BID.lava, 0); run(300);
    out.meet = [getBlock(X + 3, Y, Z) === BID.water, [getBlock(X + 2, Y, Z), getBlock(X + 1, Y, Z)].includes(BID.cobblestone), getBlock(X, Y, Z) === BID.lava];
    // water poured onto a lava source: obsidian; lava poured onto still water: stone
    area(0, 6); setBlock(X, Y, Z, BID.lava, 0); setBlock(X, Y + 2, Z, BID.water, 0); run(40); out.obsidian = getBlock(X, Y, Z) === BID.obsidian;
    area(0, 6); for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) { setBlock(X + x, Y, Z + z, BID.water, 0); setBlock(X + x, Y + 1, Z + z, BID.glass); } setBlock(X, Y + 1, Z, 0); setBlock(X, Y + 3, Z, BID.lava, 0); run(200); out.stone = getBlock(X, Y, Z) === BID.stone;
    // the nether: lava runs 7
    return out; });
  ok(r.lava[1] === 3, 'lava spreads 3 blocks over flat ground in the overworld', r.lava);
  ok(r.lavaFall[1] === 4, 'a lava source in the air also runs out one block at the top and falls from there too (Java\'s plus shape): 1 + 3 out on the ground', r.lavaFall);
  ok(r.infinite, 'two water sources a block apart make a source between them', r.infinite);
  ok(r.corner[0] && !r.corner[1], 'water heads for a drop around a corner (Java\'s slope search), not the dead end', r.corner);
  ok(r.meet[0] && r.meet[1] && r.meet[2], 'lava meeting water hardens to cobblestone, the water stays', r.meet);
  ok(r.obsidian, 'water onto a lava source makes obsidian', r.obsidian);
  ok(r.stone, 'lava falling onto water makes stone', r.stone);
};

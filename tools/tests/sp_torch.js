// Torches placed as in Java: against the face clicked; under a block's bottom, on the floor or a wall the player looks
// toward; on glass and leaves' sides and on fences; and a wall torch leans out from the wall with its foot against it
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z), o = {};
    const room = () => { for (let a = -6; a <= 6; a++) for (let c = -6; c <= 6; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 5; k++) setBlock(X + a, Y + k, Z + c, 0); } };
    const place = (tx, ty, tz, nx, ny, nz, yaw = 0, pitch = 0) => { PL.yaw = yaw; PL.pitch = pitch; INV.slots[INV.sel] = { id: IID.torch, n: 1 }; const t = { type: 'block', x: tx, y: ty, z: tz, id: getBlock(tx, ty, tz), m: getMeta(tx, ty, tz), nx, ny, nz }; TARGET = t; const rc = raycast; raycast = () => t; USE.placeCd = 0; try { useItem(true); } finally { raycast = rc; } };
    const at = (x, y, z) => getBlock(x, y, z) === BID.torch ? getMeta(x, y, z) : getBlock(x, y, z) === BID.wall_torch ? 'w' + getMeta(x, y, z) : 'none';
    room(); setBlock(X, Y, Z, BID.stone); setBlock(X, Y + 1, Z, BID.stone);
    o.walls = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([nx, nz]) => { place(X, Y + 1, Z, nx, 0, nz); return at(X + nx, Y + 1, Z + nz); });
    // the wall stays: break it and the torch drops
    // glass side, fence top
    room(); setBlock(X, Y + 1, Z, BID.glass); place(X, Y + 1, Z, 1, 0, 0); o.glass = at(X + 1, Y + 1, Z);
    setBlock(X - 3, Y, Z, BID.oak_fence); place(X - 3, Y, Z, 0, 1, 0); o.fence = at(X - 3, Y + 1, Z);
    // the bottom face of a block overhead, looking north at a wall: on that wall; looking down: on the floor
    room(); setBlock(X, Y + 2, Z, BID.stone); setBlock(X, Y + 1, Z - 1, BID.stone);
    place(X, Y + 2, Z, 0, -1, 0, 0, 0.2); o.under = at(X, Y + 1, Z);
    room(); setBlock(X, Y + 1, Z, BID.stone); place(X, Y + 1, Z, 0, -1, 0, 0, -1.2); o.underFloor = at(X, Y, Z);
    // grass replaced: by where the player looks (down: standing)
    room(); setBlock(X, Y, Z, BID.grass); setBlock(X, Y, Z - 1, BID.stone); place(X, Y, Z, 1, 0, 0, 0, -1.3); o.grass = at(X, Y, Z);
    // the mesh of a wall torch: its foot against the wall, its top leaning out
    room(); setBlock(X, Y + 1, Z, BID.stone); place(X, Y + 1, Z, 1, 0, 0);
    const c = chunkAt((X + 1) >> 4, Z >> 4), meta = getMeta(X + 1, Y + 1, Z); o.meta = meta;
    return o; });
  console.log(JSON.stringify(r));
  ok(JSON.stringify(r.walls) === JSON.stringify([3, 4, 1, 2]), 'against each side of a block: a wall torch facing away from it', r.walls);
  ok(r.glass === 4 && r.fence === 0, 'on glass\'s side and on a fence', [r.glass, r.fence]);
  ok(r.under === 1 && r.underFloor === 0, 'clicking a block\'s bottom: on the wall looked at, or the floor looking down', [r.under, r.underFloor]);
  ok(r.grass === 0, 'in place of grass, looking down: standing on the floor', r.grass);
  ok(!p.errs.length, 'no page errors', p.errs);
  await p.evaluate(() => { const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); PL.x = X + 3.5; PL.z = Z + 0.5; PL.y = Y; PL.yaw = Math.PI / 2; PL.pitch = -0.25; });
  await p.waitForTimeout(2500); await p.screenshot({ path: '/tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/torch3.png' });
  await p.evaluate(() => { PL.yaw = Math.PI * 0.75; PL.z += 3; PL.x -= 0.5; }); await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/torch4.png' });
};

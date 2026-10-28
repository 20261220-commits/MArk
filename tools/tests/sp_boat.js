// placing boats as in Java: on still or flowing water they float on the surface (never on the bottom), on the ground at
// the point looked at, and not where the boat would be inside a block (a wall's side, under a low ceiling)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival', '777');
  const r = await p.evaluate(async () => {
    const X = Math.floor(PL.x), Z = Math.floor(PL.z), Y = 200, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    // a stone pad: still water to the north (z < 0), ground to the south; a 2-deep pool with flowing water to the east
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) { setBlock(X + x, Y - 3, Z + z, BID.stone); setBlock(X + x, Y - 2, Z + z, z < 0 ? BID.water : BID.stone); setBlock(X + x, Y - 1, Z + z, z < 0 ? BID.water : BID.stone); for (let y = 0; y < 4; y++) setBlock(X + x, Y + y, Z + z, 0); }
    for (let x = 3; x <= 8; x++) for (let z = 0; z <= 3; z++) { setBlock(X + x, Y - 1, Z + z, BID.water, 3); setBlock(X + x, Y - 2, Z + z, BID.water, 8); }
    const tryAt = async (name, yaw, pitch, pos) => {
      for (const e of ENT) if (e.kind === 'boat') removeEnt(e);
      PL.x = pos[0]; PL.y = pos[1]; PL.z = pos[2]; PL.yaw = yaw; PL.pitch = pitch; PL.vx = PL.vy = PL.vz = 0;
      INV.slots[INV.sel] = { id: IID.oak_boat, n: 1 }; UI.paused = false; await wait(150); interactTick(); USE.placeCd = 0; useItem(true); await wait(2000);
      const bt = ENT.find(e => e.kind === 'boat' && !e.dead);
      out[name] = { placed: !!bt, left: INV.slots[INV.sel] ? INV.slots[INV.sel].n : 0, y: bt ? +bt.y.toFixed(2) : null, x: bt ? +bt.x.toFixed(2) : null, z: bt ? +bt.z.toFixed(2) : null, yaw: bt ? +bt.yaw.toFixed(2) : null };
    };
    await tryAt('still', 0, -0.6, [X + .5, Y, Z + 1.5]);
    await tryAt('flowing', -Math.PI / 2, -0.7, [X + 1.5, Y, Z + 1.5]);
    await tryAt('ground', Math.PI, -0.6, [X + .5, Y, Z + 1.5]);
    setBlock(X, Y, Z + 4, BID.stone); setBlock(X, Y + 1, Z + 4, BID.stone);
    await tryAt('wall side', Math.PI, 0, [X + .5, Y, Z + 1.5]);
    for (let x = -2; x <= 2; x++) for (let z = 5; z <= 8; z++) setBlock(X + x, Y, Z + z, BID.stone);
    await tryAt('under a ceiling', Math.PI, -0.5, [X + .5, Y + 1, Z + 3.5]);
    return { out, Y, X, Z };
  });
  const o = r.out;
  ok(o.still.placed && o.still.y > r.Y - 0.3, 'on still water the boat floats on the surface', o.still);
  ok(o.flowing.placed && o.flowing.y > r.Y - 0.7,  'on flowing water too, not on the bottom', o.flowing);
  ok(o.ground.placed && o.ground.y === r.Y && Math.abs(o.ground.yaw - Math.PI) < 0.01, 'on the ground at the point looked at, facing the player\'s way', o.ground);
  ok(o.ground.z !== +(r.Z + 2.5).toFixed(2) || o.ground.x !== +(r.X + .5).toFixed(2), 'where the look meets the ground, not the block\'s centre', o.ground);
  ok(!o['wall side'].placed && o['wall side'].left === 1, 'not into a wall, and the boat stays in hand', o['wall side']);
  ok(!o['under a ceiling'].placed, 'not where it would be inside a block', o['under a ceiling']);
  ok(!p.errs.length, 'no page errors', p.errs);
};

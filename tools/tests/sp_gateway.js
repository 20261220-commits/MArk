// End gateways as Java builds them (bedrock in a plus above and below, one more at each end) with their beam; the End
// portal drawn as Java's starfield
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const S2 = '/tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/';
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    switchDim(1, 100.5, 49, 0.5, 'end'); for (let i = 0; i < 400 && (UI.menu === 'loading' || W.dim !== 1); i++) await wait(100); showMenu(null); UI.paused = false;
    const gx = 40, gy = 75, gz = 40; PL.x = gx + 0.5; PL.z = gz + 9.5; PL.y = gy - 1; PL.flying = true; PL.yaw = 0; PL.pitch = 0.1;
    for (let i = 0; i < 30; i++) { W.pump(); await wait(50); }
    buildGateway(gx, gy, gz);
    const B = (dx, dy, dz) => getBlock(gx + dx, gy + dy, gz + dz), BR = BID.bedrock;
    o.shape = { gate: B(0, 0, 0) === BID.end_portal && (getMeta(gx, gy, gz) & 1) === 1, plusUp: [B(0, 1, 0), B(1, 1, 0), B(-1, 1, 0), B(0, 1, 1), B(0, 1, -1)].every(b => b === BR), plusDown: [B(0, -1, 0), B(1, -1, 0), B(-1, -1, 0), B(0, -1, 1), B(0, -1, -1)].every(b => b === BR),
      ends: B(0, 2, 0) === BR && B(0, -2, 0) === BR, corners: [B(1, 1, 1), B(-1, -1, -1), B(1, 2, 0), B(1, 0, 0)].every(b => b !== BR) };
    for (let i = 0; i < 40; i++) { W.tickN++; gatewayRender(); } const g = GW.get(gx + ',' + gy + ',' + gz); o.beam = g && g.mesh ? { vis: g.mesh.visible, h: g.mesh.scale.y } : null;
    for (let i = 0; i < 200; i++) { W.tickN++; } gatewayRender(); o.later = g && g.mesh ? g.mesh.visible : false;
    // an End portal beside it, for the picture
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) setBlock(gx - 4 + dx, gy - 2, gz + 4 + dz, BID.end_portal, 0, { noUpdate: true });
    g.spawn = W.tickN - 60;
    return o; });
  console.log(JSON.stringify(r));
  ok(r.shape.gate && r.shape.plusUp && r.shape.plusDown && r.shape.ends && r.shape.corners, 'the gateway as Java builds it: bedrock plus above and below, one more at each end', r.shape);
  ok(r.beam && r.beam.vis && r.beam.h > 100, 'a magenta beam when it appears', r.beam);
  ok(r.later === false, 'and gone again after 10 seconds (until it is used, or 2 minutes go by)', r.later);
  await p.waitForTimeout(2500); await p.screenshot({ path: S2 + 'gate1.png' });
  await p.evaluate(() => { PL.pitch = -0.6; PL.z -= 3; PL.x -= 3; PL.y += 2; }); await p.waitForTimeout(1500); await p.screenshot({ path: S2 + 'gate2.png' });
  ok(!p.errs.length, 'no page errors (the portal shader compiles)', p.errs);
};

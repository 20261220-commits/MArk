// monsters as Java: zombies and skeletons sink in water (no float) and a zombie under water turns drowned; the sun sets
// fire only out of the water and rain, by chance each tick, babies too; peaceful clears monsters; a baby zombie's head
// is bigger than half
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => { const out = {};
    const X = Math.floor(PL.x) + 30, Z = Math.floor(PL.z), Y = 150; PL.mode = 'creative';
    for (let a = -6; a <= 6; a++) for (let c = -6; c <= 6; c++) setBlock(X + a, Y - 1, Z + c, BID.stone);
    for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, Math.abs(a) === 3 || Math.abs(c) === 3 ? BID.glass : BID.water); // (a walled pool)
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e); W.time = 6000; W.rain = 0; PL.difficulty = 2; UI.paused = false;
    const tick = n => { for (let i = 0; i < n; i++) { for (const e of [...ENT]) if (e.kind === 'mob' && !e.dead && e.tick) {} gameTick(); } };
    // sinking
    const z = spawnMob('zombie', X + .5, Y + 3.2, Z + .5); z.persistent = true; tick(60); out.sink = +(z.y - Y).toFixed(2);
    // the conversion (sped up: the 30 s already spent)
    z.convIn = 599; tick(2); out.shaking = z.convT > 0; z.convT = 1; tick(2); out.drowned = ENT.some(e => e.type === 'drowned' && !e.dead && Math.abs(e.x - X - .5) < 3) && z.dead;
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e);
    // the sun: a zombie on dry land catches fire within seconds; one standing in the water never
    const dry = spawnMob('zombie', X + 4.5, Y, Z + .5), inw = spawnMob('zombie', X + .5, Y + 0.5, Z + .5), baby = spawnMob('zombie', X - 4.5, Y, Z + .5);
    baby.baby = 1e12; baby.mesh.scale.setScalar(0.5); babyLook(baby, true); out.head = +baby.mesh.userData.parts.head.scale.x.toFixed(2);
    for (const e of [dry, inw, baby]) { e.persistent = true; e.goal = null; }
    let litW = 0, firstDry = -1, firstBaby = -1; for (let i = 0; i < 400; i++) { dry.x = X + 4.5; dry.z = Z + .5; inw.x = X + .5; inw.z = Z + .5; inw.y = Math.max(inw.y, Y); baby.x = X - 4.5; baby.z = Z + .5; tick(1); if (inw.fire > 0) litW++; if (firstDry < 0 && dry.fire > 0) firstDry = i; if (firstBaby < 0 && baby.fire > 0) firstBaby = i; }
    out.fire = { firstDry, firstBaby, litW, dbg: [getLight(Math.floor(dry.x), Math.floor(dry.y + dry.h * 0.85), Math.floor(dry.z)) >> 4, topY(Math.floor(dry.x), Math.floor(dry.z)), dry.y, W.rain, skyDarken(), dry.dead, ENT.includes(dry), dry.def.burn] };
    // peaceful
    PL.difficulty = 0; const k = spawnMob('skeleton', X + 3.5, Y, Z + 3.5); tick(2); out.peaceful = k.dead; PL.difficulty = 2;
    return out; });
  ok(r.sink < 1, 'a zombie in deep water sinks to the bottom (no floating)', r.sink);
  ok(r.shaking && r.drowned, 'a zombie with its eyes under water for 30 s shakes, then turns drowned', r);
  ok(r.fire.firstDry > 0 && r.fire.litW === 0, 'a zombie in the sun catches fire after a moment, never while standing in water', r.fire);
  ok(r.fire.firstBaby >= 0, 'baby zombies burn too (Java)', r.fire);
  ok(r.peaceful, 'peaceful clears monsters', r.peaceful);
  ok(Math.abs(r.head - 1.5) < 0.01, "a baby zombie's head is drawn at 3/4 of an adult's (twice its half-size body's scale)", r.head);
};

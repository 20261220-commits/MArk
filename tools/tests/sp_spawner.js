// a monster spawner as Java's BaseSpawner: first spawn about a second after a player comes within 16 blocks, then a wait
// of 200-799 ticks after each spawn; up to 4 at a time within 4 blocks (no floor needed), never more than 6 of its kind
// around it; nothing with no player in 16; a zombie spawner stops in torchlight, a blaze spawner doesn't; when nothing
// fits it keeps trying every tick instead of waiting a whole delay
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const out = {};
    const X = Math.floor(PL.x), Y = 120, Z = Math.floor(PL.z);
    const room = (lit) => { for (let a = -7; a <= 7; a++) for (let c = -7; c <= 7; c++) for (let k = -2; k <= 7; k++) setBlock(X + a, Y + k, Z + c, (Math.abs(a) === 7 || Math.abs(c) === 7 || k === -2 || k === 7) ? BID.stone : 0);
      setBlock(X, Y, Z, BID.spawner); if (lit) setBlock(X + 2, Y, Z, BID.torch); };
    const reset = (mob, lit) => { W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobSpawning: false }; for (const e of [...ENT]) if (e !== PL) removeEnt(e); room(lit); setTile(X, Y, Z, { type: 'spawner', mob, delay: 20 }); W.time = 6000; PL.difficulty = 2; PL.mode = 'creative'; PL.x = X + 5.5; PL.y = Y - 1; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0; UI.paused = false; };
    const run = async (n, f) => { for (let i = 0; i < n; i++) { UI.paused = false; PL.x = X + 5.5; PL.y = Y - 1; PL.z = Z + .5; PL.vy = 0; if (f) f(i); gameTick(); if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); } };
    const kind = t => ENT.filter(e => e.kind === 'mob' && !e.dead && e.type === t && e.fromSpawner);
    // timing and cap: the spawned ones are taken away at once so the cap never stops it
    reset('zombie', false); const times = []; let firstSpawn = -1;
    await run(2600, i => { const z = kind('zombie'); if (z.length) { if (firstSpawn < 0) firstSpawn = i; times.push(i); for (const e of z) removeEnt(e); } });
    const waves = times.filter((t, k) => k === 0 || t - times[k - 1] > 1), gaps = waves.slice(1).map((t, k) => t - waves[k]);
    out.first = firstSpawn; out.gaps = gaps; out.waves = waves.length;
    // the cap: left alone (made to stand still), at most 6
    reset("zombie", false); await run(1400, () => { for (const e of kind('zombie')) { e.persistent = true; e.def = { ...e.def, ai: () => {} }; } }); out.cap = kind('zombie').length;
    // nobody near: nothing
    reset('zombie', false); for (let i = 0; i < 300; i++) { PL.x = X + 40.5; PL.z = Z + .5; UI.paused = false; gameTick(); } out.away = kind('zombie').length;
    // torchlight: no zombies; a blaze spawner still works
    reset("zombie", true); await run(500); out.lit = kind('zombie').length;
    reset("blaze", true); await run(500); out.blazeLit = kind('blaze').length;
    // no room on the floor (a slab of stone at y-1..y+1 except the air above the spawner block): it spawns where it fits, mid-air too
    reset('zombie', false); for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) for (let k = -1; k <= 1; k++) if (a || c) setBlock(X + a, Y + k, Z + c, BID.stone);
    for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) setBlock(X + a, Y + 2, Z + c, 0);
    const t0 = W.tickN; let tries = -1; await run(200, i => { if (tries < 0 && kind('zombie').length) tries = i; }); out.cramped = tries;
    return out; });
  console.log(JSON.stringify(r));
  ok(r.first >= 18 && r.first <= 25, 'the first spawn about a second after a player comes near (20 ticks)', r.first);
  ok(r.gaps.length >= 2 && r.gaps.every(g => g >= 199 && g <= 801), 'then 200-799 ticks between spawns', r.gaps);
  ok(r.cap === 6, 'never more than 6 of its kind around it', r.cap);
  ok(r.away === 0, 'nothing with no player within 16 blocks', r.away);
  ok(r.lit === 0 && r.blazeLit > 0, 'a zombie spawner stops in torchlight, a blaze spawner does not', [r.lit, r.blazeLit]);
  ok(r.cramped >= 0 && r.cramped < 120, 'with the floor taken it keeps trying and spawns where there is room', r.cramped);
};

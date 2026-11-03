// sneaking at an edge (also on a one-block pillar, and when you let go of the keys), boats as Java steers them, arrows'
// hit boxes and critical shots, mobs that don't wander off ledges or into lava, and commands with Java's syntax
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => {
    const o = {}, X = Math.floor(PL.x), Y = 170, Z = Math.floor(PL.z), tick = n => { for (let i = 0; i < n; i++) gameTick(); };
    W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobSpawning: false }; W.time = 6000;
    const clear = () => { for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) for (let k = -13; k < 8; k++) setBlock(X + a, Y + k, Z + c, 0); for (const e of [...ENT]) if (e.kind === 'mob' || e.kind === 'item' || e.kind === 'boat' || e.kind === 'arrow') removeEnt(e); };
    // sneaking off a one-block pillar, then letting go of both keys at once
    clear(); setBlock(X, Y - 1, Z, BID.stone); PL.mode = 'survival'; PL.flying = false;
    o.sneak = [];
    for (const yaw of [0, Math.PI / 4, -Math.PI / 2]) { PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0; PL.yaw = yaw; IN.sneak = true; IN.f = 1; tick(40); IN.sneak = false; IN.f = 0; tick(20); o.sneak.push(+(PL.y - Y).toFixed(2)); }
    // boats
    clear(); for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) { setBlock(X + a, Y - 2, Z + c, BID.stone); setBlock(X + a, Y - 1, Z + c, BID.water); }
    const bt = placeBoat(X + .5, Y - 0.4, Z + .5, 0, 'oak'); tick(5); mount(bt); const y0 = bt.yaw, p0 = PL.yaw; IN.s = 1; tick(20); IN.s = 0;
    o.boatTurn = [+((bt.yaw - y0) * 180 / Math.PI).toFixed(0), +(((PL.yaw - p0) - (bt.yaw - y0)) * 180 / Math.PI).toFixed(1)];
    IN.f = 1; tick(80); o.boatSpeed = +(Math.hypot(bt.vx, bt.vz) * 20).toFixed(1); o.seat = +(PL.y - bt.y).toFixed(2); o.paddles = !!(bt.mesh.userData.parts && bt.mesh.userData.parts.lpaddle) || !packTexture('boat'); IN.f = 0; IN.sneak = true; tick(1); IN.sneak = false;
    INV.slots[INV.sel] = null; const b2 = placeBoat(X + 3.5, Y - 0.4, Z + 3.5, 0, 'oak'); let n = 0; while (!b2.dead && n < 20) { boatHit(b2); n++; } o.fistHits = n;
    // arrows
    clear(); for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) setBlock(X + a, Y - 1, Z + c, BID.stone); PL.x = X + .5; PL.y = Y; PL.z = Z + .5;
    const shoot = off => { const c = spawnMob('cow', X + .5, Y, Z - 7.5); c.ai = null; c.hp = 1000; const a = shootArrow(X + .5 + off, Y + 0.9, Z - 1, 0, 0.04, -2.5, PL, 2); tick(20); const hit = c.hp < 1000; removeEnt(c); if (!a.dead) removeEnt(a); return hit; };
    o.arrow = [shoot(0.7), shoot(1.0)];
    const ds = new Set(); for (let i = 0; i < 40; i++) { const c = spawnMob('cow', X + .5, Y, Z - 5.5); c.ai = null; c.hp = 1000; const a = shootArrow(X + .5, Y + 0.9, Z - 1, 0, 0.02, -3, PL, 2); a.crit = true; tick(5); ds.add(1000 - c.hp); removeEnt(c); if (!a.dead) removeEnt(a); }
    o.crit = [Math.min(...ds), Math.max(...ds)];
    // mobs on a small platform in the air stay on it
    clear(); PL.mode = 'creative'; PL.flying = true; PL.y = Y + 20; for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) setBlock(X + a, Y - 1, Z + c, BID.stone);
    const ms = ['cow', 'pig', 'sheep', 'chicken', 'cat', 'panda', 'polar_bear', 'llama', 'horse'].filter(t => MOBDEF[t]).map((t, i) => { const e = spawnMob(t, X - 2 + (i % 5), Y, Z - 1 + Math.floor(i / 5) * 2); e.persistent = true; return e; });
    tick(1500); o.platform = ms.map(e => e.dead ? 'dead' : +(e.y - Y).toFixed(1));
    // a burning mob shows Java's fire drawn over it
    { const zb = spawnMob('pig', X + 2.5, Y, Z + 2.5); zb.fire = 100; zb.ai = null; entityRender(1, performance.now()); o.fireOvl = !!(zb.fireOvl && zb.fireOvl.visible); zb.fire = 0; entityRender(1, performance.now()); o.fireOff = !zb.fireOvl.visible; removeEnt(zb); }
    // commands
    clear(); for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) setBlock(X + a, Y - 1, Z + c, BID.stone); PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.yaw = 0; PL.pitch = 0; PL.flying = false;
    const R = s => runCommand(s);
    o.cmd = {};
    R('give @p minecraft:diamond 70'); o.cmd.give = INV.count(IID.diamond);
    R('clear @s diamond 5'); o.cmd.clear = INV.count(IID.diamond);
    R(`tp @s ${X} ${Y + 3} ${Z}`); o.cmd.tp = [+(PL.x - X).toFixed(2), +(PL.y - Y).toFixed(2)];
    R('tp ~ ~-3 ~2'); R('tp ^ ^ ^3'); o.cmd.rel = +(PL.z - Z).toFixed(2);
    R(`tp @s ${X} ${Y} ${Z} 90 0`); o.cmd.yaw90 = [+(-Math.sin(PL.yaw)).toFixed(2), +(-Math.cos(PL.yaw)).toFixed(2)]; // facing west
    R('summon zombie ~2 ~ ~ {NoAI:1b}'); R('summon pig ~-2 ~ ~'); o.cmd.summon = ENT.filter(e => e.type === 'zombie' && !e.dead).length;
    R('kill @e[type=zombie]'); o.cmd.kill = ENT.filter(e => e.type === 'zombie' && !e.dead).length;
    R('effect give @e[type=pig,limit=1,sort=nearest] speed 10 1'); o.cmd.effect = ENT.some(e => e.type === 'pig' && e.eff && e.eff.speed);
    R('setblock ~1 ~ ~ oak_stairs[facing=east]'); o.cmd.stair = getBlock(X + 1, Y, Z) === BID.oak_stairs;
    R('fill ~-2 ~ ~-2 ~2 ~2 ~2 glass hollow'); o.cmd.hollow = [getBlock(X - 2, Y + 1, Z) === BID.glass, getBlock(X, Y + 1, Z)];
    R('fill ~-2 ~ ~-2 ~2 ~2 ~2 air replace glass'); o.cmd.replace = getBlock(X - 2, Y + 1, Z);
    R('xp set @s 0 levels'); R('xp add @s 5 levels'); o.cmd.xp = PL.level;
    R('time set noon'); o.cmd.time = ((W.time % 24000) + 24000) % 24000;
    INV.slots[INV.sel] = { id: IID.iron_sword, n: 1 }; R('enchant @s sharpness 5'); o.cmd.ench = INV.slots[INV.sel].e && INV.slots[INV.sel].e.sharpness;
    R('gamemode survival @s'); o.cmd.mode = PL.mode; R('gamemode creative');
    return o;
  });
  ok(r.sneak.every(v => v === 0), 'sneaking off a one-block pillar (straight, slanted, sideways) and letting go: no fall', r.sneak);
  ok(r.boatTurn[0] < -60 && Math.abs(r.boatTurn[1]) < 1 && r.boatSpeed > 6 && r.boatSpeed < 8.5, 'a boat turns as in Java and the view turns with it; ~7 m/s on water', [r.boatTurn, r.boatSpeed]);
  ok(r.fistHits === 5, 'a boat breaks after five punches', r.fistHits);
  ok(r.seat === -0.45 && r.paddles, 'the driver sits in the boat as in Java (0.45 below it); the boat has paddles', [r.seat, r.paddles]);
  ok(r.fireOvl && r.fireOff, 'a burning mob shows the fire drawn over it, gone when it stops burning', [r.fireOvl, r.fireOff]);
  ok(r.arrow[0] && !r.arrow[1] && r.crit[0] >= 6 && r.crit[1] <= 10 && r.crit[1] > 6, 'arrows: a target\'s box grows 0.3; a critical arrow does 6-10', [r.arrow, r.crit]);
  ok(r.platform.every(v => v === 0), 'animals (and mobs with their own AI: cats, pandas, polar bears, llamas, horses) don\'t wander off a platform in the air', r.platform);
  const c = r.cmd;
  ok(c.give === 70 && c.clear === 65 && c.tp[0] === 0.5 && c.tp[1] === 3 && c.rel === -0.5, '/give, /clear, /tp with ~ and ^', c);
  ok(c.yaw90[0] === -1 && c.summon === 1 && c.kill === 0 && c.effect && c.stair, '/tp yaw (90 = west), /summon, /kill @e[type=..], /effect on @e[..], /setblock with a block state', c);
  ok(c.hollow[0] && c.hollow[1] === 0 && c.replace === 0 && c.xp === 5 && c.time === 6000 && c.ench === 5 && c.mode === 'survival', '/fill hollow and replace, /xp, /time, /enchant, /gamemode with a target', c);
  ok(!p.errs.length, 'no page errors', p.errs);
};

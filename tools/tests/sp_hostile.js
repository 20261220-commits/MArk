// hostile mobs hit as hard as Java's on Normal: skeleton arrows 3-4, magma cubes 3 / 4 / 6 by size, a piglin's golden sword 8; the half
// of piglins holding a crossbow keep their distance and shoot it (they used to walk up and punch), and keep it
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); W.time = 18000; PL.difficulty = 2;
    const pad = () => { for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 6; k++) setBlock(X + a, Y + k, Z + c, 0); } };
    const hold = () => { PL.x = X + .5; PL.z = Z + .5; if (PL.y < Y) PL.y = Y; PL.vx = PL.vz = 0; PL.dead = false; };
    const fight = async (t, opts, n = 200) => { pad(); for (const e of [...ENT]) if (e !== PL) removeEnt(e); PL.health = 20; PL.eff = {}; PL.fire = 0; hold(); PL.y = Y; await wait(50);
      const e = spawnMob(t, X + .5, Y, Z - 6.5, opts); e.persistent = true; if (t === 'piglin') { e.xbow = opts.xbow; hurtMob(e, 0.01, PL); }
      const dmg = []; let arrows = 0, minD = 99; const seen = new Set();
      for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); if (PL.health < 20) dmg.push(+(20 - PL.health).toFixed(1)); PL.health = 20; hold(); minD = Math.min(minD, Math.hypot(e.x - PL.x, e.z - PL.z));
        for (const a of ENT) if (a.kind === 'arrow' && a.owner === e && !seen.has(a)) { seen.add(a); arrows++; } if (i % 6 === 0) await wait(1); }
      return { dmg: [...new Set(dmg)], arrows, minD: +minD.toFixed(1), xbow: e.xbow, saved: e.def.save ? e.def.save(e) : null }; };
    o.magma = {}; for (const s of [1, 2, 4]) o.magma[s] = (await fight('magma_cube', { size: s })).dmg;
    o.skel = (await fight('skeleton', {}, 260)).dmg;
    o.sword = await fight('piglin', { xbow: 2 }); o.xbow = await fight('piglin', { xbow: 1 }, 260);
    return o; });
  ok(r.magma[1].includes(3) && r.magma[2].includes(4) && r.magma[4].includes(6) && !r.magma[4].includes(9), 'magma cubes hit for 3, 4 and 6 by size', r.magma);
  ok(r.skel.length && Math.max(...r.skel) >= 3 && Math.max(...r.skel) <= 5, 'a skeleton\'s arrow hits for 3-4 on Normal (was always 2)', r.skel);
  ok(r.sword.dmg.includes(8) && r.sword.arrows === 0, 'a piglin with a golden sword hits for 8', r.sword);
  ok(r.xbow.arrows >= 2 && r.xbow.minD > 3, 'a piglin with a crossbow keeps its distance and shoots', r.xbow);
  ok(r.xbow.saved && r.xbow.saved.xbow === 1, 'and its weapon is kept in the save', r.xbow.saved);
  ok(!p.errs.length, 'no page errors', p.errs);
};

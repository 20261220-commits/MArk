// weapon enchantments working in play: multishot (three arrows, one used, 3 durability), piercing (through a row of
// mobs, hurting each), quick charge (faster loading), infinity (no arrow used), flame (sets on fire), punch and
// knockback (further back), fire aspect, loyalty (the trident comes back), impaling (more against water mobs)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); W.time = 6000;
    for (let a = -16; a <= 16; a++) for (let c = -24; c <= 8; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 6; k++) setBlock(X + a, Y + k, Z + c, 0); }
    await wait(200); const clear = () => { for (const e of [...ENT]) if (e !== PL) removeEnt(e); };
    let hold = () => { PL.x = X + .5; PL.z = Z + .5; PL.y = Y; PL.vx = PL.vz = 0; PL.yaw = 0; PL.pitch = -0.02; PL.health = 20; };
    const run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); hold(); if (i % 4 === 0) await wait(2); } };
    const dummy = (t, x, z) => { const m = spawnMob(t, X + .5 + x, Y, Z + .5 + z); m.persistent = true; m.def = { ...m.def, ai: e => walkPhysics(e, 0, 0, 0), hostile: 0 }; m.hp = m.def.hp = 40; return m; };
    clear(); hold(); PL.mode = 'survival';
    // multishot
    INV.slots[INV.sel] = { id: IID.crossbow, n: 1, e: { multishot: 1 } }; INV.slots[1] = { id: IID.arrow, n: 10 }; const xb = INV.slots[INV.sel];
    USE.kind = 'crossbow'; USE.t = 30; crossbowRelease(xb); USE.kind = null; const n0 = ENT.filter(e => e.kind === 'arrow').length; crossbowFire(xb);
    const arr = ENT.filter(e => e.kind === 'arrow'); o.multi = { arrows: arr.length - n0, left: INV.slots[1].n, dur: xb.d || 0, spread: +(Math.max(...arr.map(a => Math.atan2(a.vx, -a.vz))) - Math.min(...arr.map(a => Math.atan2(a.vx, -a.vz)))).toFixed(2) };
    // piercing IV through three zombies in a row
    clear(); const row = [-4, -6, -8].map(z => dummy('zombie', 0, z)); INV.slots[INV.sel] = { id: IID.crossbow, n: 1, e: { piercing: 4 } };
    USE.kind = 'crossbow'; USE.t = 30; crossbowRelease(INV.slots[INV.sel]); USE.kind = null; crossbowFire(INV.slots[INV.sel]); await run(20);
    o.pierce = row.map(z => +(40 - z.hp).toFixed(1));
    // quick charge III: loads after 10 ticks, not 25
    const qc = { id: IID.crossbow, n: 1, e: { quick_charge: 3 } }; INV.slots[INV.sel] = qc; USE.kind = 'crossbow'; USE.t = 11; crossbowRelease(qc); o.quick = [!!qc.ch, crossbowCharge(qc), crossbowCharge({ id: IID.crossbow })]; USE.kind = null;
    // infinity and flame
    clear(); const zf = dummy('zombie', 0, -6); INV.slots[INV.sel] = { id: IID.bow, n: 1, e: { infinity: 1, flame: 1 } }; INV.slots[1] = { id: IID.arrow, n: 5 };
    USE.kind = 'bow'; USE.t = 25; onUseRelease(); await run(20); o.bow = { left: INV.slots[1].n, fire: zf.fire > 0, hurt: 40 - zf.hp };
    // punch vs none, knockback vs none (how far the mob is pushed)
    const push = async (setup) => { clear(); const z = dummy('zombie', 0, -3); const z0 = z.z; await setup(z); await run(15); return +(z0 - z.z).toFixed(2); };
    const shoot = (e) => async () => { INV.slots[INV.sel] = { id: IID.bow, n: 1, e }; INV.slots[1] = { id: IID.arrow, n: 5 }; USE.kind = 'bow'; USE.t = 25; onUseRelease(); };
    o.punch = [await push(shoot(null)), await push(shoot({ punch: 2 }))];
    const swing = (e) => async (z) => { INV.slots[INV.sel] = { id: IID.iron_sword, n: 1, e }; PL.attackT = 100; attackEntity(z); };
    o.kb = [await push(swing(null)), await push(swing({ knockback: 2 }))];
    // fire aspect
    clear(); const zfa = dummy('zombie', 0, -1.5); INV.slots[INV.sel] = { id: IID.iron_sword, n: 1, e: { fire_aspect: 2 } }; PL.attackT = 100; attackEntity(zfa); o.fireAspect = zfa.fire;
    // loyalty: a thrown trident comes back to the hand
    clear(); INV.slots[INV.sel] = { id: IID.trident, n: 1, e: { loyalty: 3 } }; USE.kind = 'trident'; USE.t = 15; onUseRelease(); USE.kind = null;
    const thrown = !INV.slots[INV.sel]; await run(120); o.loyalty = [thrown, !!(INV.slots.find(s => s && s.id === IID.trident))];
    // impaling: a thrown trident at a squid
    const tri = async (e, t) => { clear(); const m = dummy(t, 0, -4); PL.pitch = t === 'zombie' ? -0.02 : -0.3; const hold0 = hold; hold = () => { hold0(); PL.pitch = t === 'zombie' ? -0.02 : -0.3; }; INV.slots[INV.sel] = { id: IID.trident, n: 1, e }; USE.kind = 'trident'; USE.t = 15; onUseRelease(); USE.kind = null; await run(15); return +(40 - m.hp).toFixed(1); };
    o.impale = [await tri(null, 'squid'), await tri({ impaling: 5 }, 'squid'), await tri({ impaling: 5 }, 'zombie')];
    return o; });
  ok(r.multi.arrows === 3 && r.multi.left === 9 && r.multi.dur === 3 && r.multi.spread > 0.3, 'multishot: three arrows, one used, 3 durability', r.multi);
  ok(r.pierce.every(d => d > 0), 'piercing: the arrow hurts every mob in the row', r.pierce);
  ok(r.quick[0] && r.quick[1] === 10 && r.quick[2] === 25, 'quick charge III loads in 10 ticks (25 without)', r.quick);
  ok(r.bow.left === 5 && r.bow.fire && r.bow.hurt > 0, 'infinity uses no arrow; flame sets the mob on fire', r.bow);
  ok(r.punch[1] > r.punch[0] + 0.3, 'punch pushes further', r.punch);
  ok(r.kb[1] > r.kb[0] + 0.3, 'knockback pushes further', r.kb);
  ok(r.fireAspect >= 120, 'fire aspect II sets on fire', r.fireAspect);
  ok(r.loyalty[0] && r.loyalty[1], 'a loyal trident comes back', r.loyalty);
  ok(r.impale[1] > r.impale[0] + 10 && Math.abs(r.impale[2] - r.impale[0]) < 1, 'impaling hurts water mobs more, not others', r.impale);
  ok(!p.errs.length, 'no page errors', p.errs);
};

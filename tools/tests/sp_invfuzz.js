// no item is ever made out of nothing: thousands of random clicks (left, right, shift, double-click, number keys, F, Q,
// closing and reopening) in every kind of window, with things that can't be crafted into anything - what the player,
// the windows and the ground hold between them never grows
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async SEED => { const out = { bad: [] };
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -6; a <= 6; a++) for (let c = -6; c <= 6; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e !== PL) removeEnt(e); PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.inv = 1e9; UI.paused = false;
    const IDS = ['bedrock', 'nether_star', 'dragon_egg', 'totem_of_undying', 'saddle', 'elytra'].map(k => IID[k]).filter(v => v != null);
    INV.slots.fill(null); INV.armor.fill(null); INV.off = null; INV.cursor = null;
    let s = SEED; const rnd = n => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) % n); };
    for (let i = 0; i < 20; i++) { const id = IDS[rnd(IDS.length)]; INV.slots[i] = { id, n: 1 + rnd(maxStack(id)) }; }
    const BL = [['chest', BID.chest], ['furnace', BID.furnace], ['crafting_table', BID.crafting_table], ['hopper', BID.hopper], ['dispenser', BID.dispenser], ['anvil', BID.anvil], ['enchanting_table', BID.enchanting_table], ['brewing_stand', BID.brewing_stand], ['smithing_table', BID.smithing_table], ['grindstone', BID.grindstone], ['stonecutter', BID.stonecutter], ['loom', BID.loom], ['barrel', BID.barrel], ['dropper', BID.dropper], ['shulker_box', BID.shulker_box], ['ender_chest', BID.ender_chest]].filter(q => q[1] != null);
    BL.forEach(([, id], i) => setBlock(X - 5 + (i % 11), Y, Z - 3 - Math.floor(i / 11) * 2, id));
    const count = () => { const n = {}; const add = st => { if (st && IDS.includes(st.id)) n[st.id] = (n[st.id] || 0) + st.n; if (st && st.items) st.items.forEach(add); };
      INV.slots.forEach(add); INV.armor.forEach(add); add(INV.off); add(INV.cursor); INV.craft2.forEach(add); INV.craft3.forEach(add); if (PL.ender) PL.ender.forEach(add);
      if (GUI.ctx && Array.isArray(GUI.ctx.items) && !GUI.ctx.tile) GUI.ctx.items.forEach(add);
      for (const c of W.chunks.values()) for (const t of c.tiles.values()) if (t && Array.isArray(t.items)) t.items.forEach(add);
      for (const e of ENT) if (e.kind === 'item' && !e.dead) add(e.stack || { id: e.item, n: e.n || e.count || 1, items: e.items });
      return n; };
    const tot = n => IDS.map(id => n[id] || 0);
    const base = tot(count()); out.base = base; let prev = base, last = '';
    const key = (code, opts) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, ...opts }));
    for (let step = 0; step < 4000 && out.bad.length < 3; step++) {
      const a = rnd(100);
      if (!UI.screen || a < 3) { if (UI.screen) UI.closeScreen(); if (rnd(4) === 0) UI.openScreen('inv'); else { const i = rnd(BL.length), bx = X - 5 + (i % 11), bz = Z - 3 - Math.floor(i / 11) * 2; interactBlock({ x: bx, y: Y, z: bz, id: getBlock(bx, Y, bz), m: getMeta(bx, Y, bz), type: 'block' }, false); } last = 'open ' + (GUI.type || UI.screen); }
      else if (!GUI.slots || !GUI.slots.length) { UI.closeScreen(); last = 'close'; }
      else { const i = rnd(GUI.slots.length);
        if (a < 55) { clickSlot(i, rnd(3) === 0 ? 2 : 0, rnd(4) === 0); last = 'click'; }
        else if (a < 65) { collectToCursor(); afterClick(); last = 'collect'; }
        else if (a < 80) { GUI.hover = i; key('Digit' + (1 + rnd(9))); last = 'digit'; }
        else if (a < 88) { GUI.hover = i; key('KeyF'); last = 'F'; }
        else if (a < 94) { GUI.hover = i; key('KeyQ', { ctrlKey: rnd(2) === 0 }); last = 'Q'; }
        else { UI.closeScreen(); last = 'close'; } }
      if (step % 50 === 0) { for (let k = 0; k < 3; k++) gameTick(); await new Promise(r => setTimeout(r, 0)); }
      const now = tot(count()); if (now.some((v, k) => v > prev[k])) out.bad.push({ step, last, type: GUI.type, prev, now });
      prev = now.map((v, k) => Math.min(v, prev[k]));
    }
    if (UI.screen) UI.closeScreen(); out.end = tot(count()); return out; }, +(process.env.FUZZ_SEED || 777));
  console.log(JSON.stringify([r.base, r.end]));
  ok(r.bad.length === 0, 'random clicks in every window never make an item out of nothing', r.bad.length ? r.bad : [r.base, r.end]);
};

// Inventory model + container screens with Java Edition click semantics.
const INV = { slots: new Array(36).fill(null), armor: new Array(4).fill(null), sel: 0, cursor: null, craft2: new Array(4).fill(null), craft3: new Array(9).fill(null) };
const same = (a, b) => a && b && a.id === b.id && (a.d || 0) === (b.d || 0) && !ITEMS[a.id].dur;
INV.add = function (st) { // returns leftover count; mutates nothing on success except slots
  let n = st.n; const max = maxStack(st.id);
  const order = [...Array(9).keys(), ...Array.from({ length: 27 }, (_, i) => i + 9)];
  if (!ITEMS[st.id].dur) for (const i of order) { const s = INV.slots[i]; if (s && s.id === st.id && !s.d && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; if (!n) break; } }
  if (n) for (const i of order) if (!INV.slots[i]) { const m = Math.min(n, max); INV.slots[i] = { id: st.id, n: m }; if (st.d != null) INV.slots[i].d = st.d; n -= m; if (!n) break; }
  UI.hudDirty = true; if (UI.screen) UI.renderScreen();
  return n;
};
INV.count = id => INV.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
INV.remove = function (id, n) { for (let i = 35; i >= 0 && n > 0; i--) { const s = INV.slots[i]; if (s && s.id === id) { const m = Math.min(n, s.n); s.n -= m; n -= m; if (!s.n) INV.slots[i] = null; } } UI.hudDirty = true; };
INV.giveOrDrop = st => { const left = INV.add(st); if (left > 0) dropItem(PL.x, PL.y + 1.2, PL.z, st.id, left, null, 40, st.d); };

// ---------- screens ----------
const GUI = { slots: [], el: null, type: null, ctx: null, drag: null, hover: -1, lastClick: { t: 0, i: -1 }, creativeTab: 'all', search: '' };
function slotRef(arr, i, opts = {}) { return { get: () => arr[i], set: v => { arr[i] = v; }, ...opts }; }
function invSlots(list) {
  for (let i = 9; i < 36; i++) list.push(slotRef(INV.slots, i, { group: 'main' }));
  for (let i = 0; i < 9; i++) list.push(slotRef(INV.slots, i, { group: 'hot' }));
}
function craftResult(grid, w) { const r = matchRecipe(grid.map(s => s ? s.id : 0), w); return r ? { id: r.out, n: r.n } : null; }
function buildSlots(type, ctx) {
  const L = [];
  if (type === 'inv' || type === 'craft') {
    const grid = type === 'inv' ? INV.craft2 : INV.craft3, w = type === 'inv' ? 2 : 3;
    grid.forEach((_, i) => L.push(slotRef(grid, i, { group: 'grid' })));
    L.push({ group: 'result', output: true, get: () => craftResult(grid, w), set: () => {}, take: () => { for (let i = 0; i < grid.length; i++) if (grid[i]) { grid[i].n--; if (grid[i].n <= 0) grid[i] = null; } } });
    if (type === 'inv') for (let i = 0; i < 4; i++) L.push(slotRef(INV.armor, i, { group: 'armor', accepts: st => !st || (ITEMS[st.id].armor && ITEMS[st.id].armor.slot === i) || (i === 0 && st.id === BID.pumpkin), max: 1 }));
  } else if (type === 'chest') {
    const t = getTile(ctx.x, ctx.y, ctx.z); ctx.tile = t;
    for (let i = 0; i < 27; i++) L.push(slotRef(t.items, i, { group: 'cont' }));
  } else if (type === 'enchant') {
    ctx.items = ctx.items || [null, null];
    L.push(slotRef(ctx.items, 0, { group: 'ein', accepts: st => !st || (enchKinds(st.id).length && !st.e), max: 1 }));
    L.push(slotRef(ctx.items, 1, { group: 'elapis', accepts: st => !st || st.id === IID.lapis_lazuli }));
  } else if (type === 'furnace') {
    const t = getTile(ctx.x, ctx.y, ctx.z); ctx.tile = t;
    L.push(slotRef(t.items, 0, { group: 'fin' }));
    L.push(slotRef(t.items, 1, { group: 'ffuel', accepts: st => !st || !!ITEMS[st.id].fuel }));
    L.push(slotRef(t.items, 2, { group: 'fout', accepts: st => !st, takeOnly: true, onTake: () => { const x = t.xp || 0; let n = Math.floor(x); if (Math.random() < x - n) n++; if (n) spawnXP(PL.x, PL.y + 1, PL.z, n); t.xp = 0; } }));
  }
  if (type !== 'creative') invSlots(L);
  else for (let i = 0; i < 9; i++) L.push(slotRef(INV.slots, i, { group: 'hot' }));
  return L;
}
function clickSlot(i, btn, shift) {
  const sl = GUI.slots[i]; if (!sl) return;
  const cur = INV.cursor, st = sl.get();
  const max = id => Math.min(maxStack(id), sl.max || 64);
  if (sl.output) {
    const r = st; if (!r) return;
    if (shift) { for (let k = 0; k < 64; k++) { const rr = sl.get(); if (!rr || !rr.id) break; if (r.id !== rr.id) break; const left = INV.add({ ...rr }); if (left) { if (left < rr.n) INV.giveOrDrop({ id: rr.id, n: left }); sl.take(); break; } sl.take(); } }
    else if (!cur) { INV.cursor = { ...r }; sl.take(); }
    else if (cur.id === r.id && !ITEMS[r.id].dur && cur.n + r.n <= maxStack(r.id)) { cur.n += r.n; sl.take(); }
    play('click', { vol: 0.3 }); return afterClick();
  }
  if (shift && st) { quickMove(i); return afterClick(); }
  if (sl.takeOnly) { if (st && (!cur || (same(cur, st) && cur.n + st.n <= maxStack(st.id)))) { if (cur) cur.n += st.n; else INV.cursor = st; sl.set(null); sl.onTake && sl.onTake(); } return afterClick(); }
  const ok = s => !sl.accepts || sl.accepts(s);
  if (btn === 0) {
    if (!cur && st) { INV.cursor = st; sl.set(null); }
    else if (cur && !st) { if (!ok(cur)) return; const m = Math.min(cur.n, max(cur.id)); sl.set({ ...cur, n: m }); cur.n -= m; if (!cur.n) INV.cursor = null; }
    else if (cur && st) {
      if (same(cur, st)) { const m = Math.min(cur.n, max(st.id) - st.n); st.n += m; cur.n -= m; if (!cur.n) INV.cursor = null; }
      else if (ok(cur) && cur.n <= max(cur.id)) { sl.set(cur); INV.cursor = st; }
    }
  } else if (btn === 2) {
    if (!cur && st) { const h = Math.ceil(st.n / 2); INV.cursor = { ...st, n: h }; st.n -= h; if (!st.n) sl.set(null); }
    else if (cur) {
      if (!st && ok(cur)) { sl.set({ ...cur, n: 1 }); cur.n--; }
      else if (st && same(cur, st) && st.n < max(st.id)) { st.n++; cur.n--; }
      else if (st && !same(cur, st) && ok(cur) && cur.n <= max(cur.id)) { sl.set(cur); INV.cursor = st; }
      if (INV.cursor && INV.cursor.n <= 0) INV.cursor = null;
    }
  }
  afterClick();
}
function quickMove(i) {
  const sl = GUI.slots[i], st = sl.get(); if (!st) return;
  const g = sl.group, T = GUI.type;
  let targets;
  const idx = f => GUI.slots.map((s, k) => f(s) ? k : -1).filter(k => k >= 0);
  if (g === 'main' || g === 'hot') {
    const d = ITEMS[st.id];
    if (T === 'chest') targets = idx(s => s.group === 'cont');
    else if (T === 'furnace' && SMELT[st.id]) targets = idx(s => s.group === 'fin');
    else if (T === 'enchant') targets = idx(s => s.group === (st.id === IID.lapis_lazuli ? 'elapis' : 'ein') && s.accepts(st));
    else if (T === 'furnace' && d.fuel) targets = idx(s => s.group === 'ffuel');
    else if (T === 'inv' && d.armor && !INV.armor[d.armor.slot]) targets = idx(s => s.group === 'armor' && s.accepts(st));
    else targets = idx(s => s.group === (g === 'main' ? 'hot' : 'main'));
    if (T === 'creative') targets = [];
  } else targets = [...idx(s => s.group === 'hot').reverse(), ...idx(s => s.group === 'main').reverse()].reverse();
  if (!targets.length) return;
  if (g !== 'main' && g !== 'hot') targets = [...idx(s => s.group === 'main'), ...idx(s => s.group === 'hot')];
  for (const k of targets) { const t = GUI.slots[k].get(); if (t && same(t, st)) { const m = Math.min(st.n, maxStack(st.id) - t.n); t.n += m; st.n -= m; if (!st.n) break; } }
  if (st.n) for (const k of targets) { const s2 = GUI.slots[k]; if (!s2.get() && (!s2.accepts || s2.accepts(st))) { const m = Math.min(st.n, s2.max || maxStack(st.id)); s2.set({ ...st, n: m }); st.n -= m; if (!st.n) break; } }
  if (!st.n) sl.set(null);
  if (sl.onTake) sl.onTake();
}
function collectToCursor() {
  const c = INV.cursor; if (!c) return;
  for (const s of GUI.slots) { if (s.output) continue; const t = s.get(); if (t && same(t, c) && c.n < maxStack(c.id)) { const m = Math.min(t.n, maxStack(c.id) - c.n); c.n += m; t.n -= m; if (!t.n) s.set(null); } }
}
function afterClick() { UI.hudDirty = true; UI.renderScreen(); }
function closeScreenItems() {
  if (GUI.type === 'enchant' && GUI.ctx.items) for (const st of GUI.ctx.items) if (st) INV.giveOrDrop(st);
  for (const g of [INV.craft2, INV.craft3]) for (let i = 0; i < g.length; i++) if (g[i]) { INV.giveOrDrop(g[i]); g[i] = null; }
  if (INV.cursor) { INV.giveOrDrop(INV.cursor); INV.cursor = null; }
}

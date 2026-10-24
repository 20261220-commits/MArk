// Inventory model + container screens with Java Edition click semantics.
const INV = { slots: new Array(36).fill(null), armor: new Array(4).fill(null), sel: 0, cursor: null, craft2: new Array(4).fill(null), craft3: new Array(9).fill(null) };
const same = (a, b) => a && b && a.id === b.id && (a.d || 0) === (b.d || 0) && !ITEMS[a.id].dur && !a.e && !b.e && a.name === b.name && (a.v || 0) === (b.v || 0) && JSON.stringify(a.bp || null) === JSON.stringify(b.bp || null);
INV.add = function (st) { // returns leftover count; mutates nothing on success except slots
  let n = st.n; const max = maxStack(st.id);
  const order = [...Array(9).keys(), ...Array.from({ length: 27 }, (_, i) => i + 9)];
  if (!ITEMS[st.id].dur) for (const i of order) { const s = INV.slots[i]; if (s && same(s, st) && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; if (!n) break; } }
  if (n) for (const i of order) if (!INV.slots[i]) { const m = Math.min(n, max); INV.slots[i] = { ...st, n: m }; n -= m; if (!n) break; } // keeps enchantments, names and other data
  UI.hudDirty = true; if (UI.screen) UI.renderScreen();
  return n;
};
INV.count = id => INV.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
INV.remove = function (id, n) { for (let i = 35; i >= 0 && n > 0; i--) { const s = INV.slots[i]; if (s && s.id === id) { const m = Math.min(n, s.n); s.n -= m; n -= m; if (!s.n) INV.slots[i] = null; } } UI.hudDirty = true; };
INV.giveOrDrop = st => { const left = INV.add(st); if (left > 0) dropItem(PL.x, PL.y + 1.2, PL.z, st.id, left, null, 40, st.d, st); };

// ---------- screens ----------
const GUI = { slots: [], el: null, type: null, ctx: null, drag: null, hover: -1, lastClick: { t: 0, i: -1 }, creativeTab: 'all', search: '' };
function slotRef(arr, i, opts = {}) { return { get: () => arr[i], set: v => { arr[i] = v; }, ...opts }; }
function invSlots(list) {
  for (let i = 9; i < 36; i++) list.push(slotRef(INV.slots, i, { group: 'main' }));
  for (let i = 0; i < 9; i++) list.push(slotRef(INV.slots, i, { group: 'hot' }));
}
function craftResult(grid, w) { const r = matchRecipe(grid.map(s => s ? s.id : 0), w); if (!r) return null; const out = { id: r.out, n: r.n }; const box = isShulkerItem(r.out) && grid.find(s => s && s.items); if (box) out.items = box.items; if (typeof craftExtra === 'function') craftExtra(out, grid); return out; } // dyed shulker boxes keep their contents
function buildSlots(type, ctx) {
  const L = [];
  if (type === 'inv' || type === 'craft') {
    const grid = type === 'inv' ? INV.craft2 : INV.craft3, w = type === 'inv' ? 2 : 3;
    grid.forEach((_, i) => L.push(slotRef(grid, i, { group: 'grid' })));
    L.push({ group: 'result', output: true, get: () => craftResult(grid, w), set: () => {}, take: () => { for (let i = 0; i < grid.length; i++) if (grid[i]) { grid[i].n--; if (grid[i].n <= 0) grid[i] = null; } } });
    if (type === 'inv') for (let i = 0; i < 4; i++) L.push(slotRef(INV.armor, i, { group: 'armor', canTake: () => creative() || !enchLv(INV.armor[i], 'binding_curse'), accepts: st => !st || (ITEMS[st.id].armor && ITEMS[st.id].armor.slot === i) || (i === 0 && isHeadwear(st.id)), max: 1 }));
  } else if (type === 'chest' || type === 'hopper' || type === 'dispenser') {
    const t = ctx.cart || getTile(ctx.x, ctx.y, ctx.z); ctx.tile = t;
    for (let i = 0; i < t.items.length; i++) L.push(slotRef(t.items, i, t.shulker ? { group: 'cont', accepts: st => !st || !isShulkerItem(st.id) } : { group: 'cont' })); // no shulker boxes in shulker boxes
  } else if (type === 'horse') {
    const e = ctx.horse;
    L.push(slotRef(e.gear, 0, { group: 'hsad', accepts: st => !st || st.id === IID.saddle, max: 1 }));
    L.push(slotRef(e.gear, 1, { group: 'harm', accepts: st => !st || (e.type === 'horse' && !!HARMOR[ITEMS[st.id].key]), max: 1 }));
    if (e.chest) for (let i = 0; i < e.items.length; i++) L.push(slotRef(e.items, i, { group: 'cont' }));
  } else if (type === 'enchant') {
    ctx.items = ctx.items || [null, null];
    L.push(slotRef(ctx.items, 0, { group: 'ein', accepts: st => !st || (enchKinds(st.id).length && !st.e && st.id !== IID.shield), max: 1 }));
    L.push(slotRef(ctx.items, 1, { group: 'elapis', accepts: st => !st || st.id === IID.lapis_lazuli }));
  } else if (type === 'anvil') {
    ctx.items = ctx.items || [null, null]; ctx.name = ctx.name || '';
    L.push(slotRef(ctx.items, 0, { group: 'a0', max: 64 }));
    L.push(slotRef(ctx.items, 1, { group: 'a1' }));
    L.push({ group: 'result', output: true, get: () => anvilResult(ctx) && anvilResult(ctx).out, set: () => {}, canTake: () => { const r = anvilResult(ctx); return r && (creative() || (PL.level >= r.cost && r.cost < 40)); }, take: () => anvilTake(ctx) });
  } else if (type === 'smithing') {
    ctx.items = ctx.items || [null, null];
    L.push(slotRef(ctx.items, 0, { group: 's0', accepts: st => !st || !!SMITH_UP[ITEMS[st.id].key], max: 1 }));
    L.push(slotRef(ctx.items, 1, { group: 's1', accepts: st => !st || st.id === IID.netherite_ingot }));
    L.push({ group: 'result', output: true, get: () => smithResult(ctx), set: () => {}, take: () => { ctx.items[0] = null; const g = ctx.items[1]; g.n--; if (!g.n) ctx.items[1] = null; play('anvil', { vol: 0.5 }); } });
  } else if (type === 'trade') {
    ctx.items = ctx.items || [null]; ctx.sel = ctx.sel || 0;
    L.push(slotRef(ctx.items, 0, { group: 'tpay' }));
    L.push({ group: 'result', output: true, get: () => tradeResult(ctx), set: () => {}, take: () => tradeTake(ctx) });
  } else if (type === 'loom') {
    ctx.items = ctx.items || [null, null];
    L.push(slotRef(ctx.items, 0, { group: 'lban', accepts: st => !st || (ITEMS[st.id].block && ITEMS[st.id].place === BID.banner), max: 1 }));
    L.push(slotRef(ctx.items, 1, { group: 'ldye', accepts: st => !st || ITEMS[st.id].key.endsWith('_dye') }));
    L.push({ group: 'result', output: true, get: () => loomResult(ctx), set: () => {}, take: () => { ctx.items[0] = null; const d = ctx.items[1]; d.n--; if (!d.n) ctx.items[1] = null; play('click'); } });
  } else if (type === 'beacon') {
    ctx.tile = getTile(ctx.x, ctx.y, ctx.z); ctx.items = ctx.items || [null];
    L.push(slotRef(ctx.items, 0, { group: 'bpay', accepts: st => !st || BEACON_PAY().has(st.id), max: 1 }));
  } else if (type === 'brewing') {
    const t = getTile(ctx.x, ctx.y, ctx.z); ctx.tile = t;
    for (let k = 0; k < 3; k++) L.push(slotRef(t.items, k, { group: 'bbottle', accepts: isBottle, max: 1 }));
    L.push(slotRef(t.items, 3, { group: 'bing', accepts: st => !st || BREW_ING.has(ITEMS[st.id].key) }));
    L.push(slotRef(t.items, 4, { group: 'bfuel', accepts: st => !st || st.id === IID.blaze_powder }));
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
    if (sl.canTake && !sl.canTake()) return;
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
    if (T === 'chest' || T === 'hopper' || T === 'dispenser') targets = idx(s => s.group === 'cont');
    else if (T === 'furnace' && SMELT[st.id]) targets = idx(s => s.group === 'fin');
    else if (T === 'brewing') targets = idx(s => s.accepts(st) && (s.group === 'bbottle' ? d.potion != null || st.id === IID.glass_bottle : s.group === 'bfuel' ? !GUI.ctx.tile.items[4] || GUI.ctx.tile.items[4].n < 64 : !(st.id === IID.blaze_powder && (!GUI.ctx.tile.items[4] || GUI.ctx.tile.items[4].n < 64))));
    else if (T === 'enchant') targets = idx(s => s.group === (st.id === IID.lapis_lazuli ? 'elapis' : 'ein') && s.accepts(st));
    else if (T === 'furnace' && d.fuel) targets = idx(s => s.group === 'ffuel');
    else if (T === 'anvil') targets = idx(s => s.group === (GUI.ctx.items[0] ? 'a1' : 'a0'));
    else if (T === 'smithing') targets = idx(s => s.group === (st.id === IID.netherite_ingot ? 's1' : 's0') && s.accepts(st));
    else if (T === 'trade') targets = idx(s => s.group === 'tpay');
    else if (T === 'beacon' && BEACON_PAY().has(st.id)) targets = idx(s => s.group === 'bpay');
    else if (T === 'loom') targets = idx(s => (s.group === 'lban' || s.group === 'ldye') && s.accepts(st));
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
function afterClick() { UI.hudDirty = true; UI.renderScreen(); const c = GUI.ctx; if (c && c.x != null && typeof rsNotify === 'function') { rsNotify(c.x, c.y, c.z); const ch = chunkAt(c.x >> 4, c.z >> 4); if (ch) ch.modified = ch.edited = true; } }
function closeScreenItems() {
  if ((GUI.type === 'enchant' || GUI.type === 'anvil' || GUI.type === 'smithing' || GUI.type === 'trade' || GUI.type === 'beacon' || GUI.type === 'loom') && GUI.ctx.items) { for (const st of GUI.ctx.items) if (st) INV.giveOrDrop(st); GUI.ctx.items = null; }
  if (GUI.type === 'trade' && GUI.ctx.e) GUI.ctx.e.trading = false;
  for (const g of [INV.craft2, INV.craft3]) for (let i = 0; i < g.length; i++) if (g[i]) { INV.giveOrDrop(g[i]); g[i] = null; }
  if (INV.cursor) { INV.giveOrDrop(INV.cursor); INV.cursor = null; }
}
// ---------- anvil (repair, combine, rename) ----------
const REPAIR_MAT = { chainmail: 'iron_ingot', wooden: 'planks', stone: 'stone_crafting', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond', netherite: 'netherite_ingot', leather: 'leather' };
function repairMaterial(st) { const d = ITEMS[st.id], m = d.tool ? d.tool.mat : d.armor ? d.armor.mat : null; if (!m) return []; const k = REPAIR_MAT[m]; return TAGS[k] || [IID[k]]; }
function anvilResult(c) {
  const a = c.items && c.items[0], b = c.items && c.items[1]; if (!a) return null;
  const da = ITEMS[a.id], out = { ...a, e: a.e ? { ...a.e } : undefined }; let cost = (a.rp || 0) + (b ? b.rp || 0 : 0), used = 0, changed = false;
  if (b) {
    if (da.dur && repairMaterial(a).includes(b.id) && (a.d || 0) > 0) { // repair with raw material: 25% per unit
      let d = a.d || 0; while (d > 0 && used < b.n) { d = Math.max(0, d - Math.floor(da.dur / 4)); used++; cost++; } out.d = d; changed = true;
    } else if ((b.id === a.id && da.dur) || (b.id === IID.enchanted_book && b.e)) { // combine: durability and enchantments
      if (b.id === a.id) { const keep = (da.dur - (a.d || 0)) + (da.dur - (b.d || 0)) + Math.floor(da.dur * 0.12); out.d = Math.max(0, da.dur - keep); if (out.d < (a.d || 0)) { cost += 2; changed = true; } }
      const kinds = enchKinds(a.id);
      for (const [k, lv] of Object.entries(b.e || {})) {
        if (!ENCH[k] || !(ENCH[k][2].some(t => kinds.includes(t)) || creative())) continue;
        if (out.e && ENCH_EXCL.some(g => g.includes(k) && g.some(o => o !== k && out.e[o]))) { cost++; continue; }
        const cur = (out.e && out.e[k]) || 0, nl = cur === lv ? Math.min(ENCH[k][1], lv + 1) : Math.max(cur, lv);
        out.e = out.e || {}; out.e[k] = nl; cost += nl * (b.id === IID.enchanted_book ? 1 : 2); changed = true;
      }
      used = 1;
    } else return null;
  }
  const nm = (c.name || '').trim();
  if (nm && nm !== (a.name || da.name)) { out.name = nm; cost++; changed = true; }
  if (!changed) return null;
  out.rp = (a.rp || 0) * 2 + 1;
  if (!out.e) delete out.e;
  return { out, cost: Math.max(1, cost), used };
}
function anvilTake(c) {
  const r = anvilResult(c); if (!r) return;
  if (!creative()) PL.level -= r.cost;
  c.items[0] = null; const b = c.items[1]; if (b) { b.n -= r.used; if (b.n <= 0) c.items[1] = null; }
  c.name = '';
  play('anvil');
  // anvils wear out: 12% chance per use to become chipped, then damaged, then break
  if (!creative() && Math.random() < 0.12 && c.x != null) { const m = getMeta(c.x, c.y, c.z), dmg = ((m >> 2) & 3) + 1; if (dmg >= 3) { setBlock(c.x, c.y, c.z, 0); play('break', { mat: 'stone' }); setTimeout(() => UI.closeScreen(), 0); } else setMeta(c.x, c.y, c.z, (m & 3) | (dmg << 2)); }
  UI.hudDirty = true;
}
// ---------- smithing table (1.16+: diamond gear + netherite ingot) ----------
const SMITH_UP = {};
for (const t of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'helmet', 'chestplate', 'leggings', 'boots']) SMITH_UP['diamond_' + t] = 'netherite_' + t;
function smithResult(c) {
  const a = c.items && c.items[0], b = c.items && c.items[1]; if (!a || !b || b.id !== IID.netherite_ingot) return null;
  const up = SMITH_UP[ITEMS[a.id].key]; if (!up) return null;
  const nd = ITEMS[IID[up]], od = ITEMS[a.id];
  const out = { id: IID[up], n: 1 }; if (a.e) out.e = { ...a.e }; if (a.name) out.name = a.name;
  if (a.d) out.d = Math.round(a.d / od.dur * nd.dur);
  return out;
}
// ---------- villager trading ----------
function tradeResult(c) {
  const o = villagerOffers(c.e)[c.sel], p = c.items[0];
  if (!o || o.uses >= o.max || !p || p.id !== o.a || p.n < tradePrice(o)) return null;
  if (o.special) { if (!o.made) o.made = lootSpecial(o.special, c.e.x, c.e.z); return o.made ? { ...o.made } : null; }
  const out = { id: o.b, n: o.bn }; if (o.ench) { if (!o.e) { const keys = Object.keys(ENCH), k = keys[Math.floor(Math.random() * keys.length)]; o.e = { [k]: 1 + Math.floor(Math.random() * ENCH[k][1]) }; } out.e = { ...o.e }; }
  return out;
}
function tradeTake(c) {
  const o = villagerOffers(c.e)[c.sel], p = c.items[0];
  p.n -= tradePrice(o); if (p.n <= 0) c.items[0] = null;
  o.uses++; if (o.ench) o.e = null; o.made = null;
  play('trade'); spawnXP(PL.x, PL.y + 1, PL.z, 3 + Math.floor(Math.random() * 4)); UI.advance('trade');
  // refill the payment slot from the inventory, like Java does after a trade
  if (!c.items[0] && INV.count(o.a) > 0) { const n = Math.min(INV.count(o.a), maxStack(o.a)); INV.remove(o.a, n); c.items[0] = { id: o.a, n }; }
}
function selectTrade(i) {
  const c = GUI.ctx, o = villagerOffers(c.e)[i]; if (!o) return;
  c.sel = i;
  if (c.items[0] && c.items[0].id !== o.a) { INV.giveOrDrop(c.items[0]); c.items[0] = null; }
  const have = INV.count(o.a), cur = c.items[0] ? c.items[0].n : 0, n = Math.min(have, maxStack(o.a) - cur);
  if (n > 0) { INV.remove(o.a, n); c.items[0] = { id: o.a, n: cur + n }; }
  UI.renderScreen();
}

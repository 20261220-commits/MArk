// Work blocks with their own screens: the stonecutter (every vanilla stonecutting recipe), the cartography table
// (zoom a map out, copy it, lock it) and the grindstone (repair two items into one, take enchantments off for XP).

// ---------- stonecutter ----------
// input key: outputs (key or key*count), as in vanilla 1.17
const STONECUT = {};
for (const row of 'andesite:andesite_slab*2,andesite_stairs,andesite_wall,polished_andesite,polished_andesite_slab*2,polished_andesite_stairs;blackstone:blackstone_slab*2,blackstone_stairs,blackstone_wall,chiseled_polished_blackstone,polished_blackstone_brick_slab*2,polished_blackstone_brick_stairs,polished_blackstone_brick_wall,polished_blackstone_bricks,polished_blackstone,polished_blackstone_slab*2,polished_blackstone_stairs,polished_blackstone_wall;bricks:brick_slab*2,brick_stairs,brick_wall;cobbled_deepslate:chiseled_deepslate,cobbled_deepslate_slab*2,cobbled_deepslate_stairs,cobbled_deepslate_wall,deepslate_brick_slab*2,deepslate_brick_stairs,deepslate_brick_wall,deepslate_bricks,deepslate_tile_slab*2,deepslate_tile_stairs,deepslate_tile_wall,deepslate_tiles,polished_deepslate,polished_deepslate_slab*2,polished_deepslate_stairs,polished_deepslate_wall;nether_bricks:chiseled_nether_bricks,nether_brick_slab*2,nether_brick_stairs,nether_brick_wall;polished_blackstone:chiseled_polished_blackstone,polished_blackstone_brick_slab*2,polished_blackstone_brick_stairs,polished_blackstone_brick_wall,polished_blackstone_bricks,polished_blackstone_slab*2,polished_blackstone_stairs,polished_blackstone_wall;quartz_block:chiseled_quartz_block,quartz_bricks,quartz_pillar,quartz_slab*2,quartz_stairs;red_sandstone:chiseled_red_sandstone,cut_red_sandstone,cut_red_sandstone_slab*2,red_sandstone_slab*2,red_sandstone_stairs,red_sandstone_wall;sandstone:chiseled_sandstone,cut_sandstone,cut_sandstone_slab*2,sandstone_slab*2,sandstone_stairs,sandstone_wall;stone_bricks:chiseled_stone_bricks,stone_brick_slab*2,stone_brick_stairs,stone_brick_wall;stone:chiseled_stone_bricks,stone_brick_slab*2,stone_brick_stairs,stone_brick_wall,stone_bricks,stone_slab*2,stone_stairs;cobblestone:cobblestone_slab*2,cobblestone_stairs,cobblestone_wall;copper_block:cut_copper,cut_copper_slab*2,cut_copper_stairs;cut_copper:cut_copper_slab*2,cut_copper_stairs;cut_red_sandstone:cut_red_sandstone_slab*2;cut_sandstone:cut_sandstone_slab*2;dark_prismarine:dark_prismarine_slab*2,dark_prismarine_stairs;deepslate_bricks:deepslate_brick_slab*2,deepslate_brick_stairs,deepslate_brick_wall,deepslate_tile_slab*2,deepslate_tile_stairs,deepslate_tile_wall,deepslate_tiles;polished_deepslate:deepslate_brick_slab*2,deepslate_brick_stairs,deepslate_brick_wall,deepslate_bricks,deepslate_tile_slab*2,deepslate_tile_stairs,deepslate_tile_wall,deepslate_tiles,polished_deepslate_slab*2,polished_deepslate_stairs,polished_deepslate_wall;deepslate_tiles:deepslate_tile_slab*2,deepslate_tile_stairs,deepslate_tile_wall;diorite:diorite_slab*2,diorite_stairs,diorite_wall,polished_diorite,polished_diorite_slab*2,polished_diorite_stairs;end_stone_bricks:end_stone_brick_slab*2,end_stone_brick_stairs,end_stone_brick_wall;end_stone:end_stone_brick_slab*2,end_stone_brick_stairs,end_stone_brick_wall,end_stone_bricks;exposed_copper:exposed_cut_copper,exposed_cut_copper_slab*2,exposed_cut_copper_stairs;exposed_cut_copper:exposed_cut_copper_slab*2,exposed_cut_copper_stairs;granite:granite_slab*2,granite_stairs,granite_wall,polished_granite,polished_granite_slab*2,polished_granite_stairs;mossy_cobblestone:mossy_cobblestone_slab*2,mossy_cobblestone_stairs,mossy_cobblestone_wall;mossy_stone_bricks:mossy_stone_brick_slab*2,mossy_stone_brick_stairs,mossy_stone_brick_wall;oxidized_copper:oxidized_cut_copper,oxidized_cut_copper_slab*2,oxidized_cut_copper_stairs;oxidized_cut_copper:oxidized_cut_copper_slab*2,oxidized_cut_copper_stairs;polished_andesite:polished_andesite_slab*2,polished_andesite_stairs;basalt:polished_basalt;polished_blackstone_bricks:polished_blackstone_brick_slab*2,polished_blackstone_brick_stairs,polished_blackstone_brick_wall;polished_diorite:polished_diorite_slab*2,polished_diorite_stairs;polished_granite:polished_granite_slab*2,polished_granite_stairs;prismarine_bricks:prismarine_brick_slab*2,prismarine_brick_stairs;prismarine:prismarine_slab*2,prismarine_stairs,prismarine_wall;purpur_block:purpur_pillar,purpur_slab*2,purpur_stairs;red_nether_bricks:red_nether_brick_slab*2,red_nether_brick_stairs,red_nether_brick_wall;smooth_quartz:smooth_quartz_slab*2,smooth_quartz_stairs;smooth_red_sandstone:smooth_red_sandstone_slab*2,smooth_red_sandstone_stairs;smooth_sandstone:smooth_sandstone_slab*2,smooth_sandstone_stairs;smooth_stone:smooth_stone_slab*2;waxed_copper_block:waxed_cut_copper,waxed_cut_copper_slab*2,waxed_cut_copper_stairs;waxed_cut_copper:waxed_cut_copper_slab*2,waxed_cut_copper_stairs;waxed_exposed_copper:waxed_exposed_cut_copper,waxed_exposed_cut_copper_slab*2,waxed_exposed_cut_copper_stairs;waxed_exposed_cut_copper:waxed_exposed_cut_copper_slab*2,waxed_exposed_cut_copper_stairs;waxed_oxidized_copper:waxed_oxidized_cut_copper,waxed_oxidized_cut_copper_slab*2,waxed_oxidized_cut_copper_stairs;waxed_oxidized_cut_copper:waxed_oxidized_cut_copper_slab*2,waxed_oxidized_cut_copper_stairs;waxed_weathered_copper:waxed_weathered_cut_copper,waxed_weathered_cut_copper_slab*2,waxed_weathered_cut_copper_stairs;waxed_weathered_cut_copper:waxed_weathered_cut_copper_slab*2,waxed_weathered_cut_copper_stairs;weathered_copper:weathered_cut_copper,weathered_cut_copper_slab*2,weathered_cut_copper_stairs;weathered_cut_copper:weathered_cut_copper_slab*2,weathered_cut_copper_stairs'.split(';')) { const [k, outs] = row.split(':'); STONECUT[k] = outs.split(',').map(o => { const [out, n] = o.split('*'); return [out, +(n || 1)]; }); }
const stonecutOptions = ctx => { const s = ctx.items[0]; return s ? (STONECUT[ITEMS[s.id].key] || []).filter(([o]) => IID[o] != null) : []; };
function stonecutResult(ctx) { const o = stonecutOptions(ctx)[ctx.sel]; return o ? { id: IID[o[0]], n: o[1] } : null; }
function stonecutTake(ctx) { const s = ctx.items[0]; s.n--; if (!s.n) ctx.items[0] = null; play('click', { vol: 0.5 }); }
function stonecutHtml() {
  const c = GUI.ctx, opts = stonecutOptions(c); if (c.sel >= opts.length) c.sel = -1;
  const btns = opts.map(([o, n], i) => `<button class="scopt ${i === c.sel ? 'on' : ''}" data-sc="${i}" title="${ITEMS[IID[o]].name}">${icon(IID[o], n)}</button>`).join('');
  return `<div class="panel"><div class="cap">석재 절단기</div><div class="row top">${slotHtml(0)}<div class="scopts">${btns || '<p class="tip">돌 종류를 넣으세요</p>'}</div><div class="arrow"></div>${slotHtml(1, 'big')}</div><div class="cap">인벤토리</div>${invRows(2)}</div>`;
}

// ---------- cartography table ----------
// map + paper: zoom out one step (max 4); map + empty map: two copies; map + glass pane: a locked copy that no longer changes
function cartoResult(ctx) {
  const [m, x] = ctx.items; if (!m || m.id !== IID.filled_map || !m.map || !x) return null;
  const md = mapStore()[m.map]; if (!md) return null;
  if (x.id === IID.paper) return md.s < 4 && !md.locked ? { ...m, n: 1, zoom: true, name: m.name } : null;
  if (x.id === IID.map) return { ...m, n: 2 };
  if (x.id === IID.glass_pane) return md.locked ? null : { ...m, n: 1, lock: true };
  return null;
}
function cartoTake(ctx, r) {
  const [m, x] = ctx.items, md = mapStore()[m.map];
  if (r && r.zoom) { const id = newMap(md.x, md.z, md.s + 1, null, md.dim); r.map = id; r.name = '지도 #' + id; delete r.zoom; }
  if (r && r.lock) { const id = (W.meta.mapN = (W.meta.mapN || 0) + 1); mapStore()[id] = { ...md, marks: [...(md.marks || [])], locked: true }; MAPS.cache.delete(id); r.map = id; r.name = (m.name || '지도') + ' (잠김)'; delete r.lock; }
  m.n--; if (!m.n) ctx.items[0] = null; x.n--; if (!x.n) ctx.items[1] = null;
  play('page', { vol: 0.6 });
}
function cartoHtml() {
  return `<div class="panel"><div class="cap">지도 제작대</div><div class="row top"><div class="col">${slotHtml(0)}${slotHtml(1)}</div><div class="arrow"></div>${slotHtml(2, 'big')}</div><p class="tip">지도 + 종이: 축소 · 지도 + 빈 지도: 복사 · 지도 + 유리판: 잠금</p><div class="cap">인벤토리</div>${invRows(3)}</div>`;
}

// ---------- grindstone ----------
const isCurse = k => k.endsWith('_curse');
function grindResult(ctx) {
  const [a, b] = ctx.items, one = a && b ? null : a || b;
  if (a && b) { // two of the same damageable item: durabilities add up plus 5%, only curses survive
    if (a.id !== b.id || !ITEMS[a.id].dur) return null;
    const max = ITEMS[a.id].dur, left = Math.min(max, (max - (a.d || 0)) + (max - (b.d || 0)) + Math.floor(max * 0.05)), e = {};
    for (const st of [a, b]) for (const [k, lv] of Object.entries(st.e || {})) if (isCurse(k)) e[k] = Math.max(e[k] || 0, lv);
    const r = { id: a.id, n: 1, d: max - left }; if (Object.keys(e).length) r.e = e; return r;
  }
  if (!one || !one.e || !Object.keys(one.e).some(k => !isCurse(k))) return null;
  const e = {}; for (const [k, lv] of Object.entries(one.e)) if (isCurse(k)) e[k] = lv;
  const r = { ...one, n: 1 }; delete r.e; delete r.rc; if (Object.keys(e).length) r.e = e;
  if (one.id === IID.enchanted_book && !r.e) r.id = IID.book;
  return r;
}
function grindTake(ctx) {
  let xp = 0; for (const st of ctx.items) if (st && st.e) for (const [k, lv] of Object.entries(st.e)) if (!isCurse(k)) xp += lv * 3; // experience back for the enchantments taken off
  ctx.items[0] = ctx.items[1] = null;
  if (xp && ctx.x != null) spawnXP(ctx.x + .5, ctx.y + 1, ctx.z + .5, Math.ceil(xp / 2 + Math.random() * xp / 2));
  play('anvil', { vol: 0.4, pitch: 1.4 });
}
function grindHtml() {
  return `<div class="panel"><div class="cap">숫돌</div><div class="row top"><div class="col">${slotHtml(0)}${slotHtml(1)}</div><div class="arrow"></div>${slotHtml(2, 'big')}</div><p class="tip">같은 아이템 두 개: 수리 (마법 부여는 저주만 남음) · 마법이 부여된 아이템 하나: 마법 해제, 경험치 돌려받기</p><div class="cap">인벤토리</div>${invRows(3)}</div>`;
}

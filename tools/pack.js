// Converts the Pixel Perfection CE resource pack (CC BY-SA 4.0) into js/pack.js:
// raw RGBA pixels for every block tile, item and entity texture the game uses,
// gzip-compressed and base64-encoded so the game needs no image decoding or
// canvas readbacks at runtime (and still works from a single offline file).
//
//   node tools/pack.js                      # rebuild js/pack.js from assets/pixelperfection
//   node tools/pack.js --from <pack root>   # first copy the needed PNGs out of an unzipped pack
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.join(__dirname, '..');
const ASSET = path.join(root, 'assets', 'pixelperfection', 'textures');

// ---------- minimal PNG decoder (all colour types, bit depths 1-8, no interlace) ----------
function decodePNG(buf) {
  let p = 8, w, h, depth, ctype, palette = null, trns = null; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; if (data[12]) throw new Error('interlaced PNG'); }
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype], bpp = Math.max(1, (chans * depth) >> 3), stride = (w * chans * depth + 7) >> 3;
  const lines = Buffer.alloc(stride * h); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = lines.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[i] = v & 255;
    }
    prev = out;
  }
  const px = new Uint8Array(w * h * 4);
  const sample = (y, i) => { // i-th sample in row
    if (depth === 8) return lines[y * stride + i];
    const bit = i * depth, byte = lines[y * stride + (bit >> 3)], shift = 8 - depth - (bit & 7);
    return (byte >> shift) & ((1 << depth) - 1);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (ctype === 3) { const k = sample(y, x); px[o] = palette[k * 3]; px[o + 1] = palette[k * 3 + 1]; px[o + 2] = palette[k * 3 + 2]; px[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (ctype === 0) { const s = depth === 8 ? sample(y, x) : sample(y, x) * 255 / ((1 << depth) - 1); px[o] = px[o + 1] = px[o + 2] = s; px[o + 3] = 255; }
    else if (ctype === 4) { px[o] = px[o + 1] = px[o + 2] = sample(y, x * 2); px[o + 3] = sample(y, x * 2 + 1); }
    else if (ctype === 2) { px[o] = sample(y, x * 3); px[o + 1] = sample(y, x * 3 + 1); px[o + 2] = sample(y, x * 3 + 2); px[o + 3] = 255; }
    else { for (let c = 0; c < 4; c++) px[o + c] = sample(y, x * 4 + c); }
  }
  return { w, h, px };
}

// ---------- what the game uses ----------
// atlas tile -> pack texture (block/ unless prefixed). Missing 1.17 blocks keep the procedural art.
const TILE = {
  stone: 'stone', grass_top: 'grass_block_top', dirt: 'dirt', cobblestone: 'cobblestone', oak_planks: 'oak_planks', spruce_planks: 'spruce_planks',
  birch_planks: 'birch_planks', bedrock: 'bedrock', sand: 'sand', gravel: 'gravel', gold_ore: 'gold_ore', iron_ore: 'iron_ore', coal_ore: 'coal_ore',
  diamond_ore: 'diamond_ore', redstone_ore: 'redstone_ore', lapis_ore: 'lapis_ore', emerald_ore: 'emerald_ore', oak_log: 'oak_log', oak_log_top: 'oak_log_top',
  spruce_log: 'spruce_log', spruce_log_top: 'spruce_log_top', birch_log: 'birch_log', birch_log_top: 'birch_log_top', oak_leaves: 'oak_leaves',
  spruce_leaves: 'spruce_leaves', birch_leaves: 'birch_leaves', glass: 'glass', sandstone: 'sandstone', sandstone_top: 'sandstone_top',
  sandstone_bottom: 'sandstone_bottom', short_grass: 'grass', fern: 'fern', dandelion: 'dandelion', poppy: 'poppy', cornflower: 'cornflower',
  oxeye_daisy: 'oxeye_daisy', dead_bush: 'dead_bush', sugar_cane: 'sugar_cane', cactus_side: 'cactus_side', cactus_top: 'cactus_top', cactus_bottom: 'cactus_bottom',
  oak_sapling: 'oak_sapling', spruce_sapling: 'spruce_sapling', birch_sapling: 'birch_sapling', crafting_table_top: 'crafting_table_top',
  crafting_table_side: 'crafting_table_side', crafting_table_front: 'crafting_table_front', furnace_front: 'furnace_front', furnace_front_on: 'furnace_front_on',
  furnace_side: 'furnace_side', furnace_top: 'furnace_top', torch: 'torch', bricks: 'bricks', bookshelf: 'bookshelf', mossy_cobblestone: 'mossy_cobblestone',
  obsidian: 'obsidian', snow: 'snow', ice: 'ice', clay: 'clay', pumpkin_side: 'pumpkin_side', pumpkin_top: 'pumpkin_top', jack_o_lantern: 'jack_o_lantern',
  pumpkin_face: 'carved_pumpkin', melon_side: 'melon_side', melon_top: 'melon_top', farmland: 'farmland', farmland_wet: 'farmland_moist',
  white_wool: 'white_wool', iron_block: 'iron_block', gold_block: 'gold_block', diamond_block: 'diamond_block', smooth_stone: 'smooth_stone',
  smooth_stone_slab_side: 'smooth_stone_slab_side', stone_bricks: 'stone_bricks', granite: 'granite', diorite: 'diorite', andesite: 'andesite',
  tnt_side: 'tnt_side', tnt_top: 'tnt_top', tnt_bottom: 'tnt_bottom', oak_door_top: 'oak_door_top', oak_door_bottom: 'oak_door_bottom', ladder: 'ladder',
  lantern: 'lantern', cobweb: 'cobweb', coal_block: 'coal_block', lapis_block: 'lapis_block', emerald_block: 'emerald_block', redstone_block: 'redstone_block',
  brown_mushroom: 'brown_mushroom', red_mushroom: 'red_mushroom', spawner: 'spawner', hay_side: 'hay_block_side', hay_top: 'hay_block_top', melon_stem: 'melon_stem',
  enchanting_table_top: 'enchanting_table_top', enchanting_table_side: 'enchanting_table_side', grass_side_snowed: 'grass_block_snow',
  // redstone, utility, village
  redstone_dust_dot: 'redstone_dust_dot', redstone_dust_line0: 'redstone_dust_line0', redstone_dust_line1: 'redstone_dust_line1',
  redstone_torch: 'redstone_torch', redstone_torch_off: 'redstone_torch_off', redstone_lamp: 'redstone_lamp', redstone_lamp_on: 'redstone_lamp_on',
  lever: 'lever', repeater: 'repeater', repeater_on: 'repeater_on', piston_side: 'piston_side', piston_top: 'piston_top', piston_top_sticky: 'piston_top_sticky',
  piston_bottom: 'piston_bottom', piston_inner: 'piston_inner', anvil: 'anvil', anvil_top: 'anvil_top', smithing_table_top: 'smithing_table_top',
  smithing_table_side: 'smithing_table_side', smithing_table_front: 'smithing_table_front', smithing_table_bottom: 'smithing_table_bottom',
  dirt_path_top: 'grass_path_top', dirt_path_side: 'grass_path_side',
  // nether
  netherrack: 'netherrack', nether_quartz_ore: 'nether_quartz_ore', nether_gold_ore: 'nether_gold_ore', soul_sand: 'soul_sand', soul_soil: 'soul_soil',
  glowstone: 'glowstone', magma: 'magma', basalt_side: 'basalt_side', basalt_top: 'basalt_top', blackstone: 'blackstone', blackstone_top: 'blackstone_top',
  nether_bricks: 'nether_bricks', crimson_nylium: 'crimson_nylium', crimson_nylium_side: 'crimson_nylium_side', warped_nylium: 'warped_nylium',
  warped_nylium_side: 'warped_nylium_side', crimson_stem: 'crimson_stem', crimson_stem_top: 'crimson_stem_top', warped_stem: 'warped_stem', warped_stem_top: 'warped_stem_top',
  nether_wart_block: 'nether_wart_block', warped_wart_block: 'warped_wart_block', shroomlight: 'shroomlight', crimson_fungus: 'crimson_fungus',
  warped_fungus: 'warped_fungus', crimson_roots: 'crimson_roots', warped_roots: 'warped_roots', nether_portal: 'nether_portal',
  ancient_debris_side: 'ancient_debris_side', ancient_debris_top: 'ancient_debris_top', netherite_block: 'netherite_block', quartz_block_side: 'quartz_block_side',
  quartz_block_top: 'quartz_block_top', crying_obsidian: 'crying_obsidian', nether_wart0: 'nether_wart_stage0', nether_wart1: 'nether_wart_stage1',
  nether_wart2: 'nether_wart_stage2', fire: 'fire_0', crimson_planks: 'crimson_planks', warped_planks: 'warped_planks',
  // end & strongholds
  end_stone: 'end_stone', end_portal_frame_top: 'end_portal_frame_top', end_portal_frame_side: 'end_portal_frame_side', end_portal_frame_eye: 'end_portal_frame_eye',
  end_stone_bricks: 'end_stone_bricks', dragon_egg: 'dragon_egg', mossy_stone_bricks: 'mossy_stone_bricks', cracked_stone_bricks: 'cracked_stone_bricks', iron_bars: 'iron_bars',
  slime_block: 'slime_block',
};
for (let i = 0; i < 8; i++) TILE['wheat' + i] = 'wheat_stage' + i;
const ANIM = { water: 'water_still', lava: 'lava_still', nether_portal: 'nether_portal', fire: 'fire_0', magma: 'magma' };
const TINTED = new Set(['grass_top', 'short_grass', 'fern', 'sugar_cane', 'oak_leaves', 'spruce_leaves', 'birch_leaves', 'redstone_dust_dot', 'redstone_dust_line0', 'redstone_dust_line1']);
// item key -> item/ texture (block/ prefix for items drawn with a block texture)
const ITEM = {};
for (const k of ('stick coal charcoal iron_ingot gold_ingot iron_nugget gold_nugget diamond emerald lapis_lazuli redstone flint flint_and_steel string feather gunpowder bone ' +
  'bone_meal arrow bow leather wheat_seeds wheat bread apple golden_apple porkchop cooked_porkchop beef cooked_beef chicken cooked_chicken mutton cooked_mutton ' +
  'rotten_flesh melon_slice mushroom_stew bowl sugar paper book bucket water_bucket lava_bucket milk_bucket snowball clay_ball brick shears egg saddle name_tag ink_sac ' +
  'oak_boat netherite_scrap netherite_ingot quartz glowstone_dust blaze_rod blaze_powder ender_pearl ender_eye ghast_tear magma_cream fire_charge nether_brick ' +
  'slime_ball repeater sugar_cane oak_door red_bed lantern nether_wart iron_door').split(' ')) ITEM[k] = 'item/' + k;
for (const m of ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite']) for (const t of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) ITEM[m + '_' + t] = 'item/' + m + '_' + t;
for (const m of ['leather', 'iron', 'golden', 'diamond', 'netherite']) for (const t of ['helmet', 'chestplate', 'leggings', 'boots']) ITEM[m + '_' + t] = 'item/' + m + '_' + t;
for (const k of ['torch', 'oak_sapling', 'spruce_sapling', 'birch_sapling', 'dandelion', 'poppy', 'cornflower', 'oxeye_daisy', 'dead_bush', 'ladder', 'cobweb',
  'brown_mushroom', 'red_mushroom', 'redstone_torch', 'lever', 'crimson_fungus', 'warped_fungus', 'crimson_roots', 'warped_roots', 'iron_bars']) ITEM[k] = 'block/' + k;
ITEM.short_grass = 'block/grass'; ITEM.fern = 'block/fern';
const ITEM_TINT = { leather_helmet: 0xa06540, leather_chestplate: 0xa06540, leather_leggings: 0xa06540, leather_boots: 0xa06540, short_grass: 0x7cbd6b, fern: 0x7cbd6b };
const ENT = {
  zombie: 'entity/zombie/zombie', skeleton: 'entity/skeleton/skeleton', creeper: 'entity/creeper/creeper', spider: 'entity/spider/spider', pig: 'entity/pig/pig',
  cow: 'entity/cow/cow', sheep: 'entity/sheep/sheep', sheep_fur: 'entity/sheep/sheep_fur', chicken: 'entity/chicken', squid: 'entity/squid', steve: 'entity/steve',
  villager: 'entity/villager/villager', iron_golem: 'entity/iron_golem/iron_golem', enderman: 'entity/enderman/enderman', enderman_eyes: 'entity/enderman/enderman_eyes',
  blaze: 'entity/blaze', ghast: 'entity/ghast/ghast', ghast_shooting: 'entity/ghast/ghast_shooting', zombified_piglin: 'entity/piglin/zombified_piglin',
  magma_cube: 'entity/slime/magmacube', slime: 'entity/slime/slime', dragon: 'entity/enderdragon/dragon', dragon_eyes: 'entity/enderdragon/dragon_eyes',
  end_crystal: 'entity/end_crystal/end_crystal', boat: 'entity/boat/oak', chest: 'entity/chest/normal', bed: 'entity/bed/red', xp_orb: 'entity/experience_orb',
};
for (const t of ['plains', 'desert', 'snow', 'taiga', 'swamp']) ENT['vtype_' + t] = 'entity/villager/type/' + t;
for (const p of ['farmer', 'librarian', 'armorer', 'toolsmith', 'weaponsmith', 'butcher', 'cleric', 'fletcher', 'shepherd', 'mason', 'leatherworker', 'cartographer', 'fisherman', 'nitwit']) ENT['vprof_' + p] = 'entity/villager/profession/' + p;

// ---------- optional: copy the needed files out of a full pack ----------
const fromIdx = process.argv.indexOf('--from');
const allFiles = () => [...Object.values(TILE).map(f => 'block/' + f), ...Object.values(ANIM).map(f => 'block/' + f), 'block/grass_block_side', 'block/grass_block_side_overlay',
  ...Object.values(ITEM), 'item/leather_helmet_overlay', ...Object.values(ENT)];
if (fromIdx > 0) {
  const src = path.join(process.argv[fromIdx + 1], 'assets', 'minecraft', 'textures');
  let n = 0;
  for (const f of new Set(allFiles())) { const s = path.join(src, f + '.png'); if (!fs.existsSync(s)) { console.warn('missing', f); continue; } const d = path.join(ASSET, f + '.png'); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); n++; }
  console.log('copied', n, 'textures');
}
const load = f => { const p = path.join(ASSET, f + '.png'); return fs.existsSync(p) ? decodePNG(fs.readFileSync(p)) : null; };

// ---------- build ----------
const chunks = []; let off = 0;
const put = px => { const o = off; chunks.push(Buffer.from(px.buffer, px.byteOffset, px.length)); off += px.length; return o; };
const crop16 = img => img.w === 16 && img.h === 16 ? img.px : img.px.slice(0, 16 * 16 * 4); // first animation frame
const out = { tiles: {}, anim: {}, items: {}, ent: {} };
for (const [tile, f] of Object.entries(TILE)) {
  const img = load('block/' + f); if (!img) continue;
  let px = new Uint8Array(crop16(img));
  if (TINTED.has(tile)) for (let i = 3; i < px.length; i += 4) if (px[i] >= 128) px[i] = 240; // tint marker alpha
  out.tiles[tile] = put(px);
  if (tile.endsWith('_leaves')) { // opaque variant for "fast" graphics: holes filled with a dark leaf colour
    const o = new Uint8Array(px); let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < o.length; i += 4) if (o[i + 3]) { r += o[i]; g += o[i + 1]; b += o[i + 2]; n++; }
    for (let i = 0; i < o.length; i += 4) if (!o[i + 3]) { o[i] = r / n * 0.55; o[i + 1] = g / n * 0.55; o[i + 2] = b / n * 0.55; o[i + 3] = 240; }
    out.tiles[tile + '_o'] = put(o);
  }
}
{ // grass block side = dirt side + tinted grayscale overlay
  const base = load('block/grass_block_side'), ov = load('block/grass_block_side_overlay');
  if (base && ov) { const px = new Uint8Array(crop16(base)), o = crop16(ov); for (let i = 0; i < px.length; i += 4) if (o[i + 3] >= 128) { px[i] = o[i]; px[i + 1] = o[i + 1]; px[i + 2] = o[i + 2]; px[i + 3] = 240; } out.tiles.grass_side = put(px); }
}
for (const [k, f] of Object.entries(ANIM)) { const img = load('block/' + f); if (img && img.h > img.w) out.anim[k] = [put(new Uint8Array(img.px)), img.h / img.w]; }
{ // chest and bed tiles composed from their entity textures
  const ch = load(ENT.chest);
  if (ch) {
    const P = ch.px, W = ch.w, tile = () => new Uint8Array(16 * 16 * 4);
    const blit = (dst, sx, sy, w, h, dx, dy) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((sy + y) * W + sx + x) * 4, d = ((dy + y) * 16 + dx + x) * 4; for (let c = 0; c < 4; c++) dst[d + c] = P[s + c]; } };
    const top = tile(); blit(top, 14, 0, 14, 14, 1, 1); out.tiles.chest_top = put(top);
    const front = tile(); blit(front, 14, 14, 14, 5, 1, 2); blit(front, 14, 34, 14, 9, 1, 7); blit(front, 1, 1, 2, 4, 7, 4); out.tiles.chest_front = put(front);
    const side = tile(); blit(side, 0, 14, 14, 5, 1, 2); blit(side, 0, 34, 14, 9, 1, 7); out.tiles.chest_side = put(side);
  }
  const bed = load(ENT.bed);
  if (bed) {
    const P = bed.px, W = bed.w;
    const rot = (sx, sy) => { const t = new Uint8Array(16 * 16 * 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = ((sy + y) * W + sx + x) * 4, d = (y * 16 + x) * 4; for (let c = 0; c < 4; c++) t[d + c] = P[s + c]; } return t; };
    out.tiles.bed_head = put(rot(6, 6)); out.tiles.bed_foot = put(rot(6, 28));
  }
}
for (const [k, f] of Object.entries(ITEM)) {
  const img = load(f); if (!img) continue;
  const px = new Uint8Array(crop16(img)), tint = ITEM_TINT[k];
  if (tint) {
    const tr = tint >> 16, tg = (tint >> 8) & 255, tb = tint & 255, ov = k.startsWith('leather_') ? load(f + '_overlay') : null;
    for (let i = 0; i < px.length; i += 4) { if (ov && ov.px[i + 3]) { for (let c = 0; c < 4; c++) px[i + c] = ov.px[i + c]; continue; } px[i] = px[i] * tr / 255; px[i + 1] = px[i + 1] * tg / 255; px[i + 2] = px[i + 2] * tb / 255; }
  }
  out.items[k] = put(px);
}
for (const [k, f] of Object.entries(ENT)) { if (k === 'chest' || k === 'bed') continue; const img = load(f); if (img) out.ent[k] = [put(new Uint8Array(img.px)), img.w, img.h]; }
const gz = zlib.gzipSync(Buffer.concat(chunks), { level: 9 });
const js = `// Generated by tools/pack.js from Pixel Perfection CE (CC BY-SA 4.0, XSSheep and contributors). Do not edit.\n` +
  `const PACK = ${JSON.stringify(out)};\nPACK.data = '${gz.toString('base64')}';\n`;
fs.writeFileSync(path.join(root, 'js', 'pack.js'), js);
console.log(`js/pack.js: ${Object.keys(out.tiles).length} tiles, ${Object.keys(out.anim).length} animations, ${Object.keys(out.items).length} items, ${Object.keys(out.ent).length} entity textures, ${(off / 1024).toFixed(0)} KB raw -> ${(js.length / 1024).toFixed(0)} KB`);

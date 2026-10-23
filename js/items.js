// Item registry, recipes, smelting and block drops (main thread).
const S = SHARED();
const { CH, BLOCKS, BID, RT, TOOL } = S;

const ITEMS = [];          // id -> def
const IID = {};            // key -> id
// block items: ids 0..255 mirror block ids
const NO_ITEM = new Set(['air', 'water', 'lava', 'wheat', 'farmland', 'lit_furnace', 'budding_amethyst', 'spawner', 'redstone_wire', 'unlit_redstone_torch', 'lit_redstone_lamp',
  'piston_head', 'nether_portal', 'nether_wart', 'fire', 'end_portal', 'crops2', 'soul_fire', 'cave_vines', 'big_dripleaf_stem']);
const SPRITE_BLOCKS = { short_grass: 'short_grass', fern: 'fern', dandelion: 'dandelion', poppy: 'poppy', cornflower: 'cornflower', oxeye_daisy: 'oxeye_daisy',
  dead_bush: 'dead_bush', sugar_cane: 'sugar_cane_item', oak_sapling: 'oak_sapling', spruce_sapling: 'spruce_sapling', birch_sapling: 'birch_sapling', torch: 'torch',
  amethyst_cluster: 'amethyst_cluster', spore_blossom: 'spore_blossom', small_dripleaf: 'small_dripleaf_top', hanging_roots: 'hanging_roots', small_amethyst_bud: 'small_amethyst_bud', medium_amethyst_bud: 'medium_amethyst_bud', large_amethyst_bud: 'large_amethyst_bud', pointed_dripstone: 'pointed_dripstone', glow_lichen: 'glow_lichen', ladder: 'ladder', cobweb: 'cobweb', brown_mushroom: 'brown_mushroom', red_mushroom: 'red_mushroom',
  oak_door: 'oak_door_item', red_bed: 'bed_item', lantern: 'lantern_item' };
for (const b of BLOCKS) {
  if (!b || NO_ITEM.has(b.key)) continue;
  ITEMS[b.id] = { id: b.id, key: b.key, name: b.name, stack: 64, place: b.id, block: b, sprite: SPRITE_BLOCKS[b.key] || null };
  IID[b.key] = b.id;
  if (b.vars) { ITEMS[b.id].key = b.vk[0]; ITEMS[b.id].name = b.vn[0]; ITEMS[b.id].vi = 0; IID[b.vk[0]] = b.id; }
}
ITEMS[BID.red_bed].stack = 1; ITEMS[BID.oak_door].stack = 64; ITEMS[BID.red_bed].name = '침대';
BLOCKS[BID.red_bed].name = '침대';
ITEMS[BID.tnt].fuel = 0;

let nextId = 256;
function item(key, name, o = {}) { const id = nextId++; ITEMS[id] = { id, key, name, stack: 64, ...o }; IID[key] = id; return id; }
// one item per variant of colour/material blocks (variant 0 lives at the block id)
const VARITEM = new Int32Array(S.NB * 16).fill(-1);
for (const b of BLOCKS) if (b && b.vars && !NO_ITEM.has(b.key)) { VARITEM[b.id * 16] = b.id; if (!b.late && b.id < S.NEWB) for (let k = 1; k < b.vars.length; k++) VARITEM[b.id * 16 + k] = item(b.vk[k], b.vn[k], { place: b.id, vi: k, block: b }); }
// the item a block (with its meta) drops or is picked as
const itemOfBlock = (b, m) => { const d = BLOCKS[b]; if (!d) return b; const cd = (b === 198 || b === 246) && S.candleOf(b, m); if (cd) return cd.c < 0 ? IID.candle : IID[S.COLORS[cd.c] + '_candle']; if (d.vars) { const i = VARITEM[b * 16 + ((m >> (d.vshift || 0)) & 15)]; return i >= 0 ? i : b; } return b; };
// materials: [name prefix, harvest tier, mining speed, durability, colors]
const MATS = {
  wooden: ['나무', 1, 2, 59], stone: ['돌', 2, 4, 131], iron: ['철', 3, 6, 250], golden: ['금', 1, 12, 32], diamond: ['다이아몬드', 4, 8, 1561], netherite: ['네더라이트', 4, 9, 2031] };
const TOOL_DMG = {
  sword: { wooden: [4, 1.6], stone: [5, 1.6], iron: [6, 1.6], golden: [4, 1.6], diamond: [7, 1.6], netherite: [8, 1.6] },
  axe: { wooden: [7, 0.8], stone: [9, 0.8], iron: [9, 0.9], golden: [7, 1.0], diamond: [9, 1.0], netherite: [10, 1.0] },
  pickaxe: { wooden: [2, 1.2], stone: [3, 1.2], iron: [4, 1.2], golden: [2, 1.2], diamond: [5, 1.2], netherite: [6, 1.2] },
  shovel: { wooden: [2.5, 1], stone: [3.5, 1], iron: [4.5, 1], golden: [2.5, 1], diamond: [5.5, 1], netherite: [6.5, 1] },
  hoe: { wooden: [1, 1], stone: [1, 2], iron: [1, 3], golden: [1, 1], diamond: [1, 4], netherite: [1, 4] } };
const TOOL_NAME = { sword: '검', pickaxe: '곡괭이', axe: '도끼', shovel: '삽', hoe: '괭이' };
const TOOL_TYPE = { sword: TOOL.SWORD, pickaxe: TOOL.PICK, axe: TOOL.AXE, shovel: TOOL.SHOVEL, hoe: TOOL.HOE };

item('stick', '막대기', { fuel: 100 });
item('coal', '석탄', { fuel: 1600 });
item('charcoal', '숯', { fuel: 1600 });
item('raw_iron', '철 원석'); item('raw_gold', '금 원석'); item('raw_copper', '구리 원석');
item('iron_ingot', '철 주괴'); item('gold_ingot', '금 주괴'); item('copper_ingot', '구리 주괴');
item('iron_nugget', '철 조각'); item('gold_nugget', '금 조각');
item('diamond', '다이아몬드'); item('emerald', '에메랄드'); item('lapis_lazuli', '청금석'); item('redstone', '레드스톤 가루');
item('flint', '부싯돌'); item('flint_and_steel', '부싯돌과 부시', { stack: 1, dur: 64 });
item('string', '실'); item('feather', '깃털'); item('gunpowder', '화약'); item('bone', '뼈'); item('bone_meal', '뼛가루');
item('arrow', '화살'); item('bow', '활', { stack: 1, dur: 384 });
item('leather', '가죽');
item('wheat_seeds', '밀 씨앗', { place: BID.wheat, plant: 1 });
item('wheat', '밀');
item('bread', '빵', { food: [5, 6] });
item('apple', '사과', { food: [4, 2.4] });
item('golden_apple', '황금 사과', { food: [4, 9.6], always: 1, eff: [['regeneration', 100, 1], ['absorption', 2400, 0]] });
item('porkchop', '익히지 않은 돼지고기', { food: [3, 1.8] }); item('cooked_porkchop', '익힌 돼지고기', { food: [8, 12.8] });
item('beef', '익히지 않은 소고기', { food: [3, 1.8] }); item('cooked_beef', '스테이크', { food: [8, 12.8] });
item('chicken', '익히지 않은 닭고기', { food: [2, 1.2], eff: [['hunger', 600, 0, 0.3]] }); item('cooked_chicken', '익힌 닭고기', { food: [6, 7.2] });
item('mutton', '익히지 않은 양고기', { food: [2, 1.2] }); item('cooked_mutton', '익힌 양고기', { food: [6, 9.6] });
item('rotten_flesh', '썩은 살점', { food: [4, 0.8], eff: [['hunger', 600, 0, 0.8]] });
item('melon_slice', '수박 조각', { food: [2, 1.2] });
item('mushroom_stew', '버섯 스튜', { food: [6, 7.2], stack: 1, leaves: 'bowl' });
item('bowl', '그릇');
item('sugar', '설탕'); item('paper', '종이'); item('book', '책');
item('bucket', '양동이', { stack: 16 });
item('water_bucket', '물 양동이', { stack: 1 }); item('lava_bucket', '용암 양동이', { stack: 1, fuel: 20000 });
item('milk_bucket', '우유 양동이', { stack: 1 }); item('powder_snow_bucket', '가루눈 양동이', { stack: 1 });
item('snowball', '눈덩이', { stack: 16 }); item('clay_ball', '점토 덩이'); item('brick', '벽돌');
item('amethyst_shard', '자수정 조각');
item('spyglass', '망원경', { stack: 1 });
item('shears', '가위', { stack: 1, dur: 238 });
item('egg', '달걀', { stack: 16 });
item('saddle', '안장', { stack: 1 }); item('name_tag', '이름표');
item('ink_sac', '먹물 주머니'); item('glow_ink_sac', '발광 먹물 주머니');
// Nether & End
item('netherite_scrap', '네더라이트 파편'); item('netherite_ingot', '네더라이트 주괴');
item('quartz', '네더 석영'); item('glowstone_dust', '발광석 가루'); item('nether_brick', '네더 벽돌');
item('nether_wart', '네더 사마귀', { place: BID.nether_wart, plant: 1 });
item('blaze_rod', '블레이즈 막대', { fuel: 2400 }); item('blaze_powder', '블레이즈 가루');
item('ghast_tear', '가스트의 눈물'); item('magma_cream', '마그마 크림'); item('fire_charge', '화염구');
item('ender_pearl', '엔더 진주', { stack: 16 }); item('ender_eye', '엔더의 눈');
item('slime_ball', '슬라임볼');
item('oak_boat', '참나무 보트', { stack: 1, fuel: 1200 });
for (const [w, n] of [['spruce', '가문비나무'], ['birch', '자작나무'], ['jungle', '정글나무'], ['acacia', '아카시아나무'], ['dark_oak', '짙은 참나무']]) item(w + '_boat', n + ' 보트', { stack: 1, fuel: 1200, boat: w });
// dyes, crops and food
S.COLORS.forEach((c, i) => item(c + '_dye', S.COLKO[i] + ' 염료'));
item('cocoa_beans', '코코아 콩');
item('carrot', '당근', { food: [3, 3.6], place: BID.crops2, pmeta: 0, plant: 1 });
item('potato', '감자', { food: [1, 0.6], place: BID.crops2, pmeta: 8, plant: 1 });
item('baked_potato', '구운 감자', { food: [5, 6] }); item('poisonous_potato', '독이 있는 감자', { food: [2, 1.2], eff: [['poison', 100, 0, 0.6]] });
item('beetroot', '비트', { food: [1, 1.2] }); item('beetroot_seeds', '비트 씨앗', { place: BID.crops2, pmeta: 16, plant: 1 });
item('beetroot_soup', '비트 수프', { food: [6, 7.2], stack: 1, leaves: 'bowl' }); item('golden_carrot', '황금 당근', { food: [6, 14.4] });
item('cookie', '쿠키', { food: [2, 0.4] }); item('pumpkin_pie', '호박 파이', { food: [8, 4.8] });
item('cod', '익히지 않은 대구', { food: [2, 0.4] }); item('cooked_cod', '익힌 대구', { food: [5, 6] });
item('salmon', '익히지 않은 연어', { food: [2, 0.4] }); item('cooked_salmon', '익힌 연어', { food: [6, 9.6] });
item('dried_kelp', '말린 켈프', { food: [1, 0.6] }); item('spider_eye', '거미 눈', { food: [2, 3.2], eff: [['poison', 100, 0]] });
item('chorus_fruit', '후렴과', { food: [4, 2.4], always: 1, chorusTp: 1 }); item('popped_chorus_fruit', '튀긴 후렴과');
// treasure and tools
item('prismarine_shard', '프리즈머린 조각'); item('prismarine_crystals', '프리즈머린 수정'); item('shulker_shell', '셜커 껍데기');
item('totem_of_undying', '불사의 토템', { stack: 1 }); item('experience_bottle', '경험치 병');
item('elytra', '겉날개', { stack: 1, dur: 432, armor: { slot: 1, pts: 0, tough: 0, mat: 'elytra' }, elytra: 1 });
item('fishing_rod', '낚싯대', { stack: 1, dur: 64 }); item('compass', '나침반'); item('clock', '시계');
item('enchanted_book', '마법이 부여된 책', { stack: 1 });
for (const m of Object.keys(MATS)) for (const t of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) {
  const [pre, tier, speed, dur] = MATS[m]; const [dmg, as] = TOOL_DMG[t][m];
  item(m + '_' + t, pre + ' ' + TOOL_NAME[t], { stack: 1, dur, tool: { type: TOOL_TYPE[t], tier, speed, dmg, as, mat: m, kind: t }, fuel: m === 'wooden' ? 200 : 0 });
}
const ARMOR = { leather: ['가죽', [1, 3, 2, 1], [55, 80, 75, 65], 0], golden: ['금', [2, 5, 3, 1], [77, 112, 105, 91], 0], iron: ['철', [2, 6, 5, 2], [165, 240, 225, 195], 0], diamond: ['다이아몬드', [3, 8, 6, 3], [363, 528, 495, 429], 2],
  netherite: ['네더라이트', [3, 8, 6, 3], [407, 592, 555, 481], 3], chainmail: ['사슬', [2, 5, 4, 1], [165, 240, 225, 195], 0] };
const ARMOR_PART = [['helmet', '헬멧'], ['chestplate', '흉갑'], ['leggings', '레깅스'], ['boots', '부츠']];
for (const m of Object.keys(ARMOR)) ARMOR_PART.forEach(([k, nm], slot) => {
  const [pre, pts, durs, tough] = ARMOR[m];
  item(m + '_' + k, (m === 'leather' ? '가죽 ' : pre + ' ') + nm, { stack: 1, dur: durs[slot], armor: { slot, pts: pts[slot], tough, mat: m } });
});
// ---------- later additions: always appended here, because saved worlds store item ids by position ----------
for (const b of BLOCKS) if (b && b.late) for (let k = 1; k < b.vars.length; k++) VARITEM[b.id * 16 + k] = item(b.vk[k], b.vn[k], { place: b.id, vi: k, block: b }); // waxed copper, lightning rod, candle
item('honeycomb', '꿀벌집 조각');
S.COLORS.forEach((c, i) => item(c + '_candle', S.COLKO[i] + ' 양초', { candle: i, sprite: c + '_candle_item' }));
item('tropical_fish', '열대어', { food: [1, 0.2] });
item('axolotl_bucket', '아홀로틀 양동이', { stack: 1 }); item('tropical_fish_bucket', '열대어 양동이', { stack: 1 });
Object.assign(ITEMS[IID.candle], { candle: -1, sprite: 'candle_item' }); ITEMS[IID.lightning_rod].sprite = 'lightning_rod_item';
// ---- everything below is newer than the item id table (see the end of this file), so its order is free ----
item('glow_berries', '발광 열매', { food: [2, 0.4] });
item('enchanted_golden_apple', '마법이 부여된 황금 사과', { food: [4, 9.6], always: 1, glint: 1, sprite: 'golden_apple', eff: [['regeneration', 400, 1], ['absorption', 2400, 3], ['resistance', 6000, 0], ['fire_resistance', 6000, 0]] });
item('item_frame', '아이템 액자', { sprite: 'item_frame_item' }); item('glow_item_frame', '발광 아이템 액자', { sprite: 'glow_item_frame_item' });
for (const b of BLOCKS) if (b && b.vars && b.id >= S.NEWB && !NO_ITEM.has(b.key)) for (let k = 1; k < b.vars.length; k++) VARITEM[b.id * 16 + k] = item(b.vk[k], b.vn[k], { place: b.id, vi: k, block: b });
// fuel for wooden blocks
for (const k of ['oak_planks', 'spruce_planks', 'birch_planks', 'oak_log', 'spruce_log', 'birch_log', 'crafting_table', 'chest', 'bookshelf', 'oak_door', 'ladder', 'oak_slab', 'oak_stairs', 'oak_fence',
  'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'jungle_log', 'acacia_log', 'dark_oak_log', 'stripped_oak_log', 'stripped_spruce_log', 'stripped_birch_log', 'stripped_jungle_log', 'stripped_acacia_log', 'stripped_dark_oak_log',
  'oak_trapdoor', 'barrel', 'composter', 'cartography_table', 'fletching_table', 'loom', 'lectern', 'note_block', 'daylight_detector',
  'spruce_slab', 'birch_slab', 'jungle_slab', 'acacia_slab', 'dark_oak_slab', 'spruce_stairs', 'birch_stairs', 'jungle_stairs', 'acacia_stairs', 'dark_oak_stairs',
  'spruce_fence', 'birch_fence', 'jungle_fence', 'acacia_fence', 'dark_oak_fence']) ITEMS[IID[k]].fuel = k.endsWith('_slab') ? 150 : 300;
for (const k of ['jungle_sapling', 'acacia_sapling', 'dark_oak_sapling', 'fishing_rod', ...S.COLORS.map(c => c + '_wool'), ...S.COLORS.map(c => c + '_carpet')]) if (IID[k] != null) ITEMS[IID[k]].fuel = k.endsWith('carpet') ? 67 : 100;
for (const k of ['oak_sapling', 'spruce_sapling', 'birch_sapling', 'white_wool']) ITEMS[IID[k]].fuel = 100;
ITEMS[IID.coal_block].fuel = 16000; ITEMS[IID.bow].fuel = 300; ITEMS[IID.bowl].fuel = 100;
// netherite floats in lava and never burns; redstone dust places wire
for (const k in IID) if (k.startsWith('netherite') || k === 'ancient_debris') ITEMS[IID[k]].fireproof = 1;
ITEMS[IID.redstone].place = BID.redstone_wire;
for (const k of ['lever', 'stone_button', 'stone_pressure_plate', 'repeater', 'redstone_torch']) ITEMS[IID[k]].name = BLOCKS[BID[k]].name;

const itemName = id => ITEMS[id] ? ITEMS[id].name : '?';
const maxStack = id => ITEMS[id] ? ITEMS[id].stack : 64;

// ---------- enchantments ----------
// key: [name, max level, applicable kinds]
const ENCH = {
  efficiency: ['효율', 5, ['pickaxe', 'axe', 'shovel', 'hoe']], unbreaking: ['내구성', 3, ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'armor', 'bow']],
  fortune: ['행운', 3, ['pickaxe', 'axe', 'shovel']], silk_touch: ['섬세한 손길', 1, ['pickaxe', 'axe', 'shovel']],
  sharpness: ['날카로움', 5, ['sword', 'axe']], knockback: ['밀치기', 2, ['sword']], looting: ['약탈', 3, ['sword']],
  protection: ['보호', 4, ['armor']], feather_falling: ['가벼운 착지', 4, ['boots']], power: ['힘', 5, ['bow']], infinity: ['무한', 1, ['bow']],
  mending: ['수선', 1, ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'armor', 'bow'], 1] }; // 4th field: treasure (never from the enchanting table)
const ENCH_EXCL = [['fortune', 'silk_touch'], ['mending', 'infinity']];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const enchLv = (st, k) => (st && st.e && st.e[k]) || 0;
function enchKinds(id) { const d = ITEMS[id]; if (!d) return []; if (d.tool) return [d.tool.kind]; if (d.armor) return d.armor.slot === 3 ? ['armor', 'boots'] : ['armor']; if (id === IID.bow) return ['bow']; return []; }
function enchText(st) { return st && st.e ? Object.entries(st.e).map(([k, l]) => ENCH[k][0] + (ENCH[k][1] > 1 ? ' ' + ROMAN[l] : '')) : []; }
// Java-like roll: modified level -> weighted pick of applicable enchantments
function rollEnchant(id, level, seed) {
  const r = S.rng(seed), kinds = enchKinds(id), d = ITEMS[id];
  const ability = d.tool ? ({ wooden: 15, stone: 5, iron: 14, golden: 22, diamond: 10, netherite: 15 })[d.tool.mat] : d.armor ? ({ leather: 15, golden: 25, iron: 9, diamond: 10, netherite: 15 })[d.armor.mat] : 1;
  let L = level + 1 + r.int(Math.floor(ability / 4) + 1) + r.int(Math.floor(ability / 4) + 1);
  L = Math.max(1, Math.round(L * (1 + (r() + r() - 1) * 0.15)));
  const pool = Object.keys(ENCH).filter(k => !ENCH[k][3] && ENCH[k][2].some(t => kinds.includes(t)));
  const out = {};
  const pick = () => { const opts = pool.filter(k => !out[k] && !ENCH_EXCL.some(g => g.includes(k) && g.some(o => out[o]))); if (!opts.length) return false; const k = opts[r.int(opts.length)]; out[k] = Math.max(1, Math.min(ENCH[k][1], Math.ceil(L / 30 * ENCH[k][1] + (r() - 0.3)))); return true; };
  pick(); while (r.int(50) <= L) { if (!pick()) break; L = Math.floor(L / 2); }
  return out;
}

// ---------- recipes ----------
const TAGS = {
  planks: [BID.oak_planks, BID.spruce_planks, BID.birch_planks, BID.crimson_planks, BID.warped_planks, BID.jungle_planks, BID.acacia_planks, BID.dark_oak_planks],
  logs: [BID.oak_log, BID.spruce_log, BID.birch_log, BID.jungle_log, BID.acacia_log, BID.dark_oak_log, BID.stripped_oak_log, BID.stripped_spruce_log, BID.stripped_birch_log, BID.stripped_jungle_log, BID.stripped_acacia_log, BID.stripped_dark_oak_log],
  wool: S.COLORS.map(c => IID[c + '_wool']), wooden_slabs: [IID.oak_slab, ...['spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'crimson', 'warped'].map(w => IID[w + '_slab'])],
  soul: [BID.soul_sand, BID.soul_soil], stone_slabs: [IID.cobblestone_slab, IID.smooth_stone_slab, IID.stone_slab, IID.stone_brick_slab],
  stone_crafting: [BID.cobblestone, BID.cobbled_deepslate],
  coals: [IID.coal, IID.charcoal],
};
const RECIPES = [];
function shaped(out, n, pattern, keys) {
  const k = {};
  for (const ch in keys) { const v = keys[ch]; k[ch] = Array.isArray(v) ? v : TAGS[v] || [IID[v]]; }
  RECIPES.push({ out: typeof out === 'number' ? out : IID[out], n, p: pattern, k });
}
function shapeless(out, n, ings) { RECIPES.push({ out: IID[out], n, s: ings.map(v => TAGS[v] || [IID[v]]) }); }
[['oak_log', 'oak_planks'], ['spruce_log', 'spruce_planks'], ['birch_log', 'birch_planks'], ['crimson_stem', 'crimson_planks'], ['warped_stem', 'warped_planks']].forEach(([l, p]) => shapeless(p, 4, [l]));
shaped('stick', 4, ['#', '#'], { '#': 'planks' });
shaped('crafting_table', 1, ['##', '##'], { '#': 'planks' });
shaped('furnace', 1, ['###', '# #', '###'], { '#': 'stone_crafting' });
shaped('chest', 1, ['###', '# #', '###'], { '#': 'planks' });
shaped('torch', 4, ['C', 'S'], { C: 'coals', S: 'stick' });
const HEADS = { wooden: 'planks', stone: 'stone_crafting', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' }; // netherite gear comes from the smithing table
for (const m in HEADS) {
  const X = HEADS[m];
  shaped(m + '_pickaxe', 1, ['XXX', ' S ', ' S '], { X, S: 'stick' });
  shaped(m + '_axe', 1, ['XX', 'XS', ' S'], { X, S: 'stick' });
  shaped(m + '_shovel', 1, ['X', 'S', 'S'], { X, S: 'stick' });
  shaped(m + '_sword', 1, ['X', 'X', 'S'], { X, S: 'stick' });
  shaped(m + '_hoe', 1, ['XX', ' S', ' S'], { X, S: 'stick' });
}
for (const [m, X] of [['leather', 'leather'], ['iron', 'iron_ingot'], ['golden', 'gold_ingot'], ['diamond', 'diamond']]) {
  shaped(m + '_helmet', 1, ['XXX', 'X X'], { X });
  shaped(m + '_chestplate', 1, ['X X', 'XXX', 'XXX'], { X });
  shaped(m + '_leggings', 1, ['XXX', 'X X', 'X X'], { X });
  shaped(m + '_boots', 1, ['X X', 'X X'], { X });
}
const STORAGE = [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['diamond_block', 'diamond'], ['emerald_block', 'emerald'], ['lapis_block', 'lapis_lazuli'],
  ['redstone_block', 'redstone'], ['coal_block', 'coal'], ['raw_iron_block', 'raw_iron'], ['raw_gold_block', 'raw_gold'], ['raw_copper_block', 'raw_copper'],
  ['copper_block', 'copper_ingot'], ['hay_block', 'wheat'], ['iron_ingot', 'iron_nugget'], ['gold_ingot', 'gold_nugget'], ['netherite_block', 'netherite_ingot'], ['slime_block', 'slime_ball']];
for (const [b, i] of STORAGE) { shaped(b, 1, ['###', '###', '###'], { '#': i }); shapeless(i, 9, [b]); }
shaped('melon', 1, ['###', '###', '###'], { '#': 'melon_slice' });
shaped('bricks', 1, ['##', '##'], { '#': 'brick' });
shaped('stone_bricks', 4, ['##', '##'], { '#': 'stone' });
shaped('sandstone', 1, ['##', '##'], { '#': 'sand' });
shaped('snow_block', 1, ['##', '##'], { '#': 'snowball' });
shaped('clay', 1, ['##', '##'], { '#': 'clay_ball' });
shaped('white_wool', 1, ['##', '##'], { '#': 'string' });
shaped('amethyst_block', 1, ['##', '##'], { '#': 'amethyst_shard' });
shaped('dripstone_block', 1, ['##', '##'], { '#': 'pointed_dripstone' });
shaped('cut_copper', 4, ['##', '##'], { '#': 'copper_block' });
shaped('bookshelf', 1, ['###', 'BBB', '###'], { '#': 'planks', B: 'book' });
shapeless('book', 1, ['paper', 'paper', 'paper', 'leather']);
shaped('paper', 3, ['###'], { '#': 'sugar_cane' });
shapeless('sugar', 1, ['sugar_cane']);
shaped('bread', 1, ['###'], { '#': 'wheat' });
shaped('bucket', 1, ['# #', ' # '], { '#': 'iron_ingot' });
shaped('shears', 1, [' #', '# '], { '#': 'iron_ingot' });
shapeless('flint_and_steel', 1, ['iron_ingot', 'flint']);
shaped('bow', 1, [' #S', '# S', ' #S'], { '#': 'stick', S: 'string' });
shaped('arrow', 4, ['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' });
shaped('bowl', 4, ['# #', ' # '], { '#': 'planks' });
shapeless('mushroom_stew', 1, ['brown_mushroom', 'red_mushroom', 'bowl']);
shaped('golden_apple', 1, ['###', '#A#', '###'], { '#': 'gold_ingot', A: 'apple' });
shaped('tnt', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' });
shaped('ladder', 3, ['S S', 'SSS', 'S S'], { S: 'stick' });
shaped('oak_door', 3, ['##', '##', '##'], { '#': 'oak_planks' });
shaped('red_bed', 1, ['WWW', '###'], { W: 'wool', '#': 'planks' });
shaped('oak_slab', 6, ['###'], { '#': 'oak_planks' });
shaped('cobblestone_slab', 6, ['###'], { '#': 'cobblestone' });
shaped('smooth_stone_slab', 6, ['###'], { '#': 'smooth_stone' });
shaped('lantern', 1, ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'torch' });
shaped('oak_stairs', 4, ['#  ', '## ', '###'], { '#': 'oak_planks' });
shaped('cobblestone_stairs', 4, ['#  ', '## ', '###'], { '#': 'cobblestone' });
shaped('stone_brick_stairs', 4, ['#  ', '## ', '###'], { '#': 'stone_bricks' });
shaped('oak_fence', 3, ['W#W', 'W#W'], { W: 'oak_planks', '#': 'stick' });
shaped('glass_pane', 16, ['###', '###'], { '#': 'glass' });
shaped('enchanting_table', 1, [' B ', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' });
shaped('jack_o_lantern', 1, ['P', 'T'], { P: 'pumpkin', T: 'torch' });
shapeless('bone_meal', 3, ['bone']);
shaped('spyglass', 1, ['A', 'C', 'C'], { A: 'amethyst_shard', C: 'copper_ingot' });
shaped('tinted_glass', 2, [' A ', 'AGA', ' A '], { A: 'amethyst_shard', G: 'glass' });
shapeless('mossy_cobblestone', 1, ['cobblestone', 'moss_block']);
shapeless('mossy_stone_bricks', 1, ['stone_bricks', 'moss_block']);
// redstone
shaped('redstone_torch', 1, ['R', 'S'], { R: 'redstone', S: 'stick' });
shaped('lever', 1, ['S', 'C'], { S: 'stick', C: 'cobblestone' });
shapeless('stone_button', 1, ['stone']);
shaped('stone_pressure_plate', 1, ['##'], { '#': 'stone' });
shaped('repeater', 1, ['TRT', 'SSS'], { T: 'redstone_torch', R: 'redstone', S: 'stone' });
shaped('piston', 1, ['PPP', 'CIC', 'CRC'], { P: 'planks', C: 'cobblestone', I: 'iron_ingot', R: 'redstone' });
shaped('sticky_piston', 1, ['S', 'P'], { S: 'slime_ball', P: 'piston' });
shaped('redstone_lamp', 1, [' R ', 'RGR', ' R '], { R: 'redstone', G: 'glowstone' });
// village & utility
shaped('anvil', 1, ['BBB', ' I ', 'III'], { B: 'iron_block', I: 'iron_ingot' });
shaped('smithing_table', 1, ['II', '##', '##'], { I: 'iron_ingot', '#': 'planks' });
shaped('iron_bars', 16, ['###', '###'], { '#': 'iron_ingot' });
shaped('oak_boat', 1, ['# #', '###'], { '#': 'oak_planks' });
// nether & end
shaped('glowstone', 1, ['##', '##'], { '#': 'glowstone_dust' });
shaped('quartz_block', 1, ['##', '##'], { '#': 'quartz' });
shaped('nether_bricks', 1, ['##', '##'], { '#': 'nether_brick' });
shaped('nether_brick_fence', 6, ['B#B', 'B#B'], { B: 'nether_bricks', '#': 'nether_brick' });
shaped('nether_wart_block', 1, ['###', '###', '###'], { '#': 'nether_wart' });
shaped('magma_block', 1, ['##', '##'], { '#': 'magma_cream' });
shaped('end_stone_bricks', 4, ['##', '##'], { '#': 'end_stone' });
shapeless('netherite_ingot', 1, ['netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'gold_ingot', 'gold_ingot', 'gold_ingot', 'gold_ingot']);
shapeless('blaze_powder', 2, ['blaze_rod']);
shapeless('ender_eye', 1, ['ender_pearl', 'blaze_powder']);
shapeless('magma_cream', 1, ['blaze_powder', 'slime_ball']);
shapeless('fire_charge', 3, ['gunpowder', 'blaze_powder', 'coals']);
// 1.17: waxing, lightning rods, candles
for (const k of ['copper_block', 'exposed_copper', 'weathered_copper', 'oxidized_copper', 'cut_copper']) shapeless('waxed_' + k, 1, [k, 'honeycomb']);
shaped('lightning_rod', 1, ['#', '#', '#'], { '#': 'copper_ingot' });
shaped('candle', 1, ['S', 'H'], { S: 'string', H: 'honeycomb' });
for (const c of S.COLORS) shapeless(c + '_candle', 1, ['candle', c + '_dye']);
shaped('cauldron', 1, ['# #', '# #', '###'], { '#': 'iron_ingot' });
shaped('moss_carpet', 3, ['##'], { '#': 'moss_block' });
shaped('item_frame', 1, ['SSS', 'SLS', 'SSS'], { S: 'stick', L: 'leather' }); shapeless('glow_item_frame', 1, ['item_frame', 'glow_ink_sac']);
// cut copper of every oxidation stage, its slabs and stairs, waxed or not
for (const [full, cut] of [['copper_block', 'cut_copper'], ['exposed_copper', 'exposed_cut_copper'], ['weathered_copper', 'weathered_cut_copper'], ['oxidized_copper', 'oxidized_cut_copper']]) for (const w of ['', 'waxed_']) {
  if (cut !== 'cut_copper' || w) shaped(w + cut, 4, ['##', '##'], { '#': w + full });
  shaped(w + cut + '_slab', 6, ['###'], { '#': w + cut }); shaped(w + cut + '_stairs', 4, ['#  ', '## ', '###'], { '#': w + cut });
  if (!w) { if (cut !== 'cut_copper') shapeless('waxed_' + cut, 1, [cut, 'honeycomb']); shapeless('waxed_' + cut + '_slab', 1, [cut + '_slab', 'honeycomb']); shapeless('waxed_' + cut + '_stairs', 1, [cut + '_stairs', 'honeycomb']); }
}

// ---------- 1.17 expansion recipes ----------
[['jungle_log', 'jungle_planks'], ['acacia_log', 'acacia_planks'], ['dark_oak_log', 'dark_oak_planks'], ['stripped_oak_log', 'oak_planks'], ['stripped_spruce_log', 'spruce_planks'], ['stripped_birch_log', 'birch_planks'],
 ['stripped_jungle_log', 'jungle_planks'], ['stripped_acacia_log', 'acacia_planks'], ['stripped_dark_oak_log', 'dark_oak_planks']].forEach(([l, p]) => shapeless(p, 4, [l]));
// dyes from flowers and minerals, and mixing
for (const [src, dye, n] of [['dandelion', 'yellow', 1], ['poppy', 'red', 1], ['cornflower', 'blue', 1], ['oxeye_daisy', 'light_gray', 1], ['allium', 'magenta', 1], ['azure_bluet', 'light_gray', 1],
  ['red_tulip', 'red', 1], ['orange_tulip', 'orange', 1], ['white_tulip', 'light_gray', 1], ['pink_tulip', 'pink', 1], ['lily_of_the_valley', 'white', 1], ['blue_orchid', 'light_blue', 1], ['wither_rose', 'black', 1],
  ['bone_meal', 'white', 1], ['ink_sac', 'black', 1], ['lapis_lazuli', 'blue', 1], ['cocoa_beans', 'brown', 1], ['beetroot', 'red', 1]]) shapeless(dye + '_dye', n, [src]);
for (const [a, b, out] of [['red', 'yellow', 'orange'], ['blue', 'white', 'light_blue'], ['red', 'white', 'pink'], ['black', 'white', 'gray'], ['gray', 'white', 'light_gray'], ['blue', 'green', 'cyan'],
  ['blue', 'red', 'purple'], ['purple', 'pink', 'magenta'], ['green', 'white', 'lime']]) shapeless(out + '_dye', 2, [a + '_dye', b + '_dye']);
// colour families
for (const c of S.COLORS) {
  const D = c + '_dye';
  if (c !== 'white') shapeless(c + '_wool', 1, [D, 'white_wool']);
  shapeless(c + '_concrete_powder', 8, [D, 'sand', 'sand', 'sand', 'sand', 'gravel', 'gravel', 'gravel', 'gravel']);
  shaped(c + '_terracotta', 8, ['###', '#D#', '###'], { '#': 'terracotta', D });
  shaped(c + '_stained_glass', 8, ['###', '#D#', '###'], { '#': 'glass', D });
  shaped(c + '_stained_glass_pane', 16, ['###', '###'], { '#': c + '_stained_glass' });
  shaped(c + '_carpet', 3, ['##'], { '#': c + '_wool' });
}
// slabs, stairs, fences, walls of every material
const FULL = { stone: 'stone', sandstone: 'sandstone', brick: 'bricks', stone_brick: 'stone_bricks', nether_brick: 'nether_bricks', quartz: 'quartz_block', spruce: 'spruce_planks', birch: 'birch_planks',
  jungle: 'jungle_planks', acacia: 'acacia_planks', dark_oak: 'dark_oak_planks', crimson: 'crimson_planks', warped: 'warped_planks', red_sandstone: 'red_sandstone', purpur: 'purpur_block', prismarine: 'prismarine',
  mossy_cobblestone: 'mossy_cobblestone', cobblestone: 'cobblestone', mossy_stone_brick: 'mossy_stone_bricks', red_nether_brick: 'red_nether_bricks', blackstone: 'blackstone', polished_blackstone: 'polished_blackstone',
  end_stone_brick: 'end_stone_bricks', granite: 'granite', diorite: 'diorite', andesite: 'andesite' };
for (const [k, f] of Object.entries(FULL)) {
  if (IID[k + '_slab'] != null) shaped(k + '_slab', 6, ['###'], { '#': f });
  if (IID[k + '_stairs'] != null) shaped(k + '_stairs', 4, ['#  ', '## ', '###'], { '#': f });
  if (IID[k + '_fence'] != null) shaped(k + '_fence', 3, ['W#W', 'W#W'], { W: f, '#': 'stick' });
  if (IID[k + '_wall'] != null) shaped(k + '_wall', 6, ['###', '###'], { '#': f });
}
// decorative and natural blocks
for (const [o, i] of [['polished_granite', 'granite'], ['polished_diorite', 'diorite'], ['polished_andesite', 'andesite'], ['cut_sandstone', 'sandstone'], ['quartz_bricks', 'quartz_block'],
  ['polished_blackstone', 'blackstone'], ['polished_blackstone_bricks', 'polished_blackstone'], ['cut_red_sandstone', 'red_sandstone'], ['red_sandstone', 'red_sand'], ['prismarine', 'prismarine_shard'],
  ['purpur_block', 'popped_chorus_fruit'], ['packed_ice', 'ice'], ['coarse_dirt', 'dirt']]) shaped(o, 4, ['##', '##'], { '#': i });
shaped('chiseled_stone_bricks', 1, ['#', '#'], { '#': 'stone_brick_slab' }); shaped('chiseled_sandstone', 1, ['#', '#'], { '#': 'sandstone_slab' });
shaped('chiseled_quartz_block', 1, ['#', '#'], { '#': 'quartz_slab' }); shaped('chiseled_nether_bricks', 1, ['#', '#'], { '#': 'nether_brick_slab' }); shaped('purpur_pillar', 1, ['#', '#'], { '#': 'purpur_slab' });
shaped('red_nether_bricks', 1, ['NW', 'WN'], { N: 'nether_brick', W: 'nether_wart' });
shaped('prismarine_bricks', 1, ['###', '###', '###'], { '#': 'prismarine_shard' }); shaped('dark_prismarine', 1, ['###', '#D#', '###'], { '#': 'prismarine_shard', D: 'black_dye' });
shaped('sea_lantern', 1, ['SCS', 'CCC', 'SCS'], { S: 'prismarine_shard', C: 'prismarine_crystals' });
shaped('blue_ice', 1, ['###', '###', '###'], { '#': 'packed_ice' });
shaped('bone_block', 1, ['###', '###', '###'], { '#': 'bone_meal' }); shapeless('bone_meal', 9, ['bone_block']);
shaped('end_rod', 4, ['B', 'P'], { B: 'blaze_rod', P: 'popped_chorus_fruit' });
// redstone and mechanisms
shaped('observer', 1, ['CCC', 'RRQ', 'CCC'], { C: 'cobblestone', R: 'redstone', Q: 'quartz' });
shaped('hopper', 1, ['I I', 'ICI', ' I '], { I: 'iron_ingot', C: 'chest' });
shaped('comparator', 1, [' T ', 'TQT', 'SSS'], { T: 'redstone_torch', Q: 'quartz', S: 'stone' });
shaped('dispenser', 1, ['CCC', 'CBC', 'CRC'], { C: 'cobblestone', B: 'bow', R: 'redstone' });
shaped('dropper', 1, ['CCC', 'C C', 'CRC'], { C: 'cobblestone', R: 'redstone' });
shaped('daylight_detector', 1, ['GGG', 'QQQ', 'WWW'], { G: 'glass', Q: 'quartz', W: 'wooden_slabs' });
shaped('target', 1, [' R ', 'RHR', ' R '], { R: 'redstone', H: 'hay_block' });
shaped('note_block', 1, ['###', '#R#', '###'], { '#': 'planks', R: 'redstone' });
shaped('iron_door', 3, ['##', '##', '##'], { '#': 'iron_ingot' }); shaped('oak_trapdoor', 2, ['###', '###'], { '#': 'planks' });
// workstations
shaped('composter', 1, ['# #', '# #', '###'], { '#': 'wooden_slabs' });
shaped('barrel', 1, ['PSP', 'P P', 'PSP'], { P: 'planks', S: 'wooden_slabs' });
shaped('blast_furnace', 1, ['III', 'IFI', 'SSS'], { I: 'iron_ingot', F: 'furnace', S: 'smooth_stone' });
shaped('smoker', 1, [' L ', 'LFL', ' L '], { L: 'logs', F: 'furnace' });
shaped('cartography_table', 1, ['pp', '##', '##'], { p: 'paper', '#': 'planks' });
shaped('fletching_table', 1, ['ff', '##', '##'], { f: 'flint', '#': 'planks' });
shaped('loom', 1, ['ss', '##'], { s: 'string', '#': 'planks' });
shaped('stonecutter', 1, [' I ', 'SSS'], { I: 'iron_ingot', S: 'stone' });
shaped('grindstone', 1, ['T#T', 'P P'], { T: 'stick', '#': 'stone_slabs', P: 'planks' });
shaped('lectern', 1, ['SSS', ' B ', ' S '], { S: 'wooden_slabs', B: 'bookshelf' });
shaped('soul_torch', 4, ['C', 'S', 'X'], { C: 'coals', S: 'stick', X: 'soul' });
shaped('soul_lantern', 1, ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'soul_torch' });
shaped('chain', 1, ['N', 'I', 'N'], { N: 'iron_nugget', I: 'iron_ingot' });
shaped('lodestone', 1, ['CCC', 'CNC', 'CCC'], { C: 'chiseled_stone_bricks', N: 'netherite_ingot' });
// food, tools, boats
shaped('cookie', 8, ['WCW'], { W: 'wheat', C: 'cocoa_beans' });
shapeless('pumpkin_pie', 1, ['pumpkin', 'sugar', 'egg']);
shaped('beetroot_soup', 1, ['BBB', 'BBB', ' W '], { B: 'beetroot', W: 'bowl' });
shaped('golden_carrot', 1, ['NNN', 'NCN', 'NNN'], { N: 'gold_nugget', C: 'carrot' });
shaped('fishing_rod', 1, ['  S', ' SX', 'S X'], { S: 'stick', X: 'string' });
shaped('compass', 1, [' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'redstone' });
shaped('clock', 1, [' G ', 'GRG', ' G '], { G: 'gold_ingot', R: 'redstone' });
for (const w of ['spruce', 'birch', 'jungle', 'acacia', 'dark_oak']) shaped(w + '_boat', 1, ['# #', '###'], { '#': w + '_planks' });

function matchRecipe(grid, w) { // grid: array of item ids (0 = empty), w = width (2 or 3)
  const h = grid.length / w;
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y * w + x]) { count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (!count) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const at = (x, y) => grid[(y + minY) * w + x + minX];
  for (const r of RECIPES) {
    if (r.s) {
      if (r.s.length !== count) continue;
      const items = []; for (const g of grid) if (g) items.push(g);
      const used = new Array(items.length).fill(false); let ok = true;
      for (const opts of r.s) { const k = items.findIndex((it, i) => !used[i] && opts.includes(it)); if (k < 0) { ok = false; break; } used[k] = true; }
      if (ok) return r;
      continue;
    }
    const ph = r.p.length, pw = Math.max(...r.p.map(s => s.length));
    if (pw !== bw || ph !== bh) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < ph && ok; y++) for (let x = 0; x < pw; x++) {
        const ch = (r.p[y][mirror ? pw - 1 - x : x] || ' ');
        const g = at(x, y);
        if (ch === ' ') { if (g) { ok = false; break; } }
        else if (!g || !r.k[ch].includes(g)) { ok = false; break; }
      }
      if (ok) return r;
    }
  }
  return null;
}

// ---------- smelting ----------
const SMELT = {};
[['sand', 'glass', 0.1], ['cobblestone', 'stone', 0.1], ['stone', 'smooth_stone', 0.1], ['cobbled_deepslate', 'deepslate', 0.1], ['clay_ball', 'brick', 0.3],
 ['oak_log', 'charcoal', 0.15], ['spruce_log', 'charcoal', 0.15], ['birch_log', 'charcoal', 0.15],
 ['raw_iron', 'iron_ingot', 0.7], ['raw_gold', 'gold_ingot', 1], ['raw_copper', 'copper_ingot', 0.7],
 ['iron_ore', 'iron_ingot', 0.7], ['gold_ore', 'gold_ingot', 1], ['copper_ore', 'copper_ingot', 0.7],
 ['porkchop', 'cooked_porkchop', 0.35], ['beef', 'cooked_beef', 0.35], ['chicken', 'cooked_chicken', 0.35], ['mutton', 'cooked_mutton', 0.35],
 ['wet_sponge', 'sponge', 0], ['clay', 'terracotta', 0.35], ['cactus', 'green_dye', 1], ['potato', 'baked_potato', 0.35], ['cod', 'cooked_cod', 0.35], ['salmon', 'cooked_salmon', 0.35],
 ['chorus_fruit', 'popped_chorus_fruit', 0.1], ['nether_bricks', 'cracked_nether_bricks', 0.1], ['red_sand', 'glass', 0.1], ['jungle_log', 'charcoal', 0.15], ['acacia_log', 'charcoal', 0.15], ['dark_oak_log', 'charcoal', 0.15], ['nether_gold_ore', 'gold_ingot', 1], ['nether_quartz_ore', 'quartz', 0.2], ['ancient_debris', 'netherite_scrap', 2],
 ['netherrack', 'nether_brick', 0.1], ['stone_bricks', 'cracked_stone_bricks', 0.1], ['iron_sword', 'iron_nugget', 0.1], ['iron_pickaxe', 'iron_nugget', 0.1], ['golden_sword', 'gold_nugget', 0.1], ['golden_pickaxe', 'gold_nugget', 0.1]]
  .forEach(([a, b, xp]) => { if (IID[a] != null && IID[b] != null) SMELT[IID[a]] = [IID[b], xp]; });

// ---------- drops ----------
function toolOf(stack) { const d = stack && ITEMS[stack.id]; return d && d.tool ? d.tool : null; }
function canHarvest(b, stack) {
  const d = BLOCKS[b]; if (!d) return false;
  if (d.tier === 0) return true;
  if (d.tier === 99) return false;
  const t = toolOf(stack); if (!t) return false;
  return t.type === d.tool && t.tier >= d.tier;
}
// seconds to break, per MC formula (ticks/20)
// blocks hosted in another block's spare meta (candles, lightning rod) have their own hardness
const blockHard = (b, m) => (b === 198 || b === 246) && S.candleOf(b, m) ? 0.1 : S.isRod(b, m) ? 3 : BLOCKS[b].hard;
function breakTicks(b, stack, onGround, inWater, meta = 0) {
  const d = BLOCKS[b]; if (!d || d.hard < 0) return Infinity;
  const hard = blockHard(b, meta);
  if (hard === 0) return 0;
  const t = toolOf(stack);
  let speed = 1;
  if (typeof digMul === 'function') speed = digMul();
  if (t && t.type === d.tool) { speed = t.speed * speed; const ef = enchLv(stack, 'efficiency'); if (ef && canHarvest(b, stack)) speed += ef * ef + 1; }
  if (stack && stack.id === IID.shears && (d.leaves || b === BID.cobweb || b === BID.white_wool)) speed = b === BID.white_wool ? 5 : 15;
  if (t && t.type === TOOL.SWORD && b === BID.cobweb) speed = 15;
  if (t && t.type === TOOL.SWORD && d.leaves) speed = 1.5;
  if (inWater) speed /= 5;
  if (!onGround) speed /= 5;
  const harvest = canHarvest(b, stack) || (b === BID.cobweb && t && t.type === TOOL.SWORD);
  const dmg = speed / hard / (harvest ? 30 : 100);
  if (dmg >= 1) return 0;
  return Math.ceil(1 / dmg);
}
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
// returns {items:[[id,count]], xp}
function blockDrops(b, meta, stack) {
  const d = BLOCKS[b], res = { items: [], xp: 0 };
  const add = (k, n = 1) => { if (n > 0) res.items.push([typeof k === 'number' ? k : IID[k], n]); };
  const shears = stack && stack.id === IID.shears;
  const t = toolOf(stack);
  const cd = (b === 198 || b === 246) && S.candleOf(b, meta);
  if (cd) { add(itemOfBlock(b, meta), cd.n); return res; }
  if (S.isRod(b, meta) && !(t && t.type === TOOL.PICK)) return res;
  // silk touch keeps the block itself; fortune multiplies ore drops (applied after the switch)
  if (enchLv(stack, 'silk_touch') && canHarvest(b, stack) && ITEMS[b] && !['short_grass', 'fern', 'dead_bush', 'wheat', 'oak_door', 'red_bed'].includes(d.key) && d.hard >= 0 && b !== BID.spawner) { add(itemOfBlock(b, meta)); return res; }
  const fortune = enchLv(stack, 'fortune');
  const fortuneOre = ['coal_ore', 'deepslate_coal_ore', 'diamond_ore', 'deepslate_diamond_ore', 'emerald_ore', 'lapis_ore', 'deepslate_lapis_ore', 'redstone_ore', 'deepslate_redstone_ore', 'iron_ore', 'deepslate_iron_ore', 'gold_ore', 'deepslate_gold_ore', 'copper_ore', 'deepslate_copper_ore', 'nether_quartz_ore', 'nether_gold_ore', 'glowstone'].includes(d.key);
  // fortune: redstone gets +0..level (uniform bonus), the other ores multiply
  if (fortune && fortuneOre && canHarvest(b, stack)) { const r0 = blockDrops(b, meta, { id: stack.id, n: 1 }); const mul = Math.max(0, Math.floor(Math.random() * (fortune + 2)) - 1) + 1, flat = d.key.endsWith('redstone_ore'); for (const it of r0.items) res.items.push([it[0], flat ? it[1] + Math.floor(Math.random() * (fortune + 1)) : it[1] * mul]); res.xp = r0.xp; return res; }
  if (!canHarvest(b, stack)) {
    if (b === BID.cobweb && t && t.type === TOOL.SWORD) add('string');
    else if (b === BID.cobweb && shears) add('cobweb');
    else if (b === BID.powder_snow) {}
    return res;
  }
  switch (d.key) {
    case 'stone': add('cobblestone'); break;
    case 'deepslate': add('cobbled_deepslate'); break;
    case 'grass_block': case 'farmland': add('dirt'); break;
    case 'coal_ore': case 'deepslate_coal_ore': add('coal'); res.xp = ri(0, 2); break;
    case 'iron_ore': case 'deepslate_iron_ore': add('raw_iron'); break;
    case 'gold_ore': case 'deepslate_gold_ore': add('raw_gold'); break;
    case 'copper_ore': case 'deepslate_copper_ore': add('raw_copper', ri(2, 3)); break;
    case 'diamond_ore': case 'deepslate_diamond_ore': add('diamond'); res.xp = ri(3, 7); break;
    case 'emerald_ore': add('emerald'); res.xp = ri(3, 7); break;
    case 'redstone_ore': case 'deepslate_redstone_ore': add('redstone', ri(4, 5)); res.xp = ri(1, 5); break;
    case 'lapis_ore': case 'deepslate_lapis_ore': add('lapis_lazuli', ri(4, 9)); res.xp = ri(2, 5); break;
    case 'oak_leaves': case 'spruce_leaves': case 'birch_leaves':
      if (shears) { add(b); break; }
      if (Math.random() < 0.05) add(d.key.replace('leaves', 'sapling'));
      if (Math.random() < 0.02) add('stick', ri(1, 2));
      if (b === BID.oak_leaves && Math.random() < 0.005) add('apple');
      break;
    case 'glass': break;
    case 'short_grass': case 'fern': if (shears) add(b); else if (Math.random() < 0.125) add('wheat_seeds'); break;
    case 'dead_bush': if (shears) add(b); else add('stick', ri(0, 2)); break;
    case 'gravel': if (Math.random() < 0.1) add('flint'); else add('gravel'); break;
    case 'snow': add('snowball', (meta & 7) + 1); break;
    case 'snow_block': add('snowball', 4); break;
    case 'clay': add('clay_ball', 4); break;
    case 'melon': add('melon_slice', ri(3, 7)); break;
    case 'wheat': if ((meta & 7) >= 7) { add('wheat'); let s = 1; for (let i = 0; i < 3; i++) if (Math.random() < 0.57) s++; add('wheat_seeds', s); } else add('wheat_seeds'); break;
    case 'bookshelf': add('book', 3); break;
    case 'ice': break;
    case 'amethyst_cluster': add('amethyst_shard', t && t.type === TOOL.PICK ? 4 : 2); break;
    case 'small_amethyst_bud': case 'medium_amethyst_bud': case 'large_amethyst_bud': break; // only with silk touch
    case 'cave_vines': if (meta & 1) add('glow_berries'); break;
    case 'sculk_sensor': res.xp = 5; break; // the block itself only with silk touch
    case 'big_dripleaf_stem': add('big_dripleaf'); break;
    case 'small_dripleaf': if (shears && !(meta & 8)) add(b); break;
    case 'hanging_roots': if (shears) add(b); break;
    case 'azalea_leaves': case 'flowering_azalea_leaves':
      if (shears) { add(b); break; }
      if (Math.random() < 0.05) add(b === BID.azalea_leaves ? 'azalea' : 'flowering_azalea');
      if (Math.random() < 0.02) add('stick', ri(1, 2));
      break;
    case 'spawner': res.xp = ri(15, 43); break;
    case 'lit_furnace': add('furnace'); break;
    case 'glowstone': add('glowstone_dust', ri(2, 4)); break;
    case 'nether_quartz_ore': add('quartz'); res.xp = ri(2, 5); break;
    case 'nether_gold_ore': add('gold_nugget', ri(2, 6)); res.xp = ri(0, 1); break;
    case 'redstone_wire': add('redstone'); break;
    case 'redstone_torch': case 'unlit_redstone_torch': add('redstone_torch'); break;
    case 'redstone_lamp': case 'lit_redstone_lamp': add('redstone_lamp'); break;
    case 'nether_wart': add('nether_wart', meta >= 3 ? ri(2, 4) : 1); break;
    case 'piston_head': case 'fire': case 'nether_portal': case 'end_portal': break;
    case 'jungle_leaves': case 'acacia_leaves': case 'dark_oak_leaves':
      if (shears) { add(b); break; }
      if (Math.random() < (b === BID.jungle_leaves ? 0.025 : 0.05)) add(d.key.replace('leaves', 'sapling'));
      if (Math.random() < 0.02) add('stick', ri(1, 2));
      if (b === BID.dark_oak_leaves && Math.random() < 0.005) add('apple');
      if (b === BID.jungle_leaves && Math.random() < 0.02) add('cocoa_beans');
      break;
    case 'podzol': case 'mycelium': add('dirt'); break;
    case 'packed_ice': case 'blue_ice': case 'stained_glass': case 'stained_glass_pane': case 'soul_fire': break;
    case 'crops2': {
      const type = meta >> 3, ripe = (meta & 7) >= 7;
      if (type === 0) add('carrot', ripe ? ri(2, 5) : 1);
      else if (type === 1) { add('potato', ripe ? ri(2, 5) : 1); if (ripe && Math.random() < 0.02) add('poisonous_potato'); }
      else { if (ripe) add('beetroot'); add('beetroot_seeds', ripe ? ri(1, 4) : 1); }
      break;
    }
    case 'vine': case 'nether_sprouts': if (shears) add(b); break;
    case 'chorus_plant': if (Math.random() < 0.5) add('chorus_fruit'); break;
    case 'brown_mushroom_block': case 'red_mushroom_block': { const n = Math.max(0, ri(-7, 2)); if (n) add(d.key.replace('_block', ''), n); break; }
    case 'sea_lantern': add('prismarine_crystals', ri(2, 3)); break;
    case 'gilded_blackstone': if (Math.random() < 0.1) add('gold_nugget', ri(2, 5)); else add(b); break;
    case 'iron_door': if (!(meta & 8)) add(b); break;
    case 'crimson_roots': case 'warped_roots': add(b); break;
    case 'cobweb': add('string'); break;
    case 'powder_snow': break;
    case 'glow_lichen': if (shears) add(b); break;
    default: if (ITEMS[b]) add(itemOfBlock(b, meta));
  }
  return res;
}

// ---------- item id table ----------
// Item ids are positions in ITEMS. Saved data is tagged with a hash of the key list it was written with
// (world meta keeps each list), so ids can change between versions: loading remaps them by key.
// Untagged data comes from before this table existed and uses today's order.
const ITEM_KEYS = Array.from(ITEMS, d => d ? d.key : null);
const ITEM_TABLE = (() => { let h = 5381; for (const k of ITEM_KEYS) for (const ch of (k || '-') + ',') h = (h * 33 + ch.charCodeAt(0)) >>> 0; return h.toString(36); })();
const remapCache = {};
function itemRemapFor(tag) {
  if (!tag || tag === ITEM_TABLE) return null;
  if (remapCache[tag] !== undefined) return remapCache[tag];
  const keys = W.meta && W.meta.itables && W.meta.itables[tag]; if (!keys) return remapCache[tag] = null;
  const byKey = {}; ITEMS.forEach((d, i) => { if (d) byKey[d.key] = i; });
  return remapCache[tag] = Int32Array.from(keys, k => k != null && byKey[k] != null ? byKey[k] : -1);
}
// rewrites item ids in place: stacks ({id, n}) and villager offers ({a, an, b, bn}); unknown items vanish
function remapItems(o, m) {
  if (!m || !o || typeof o !== 'object') return o;
  const map = i => i >= 0 && i < m.length ? m[i] : -1;
  if (typeof o.id === 'number' && typeof o.n === 'number') o.id = map(o.id);
  if (typeof o.a === 'number' && typeof o.an === 'number') { o.a = map(o.a); o.b = map(o.b); }
  for (const k in o) {
    const v = o[k]; if (!v || typeof v !== 'object') continue;
    remapItems(v, m);
    if (Array.isArray(o) && typeof v.id === 'number' && typeof v.n === 'number' && v.id < 0) o[k] = null;
  }
  return o;
}

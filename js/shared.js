// Shared engine core. Everything inside SHARED must be self-contained: the
// function is stringified into the Web Worker, so it may not touch outer scope.
const SHARED = function () {
'use strict';
const CW = 16, CH = 256, SEA = 62, CVOL = CW * CW * CH; // 1.17 overworld height 0..255
const ATL = 512, TPR = 32; // texture atlas: 32x32 tiles of 16px
const RT = { AIR: 0, CUBE: 1, CUTOUT: 2, CROSS: 3, FLUID: 4, TORCH: 5, BOX: 6, TRANS: 7, CROP: 8, WIRE: 9, TBOX: 10 };
const TOOL = { NONE: 0, PICK: 1, AXE: 2, SHOVEL: 3, HOE: 4, SWORD: 5, SHEARS: 6 };

// ---------- texture tiles (16x16 atlas, painted on the main thread) ----------
const TILES = ('stone grass_top grass_side grass_side_snowed dirt cobblestone oak_planks spruce_planks birch_planks bedrock sand gravel ' +
  'gold_ore iron_ore coal_ore copper_ore diamond_ore redstone_ore lapis_ore emerald_ore oak_log oak_log_top spruce_log spruce_log_top ' +
  'birch_log birch_log_top oak_leaves spruce_leaves birch_leaves oak_leaves_o spruce_leaves_o birch_leaves_o glass sandstone sandstone_top ' +
  'sandstone_bottom water lava short_grass fern dandelion poppy cornflower oxeye_daisy dead_bush sugar_cane cactus_side cactus_top ' +
  'cactus_bottom oak_sapling spruce_sapling birch_sapling crafting_table_top crafting_table_side crafting_table_front furnace_front ' +
  'furnace_front_on furnace_side furnace_top chest_front chest_side chest_top torch bricks bookshelf mossy_cobblestone obsidian snow ice clay ' +
  'pumpkin_side pumpkin_top jack_o_lantern pumpkin_face melon_side melon_top farmland farmland_wet wheat0 wheat1 wheat2 wheat3 wheat4 wheat5 ' +
  'wheat6 wheat7 white_wool iron_block gold_block diamond_block copper_block exposed_copper weathered_copper oxidized_copper cut_copper ' +
  'raw_iron_block raw_gold_block raw_copper_block amethyst_block budding_amethyst amethyst_cluster calcite tuff deepslate deepslate_top ' +
  'cobbled_deepslate deepslate_coal_ore deepslate_iron_ore deepslate_copper_ore deepslate_gold_ore deepslate_redstone_ore deepslate_lapis_ore ' +
  'deepslate_diamond_ore dripstone_block pointed_dripstone moss_block tinted_glass smooth_stone smooth_stone_slab_side stone_bricks granite ' +
  'diorite andesite tnt_side tnt_top tnt_bottom bed_head bed_foot bed_side oak_door_top oak_door_bottom ladder powder_snow lantern cobweb ' +
  'coal_block lapis_block emerald_block redstone_block smooth_basalt brown_mushroom red_mushroom spawner hay_side hay_top melon_stem glow_lichen enchanting_table_top enchanting_table_side ' +
  'redstone_dust_dot redstone_dust_line0 redstone_dust_line1 redstone_torch redstone_torch_off redstone_lamp redstone_lamp_on lever repeater repeater_on piston_side piston_top piston_top_sticky piston_bottom piston_inner anvil anvil_top smithing_table_top smithing_table_side smithing_table_front smithing_table_bottom dirt_path_top dirt_path_side netherrack nether_quartz_ore nether_gold_ore soul_sand soul_soil glowstone magma basalt_side basalt_top blackstone blackstone_top nether_bricks crimson_nylium crimson_nylium_side warped_nylium warped_nylium_side crimson_stem crimson_stem_top warped_stem warped_stem_top nether_wart_block warped_wart_block shroomlight crimson_fungus warped_fungus crimson_roots warped_roots nether_portal ancient_debris_side ancient_debris_top netherite_block quartz_block_side quartz_block_top crying_obsidian nether_wart0 nether_wart1 nether_wart2 fire crimson_planks warped_planks end_stone end_portal_frame_top end_portal_frame_side end_portal_frame_eye end_portal end_stone_bricks dragon_egg mossy_stone_bricks cracked_stone_bricks iron_bars slime_block').split(' ');
const T = {}; TILES.forEach((n, i) => T[n] = i);

// ---------- blocks ----------
// [id, key, name, renderType, textures, hardness, tool, harvestTier(0 = any tool or hand), extra]
// textures: 'all' | [side, top, bottom] | [side, top, bottom, front]
const C = RT.CUBE, X = RT.CROSS, P = TOOL.PICK, A = TOOL.AXE, S = TOOL.SHOVEL, H = TOOL.HOE, N = TOOL.NONE;
const BLOCK_ROWS = [
  [0, 'air', '공기', RT.AIR, null, 0, N, 0],
  [1, 'stone', '돌', C, 'stone', 1.5, P, 1],
  [2, 'grass_block', '잔디 블록', C, ['grass_side', 'grass_top', 'dirt'], 0.6, S, 0, { tint: 1 }],
  [3, 'dirt', '흙', C, 'dirt', 0.5, S, 0],
  [4, 'cobblestone', '조약돌', C, 'cobblestone', 2, P, 1],
  [5, 'oak_planks', '참나무 판자', C, 'oak_planks', 2, A, 0],
  [6, 'spruce_planks', '가문비나무 판자', C, 'spruce_planks', 2, A, 0],
  [7, 'birch_planks', '자작나무 판자', C, 'birch_planks', 2, A, 0],
  [8, 'bedrock', '기반암', C, 'bedrock', -1, N, 0],
  [9, 'sand', '모래', C, 'sand', 0.5, S, 0, { fall: 1 }],
  [10, 'gravel', '자갈', C, 'gravel', 0.6, S, 0, { fall: 1 }],
  [11, 'gold_ore', '금 광석', C, 'gold_ore', 3, P, 3],
  [12, 'iron_ore', '철 광석', C, 'iron_ore', 3, P, 2],
  [13, 'coal_ore', '석탄 광석', C, 'coal_ore', 3, P, 1],
  [14, 'copper_ore', '구리 광석', C, 'copper_ore', 3, P, 2],
  [15, 'diamond_ore', '다이아몬드 광석', C, 'diamond_ore', 3, P, 3],
  [16, 'redstone_ore', '레드스톤 광석', C, 'redstone_ore', 3, P, 3],
  [17, 'lapis_ore', '청금석 광석', C, 'lapis_ore', 3, P, 2],
  [18, 'emerald_ore', '에메랄드 광석', C, 'emerald_ore', 3, P, 3],
  [19, 'oak_log', '참나무 원목', C, ['oak_log', 'oak_log_top', 'oak_log_top'], 2, A, 0, { log: 1 }],
  [20, 'spruce_log', '가문비나무 원목', C, ['spruce_log', 'spruce_log_top', 'spruce_log_top'], 2, A, 0, { log: 1 }],
  [21, 'birch_log', '자작나무 원목', C, ['birch_log', 'birch_log_top', 'birch_log_top'], 2, A, 0, { log: 1 }],
  [22, 'oak_leaves', '참나무 잎', RT.CUTOUT, 'oak_leaves', 0.2, H, 0, { tint: 2, lop: 1, leaves: 1 }],
  [23, 'spruce_leaves', '가문비나무 잎', RT.CUTOUT, 'spruce_leaves', 0.2, H, 0, { tint: 5, lop: 1, leaves: 1 }],
  [24, 'birch_leaves', '자작나무 잎', RT.CUTOUT, 'birch_leaves', 0.2, H, 0, { tint: 4, lop: 1, leaves: 1 }],
  [25, 'glass', '유리', RT.CUTOUT, 'glass', 0.3, N, 0, { selfcull: 1 }],
  [26, 'sandstone', '사암', C, ['sandstone', 'sandstone_top', 'sandstone_bottom'], 0.8, P, 1],
  [27, 'water', '물', RT.FLUID, 'water', 100, N, 0, { lop: 2, fluid: 1, tint: 3, nosolid: 1, repl: 1 }],
  [28, 'lava', '용암', RT.FLUID, 'lava', 100, N, 0, { lop: 1, fluid: 2, light: 15, nosolid: 1, repl: 1 }],
  [29, 'short_grass', '풀', X, 'short_grass', 0, N, 0, { tint: 1, repl: 1, plant: 1 }],
  [30, 'fern', '고사리', X, 'fern', 0, N, 0, { tint: 1, repl: 1, plant: 1 }],
  [31, 'dandelion', '민들레', X, 'dandelion', 0, N, 0, { plant: 1 }],
  [32, 'poppy', '양귀비', X, 'poppy', 0, N, 0, { plant: 1 }],
  [33, 'cornflower', '수레국화', X, 'cornflower', 0, N, 0, { plant: 1 }],
  [34, 'oxeye_daisy', '옥스아이 데이지', X, 'oxeye_daisy', 0, N, 0, { plant: 1 }],
  [35, 'dead_bush', '마른 덤불', X, 'dead_bush', 0, N, 0, { repl: 1, plant: 2 }],
  [36, 'sugar_cane', '사탕수수', X, 'sugar_cane', 0, N, 0, { tint: 1, plant: 3 }],
  [37, 'cactus', '선인장', RT.BOX, ['cactus_side', 'cactus_top', 'cactus_bottom'], 0.4, N, 0, { plant: 4 }],
  [38, 'oak_sapling', '참나무 묘목', X, 'oak_sapling', 0, N, 0, { plant: 1 }],
  [39, 'spruce_sapling', '가문비나무 묘목', X, 'spruce_sapling', 0, N, 0, { plant: 1 }],
  [40, 'birch_sapling', '자작나무 묘목', X, 'birch_sapling', 0, N, 0, { plant: 1 }],
  [41, 'crafting_table', '제작대', C, ['crafting_table_side', 'crafting_table_top', 'oak_planks', 'crafting_table_front'], 2.5, A, 0],
  [42, 'furnace', '화로', C, ['furnace_side', 'furnace_top', 'furnace_top', 'furnace_front'], 3.5, P, 1, { facing: 1 }],
  [43, 'lit_furnace', '화로', C, ['furnace_side', 'furnace_top', 'furnace_top', 'furnace_front_on'], 3.5, P, 1, { facing: 1, light: 13 }],
  [44, 'chest', '상자', RT.BOX, ['chest_side', 'chest_top', 'chest_top', 'chest_front'], 2.5, A, 0, { facing: 1 }],
  [45, 'torch', '횃불', RT.TORCH, 'torch', 0, N, 0, { light: 14, nosolid: 1 }],
  [46, 'bricks', '벽돌', C, 'bricks', 2, P, 1],
  [47, 'bookshelf', '책장', C, ['bookshelf', 'oak_planks', 'oak_planks'], 1.5, A, 0],
  [48, 'mossy_cobblestone', '이끼 낀 조약돌', C, 'mossy_cobblestone', 2, P, 1],
  [49, 'obsidian', '흑요석', C, 'obsidian', 50, P, 4],
  [50, 'snow_block', '눈 블록', C, 'snow', 0.2, S, 1],
  [51, 'snow', '눈', RT.BOX, 'snow', 0.1, S, 1, { repl: 2 }],
  [52, 'ice', '얼음', RT.TRANS, 'ice', 0.5, P, 0, { lop: 2, selfcull: 1, slip: 1 }],
  [53, 'clay', '점토', C, 'clay', 0.6, S, 0],
  [54, 'pumpkin', '호박', C, ['pumpkin_side', 'pumpkin_top', 'pumpkin_top', 'pumpkin_face'], 1, A, 0, { facing: 1 }],
  [55, 'jack_o_lantern', '잭 오 랜턴', C, ['pumpkin_side', 'pumpkin_top', 'pumpkin_top', 'jack_o_lantern'], 1, A, 0, { facing: 1, light: 15 }],
  [56, 'melon', '수박', C, ['melon_side', 'melon_top', 'melon_top'], 1, A, 0],
  [57, 'farmland', '경작지', RT.BOX, ['dirt', 'farmland', 'dirt'], 0.6, S, 0],
  [58, 'wheat', '밀', RT.CROP, 'wheat0', 0, N, 0, { plant: 5 }],
  [59, 'white_wool', '하얀색 양털', C, 'white_wool', 0.8, TOOL.SHEARS, 0],
  [60, 'iron_block', '철 블록', C, 'iron_block', 5, P, 2],
  [61, 'gold_block', '금 블록', C, 'gold_block', 3, P, 3],
  [62, 'diamond_block', '다이아몬드 블록', C, 'diamond_block', 5, P, 3],
  [63, 'copper_block', '구리 블록', C, 'copper_block', 3, P, 2, { oxid: 64 }],
  [64, 'exposed_copper', '약간 녹슨 구리', C, 'exposed_copper', 3, P, 2, { oxid: 65, scrape: 63 }],
  [65, 'weathered_copper', '녹슨 구리', C, 'weathered_copper', 3, P, 2, { oxid: 66, scrape: 64 }],
  [66, 'oxidized_copper', '산화된 구리', C, 'oxidized_copper', 3, P, 2, { scrape: 65 }],
  [67, 'cut_copper', '깎인 구리', C, 'cut_copper', 3, P, 2],
  [68, 'raw_iron_block', '철 원석 블록', C, 'raw_iron_block', 5, P, 2],
  [69, 'raw_gold_block', '금 원석 블록', C, 'raw_gold_block', 5, P, 3],
  [70, 'raw_copper_block', '구리 원석 블록', C, 'raw_copper_block', 5, P, 2],
  [71, 'amethyst_block', '자수정 블록', C, 'amethyst_block', 1.5, P, 0],
  [72, 'budding_amethyst', '싹트는 자수정', C, 'budding_amethyst', 1.5, P, 99],
  [73, 'amethyst_cluster', '자수정 군집', X, 'amethyst_cluster', 1.5, P, 0, { light: 5, nosolid: 1 }],
  [74, 'calcite', '방해석', C, 'calcite', 0.75, P, 1],
  [75, 'tuff', '응회암', C, 'tuff', 1.5, P, 1],
  [76, 'deepslate', '심층암', C, ['deepslate', 'deepslate_top', 'deepslate_top'], 3, P, 1],
  [77, 'cobbled_deepslate', '심층암 조약돌', C, 'cobbled_deepslate', 3.5, P, 1],
  [78, 'deepslate_coal_ore', '심층암 석탄 광석', C, 'deepslate_coal_ore', 4.5, P, 1],
  [79, 'deepslate_iron_ore', '심층암 철 광석', C, 'deepslate_iron_ore', 4.5, P, 2],
  [80, 'deepslate_copper_ore', '심층암 구리 광석', C, 'deepslate_copper_ore', 4.5, P, 2],
  [81, 'deepslate_gold_ore', '심층암 금 광석', C, 'deepslate_gold_ore', 4.5, P, 3],
  [82, 'deepslate_redstone_ore', '심층암 레드스톤 광석', C, 'deepslate_redstone_ore', 4.5, P, 3],
  [83, 'deepslate_lapis_ore', '심층암 청금석 광석', C, 'deepslate_lapis_ore', 4.5, P, 2],
  [84, 'deepslate_diamond_ore', '심층암 다이아몬드 광석', C, 'deepslate_diamond_ore', 4.5, P, 3],
  [85, 'dripstone_block', '점적석 블록', C, 'dripstone_block', 1.5, P, 1],
  [86, 'pointed_dripstone', '뾰족한 점적석', X, 'pointed_dripstone', 1.5, P, 0, { nosolid: 1 }],
  [87, 'moss_block', '이끼 블록', C, 'moss_block', 0.1, H, 0],
  [88, 'tinted_glass', '색유리', RT.TRANS, 'tinted_glass', 0.3, N, 0, { lop: 15, selfcull: 1 }],
  [89, 'smooth_stone', '매끄러운 돌', C, 'smooth_stone', 2, P, 1],
  [90, 'stone_bricks', '석재 벽돌', C, 'stone_bricks', 1.5, P, 1],
  [91, 'granite', '화강암', C, 'granite', 1.5, P, 1],
  [92, 'diorite', '섬록암', C, 'diorite', 1.5, P, 1],
  [93, 'andesite', '안산암', C, 'andesite', 1.5, P, 1],
  [94, 'tnt', 'TNT', C, ['tnt_side', 'tnt_top', 'tnt_bottom'], 0, N, 0],
  [95, 'red_bed', '빨간색 침대', RT.BOX, 'bed_side', 0.2, N, 0],
  [96, 'oak_door', '참나무 문', RT.BOX, 'oak_door_bottom', 3, A, 0],
  [97, 'ladder', '사다리', RT.BOX, 'ladder', 0.4, A, 0, { nosolid: 1, climb: 1 }],
  [98, 'powder_snow', '가루눈', C, 'powder_snow', 0.25, N, 99, { nosolid: 1, lop: 1 }],
  [99, 'lantern', '랜턴', RT.BOX, 'lantern', 3.5, P, 0, { light: 15 }],
  [100, 'cobweb', '거미줄', X, 'cobweb', 4, TOOL.SWORD, 99, { lop: 1, nosolid: 1, web: 1 }],
  [101, 'coal_block', '석탄 블록', C, 'coal_block', 5, P, 1],
  [102, 'lapis_block', '청금석 블록', C, 'lapis_block', 3, P, 2],
  [103, 'emerald_block', '에메랄드 블록', C, 'emerald_block', 5, P, 3],
  [104, 'redstone_block', '레드스톤 블록', C, 'redstone_block', 5, P, 1],
  [105, 'smooth_basalt', '매끄러운 현무암', C, 'smooth_basalt', 1.25, P, 1],
  [106, 'brown_mushroom', '갈색 버섯', X, 'brown_mushroom', 0, N, 0, { plant: 6 }],
  [107, 'red_mushroom', '빨간색 버섯', X, 'red_mushroom', 0, N, 0, { plant: 6 }],
  [108, 'spawner', '생성기', RT.CUTOUT, 'spawner', 5, P, 99],
  [109, 'oak_slab', '참나무 반 블록', RT.BOX, 'oak_planks', 2, A, 0, { slab: 5 }],
  [110, 'cobblestone_slab', '조약돌 반 블록', RT.BOX, 'cobblestone', 2, P, 1, { slab: 4 }],
  [111, 'smooth_stone_slab', '매끄러운 돌 반 블록', RT.BOX, ['smooth_stone_slab_side', 'smooth_stone', 'smooth_stone'], 2, P, 1, { slab: 89 }],
  [112, 'hay_block', '건초 더미', C, ['hay_side', 'hay_top', 'hay_top'], 0.5, H, 0, { log: 1 }],
  [113, 'oak_stairs', '참나무 계단', RT.BOX, 'oak_planks', 2, A, 0, { stairs: 1 }],
  [114, 'cobblestone_stairs', '조약돌 계단', RT.BOX, 'cobblestone', 2, P, 1, { stairs: 1 }],
  [115, 'stone_brick_stairs', '석재 벽돌 계단', RT.BOX, 'stone_bricks', 1.5, P, 1, { stairs: 1 }],
  [116, 'oak_fence', '참나무 울타리', RT.BOX, 'oak_planks', 2, A, 0, { connect: 1 }],
  [117, 'glass_pane', '유리판', RT.BOX, 'glass', 0.3, N, 0, { connect: 2 }],
  [119, 'enchanting_table', '마법 부여대', RT.BOX, ['enchanting_table_side', 'enchanting_table_top', 'obsidian'], 5, P, 1, { light: 7 }],
  // ---- redstone ----
  [120, 'redstone_wire', '레드스톤 가루', RT.WIRE, 'redstone_dust_dot', 0, N, 0, { nosolid: 1, rs: 'wire', tint: 6 }],
  [121, 'redstone_torch', '레드스톤 횃불', RT.TORCH, 'redstone_torch', 0, N, 0, { light: 7, nosolid: 1, rs: 'torch' }],
  [122, 'unlit_redstone_torch', '레드스톤 횃불', RT.TORCH, 'redstone_torch_off', 0, N, 0, { nosolid: 1, rs: 'torch' }],
  [123, 'redstone_lamp', '레드스톤 램프', C, 'redstone_lamp', 0.3, N, 0, { rs: 'lamp' }],
  [124, 'lit_redstone_lamp', '레드스톤 램프', C, 'redstone_lamp_on', 0.3, N, 0, { rs: 'lamp', light: 15 }],
  [125, 'lever', '레버', RT.BOX, 'cobblestone', 0.5, N, 0, { nosolid: 1, rs: 'lever' }],
  [126, 'stone_button', '돌 버튼', RT.BOX, 'stone', 0.5, P, 0, { nosolid: 1, rs: 'button' }],
  [127, 'stone_pressure_plate', '돌 압력판', RT.BOX, 'stone', 0.5, P, 1, { nosolid: 1, rs: 'plate' }],
  [128, 'repeater', '레드스톤 중계기', RT.BOX, ['smooth_stone', 'repeater', 'smooth_stone'], 0, N, 0, { rs: 'repeater' }],
  [129, 'piston', '피스톤', RT.BOX, ['piston_side', 'piston_top', 'piston_bottom'], 1.5, P, 0, { rs: 'piston' }],
  [130, 'sticky_piston', '끈끈이 피스톤', RT.BOX, ['piston_side', 'piston_top_sticky', 'piston_bottom'], 1.5, P, 0, { rs: 'piston' }],
  [131, 'piston_head', '피스톤 머리', RT.BOX, ['piston_side', 'piston_top', 'piston_top'], 1.5, P, 0, { rs: 'head' }],
  // ---- utility & village ----
  [132, 'anvil', '모루', RT.BOX, ['anvil', 'anvil_top', 'anvil'], 5, P, 1, { fall: 1, facing: 1 }],
  [133, 'smithing_table', '대장장이 작업대', C, ['smithing_table_side', 'smithing_table_top', 'smithing_table_bottom', 'smithing_table_front'], 2.5, A, 0],
  [134, 'dirt_path', '흙길', RT.BOX, ['dirt_path_side', 'dirt_path_top', 'dirt'], 0.65, S, 0],
  // ---- nether ----
  [135, 'netherrack', '네더랙', C, 'netherrack', 0.4, P, 1],
  [136, 'nether_quartz_ore', '네더 석영 광석', C, 'nether_quartz_ore', 3, P, 1],
  [137, 'nether_gold_ore', '네더 금 광석', C, 'nether_gold_ore', 3, P, 1],
  [138, 'soul_sand', '영혼 모래', C, 'soul_sand', 0.5, S, 0],
  [139, 'soul_soil', '영혼 흙', C, 'soul_soil', 0.5, S, 0],
  [140, 'glowstone', '발광석', C, 'glowstone', 0.3, N, 0, { light: 15 }],
  [141, 'magma_block', '마그마 블록', C, 'magma', 0.5, P, 1, { light: 3 }],
  [142, 'basalt', '현무암', C, ['basalt_side', 'basalt_top', 'basalt_top'], 1.25, P, 1, { log: 1 }],
  [143, 'blackstone', '흑암', C, ['blackstone', 'blackstone_top', 'blackstone_top'], 1.5, P, 1],
  [144, 'nether_bricks', '네더 벽돌', C, 'nether_bricks', 2, P, 1],
  [145, 'crimson_nylium', '진홍빛 나일리움', C, ['crimson_nylium_side', 'crimson_nylium', 'netherrack'], 0.4, P, 1],
  [146, 'warped_nylium', '뒤틀린 나일리움', C, ['warped_nylium_side', 'warped_nylium', 'netherrack'], 0.4, P, 1],
  [147, 'crimson_stem', '진홍빛 자루', C, ['crimson_stem', 'crimson_stem_top', 'crimson_stem_top'], 2, A, 0, { log: 1 }],
  [148, 'warped_stem', '뒤틀린 자루', C, ['warped_stem', 'warped_stem_top', 'warped_stem_top'], 2, A, 0, { log: 1 }],
  [149, 'nether_wart_block', '네더 사마귀 블록', C, 'nether_wart_block', 1, H, 0],
  [150, 'warped_wart_block', '뒤틀린 사마귀 블록', C, 'warped_wart_block', 1, H, 0],
  [151, 'shroomlight', '버섯불', C, 'shroomlight', 1, H, 0, { light: 15 }],
  [152, 'crimson_fungus', '진홍빛 균', X, 'crimson_fungus', 0, N, 0, { plant: 7 }],
  [153, 'warped_fungus', '뒤틀린 균', X, 'warped_fungus', 0, N, 0, { plant: 7 }],
  [154, 'crimson_roots', '진홍빛 뿌리', X, 'crimson_roots', 0, N, 0, { plant: 7, repl: 1 }],
  [155, 'warped_roots', '뒤틀린 뿌리', X, 'warped_roots', 0, N, 0, { plant: 7, repl: 1 }],
  [156, 'nether_portal', '네더 차원문', RT.TBOX, 'nether_portal', -1, N, 0, { light: 11, nosolid: 1 }],
  [157, 'ancient_debris', '고대 잔해', C, ['ancient_debris_side', 'ancient_debris_top', 'ancient_debris_top'], 30, P, 4],
  [158, 'netherite_block', '네더라이트 블록', C, 'netherite_block', 50, P, 4],
  [159, 'quartz_block', '석영 블록', C, ['quartz_block_side', 'quartz_block_top', 'quartz_block_top'], 0.8, P, 1],
  [160, 'crying_obsidian', '우는 흑요석', C, 'crying_obsidian', 50, P, 4, { light: 10 }],
  [161, 'nether_wart', '네더 사마귀', RT.CROP, 'nether_wart0', 0, N, 0, { plant: 8 }],
  [162, 'fire', '불', RT.CROP, 'fire', 0, N, 0, { light: 15, nosolid: 1, repl: 1 }],
  [163, 'crimson_planks', '진홍빛 판자', C, 'crimson_planks', 2, A, 0],
  [164, 'warped_planks', '뒤틀린 판자', C, 'warped_planks', 2, A, 0],
  [165, 'nether_brick_fence', '네더 벽돌 울타리', RT.BOX, 'nether_bricks', 2, P, 1, { connect: 3 }],
  // ---- end & strongholds ----
  [166, 'end_stone', '엔드 돌', C, 'end_stone', 3, P, 1],
  [167, 'end_portal_frame', '엔드 차원문 틀', RT.BOX, ['end_portal_frame_side', 'end_portal_frame_top', 'end_stone'], -1, N, 0, { light: 1 }],
  [168, 'end_portal', '엔드 차원문', RT.BOX, 'end_portal', -1, N, 0, { light: 15, nosolid: 1 }],
  [169, 'end_stone_bricks', '엔드 돌 벽돌', C, 'end_stone_bricks', 3, P, 1],
  [170, 'dragon_egg', '드래곤 알', RT.BOX, 'dragon_egg', 3, N, 0, { light: 1, fall: 1 }],
  [171, 'mossy_stone_bricks', '이끼 낀 석재 벽돌', C, 'mossy_stone_bricks', 1.5, P, 1],
  [172, 'cracked_stone_bricks', '금 간 석재 벽돌', C, 'cracked_stone_bricks', 1.5, P, 1],
  [173, 'iron_bars', '철창', RT.BOX, 'iron_bars', 5, P, 1, { connect: 2 }],
  [174, 'slime_block', '슬라임 블록', RT.TRANS, 'slime_block', 0, N, 0, { lop: 1, selfcull: 1, bounce: 1 }],
  [118, 'glow_lichen', '발광 이끼', RT.BOX, 'glow_lichen', 0.2, TOOL.SHEARS, 99, { light: 7, nosolid: 1, repl: 1, lichen: 1 }],
];
const NB = 256;
const BLOCKS = new Array(NB).fill(null);
const BID = {};
const RTYPE = new Uint8Array(NB), OPQ = new Uint8Array(NB), LOP = new Uint8Array(NB), LEM = new Uint8Array(NB);
const SOLID = new Uint8Array(NB), TINT = new Uint8Array(NB), FLUID = new Uint8Array(NB), REPL = new Uint8Array(NB);
const SELFCULL = new Uint8Array(NB), FACING = new Uint8Array(NB), LOGAX = new Uint8Array(NB);
const FT = new Int16Array(NB * 4); // side, top, bottom, front
for (const r of BLOCK_ROWS) {
  const [id, key, name, rt, tx, hard, tool, tier, ex = {}] = r;
  const d = { id, key, name, rt, hard, tool, tier, ...ex };
  BLOCKS[id] = d; BID[key] = id;
  RTYPE[id] = rt;
  OPQ[id] = (rt === RT.CUBE && !ex.nosolid) || id === BID.powder_snow ? 1 : 0;
  LOP[id] = ex.lop != null ? ex.lop : (OPQ[id] ? 15 : 0);
  LEM[id] = ex.light || 0;
  SOLID[id] = rt === RT.AIR || ex.nosolid || rt === RT.CROSS || rt === RT.CROP || rt === RT.TORCH ? 0 : 1;
  TINT[id] = ex.tint || 0; FLUID[id] = ex.fluid || 0;
  REPL[id] = rt === RT.AIR ? 1 : (ex.repl || 0);
  SELFCULL[id] = ex.selfcull || 0; FACING[id] = ex.facing || 0; LOGAX[id] = ex.log || 0;
  if (tx) {
    const a = typeof tx === 'string' ? [tx, tx, tx, tx] : [tx[0], tx[1], tx[2], tx[3] || tx[0]];
    for (let k = 0; k < 4; k++) { if (T[a[k]] == null) throw new Error('tile ' + a[k]); FT[id * 4 + k] = T[a[k]]; }
  }
}
OPQ[BID.powder_snow] = 1;

// ---------- biomes ----------
// name, grass, foliage, water, temperature, trees per chunk, tree type
const BIOMES = [
  ['바다', 0x8eb971, 0x71a74d, 0x3f76e4, 0.5, 0, 0],
  ['평원', 0x91bd59, 0x77ab2f, 0x3f76e4, 0.8, 0.15, 0],
  ['숲', 0x79c05a, 0x59ae30, 0x3f76e4, 0.7, 8, 1],
  ['자작나무 숲', 0x88bb67, 0x6ba941, 0x3f76e4, 0.6, 8, 2],
  ['타이가', 0x86b783, 0x68a464, 0x3f76e4, 0.25, 8, 3],
  ['눈 덮인 툰드라', 0x80b497, 0x60a17b, 0x3d57d6, 0.0, 0.1, 3],
  ['사막', 0xbfb755, 0xaea42a, 0x3f76e4, 2.0, 0, 0],
  ['산', 0x8ab689, 0x6da36b, 0x3f76e4, 0.2, 1, 3],
  ['해변', 0x91bd59, 0x77ab2f, 0x3f76e4, 0.8, 0, 0],
  ['강', 0x8eb971, 0x71a74d, 0x3f76e4, 0.5, 0, 0],
  ['늪', 0x6a7039, 0x6a7039, 0x617b64, 0.8, 2, 0],
  ['눈 덮인 타이가', 0x80b497, 0x60a17b, 0x3d57d6, -0.5, 6, 3],
  ['얼어붙은 바다', 0x80b497, 0x60a17b, 0x3938c9, 0.0, 0, 0],
];
const BIO = { OCEAN: 0, PLAINS: 1, FOREST: 2, BIRCH: 3, TAIGA: 4, TUNDRA: 5, DESERT: 6, MOUNTAINS: 7, BEACH: 8, RIVER: 9, SWAMP: 10, SNOWY_TAIGA: 11, FROZEN_OCEAN: 12 };

// ---------- shapes (pixel boxes) ----------
const DIRS = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]]; // facing 0 north,1 east,2 south,3 west
const DIR6 = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]]; // down, up, north, south, west, east
// rotate a pixel box about the block centre for horizontal facing f (boxes are authored facing north)
function rotBox(b, f) { const [x0, y0, z0, x1, y1, z1] = b; return f === 0 ? b : f === 1 ? [16 - z1, y0, x0, 16 - z0, y1, x1] : f === 2 ? [16 - x1, y0, 16 - z1, 16 - x0, y1, 16 - z0] : [z0, y0, 16 - x1, z1, y1, 16 - x0]; }
function shapes(id, meta) {
  switch (id) {
    case 37: return [[1, 0, 1, 15, 16, 15]];
    case 44: return [[1, 0, 1, 15, 14, 15]];
    case 57: return [[0, 0, 0, 16, 15, 16]];
    case 51: return [[0, 0, 0, 16, ((meta & 7) + 1) * 2, 16]];
    case 95: return [[0, 3, 0, 16, 9, 16], [0, 0, 0, 3, 3, 3], [13, 0, 0, 16, 3, 3], [0, 0, 13, 3, 3, 16], [13, 0, 13, 16, 3, 16]];
    case 96: { const f = (meta & 3), open = meta & 4; return [doorBox(open ? (f + 1) & 3 : f)]; }
    case 97: return [ladderBox(meta & 3)];
    case 99: return meta & 1 ? [[5, 1, 5, 11, 8, 11], [6, 8, 6, 10, 10, 10], [7, 10, 7, 9, 16, 9]] : [[5, 0, 5, 11, 7, 11], [6, 7, 6, 10, 9, 10]];
    case 109: case 110: case 111: return (meta & 1) ? [[0, 8, 0, 16, 16, 16]] : [[0, 0, 0, 16, 8, 16]];
    case 113: case 114: case 115: { // stairs: meta = facing | top<<2
      const f = meta & 3, top = meta & 4, ylo = top ? 0 : 8, yhi = top ? 8 : 16;
      const back = f === 0 ? [0, ylo, 0, 16, yhi, 8] : f === 1 ? [8, ylo, 0, 16, yhi, 16] : f === 2 ? [0, ylo, 8, 16, yhi, 16] : [0, ylo, 0, 8, yhi, 16];
      return [top ? [0, 8, 0, 16, 16, 16] : [0, 0, 0, 16, 8, 16], back];
    }
    case 119: return [[0, 0, 0, 16, 12, 16]];
    case 116: case 165: { // fences: meta bits N,E,S,W connections
      const b = [[6, 0, 6, 10, 16, 10]];
      for (const y0 of [6, 12]) {
        if (meta & 1) b.push([7, y0, 0, 9, y0 + 3, 6]); if (meta & 2) b.push([10, y0, 7, 16, y0 + 3, 9]);
        if (meta & 4) b.push([7, y0, 10, 9, y0 + 3, 16]); if (meta & 8) b.push([0, y0, 7, 6, y0 + 3, 9]);
      }
      return b;
    }
    case 117: case 173: { // glass pane / iron bars
      const b = [[7, 0, 7, 9, 16, 9]];
      if (meta & 1) b.push([7, 0, 0, 9, 16, 7]); if (meta & 2) b.push([9, 0, 7, 16, 16, 9]);
      if (meta & 4) b.push([7, 0, 9, 9, 16, 16]); if (meta & 8) b.push([0, 0, 7, 7, 16, 9]);
      return b;
    }
    case 125: { // lever: meta = attached side (DIR6 index) | on<<3
      const a = meta & 7, on = meta & 8;
      const base = [[4, 0, 5, 12, 3, 11], [4, 13, 5, 12, 16, 11], [4, 5, 0, 12, 11, 3], [4, 5, 13, 12, 11, 16], [0, 5, 4, 3, 11, 12], [13, 5, 4, 16, 11, 12]][a];
      const h = on ? [[9, 3, 7, 11, 10, 9], [9, 6, 7, 11, 13, 9], [7, 2, 3, 9, 8, 5], [7, 2, 11, 9, 8, 13], [3, 2, 7, 5, 8, 9], [11, 2, 7, 13, 8, 9]][a]
        : [[5, 3, 7, 7, 10, 9], [5, 6, 7, 7, 13, 9], [7, 8, 3, 9, 14, 5], [7, 8, 11, 9, 14, 13], [3, 8, 7, 5, 14, 9], [11, 8, 7, 13, 14, 9]][a];
      return [base, h];
    }
    case 126: { const a = meta & 7, t = meta & 8 ? 1 : 2; return [[[5, 0, 6, 11, t, 10], [5, 16 - t, 6, 11, 16, 10], [5, 6, 0, 11, 10, t], [5, 6, 16 - t, 11, 10, 16], [0, 6, 5, t, 10, 11], [16 - t, 6, 5, 16, 10, 11]][a]]; }
    case 127: return [[1, 0, 1, 15, meta & 1 ? 1 : 2, 15]];
    case 128: { // repeater: facing | delay<<2 | powered<<4; torches drawn as extra boxes
      const f = meta & 3, d = (meta >> 2) & 3;
      return [[0, 0, 0, 16, 2, 16], rotBox([7, 2, 2, 9, 7, 4], f), rotBox([7, 2, 6 + d * 2, 9, 7, 8 + d * 2], f)];
    }
    case 129: case 130: { // piston base: facing (DIR6) | extended<<3
      if (!(meta & 8)) return [[0, 0, 0, 16, 16, 16]];
      return [[[0, 4, 0, 16, 16, 16], [0, 0, 0, 16, 12, 16], [0, 0, 4, 16, 16, 16], [0, 0, 0, 16, 16, 12], [4, 0, 0, 16, 16, 16], [0, 0, 0, 12, 16, 16]][meta & 7]];
    }
    case 131: { const f = meta & 7; return [[[0, 0, 0, 16, 4, 16], [0, 12, 0, 16, 16, 16], [0, 0, 0, 16, 16, 4], [0, 0, 12, 16, 16, 16], [0, 0, 0, 4, 16, 16], [12, 0, 0, 16, 16, 16]][f],
      [[6, 4, 6, 10, 20, 10], [6, -4, 6, 10, 12, 10], [6, 6, 4, 10, 10, 20], [6, 6, -4, 10, 10, 12], [4, 6, 6, 20, 10, 10], [-4, 6, 6, 12, 10, 10]][f]]; } // the arm reaches 4px into the base
    case 132: { const f = meta & 3; return [rotBox([2, 0, 2, 14, 4, 14], f), rotBox([4, 4, 3, 12, 5, 13], f), rotBox([6, 5, 4, 10, 10, 12], f), rotBox([3, 10, 0, 13, 16, 16], f)]; }
    case 134: return [[0, 0, 0, 16, 15, 16]];
    case 156: return [(meta & 1) ? [6, 0, 0, 10, 16, 16] : [0, 0, 6, 16, 16, 10]];
    case 167: return meta & 4 ? [[0, 0, 0, 16, 13, 16], [4, 13, 4, 12, 16, 12]] : [[0, 0, 0, 16, 13, 16]];
    case 168: return [[0, 0, 0, 16, 12, 16]];
    case 170: return [[6, 15, 6, 10, 16, 10], [4, 14, 4, 12, 15, 12], [3, 13, 3, 13, 14, 13], [2, 11, 2, 14, 13, 14], [1, 8, 1, 15, 11, 15], [2, 3, 2, 14, 8, 14], [3, 1, 3, 13, 3, 13], [5, 0, 5, 11, 1, 11]];
    case 118: return [[[0, 0, 0, 16, 1, 16], [0, 15, 0, 16, 16, 16], [0, 0, 0, 16, 16, 1], [0, 0, 15, 16, 16, 16], [0, 0, 0, 1, 16, 16], [15, 0, 0, 16, 16, 16]][meta % 6]]; // glow lichen: attached face
  }
  return null;
}
function doorBox(f) { return f === 0 ? [0, 0, 0, 16, 16, 3] : f === 1 ? [13, 0, 0, 16, 16, 16] : f === 2 ? [0, 0, 13, 16, 16, 16] : [0, 0, 0, 3, 16, 16]; }
function ladderBox(f) { return f === 0 ? [0, 0, 0, 16, 16, 1] : f === 1 ? [15, 0, 0, 16, 16, 16] : f === 2 ? [0, 0, 15, 16, 16, 16] : [0, 0, 0, 1, 16, 16]; }
// collision boxes (null => full cube when SOLID)
function collide(id, meta) {
  if (id === 51) { const l = meta & 7; return l === 0 ? [] : [[0, 0, 0, 16, l * 2, 16]]; }
  if (id === 95) return [[0, 0, 0, 16, 9, 16]];
  if (id === 138) return [[0, 0, 0, 16, 14, 16]]; // soul sand slows by sinking you slightly
  if (id === 128) return [[0, 0, 0, 16, 2, 16]];
  if (id === 116 || id === 165) { // fences are 1.5 blocks tall for collision
    const b = [[6, 0, 6, 10, 24, 10]];
    if (meta & 1) b.push([6, 0, 0, 10, 24, 6]); if (meta & 2) b.push([10, 0, 6, 16, 24, 10]);
    if (meta & 4) b.push([6, 0, 10, 10, 24, 16]); if (meta & 8) b.push([0, 0, 6, 6, 24, 10]);
    return b;
  }
  return shapes(id, meta);
}

// ---------- RNG & noise ----------
function hash32(a, b, c, d) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(d | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return (h ^ (h >>> 15)) >>> 0;
}
function rng(seed) { let s = seed >>> 0 || 1; const f = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.int = n => Math.floor(f() * n); return f; }
function makeNoise(seed) {
  const r = rng(seed), perm = new Uint8Array(512), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = r.int(i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function n2(xin, yin) {
    const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = (perm[ii + perm[jj]] % 12) * 3; tt *= tt; n += tt * tt * (G3[g] * x0 + G3[g + 1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = (perm[ii + i1 + perm[jj + j1]] % 12) * 3; tt *= tt; n += tt * tt * (G3[g] * x1 + G3[g + 1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = (perm[ii + 1 + perm[jj + 1]] % 12) * 3; tt *= tt; n += tt * tt * (G3[g] * x2 + G3[g + 1] * y2); }
    return 70 * n;
  }
  function n3(x, y, z) {
    const F3 = 1 / 3, G = 1 / 6;
    const s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s), t = (i + j + k) * G;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
    else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
    const x1 = x0 - i1 + G, y1 = y0 - j1 + G, z1 = z0 - k1 + G, x2 = x0 - i2 + 2 * G, y2 = y0 - j2 + 2 * G, z2 = z0 - k2 + 2 * G, x3 = x0 - 1 + 0.5, y3 = y0 - 1 + 0.5, z3 = z0 - 1 + 0.5;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (tt > 0) { g = (perm[ii + perm[jj + perm[kk]]] % 12) * 3; tt *= tt; n += tt * tt * (G3[g] * x0 + G3[g + 1] * y0 + G3[g + 2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (tt > 0) { g = (perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12) * 3; tt *= tt; n += tt * tt * (G3[g] * x1 + G3[g + 1] * y1 + G3[g + 2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (tt > 0) { g = (perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12) * 3; tt *= tt; n += tt * tt * (G3[g] * x2 + G3[g + 1] * y2 + G3[g + 2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (tt > 0) { g = (perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12) * 3; tt *= tt; n += tt * tt * (G3[g] * x3 + G3[g + 1] * y3 + G3[g + 2] * z3); }
    return 32 * n;
  }
  function fbm(x, z, oct) { let t = 0, a = 1, f = 1, s = 0; for (let o = 0; o < oct; o++) { t += n2(x * f + o * 17.3, z * f - o * 9.1) * a; s += a; a *= 0.5; f *= 2; } return t / s; }
  return { n2, n3, fbm };
}

// ---------- terrain ----------
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function makeGen(seed) {
  const nC = makeNoise(seed), nM = makeNoise(seed + 1), nD = makeNoise(seed + 2), nT = makeNoise(seed + 3), nH = makeNoise(seed + 4), nR = makeNoise(seed + 5), nX = makeNoise(seed + 6);
  // column: [height, biome]
  function column(wx, wz) {
    const cont = nC.fbm(wx / 900, wz / 900, 4) * 1.6 + 0.12;
    const land = smooth(-0.22, 0.02, cont);
    const mRaw = nM.fbm(wx / 420, wz / 420, 3);
    const mount = smooth(0.12, 0.5, mRaw) * smooth(0.0, 0.25, cont);
    const ridge = 1 - Math.abs(nM.n2(wx / 160, wz / 160));
    const hills = nD.fbm(wx / 130, wz / 130, 4);
    const detail = nD.n2(wx / 28, wz / 28);
    const oceanH = 44 + hills * 8 + cont * 10;
    let landH = 66 + hills * 7 + detail * 1.5 + smooth(0.1, 0.4, cont) * 4 + mount * (28 + ridge * ridge * 64);
    let h = oceanH + (landH - oceanH) * land;
    const rv = Math.abs(nR.fbm(wx / 520, wz / 520, 3));
    let river = false;
    if (land > 0.6 && mount < 0.5 && rv < 0.05) { const k = 1 - rv / 0.05; h = h + (57 - h) * smooth(0, 0.65, k); river = rv < 0.03; }
    h = Math.max(6, Math.min(CH - 6, Math.floor(h)));
    const temp = nT.fbm(wx / 1100, wz / 1100, 3) * 1.6 + nX.n2(wx / 40, wz / 40) * 0.04;
    const hum = nH.fbm(wx / 900, wz / 900, 3) * 1.6;
    let b;
    if (h < SEA - 1) b = river ? BIO.RIVER : (temp < -0.45 ? BIO.FROZEN_OCEAN : BIO.OCEAN);
    else if (river && h <= SEA) b = BIO.RIVER;
    else if (h <= SEA + 2 && cont < 0.2 && mount < 0.2) b = temp > 0.5 && hum < -0.1 ? BIO.DESERT : BIO.BEACH;
    else if (mount > 0.45) b = BIO.MOUNTAINS;
    else if (temp < -0.45) b = hum > 0.05 ? BIO.SNOWY_TAIGA : BIO.TUNDRA;
    else if (temp < -0.15) b = BIO.TAIGA;
    else if (temp > 0.45 && hum < 0.05) b = BIO.DESERT;
    else if (hum > 0.45 && temp > 0.1 && h <= SEA + 6) b = BIO.SWAMP;
    else if (hum > 0.15) b = nX.n2(wx / 300, wz / 300) > 0.25 ? BIO.BIRCH : BIO.FOREST;
    else b = BIO.PLAINS;
    return [h, b];
  }
  return { column, nD, nX };
}
// Cave worms (MC-style carvers) are deterministic per origin chunk, so each origin's
// carve spheres are simulated once and cached; every chunk within 8 reuses them.
const caveCache = new Map();
function caveBlobs(seed, ox, oz) {
  const key = ox * 65536 + oz;
  let bl = caveCache.get(key);
  if (bl && bl.seed === seed) return bl.data;
  const out = [];
  function tunnel(r, px, py, pz, width, yaw, pitch, start, len, yScale) {
    const midBranch = r.int(len / 2) + len / 4; const steep = r.int(6) === 0;
    let dyaw = 0, dpitch = 0;
    for (let i = start; i < len; i++) {
      const rh = 1.5 + Math.sin(Math.PI * i / len) * width, rv = rh * yScale;
      const cp = Math.cos(pitch);
      px += Math.cos(yaw) * cp; py += Math.sin(pitch); pz += Math.sin(yaw) * cp;
      pitch *= steep ? 0.92 : 0.7; pitch += dpitch * 0.1; yaw += dyaw * 0.1;
      dpitch *= 0.9; dyaw *= 0.75; dpitch += (r() - r()) * r() * 2; dyaw += (r() - r()) * r() * 4;
      if (i === midBranch && width > 1 && yScale === 1) {
        tunnel(rng(hash32(seed, px | 0, pz | 0, i)), px, py, pz, r() * 0.5 + 0.5, yaw - Math.PI / 2, pitch / 3, i, len, 1);
        tunnel(rng(hash32(seed, pz | 0, px | 0, i + 7)), px, py, pz, r() * 0.5 + 0.5, yaw + Math.PI / 2, pitch / 3, i, len, 1);
        return;
      }
      if (r.int(4) === 0) continue;
      out.push(px, py, pz, rh, rv);
    }
  }
  const r = rng(hash32(seed, ox, oz, 2));
  if (r.int(7) === 0) {
    const n = r.int(r.int(r.int(15) + 1) + 1);
    for (let k = 0; k < n; k++) {
      const px = ox * 16 + r.int(16), py = r.int(r.int(120) + 8), pz = oz * 16 + r.int(16);
      let tun = 1;
      if (r.int(4) === 0) { out.push(px, py, pz, 1.5 + (1 + r() * 6) * 1.2, (1 + r() * 6) * 0.7); tun += r.int(4); }
      for (let t = 0; t < tun; t++) {
        let w = r() * 2 + r(); if (r.int(10) === 0) w *= r() * r() * 3 + 1;
        tunnel(rng(hash32(seed, ox * 31 + k, oz * 17 + t, 3)), px, py, pz, w, r() * Math.PI * 2, (r() - 0.5) / 4, 0, 112 - r.int(28), 1);
      }
    }
  }
  if (r.int(60) === 0) {
    const px = ox * 16 + r.int(16), py = 20 + r.int(30), pz = oz * 16 + r.int(16);
    tunnel(rng(hash32(seed, ox, oz, 4)), px, py, pz, (r() * 2 + r()) * 2, r() * Math.PI * 2, (r() - 0.5) / 4, 0, 90, 3);
  }
  const data = new Float32Array(out);
  if (caveCache.size > 4000) caveCache.delete(caveCache.keys().next().value);
  caveCache.set(key, { seed, data });
  return data;
}
const ORE_SWAP = { 13: 78, 12: 79, 14: 80, 11: 81, 16: 82, 17: 83, 15: 84 };
function genChunk(seed, cx, cz) {
  const G = makeGen(seed);
  const blocks = new Uint8Array(CVOL), meta = new Uint8Array(CVOL);
  const biome = new Uint8Array(256), hgt = new Int16Array(18 * 18), bpad = new Uint8Array(18 * 18);
  const x0 = cx * CW, z0 = cz * CW;
  for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) { const c = G.column(x0 + x, z0 + z); hgt[(z + 1) * 18 + x + 1] = c[0]; bpad[(z + 1) * 18 + x + 1] = c[1]; }
  const I = (x, y, z) => (y << 8) | (z << 4) | x;
  const R = rng(hash32(seed, cx, cz, 1));
  const STONE = 1, WATER = 27, LAVA = 28;
  // 1. base terrain + surface
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const h = hgt[(z + 1) * 18 + x + 1], b = bpad[(z + 1) * 18 + x + 1];
    biome[z * 16 + x] = b;
    const wx = x0 + x, wz = z0 + z;
    const dsl = 7 + Math.floor(G.nX.n2(wx / 9, wz / 9) * 3);
    const depth = 3 + Math.floor((G.nD.n2(wx / 7, wz / 7) + 1) * 1.2);
    let slope = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) slope = Math.max(slope, Math.abs(hgt[(z + 1 + dz) * 18 + x + 1 + dx] - h));
    for (let y = 0; y <= h; y++) {
      let id = y < dsl ? 76 : STONE;
      const d = h - y;
      if (b === BIO.DESERT) { if (d < 4) id = 9; else if (d < 7) id = 26; }
      else if (b === BIO.BEACH) { if (d < 4) id = 9; else if (d < 6) id = 26; }
      else if (b === BIO.OCEAN || b === BIO.FROZEN_OCEAN || b === BIO.RIVER) { if (d < 3) id = h < SEA - 12 ? 10 : (G.nX.n2(wx / 12, wz / 12) > 0.55 ? 53 : 9); }
      else if (b === BIO.MOUNTAINS) {
        if (h > 92 || slope > 2) { if (d === 0 && h > 98 && slope <= 2) id = 50; }
        else if (d === 0) id = 2; else if (d < depth) id = 3;
      }
      else { if (d === 0) id = h < SEA ? 3 : 2; else if (d < depth) id = 3; }
      blocks[I(x, y, z)] = id;
    }
    for (let y = h + 1; y <= SEA; y++) blocks[I(x, y, z)] = WATER;
    if ((b === BIO.FROZEN_OCEAN || ((b === BIO.TUNDRA || b === BIO.SNOWY_TAIGA || b === BIO.RIVER) && BIOMES[b][4] <= 0.15)) && h < SEA) blocks[I(x, SEA, z)] = 52;
    blocks[I(x, 0, z)] = 8;
    for (let y = 1; y < 5; y++) if (R() < (5 - y) / 5) blocks[I(x, y, z)] = 8;
  }
  // 2. carvers (caves + ravines) seeded from surrounding chunks
  const carvable = id => id === 1 || id === 2 || id === 3 || id === 76 || id === 26 || id === 50 || (id >= 11 && id <= 18) || id === 91 || id === 92 || id === 93 || id === 75 || id === 10 || id === 9;
  function carveBlob(px, py, pz, rh, rv) {
    const minX = Math.max(0, Math.floor(px - x0 - rh) - 1), maxX = Math.min(15, Math.floor(px - x0 + rh) + 1);
    const minZ = Math.max(0, Math.floor(pz - z0 - rh) - 1), maxZ = Math.min(15, Math.floor(pz - z0 + rh) + 1);
    if (minX > maxX || minZ > maxZ) return;
    const minY = Math.max(1, Math.floor(py - rv) - 1), maxY = Math.min(CH - 8, Math.floor(py + rv) + 1);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) for (let y = maxY + 1; y >= minY - 1; y--) {
      if (y < 0 || y >= CH) continue; const b = blocks[I(x, y, z)]; if (b === WATER || b === 52) return;
    }
    for (let x = minX; x <= maxX; x++) {
      const dx = (x + x0 + 0.5 - px) / rh;
      for (let z = minZ; z <= maxZ; z++) {
        const dz = (z + z0 + 0.5 - pz) / rh; if (dx * dx + dz * dz >= 1) continue;
        let grass = false;
        for (let y = maxY; y >= minY; y--) {
          const dy = (y + 0.5 - py) / rv; if (dy <= -0.7 || dx * dx + dy * dy + dz * dz >= 1) continue;
          const i = I(x, y, z), b = blocks[i];
          if (b === 2) grass = true;
          if (!carvable(b)) continue;
          if ((b === 9 || b === 10) && blocks[I(x, Math.min(CH - 1, y + 1), z)] === WATER) continue;
          blocks[i] = y <= 10 ? LAVA : 0;
          if (grass && y > 0 && blocks[I(x, y - 1, z)] === 3) blocks[I(x, y - 1, z)] = 2;
        }
      }
    }
  }
  for (let ox = cx - 8; ox <= cx + 8; ox++) for (let oz = cz - 8; oz <= cz + 8; oz++) {
    const bl = caveBlobs(seed, ox, oz);
    for (let i = 0; i < bl.length; i += 5) {
      const px = bl[i], pz = bl[i + 2], rh = bl[i + 3];
      if (px + rh < x0 - 1 || px - rh > x0 + 17 || pz + rh < z0 - 1 || pz - rh > z0 + 17) continue;
      carveBlob(px, bl[i + 1], pz, rh, bl[i + 4]);
    }
  }
  // 3. ores and blobs (start inside chunk, clipped to chunk)
  function vein(id, size, y, onlyStone) {
    const x = R() * 16, z = R() * 16;
    const a = R() * Math.PI, s8 = size / 8;
    const xa = x + Math.sin(a) * s8, xb = x - Math.sin(a) * s8, za = z + Math.cos(a) * s8, zb = z - Math.cos(a) * s8;
    const ya = y + R.int(3) - 2, yb = y + R.int(3) - 2;
    for (let i = 0; i < size; i++) {
      const t = i / size, px = xa + (xb - xa) * t, py = ya + (yb - ya) * t, pz = za + (zb - za) * t;
      const rr = ((Math.sin(Math.PI * t) + 1) * R() * size / 16 + 1) / 2;
      const ax0 = Math.max(0, Math.floor(px - rr)), ax1 = Math.min(15, Math.floor(px + rr));
      const az0 = Math.max(0, Math.floor(pz - rr)), az1 = Math.min(15, Math.floor(pz + rr));
      const ay0 = Math.max(1, Math.floor(py - rr)), ay1 = Math.min(CH - 1, Math.floor(py + rr));
      if (ax0 > ax1 || az0 > az1 || ay0 > ay1) continue;
      const r2 = rr * rr;
      for (let bx = ax0; bx <= ax1; bx++) for (let by = ay0; by <= ay1; by++) for (let bz = az0; bz <= az1; bz++) {
        const dx = bx + 0.5 - px, dy = by + 0.5 - py, dz = bz + 0.5 - pz;
        if (dx * dx + dy * dy + dz * dz >= r2) continue;
        const i2 = I(bx, by, bz), cur = blocks[i2];
        if (cur === 1) blocks[i2] = id; else if (cur === 76 && !onlyStone) blocks[i2] = ORE_SWAP[id] || (id === 75 ? 75 : 76);
      }
    }
  }
  const uni = (lo, hi) => lo + R.int(hi - lo + 1);
  const tri = (c, s) => c + R.int(s) - R.int(s);
  // dirt/gravel: MC spreads 10/8 blobs over 256 blocks of height; this world is 128 high
  for (let i = 0; i < 5; i++) vein(3, 33, uni(0, 127), 1);
  for (let i = 0; i < 4; i++) vein(10, 33, uni(0, 127), 1);
  for (const id of [91, 92, 93]) for (let i = 0; i < 10; i++) vein(id, 33, uni(0, 79), 1);
  for (let i = 0; i < 2; i++) vein(75, 33, uni(0, 16), 0);
  for (let i = 0; i < 20; i++) vein(13, 17, uni(0, 127));
  for (let i = 0; i < 20; i++) vein(12, 9, uni(0, 63));
  for (let i = 0; i < 6; i++) vein(14, 10, tri(48, 48));
  for (let i = 0; i < 2; i++) vein(11, 9, uni(0, 31));
  for (let i = 0; i < 8; i++) vein(16, 8, uni(0, 15));
  vein(15, 8, uni(0, 15));
  vein(17, 7, tri(16, 16));
  if (biome[8 * 16 + 8] === BIO.MOUNTAINS) for (let i = 3 + R.int(6); i > 0; i--) { const i2 = I(R.int(16), uni(4, 31), R.int(16)); if (blocks[i2] === 1) blocks[i2] = 18; }
  const tiles = [];
  // 4. amethyst geode (1.17)
  if (R.int(24) === 0) {
    const gx = 8 + R.int(3) - 1, gz = 8 + R.int(3) - 1, gy = 8 + R.int(32);
    if (gy + 7 < hgt[(gz + 1) * 18 + gx + 1] - 2) {
      const sc = 0.85 + R() * 0.3;
      for (let x = gx - 7; x <= gx + 7; x++) for (let y = gy - 7; y <= gy + 7; y++) for (let z = gz - 7; z <= gz + 7; z++) {
        if (x < 0 || z < 0 || x > 15 || z > 15 || y < 2) continue;
        const d = Math.sqrt((x - gx) ** 2 + (y - gy) ** 2 * 1.1 + (z - gz) ** 2) / sc + G.nX.n3(x * 0.4, y * 0.4, z * 0.4 + cx) * 0.6;
        const i2 = I(x, y, z);
        if (d < 3.3) blocks[i2] = 0;
        else if (d < 4.3) blocks[i2] = R() < 0.083 ? 72 : 71;
        else if (d < 5.3) blocks[i2] = 74;
        else if (d < 6.3) blocks[i2] = 105;
      }
      for (let x = gx - 5; x <= gx + 5; x++) for (let y = gy - 5; y <= gy + 5; y++) for (let z = gz - 5; z <= gz + 5; z++) {
        if (x < 1 || z < 1 || x > 14 || z > 14 || y < 2 || blocks[I(x, y, z)] !== 72) continue;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const j = I(x + dx, y + dy, z + dz); if (blocks[j] === 0 && R() < 0.35) blocks[j] = 73;
        }
      }
    }
  }
  // 5. dungeon (monster room)
  if (R.int(3) === 0) {
    const dx = 3 + R.int(10), dz = 3 + R.int(10), dy = 12 + R.int(40), rx = 2 + R.int(2), rz = 2 + R.int(2);
    let ok = true, open = 0;
    for (let x = dx - rx - 1; x <= dx + rx + 1 && ok; x++) for (let z = dz - rz - 1; z <= dz + rz + 1 && ok; z++) for (let y = dy - 1; y <= dy + 4; y++) {
      if (x < 0 || z < 0 || x > 15 || z > 15) { ok = false; break; }
      const b = blocks[I(x, y, z)], sol = b !== 0 && b !== WATER && b !== LAVA;
      if ((y === dy - 1 || y === dy + 4) && !sol) { ok = false; break; }
      if ((x === dx - rx - 1 || x === dx + rx + 1 || z === dz - rz - 1 || z === dz + rz + 1) && y === dy && b === 0 && blocks[I(x, y + 1, z)] === 0) open++;
      if (b === WATER || b === LAVA) ok = false;
    }
    if (ok && open >= 1 && open <= 5) {
      for (let x = dx - rx - 1; x <= dx + rx + 1; x++) for (let z = dz - rz - 1; z <= dz + rz + 1; z++) for (let y = dy + 3; y >= dy - 1; y--) {
        const i2 = I(x, y, z), wall = x === dx - rx - 1 || x === dx + rx + 1 || z === dz - rz - 1 || z === dz + rz + 1;
        if (y === dy - 1) blocks[i2] = R() < 0.75 ? 48 : 4;
        else if (!wall) blocks[i2] = 0;
        else if (blocks[I(x, y - 1, z)] !== 0 && blocks[i2] !== 0) blocks[i2] = 4;
      }
      blocks[I(dx, dy, dz)] = 108;
      tiles.push({ t: 'spawner', i: I(dx, dy, dz), mob: ['zombie', 'zombie', 'skeleton', 'spider'][R.int(4)] });
      for (let c = 0; c < 2; c++) for (let tr = 0; tr < 3; tr++) {
        const x = dx + R.int(rx * 2 + 1) - rx, z = dz + R.int(rz * 2 + 1) - rz, i2 = I(x, dy, z);
        if (blocks[i2] !== 0) continue;
        let walls = 0; for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (blocks[I(x + ax, dy, z + az)] !== 0) walls++;
        if (walls !== 1) continue;
        blocks[i2] = 44; meta[i2] = R.int(4);
        const loot = [], pool = [['saddle', 0], ['bread', 1], ['wheat', 4], ['gunpowder', 4], ['string', 4], ['bucket', 1], ['golden_apple', 1], ['redstone', 4], ['iron_ingot', 4], ['coal', 4], ['bone', 6], ['rotten_flesh', 6], ['name_tag', 0], ['wheat_seeds', 4]];
        for (let k = 1 + R.int(3) + 2; k > 0; k--) { const [it, mx] = pool[R.int(pool.length)]; if (mx) loot.push([R.int(27), it, 1 + R.int(mx)]); }
        tiles.push({ t: 'chest', i: i2, loot });
        break;
      }
    }
  }
  // 6. dripstone (sparse, 1.17)
  for (let a = 0; a < 6; a++) {
    const x = R.int(16), z = R.int(16), y0 = 12 + R.int(40);
    for (let y = y0; y < y0 + 20 && y < CH - 2; y++) {
      if (blocks[I(x, y, z)] === 0 && blocks[I(x, y + 1, z)] === 1) {
        blocks[I(x, y + 1, z)] = 85; blocks[I(x, y, z)] = 86;
        if (R() < 0.5 && y > 2 && blocks[I(x, y - 1, z)] === 0) blocks[I(x, y - 1, z)] = 86;
        break;
      }
    }
  }
  // glow lichen on cave walls (1.17), only well below the surface
  const LF = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  const rocky = b => b === 1 || b === 76 || b === 75 || b === 91 || b === 92 || b === 93;
  for (let z = 1; z < 15; z++) for (let x = 1; x < 15; x++) {
    const top = Math.min(56, hgt[(z + 1) * 18 + x + 1] - 8);
    for (let y = 8; y < top; y++) {
      const i2 = I(x, y, z); if (blocks[i2] !== 0 || R() > 0.12) continue;
      const f = R.int(6), [dx, dy, dz] = LF[f];
      if (rocky(blocks[I(x + dx, y + dy, z + dz)])) { blocks[i2] = 118; meta[i2] = f; }
    }
  }
  // 7. surface features: trees (from this and neighbouring chunks), plants, snow
  const setT = (wx, y, wz, id, m, force) => {
    const x = wx - x0, z = wz - z0; if (x < 0 || z < 0 || x > 15 || z > 15 || y < 1 || y >= CH) return;
    const i2 = I(x, y, z), cur = blocks[i2];
    if (force || cur === 0 || cur === 22 || cur === 23 || cur === 24 || REPL[cur] && !FLUID[cur]) { blocks[i2] = id; meta[i2] = m || 0; }
  };
  for (let ox = cx - 1; ox <= cx + 1; ox++) for (let oz = cz - 1; oz <= cz + 1; oz++) {
    const r = rng(hash32(seed, ox, oz, 5));
    const own = ox === cx && oz === cz;
    const cc = own ? [hgt[9 * 18 + 9], bpad[9 * 18 + 9]] : G.column(ox * 16 + 8, oz * 16 + 8);
    const bd = BIOMES[cc[1]];
    let cnt = bd[5] < 1 ? (r() < bd[5] ? 1 : 0) : Math.floor(bd[5] + r() * 3 - 1);
    for (let k = 0; k < cnt; k++) {
      const tx = ox * 16 + r.int(16), tz = oz * 16 + r.int(16), kind = r(), hh = r();
      let h, b;
      const lx = tx - x0, lz = tz - z0;
      if (lx >= -1 && lz >= -1 && lx <= 16 && lz <= 16) { h = hgt[(lz + 1) * 18 + lx + 1]; b = bpad[(lz + 1) * 18 + lx + 1]; } else { const c = G.column(tx, tz); h = c[0]; b = c[1]; }
      if (h <= SEA || b === BIO.DESERT || b === BIO.BEACH || b === BIO.RIVER || b === BIO.OCEAN || (b === BIO.MOUNTAINS && h > 92)) continue;
      if (lx >= 0 && lz >= 0 && lx < 16 && lz < 16) { const top = blocks[I(lx, h, lz)]; if (top !== 2 && top !== 3) continue; }
      let type = BIOMES[b][6];
      if (type === 1) type = kind < 0.2 ? 2 : 0;
      if (b === BIO.MOUNTAINS) type = kind < 0.6 ? 3 : 0;
      growTree(setT, tx, h + 1, tz, type, hh, b === BIO.TUNDRA || b === BIO.SNOWY_TAIGA);
      if (lx >= 0 && lz >= 0 && lx < 16 && lz < 16) blocks[I(lx, h, lz)] = 3;
    }
  }
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const h = hgt[(z + 1) * 18 + x + 1], b = biome[z * 16 + x], top = blocks[I(x, h, z)], above = I(x, h + 1, z);
    if (h + 1 >= CH || blocks[above] !== 0) continue;
    const v = R();
    if (top === 2) {
      if (b === BIO.PLAINS) { if (v < 0.22) blocks[above] = 29; else if (v < 0.235) blocks[above] = R() < 0.5 ? 31 : 32; else if (v < 0.245) blocks[above] = R() < 0.5 ? 33 : 34; else if (v < 0.2453) placePumpkins(x, h, z); }
      else if (b === BIO.FOREST || b === BIO.BIRCH) { if (v < 0.1) blocks[above] = 29; else if (v < 0.11) blocks[above] = R() < 0.6 ? 32 : 31; else if (v < 0.112) blocks[above] = R() < .5 ? 106 : 107; }
      else if (b === BIO.TAIGA || b === BIO.SNOWY_TAIGA) { if (v < 0.08) blocks[above] = 30; else if (v < 0.12) blocks[above] = 29; }
      else if (b === BIO.SWAMP) { if (v < 0.06) blocks[above] = 29; else if (v < 0.07) blocks[above] = 107; }
      else if (b === BIO.MOUNTAINS) { if (v < 0.05) blocks[above] = 29; }
      else if (b === BIO.TUNDRA) { if (v < 0.01) blocks[above] = 29; }
    } else if (top === 9 && b === BIO.DESERT) {
      if (v < 0.006 && x > 0 && z > 0 && x < 15 && z < 15) { const n = 1 + R.int(3); for (let k = 1; k <= n && h + k < CH; k++) blocks[I(x, h + k, z)] = 37; }
      else if (v < 0.012) blocks[above] = 35;
    }
    if ((top === 2 || top === 9 || top === 3) && h === SEA && R() < 0.25) {
      let wet = false; for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (hgt[(z + 1 + az) * 18 + x + 1 + ax] < SEA) wet = true;
      if (wet) { const n = 1 + R.int(3); for (let k = 1; k <= n; k++) blocks[I(x, h + k, z)] = 36; }
    }
  }
  function placePumpkins(x, h, z) { for (let k = 0; k < 5; k++) { const px = x + R.int(5) - 2, pz = z + R.int(5) - 2; if (px < 0 || pz < 0 || px > 15 || pz > 15) continue; const ph = hgt[(pz + 1) * 18 + px + 1]; if (blocks[I(px, ph, pz)] === 2 && blocks[I(px, ph + 1, pz)] === 0) { blocks[I(px, ph + 1, pz)] = 54; meta[I(px, ph + 1, pz)] = R.int(4); } } }
  // snow cover for cold biomes
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const b = biome[z * 16 + x], cold = BIOMES[b][4] <= 0.15 || (b === BIO.MOUNTAINS && hgt[(z + 1) * 18 + x + 1] > 95);
    if (!cold) continue;
    for (let y = CH - 2; y > 0; y--) {
      const id = blocks[I(x, y, z)]; if (id === 0) continue;
      if (OPQ[id] || id === 22 || id === 23 || id === 24) { if (blocks[I(x, y + 1, z)] === 0) blocks[I(x, y + 1, z)] = 51; }
      else if (REPL[id] && !FLUID[id] && OPQ[blocks[I(x, y - 1, z)]]) blocks[I(x, y, z)] = 51;
      break;
    }
  }
  const light = new Uint8Array(CVOL);
  lightChunk(blocks, light);
  return { blocks, meta, light, biome, tiles };
}
// tree shapes; types 0 oak, 2 birch, 3 spruce
function growTree(set, x, y, z, type, r, snowy) {
  if (type === 3) {
    const th = 6 + Math.floor(r * 4), top = y + th, leafStart = 1 + Math.floor(r * 2);
    let rad = 0, maxR = 2 + (r > 0.5 ? 1 : 0), step = 0;
    for (let yy = top + 1; yy >= y + leafStart; yy--) {
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad > 0 && Math.abs(dx) === rad && Math.abs(dz) === rad) continue;
        set(x + dx, yy, z + dz, 23, 0);
        if (snowy && (yy === top + 1 || rad > 0)) set(x + dx, yy + 1, z + dz, 51, 0);
      }
      if (rad >= maxR || (step++ & 1)) rad = rad >= maxR ? 1 : rad + 1; else if (rad === 0) rad = 1;
    }
    for (let i = 0; i < th; i++) set(x, y + i, z, 20, 0, true);
    return;
  }
  const th = (type === 2 ? 5 : 4) + Math.floor(r * 3), top = y + th, leaf = type === 2 ? 24 : 22, log = type === 2 ? 21 : 19;
  let h = Math.floor(r * 9973);
  for (let yy = top - 3; yy <= top; yy++) {
    const d = yy - top, rad = d >= -1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      if (Math.abs(dx) === rad && Math.abs(dz) === rad && (d === 0 || (h & 1))) continue;
      set(x + dx, yy, z + dz, leaf, 0);
    }
  }
  for (let i = 0; i < th; i++) set(x, y + i, z, log, 0, true);
}

// ---------- lighting (within one chunk) ----------
function lightChunk(blocks, light) {
  const q = new Int32Array(1 << 18); let qh = 0, qt = 0;
  const top = new Int16Array(256);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    let y = CH - 1;
    for (; y >= 0; y--) { const i = (y << 8) | (z << 4) | x; if (LOP[blocks[i]] > 0) break; light[i] = 0xf0; }
    top[z * 16 + x] = y + 1;
  }
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    let hi = top[z * 16 + x], t = hi;
    if (x > 0) t = Math.max(t, top[z * 16 + x - 1]); if (x < 15) t = Math.max(t, top[z * 16 + x + 1]);
    if (z > 0) t = Math.max(t, top[z * 16 + x - 16]); if (z < 15) t = Math.max(t, top[z * 16 + x + 16]);
    for (let y = hi; y <= Math.min(CH - 1, t); y++) { q[qt] = (y << 8) | (z << 4) | x; qt = (qt + 1) & 0x3ffff; }
  }
  bfs(blocks, light, q, qh, qt, 4);
  qh = qt = 0;
  for (let i = 0; i < CVOL; i++) { const e = LEM[blocks[i]]; if (e) { light[i] = (light[i] & 0xf0) | e; q[qt++] = i; } }
  bfs(blocks, light, q, qh, qt, 0);
}
function bfs(blocks, light, q, qh, qt, sh) {
  const M = 0x3ffff;
  while (qh !== qt) {
    const i = q[qh]; qh = (qh + 1) & M;
    const l = (light[i] >> sh) & 15; if (l <= 1) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    for (let k = 0; k < 6; k++) {
      let j;
      if (k === 0) { if (x === 0) continue; j = i - 1; } else if (k === 1) { if (x === 15) continue; j = i + 1; }
      else if (k === 2) { if (z === 0) continue; j = i - 16; } else if (k === 3) { if (z === 15) continue; j = i + 16; }
      else if (k === 4) { if (y === 0) continue; j = i - 256; } else { if (y === CH - 1) continue; j = i + 256; }
      const op = LOP[blocks[j]]; if (op >= 15) continue;
      const nl = l - Math.max(1, op);
      if (((light[j] >> sh) & 15) >= nl) continue;
      light[j] = sh ? (light[j] & 0x0f) | (nl << 4) : (light[j] & 0xf0) | nl;
      q[qt] = j; qt = (qt + 1) & M;
    }
  }
}

// ---------- mesher ----------
// padded volume: x,z in [-1,16], y in [-1,CH] (bottom layer bedrock, top layer open sky)
const PW = 18, PA = PW * PW, PH = CH + 2;
const pidx = (x, y, z) => (y + 1) * PA + (z + 1) * PW + (x + 1);
// face: normal, corner positions (bl, br, tr, tl seen from outside), shade, tile slot
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.6 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.6 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.8 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.8 },
];
// face index of each facing direction (0 north,1 east,2 south,3 west)
const DIR_FACE = [5, 0, 4, 1];
const AO_CURVE = [0.5, 0.66, 0.82, 1.0];
function Buf() { this.n = 0; this.pos = new Uint16Array(4096 * 3); this.uv = new Uint16Array(4096 * 2); this.lt = new Uint8Array(4096 * 4); this.col = new Uint8Array(4096 * 4); }
Buf.prototype.grow = function () {
  const c = this.pos.length / 3 * 2;
  const g = (a, k, T) => { const b = new T(c * k); b.set(a); return b; };
  this.pos = g(this.pos, 3, Uint16Array); this.uv = g(this.uv, 2, Uint16Array); this.lt = g(this.lt, 4, Uint8Array); this.col = g(this.col, 4, Uint8Array);
};
Buf.prototype.out = function (flip) {
  const nq = this.n / 4, idx = this.n > 65535 ? new Uint32Array(nq * 6) : new Uint16Array(nq * 6);
  for (let q = 0; q < nq; q++) {
    const b = q * 4, f = flip[q];
    if (f) { idx[q * 6] = b + 1; idx[q * 6 + 1] = b + 2; idx[q * 6 + 2] = b + 3; idx[q * 6 + 3] = b + 1; idx[q * 6 + 4] = b + 3; idx[q * 6 + 5] = b; }
    else { idx[q * 6] = b; idx[q * 6 + 1] = b + 1; idx[q * 6 + 2] = b + 2; idx[q * 6 + 3] = b; idx[q * 6 + 4] = b + 2; idx[q * 6 + 5] = b + 3; }
  }
  return { pos: this.pos.slice(0, this.n * 3), uv: this.uv.slice(0, this.n * 2), lt: this.lt.slice(0, this.n * 4), col: this.col.slice(0, this.n * 4), idx, count: this.n };
};
function meshChunk(B, M, L, bio, opts) {
  const fancy = opts.fancy, smoothL = opts.smooth;
  // opaque (no alpha test), cutout (alpha-tested: leaves, plants, glass, doors) and translucent buffers
  const O = new Buf(), Cu = new Buf(), Tr = new Buf(), oFlip = [], cFlip = [], tFlip = [];
  // biome tint per inner column, 3x3 blended
  const tint = new Uint8Array(256 * 3 * 3); // [grass, foliage, water] rgb
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    for (let k = 0; k < 3; k++) {
      let r = 0, g = 0, b = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = BIOMES[bio[(z + 1 + dz) * PW + x + 1 + dx]][1 + k]; r += c >> 16; g += (c >> 8) & 255; b += c & 255; }
      const o = ((z * 16 + x) * 3 + k) * 3; tint[o] = r / 9; tint[o + 1] = g / 9; tint[o + 2] = b / 9;
    }
  }
  const FIX = { 4: [0x80, 0xa7, 0x55], 5: [0x61, 0x99, 0x61] };
  let cr = 255, cg = 255, cb = 255;
  const setTint = (t, x, z, meta) => {
    if (!t) { cr = cg = cb = 255; return; }
    if (t === 6) { const p = (meta & 15) / 15; cr = (p ? p * 0.6 + 0.4 : 0.3) * 255; cg = Math.max(0, p * p * 0.7 - 0.5) * 255; cb = Math.max(0, p * p * 0.6 - 0.7) * 255; return; } // redstone power
    if (t >= 4) { const f = FIX[t]; cr = f[0]; cg = f[1]; cb = f[2]; return; }
    const o = ((z * 16 + x) * 3 + t - 1) * 3; cr = tint[o]; cg = tint[o + 1]; cb = tint[o + 2];
  };
  const blk = (x, y, z) => y < -1 ? 8 : y > CH ? 0 : B[pidx(x, y, z)];
  const lightAt = (x, y, z) => y > CH ? 0xf0 : y < -1 ? 0 : L[pidx(x, y, z)];
  // neighbour and AO sample offsets as flat index deltas
  const NOFF = new Int32Array(6), AOO = new Int32Array(6 * 12);
  for (let f = 0; f < 6; f++) {
    const F = FACES[f]; NOFF[f] = F.n[0] + F.n[2] * PW + F.n[1] * PA;
    for (let k = 0; k < 4; k++) {
      const c = F.c[k]; let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
      if (F.n[0]) { ay = c[1] ? 1 : -1; bz = c[2] ? 1 : -1; } else if (F.n[1]) { ax = c[0] ? 1 : -1; bz = c[2] ? 1 : -1; } else { ax = c[0] ? 1 : -1; by = c[1] ? 1 : -1; }
      const a = ax + az * PW + ay * PA, b = bx + bz * PW + by * PA;
      AOO[f * 12 + k * 3] = a; AOO[f * 12 + k * 3 + 1] = b; AOO[f * 12 + k * 3 + 2] = a + b;
    }
  }
  let maxY = Math.min(CH, opts.h || CH) - 1; // only layers below opts.h were filled
  findTop: for (; maxY > 0; maxY--) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) if (B[pidx(x, maxY, z)]) break findTop;
  const QU = new Uint16Array(8);
  // emits a quad; uvs given as [u0,v0,u1,v1] px within tile, rot 0..3
  const D6F = [3, 2, 5, 4, 1, 0]; // DIR6 index -> face index
  const isRS = b => b === 120 || b === 121 || b === 122 || b === 125 || b === 126 || b === 127 || b === 128 || b === 104;
  function quad(buf, flipArr, cs, tile, u0, v0, u1, v1, rot, lights, sh, flip) {
    const tu = (tile % TPR) * 16, tv = ((tile / TPR) | 0) * 16;
    QU[0] = tu + u0; QU[1] = tv + v1; QU[2] = tu + u1; QU[3] = tv + v1; QU[4] = tu + u1; QU[5] = tv + v0; QU[6] = tu + u0; QU[7] = tv + v0;
    if (buf.n * 3 + 12 >= buf.pos.length) buf.grow();
    const P = buf.pos, U = buf.uv, Lt = buf.lt, Co = buf.col;
    for (let k = 0; k < 4; k++) {
      const q = (k + rot) & 3, c = cs[k], l = lights[k], n = buf.n++;
      P[n * 3] = Math.round((c[0] + 1) * 16); P[n * 3 + 1] = Math.round(c[1] * 16); P[n * 3 + 2] = Math.round((c[2] + 1) * 16); // +1 bias keeps offsets positive
      U[n * 2] = QU[q * 2]; U[n * 2 + 1] = QU[q * 2 + 1];
      Lt[n * 4] = l[0]; Lt[n * 4 + 1] = l[1]; Lt[n * 4 + 2] = sh[k] >= 1 ? 255 : sh[k] * 255; Lt[n * 4 + 3] = 255;
      Co[n * 4] = cr; Co[n * 4 + 1] = cg; Co[n * 4 + 2] = cb; Co[n * 4 + 3] = 255;
    }
    flipArr.push(flip ? 1 : 0);
  }
  const L4 = [[0, 0], [0, 0], [0, 0], [0, 0]], SH4 = [1, 1, 1, 1], CS = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  function flatLight(x, y, z) { const l = lightAt(x, y, z); const s = (l >> 4) * 17, b = (l & 15) * 17; for (let k = 0; k < 4; k++) { L4[k][0] = s; L4[k][1] = b; } }
  function cubeTile(id, meta, f, x, y, z) {
    const base = id * 4;
    let slot = f === 2 ? 1 : f === 3 ? 2 : 0;
    if (FACING[id] && f === DIR_FACE[meta & 3]) slot = 3;
    else if (id === 41 && (f === 4 || f === 5)) slot = 3;
    if (LOGAX[id] && meta) { const ax = meta; if (ax === 1) slot = (f === 0 || f === 1) ? 1 : 0; else slot = (f === 4 || f === 5) ? 1 : 0; }
    let t = FT[base + slot];
    if (id === 2 && slot === 0) { const a = blk(x, y + 1, z); if (a === 51 || a === 50) t = T.grass_side_snowed; }
    if (!fancy && RTYPE[id] === RT.CUTOUT && (id >= 22 && id <= 24)) t = T[BLOCKS[id].key + '_o'];
    return t;
  }
  function logRot(id, meta, f) { if (!LOGAX[id] || !meta) return 0; if (meta === 1) return (f === 2 || f === 3 || f === 4 || f === 5) ? 1 : 0; return (f === 0 || f === 1 || f === 2 || f === 3) ? 1 : 0; }
  for (let y = 0; y <= maxY; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const pi = pidx(x, y, z), id = B[pi]; if (!id) continue;
    const rt = RTYPE[id], meta = M[pi];
    setTint(TINT[id], x, z, meta);
    if (rt === RT.CUBE || rt === RT.CUTOUT || rt === RT.TRANS) {
      const trans = rt === RT.TRANS, cut = rt === RT.CUTOUT && !(id >= 22 && id <= 24 && !fancy);
      const buf = trans ? Tr : cut ? Cu : O, fl = trans ? tFlip : cut ? cFlip : oFlip;
      const leaves = rt === RT.CUTOUT && id >= 22 && id <= 24;
      for (let f = 0; f < 6; f++) {
        const ni = pi + NOFF[f], nb = B[ni];
        if (OPQ[nb]) continue;
        const F = FACES[f];
        if (nb === id && (SELFCULL[id] || (leaves && !fancy))) continue;
        if (trans && nb && RTYPE[nb] === RT.CUBE) continue;
        const tile = cubeTile(id, meta, f, x, y, z);
        let flip = false;
        if (smoothL) {
          const l0 = L[ni];
          for (let k = 0; k < 4; k++) {
            const ao3 = f * 12 + k * 3, i1 = ni + AOO[ao3], i2 = ni + AOO[ao3 + 1], i3 = ni + AOO[ao3 + 2];
            const o1 = OPQ[B[i1]], o2 = OPQ[B[i2]], o3 = OPQ[B[i3]];
            const ao = o1 && o2 ? 0 : 3 - o1 - o2 - o3;
            let ls = l0 >> 4, lb = l0 & 15, n = 1, l;
            if (!o1) { l = L[i1]; ls += l >> 4; lb += l & 15; n++; }
            if (!o2) { l = L[i2]; ls += l >> 4; lb += l & 15; n++; }
            if (!o3 && !(o1 && o2)) { l = L[i3]; ls += l >> 4; lb += l & 15; n++; }
            L4[k][0] = ls / n * 17; L4[k][1] = lb / n * 17; SH4[k] = F.s * AO_CURVE[ao];
          }
          const a0 = SH4[0] * (L4[0][0] + L4[0][1] + 8), a2 = SH4[2] * (L4[2][0] + L4[2][1] + 8), a1 = SH4[1] * (L4[1][0] + L4[1][1] + 8), a3 = SH4[3] * (L4[3][0] + L4[3][1] + 8);
          flip = a0 + a2 < a1 + a3;
        } else { const l = L[ni], ss = (l >> 4) * 17, bb = (l & 15) * 17; for (let k = 0; k < 4; k++) { L4[k][0] = ss; L4[k][1] = bb; SH4[k] = F.s; } }
        for (let k = 0; k < 4; k++) { const c = F.c[k]; CS[k][0] = x + c[0]; CS[k][1] = y + c[1]; CS[k][2] = z + c[2]; }
        let rot = logRot(id, meta, f);
        quad(buf, fl, CS, tile, 0, 0, 16, 16, rot, L4, SH4, flip);
      }
    } else if (rt === RT.CROSS || rt === RT.CROP) {
      const tile = id === 58 ? T['wheat' + Math.min(7, meta)] : id === 161 ? T['nether_wart' + (meta >= 3 ? 2 : meta >= 1 ? 1 : 0)] : FT[id * 4];
      flatLight(x, y, z);
      const sh = SH4; sh[0] = sh[1] = sh[2] = sh[3] = 1;
      const planes = rt === RT.CROSS
        ? [[[0.15, 0.15], [0.85, 0.85]], [[0.15, 0.85], [0.85, 0.15]]]
        : [[[0.25, 0], [0.25, 1]], [[0.75, 1], [0.75, 0]], [[0, 0.75], [1, 0.75]], [[1, 0.25], [0, 0.25]]];
      const yo = id === 58 ? -1 / 16 : 0;
      let ox = 0, oz = 0;
      if (id === 29 || id === 30 || (id >= 31 && id <= 34)) { const hh = ((x * 3129871) ^ (z * 116129781) ^ y) >>> 0; ox = ((hh & 15) / 15 - 0.5) * 0.4; oz = (((hh >> 4) & 15) / 15 - 0.5) * 0.4; }
      const vflip = id === 86 && !(meta & 1);
      for (const [a, b] of planes) {
        const p0 = [x + a[0] + ox, y + yo, z + a[1] + oz], p1 = [x + b[0] + ox, y + yo, z + b[1] + oz];
        const cs = [[p0[0], p0[1], p0[2]], [p1[0], p1[1], p1[2]], [p1[0], p1[1] + 1, p1[2]], [p0[0], p0[1] + 1, p0[2]]];
        const cb2 = [cs[1], cs[0], cs[3], cs[2]];
        quad(Cu, cFlip, cs, tile, 0, vflip ? 16 : 0, 16, vflip ? 0 : 16, 0, L4, sh, false);
        quad(Cu, cFlip, cb2, tile, 0, vflip ? 16 : 0, 16, vflip ? 0 : 16, 0, L4, sh, false);
      }
    } else if (rt === RT.TORCH) {
      flatLight(x, y, z); SH4[0] = SH4[1] = SH4[2] = SH4[3] = 1;
      let ox = 0, oy = 0, oz = 0;
      if (meta >= 1 && meta <= 4) { const d = DIRS[meta - 1]; ox = d[0] * 5 / 16; oz = d[2] * 5 / 16; oy = 3 / 16; }
      const bx0 = 7 / 16 + ox, bx1 = 9 / 16 + ox, bz0 = 7 / 16 + oz, bz1 = 9 / 16 + oz, by1 = 10 / 16;
      const tile = FT[id * 4];
      for (let f = 0; f < 6; f++) {
        if (f === 3 && meta) continue;
        const F = FACES[f];
        for (let k = 0; k < 4; k++) { const c = F.c[k]; CS[k][0] = x + (c[0] ? bx1 : bx0); CS[k][1] = y + oy + (c[1] ? by1 : 0); CS[k][2] = z + (c[2] ? bz1 : bz0); }
        if (f === 2) quad(Cu, cFlip, CS, tile, 7, 6, 9, 8, 0, L4, SH4, false);
        else if (f === 3) quad(Cu, cFlip, CS, tile, 7, 14, 9, 16, 0, L4, SH4, false);
        else quad(Cu, cFlip, CS, tile, 7, 6, 9, 16, 0, L4, SH4, false);
      }
    } else if (rt === RT.BOX) {
      const boxes = shapes(id, meta);
      boxFaces(id, meta, x, y, z, boxes, Cu, cFlip);
    } else if (rt === RT.TBOX) {
      setTint(0); boxFaces(id, meta, x, y, z, shapes(id, meta), Tr, tFlip);
    } else if (rt === RT.WIRE) {
      wire(x, y, z, meta);
    } else if (rt === RT.FLUID) {
      fluid(id, meta, x, y, z);
    }
  }
  // texture rotation so that a face's texture "up" points along direction d
  function rotFor(f, d) {
    const c = FACES[f].c, U = [c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]], Rt = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]];
    const du = U[0] * d[0] + U[1] * d[1] + U[2] * d[2], dr = Rt[0] * d[0] + Rt[1] * d[1] + Rt[2] * d[2];
    return du > 0.5 ? 0 : dr > 0.5 ? 1 : du < -0.5 ? 2 : dr < -0.5 ? 3 : 0;
  }
  // redstone dust: flat lines toward connections, climbing up blocks, coloured by power
  function wire(x, y, z, meta) {
    const conn = [0, 0, 0, 0], up = [0, 0, 0, 0], above = OPQ[blk(x, y + 1, z)];
    DIRS.forEach(([dx, , dz], d) => {
      const n = blk(x + dx, y, z + dz);
      if (isRS(n) && (n !== 128 || (((M[pidx(x + dx, y, z + dz)] & 3) & 1) === (d & 1)))) conn[d] = 1;
      else if (!OPQ[n] && blk(x + dx, y - 1, z + dz) === 120) conn[d] = 1;
      else if (!above && blk(x + dx, y + 1, z + dz) === 120) { conn[d] = 1; up[d] = 1; }
    });
    flatLight(x, y, z); SH4[0] = SH4[1] = SH4[2] = SH4[3] = 1;
    const yy = y + 1 / 16, F = FACES[2];
    const flat = (tile, x0, z0, x1, z1, u0, v0, u1, v1, rot) => { for (let k = 0; k < 4; k++) { const c = F.c[k]; CS[k][0] = x + (c[0] ? x1 : x0) / 16; CS[k][1] = yy; CS[k][2] = z + (c[2] ? z1 : z0) / 16; } quad(Cu, cFlip, CS, tile, u0, v0, u1, v1, rot, L4, SH4, false); };
    const ns = conn[0] || conn[2], ew = conn[1] || conn[3];
    if (!ns && !ew) flat(T.redstone_dust_dot, 0, 0, 16, 16, 0, 0, 16, 16, 0);
    else if (ns && !ew) flat(T.redstone_dust_line0, 0, 0, 16, 16, 0, 0, 16, 16, 0);
    else if (ew && !ns) flat(T.redstone_dust_line1, 0, 0, 16, 16, 0, 0, 16, 16, 0);
    else {
      flat(T.redstone_dust_dot, 4, 4, 12, 12, 4, 4, 12, 12, 0);
      if (conn[0]) flat(T.redstone_dust_line0, 0, 0, 16, 5, 0, 0, 16, 5, 0); if (conn[2]) flat(T.redstone_dust_line0, 0, 11, 16, 16, 0, 11, 16, 16, 0);
      if (conn[3]) flat(T.redstone_dust_line1, 0, 0, 5, 16, 0, 0, 5, 16, 0); if (conn[1]) flat(T.redstone_dust_line1, 11, 0, 16, 16, 11, 0, 16, 16, 0);
    }
    DIRS.forEach(([dx, , dz], d) => { // vertical strip on the side of the block the dust climbs
      if (!up[d]) return;
      const Fv = FACES[[4, 1, 5, 0][d]], off = 1 / 16; // the neighbour's face that looks back toward this cell
      for (let k = 0; k < 4; k++) { const c = Fv.c[k]; CS[k][0] = x + dx + c[0]; CS[k][1] = y + c[1]; CS[k][2] = z + dz + c[2]; if (dx) CS[k][0] = x + (dx > 0 ? 1 - off : off); if (dz) CS[k][2] = z + (dz > 0 ? 1 - off : off); }
      quad(Cu, cFlip, CS, T.redstone_dust_line0, 0, 0, 16, 16, 0, L4, SH4, false);
    });
  }
  function boxFaces(id, meta, x, y, z, boxes, OUT, OFL) {
    for (let bi = 0; bi < boxes.length; bi++) {
      const bx = boxes[bi];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const atEdge = (F.n[0] > 0 && bx[3] === 16) || (F.n[0] < 0 && bx[0] === 0) || (F.n[1] > 0 && bx[4] === 16) || (F.n[1] < 0 && bx[1] === 0) || (F.n[2] > 0 && bx[5] === 16) || (F.n[2] < 0 && bx[2] === 0);
        const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
        if (atEdge && OPQ[blk(nx, ny, nz)]) continue;
        if (atEdge && (id === 156 || id === 117 || id === 173) && blk(nx, ny, nz) === id) continue;
        if (atEdge && id === 51 && F.n[1] === 0 && blk(nx, ny, nz) === 51 && M[pidx(nx, ny, nz)] >= meta) continue;
        if (atEdge && F.n[1] === 0 && (id >= 109 && id <= 111) && blk(nx, ny, nz) === id && (M[pidx(nx, ny, nz)] & 1) === (meta & 1)) continue;
        if (atEdge) flatLight(nx, ny, nz); else flatLight(x, y, z);
        if (atEdge && id !== 51 && id !== 57 && !(id >= 109 && id <= 111)) { const own = lightAt(x, y, z), nl = lightAt(nx, ny, nz); if (((own >> 4) + (own & 15)) > ((nl >> 4) + (nl & 15))) flatLight(x, y, z); }
        SH4[0] = SH4[1] = SH4[2] = SH4[3] = F.s;
        for (let k = 0; k < 4; k++) { const c = F.c[k]; CS[k][0] = x + (c[0] ? bx[3] : bx[0]) / 16; CS[k][1] = y + (c[1] ? bx[4] : bx[1]) / 16; CS[k][2] = z + (c[2] ? bx[5] : bx[2]) / 16; }
        let u0, u1, v0, v1;
        if (F.n[0] > 0) { u0 = 16 - bx[5]; u1 = 16 - bx[2]; } else if (F.n[0] < 0) { u0 = bx[2]; u1 = bx[5]; }
        else if (F.n[2] > 0) { u0 = bx[0]; u1 = bx[3]; } else { u0 = 16 - bx[3]; u1 = 16 - bx[0]; }
        if (F.n[1] > 0) { u0 = bx[0]; u1 = bx[3]; v0 = bx[2]; v1 = bx[5]; }
        else if (F.n[1] < 0) { u0 = bx[0]; u1 = bx[3]; v0 = 16 - bx[5]; v1 = 16 - bx[2]; }
        else { v0 = 16 - bx[4]; v1 = 16 - bx[1]; }
        let tile = FT[id * 4 + (f === 2 ? 1 : f === 3 ? 2 : 0)], rot = 0;
        if (FACING[id] && f === DIR_FACE[meta & 3]) tile = FT[id * 4 + 3];
        if (id === 95) { // bed
          const fac = meta & 3, head = meta & 4;
          if (f === 2) { tile = head ? T.bed_head : T.bed_foot; rot = [2, 3, 0, 1][fac]; u0 = 0; u1 = 16; v0 = 0; v1 = 16; }
          else if (f === 3) { tile = T.oak_planks; }
          else if (bi > 0) tile = T.oak_planks;
          else { tile = T.bed_side; v0 = 3; v1 = 9; }
        } else if (id === 96) { tile = meta & 8 ? T.oak_door_top : T.oak_door_bottom; if (F.n[1]) { u0 = 0; u1 = 3; v0 = 0; v1 = 16; tile = T.oak_planks; } else if ((bx[3] - bx[0]) < 16 && F.n[0] === 0) { u0 = 0; u1 = 3; } else if ((bx[5] - bx[2]) < 16 && F.n[2] === 0) { u0 = 0; u1 = 3; } else { u0 = 0; u1 = 16; } }
        else if (id === 97) { u0 = 0; u1 = 16; v0 = 0; v1 = 16; }
        else if (id === 99) { // lantern pixels
          if (bi === 0) { if (F.n[1]) { u0 = 0; u1 = 6; v0 = 9; v1 = 15; } else { u0 = 0; u1 = 6; v0 = 2; v1 = 9; } }
          else if (bi === 1) { u0 = 1; u1 = 5; v0 = F.n[1] ? 10 : 0; v1 = F.n[1] ? 14 : 2; }
          else { u0 = 11; u1 = 13; v0 = 1; v1 = 7; }
        } else if (id === 37 && F.n[1] === 0) { u0 = 0; u1 = 16; }
        else if (id === 44 && F.n[1] === 0 && f !== DIR_FACE[meta & 3]) tile = T.chest_side;
        else if (id === 125 && bi === 1) { tile = T.lever; u0 = 7; u1 = 9; if (F.n[1]) { v0 = 6; v1 = 8; } else { v0 = 6; v1 = 16; } }
        else if (id === 128) {
          if (bi === 0 && f === 2) { tile = meta & 16 ? T.repeater_on : T.repeater; rot = rotFor(2, DIRS[(meta & 3) ^ 2]); }
          else if (bi > 0) { tile = meta & 16 ? T.redstone_torch : T.redstone_torch_off; u0 = 7; u1 = 9; if (F.n[1]) { v0 = 6; v1 = 8; } else { v0 = 6; v1 = 11; } }
        } else if (id === 129 || id === 130) {
          const fd = meta & 7, front = D6F[fd], back = D6F[fd ^ 1];
          if (f === front) tile = meta & 8 ? T.piston_inner : FT[id * 4 + 1];
          else if (f === back) tile = T.piston_bottom;
          else { tile = T.piston_side; rot = rotFor(f, DIR6[fd]); }
        } else if (id === 131) {
          const fd = meta & 7, front = D6F[fd];
          if (bi === 0) { if (f === front) tile = meta & 8 ? T.piston_top_sticky : T.piston_top; else if (f === D6F[fd ^ 1]) tile = T.piston_top; else { tile = T.piston_side; rot = rotFor(f, DIR6[fd]); } }
          else { tile = T.piston_side; rot = rotFor(f, DIR6[fd]) ^ 1; u0 = 0; u1 = 16; v0 = 6; v1 = 10; }
        } else if (id === 132) { tile = bi === 3 && f === 2 ? T.anvil_top : T.anvil; if (bi === 3 && f === 2) rot = rotFor(2, DIRS[meta & 3]); }
        else if (id === 167 && bi === 1) { tile = T.end_portal_frame_eye; }
        if (id === 57 && f === 2 && (meta & 7) > 0) tile = T.farmland_wet;
        if (id === 51 || id === 57) setTint(0);
        quad(OUT, OFL, CS, tile, u0, v0, u1, v1, rot, L4, SH4, false);
      }
    }
  }
  function fh(x, y, z, id) { // fluid surface height of cell (or -1 if not this fluid)
    const b = blk(x, y, z); if (b !== id) return -1;
    if (blk(x, y + 1, z) === id) return 1;
    const m = M[pidx(x, y, z)]; if (m & 8) return 0.9; return m === 0 ? 0.89 : (8 - m) / 9;
  }
  function corner(x, y, z, id, dx, dz) {
    let s = 0, n = 0;
    for (const [ax, az] of [[0, 0], [dx, 0], [0, dz], [dx, dz]]) {
      const cx2 = x + ax, cz2 = z + az;
      if (blk(cx2, y + 1, cz2) === id) return 1;
      const h = fh(cx2, y, cz2, id);
      if (h >= 0) { s += h; n++; } else if (!SOLID[blk(cx2, y, cz2)]) { n++; }
    }
    return n ? s / n : 0.89;
  }
  function fluid(id, meta, x, y, z) {
    const water = id === 27, buf = water ? Tr : O, fl = water ? tFlip : oFlip, tile = FT[id * 4];
    const top = blk(x, y + 1, z) === id;
    const h00 = top ? 1 : corner(x, y, z, id, -1, -1), h10 = top ? 1 : corner(x, y, z, id, 1, -1), h11 = top ? 1 : corner(x, y, z, id, 1, 1), h01 = top ? 1 : corner(x, y, z, id, -1, 1);
    const HH = (cx, cz) => cx ? (cz ? h11 : h10) : (cz ? h01 : h00);
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2], nb = blk(nx, ny, nz);
      if (nb === id) continue;
      if (f !== 2 && OPQ[nb]) continue;
      if (f === 2 && top) continue;
      if (water && nb === 52 && f !== 2) continue;
      flatLight(nx, ny, nz);
      const ownL = lightAt(x, y, z); if (f === 2 || ((ownL >> 4) > (lightAt(nx, ny, nz) >> 4))) { const s = (ownL >> 4) * 17, b = (ownL & 15) * 17; for (let k = 0; k < 4; k++) { L4[k][0] = Math.max(L4[k][0], s); L4[k][1] = Math.max(L4[k][1], b); } }
      SH4[0] = SH4[1] = SH4[2] = SH4[3] = F.s;
      for (let k = 0; k < 4; k++) { const c = F.c[k]; CS[k][0] = x + c[0]; CS[k][2] = z + c[2]; CS[k][1] = y + (c[1] ? HH(c[0], c[2]) : 0); }
      quad(buf, fl, CS, tile, 0, 0, 16, 16, 0, L4, SH4, false);
      if (water && f === 2) { const tmp = [CS[1], CS[0], CS[3], CS[2]]; quad(buf, fl, tmp, tile, 0, 0, 16, 16, 0, L4, SH4, false); }
    }
  }
  return { o: O.out(oFlip), c: Cu.out(cFlip), t: Tr.out(tFlip) };
}

return { CW, CH, SEA, CVOL, ATL, TPR, RT, TOOL, TILES, T, BLOCKS, BID, RTYPE, OPQ, LOP, LEM, SOLID, TINT, FLUID, REPL, FACING, LOGAX, FT, BIOMES, BIO, DIRS, DIR6,
  shapes, collide, hash32, rng, makeNoise, makeGen, genChunk, growTree, lightChunk, meshChunk, pidx, PW, PA, PH };
};

function workerMain(S) {
  self.onmessage = e => {
    const m = e.data;
    if (m.type === 'gen') {
      const r = S.genChunk(m.seed, m.cx, m.cz);
      self.postMessage({ type: 'gen', id: m.id, cx: m.cx, cz: m.cz, blocks: r.blocks, meta: r.meta, light: r.light, biome: r.biome, tiles: r.tiles }, [r.blocks.buffer, r.meta.buffer, r.light.buffer, r.biome.buffer]);
    } else if (m.type === 'mesh') {
      const r = S.meshChunk(m.B, m.M, m.L, m.bio, m.opts);
      const tr = [m.B.buffer, m.M.buffer, m.L.buffer];
      for (const k of ['o', 'c', 't']) tr.push(r[k].pos.buffer, r[k].uv.buffer, r[k].lt.buffer, r[k].col.buffer, r[k].idx.buffer);
      self.postMessage({ type: 'mesh', id: m.id, cx: m.cx, cz: m.cz, ver: m.ver, o: r.o, c: r.c, t: r.t, B: m.B, M: m.M, L: m.L }, tr);
    }
  };
}

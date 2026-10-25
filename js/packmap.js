// Which resource-pack textures the game uses and how they become its tiles, item sprites and entity skins.
// Shared by tools/pack.js (Node: builds js/pack.js from Pixel Perfection CE) and js/userpack.js (browser: converts
// a resource pack or client.jar the player picks, on their own device).
const PACKMAP = (() => { // own scope: the game has globals of the same names (ENT, ITEM...)
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
  brown_mushroom: 'brown_mushroom', red_mushroom: 'red_mushroom', spawner: 'spawner', hay_side: 'hay_block_side', hay_top: 'hay_block_top', melon_stem: 'melon_stem', pumpkin_stem: 'pumpkin_stem', attached_melon_stem: 'attached_melon_stem', attached_pumpkin_stem: 'attached_pumpkin_stem',
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
// expansion tiles share the pack's names
for (const t of 'jungle_log jungle_log_top jungle_planks jungle_leaves jungle_sapling acacia_log acacia_log_top acacia_planks acacia_leaves acacia_sapling dark_oak_log dark_oak_log_top dark_oak_planks dark_oak_leaves dark_oak_sapling stripped_oak_log stripped_oak_log_top stripped_spruce_log stripped_spruce_log_top stripped_birch_log stripped_birch_log_top stripped_jungle_log stripped_jungle_log_top stripped_acacia_log stripped_acacia_log_top stripped_dark_oak_log stripped_dark_oak_log_top terracotta allium azure_bluet red_tulip orange_tulip white_tulip pink_tulip lily_of_the_valley blue_orchid wither_rose red_sand red_sandstone red_sandstone_top red_sandstone_bottom podzol_side podzol_top mycelium_side mycelium_top coarse_dirt packed_ice blue_ice bone_block_side bone_block_top prismarine sea_lantern sponge wet_sponge purpur_block purpur_pillar purpur_pillar_top end_rod chorus_plant chorus_flower brown_mushroom_block red_mushroom_block mushroom_stem lily_pad vine observer_side observer_top observer_front hopper_outside hopper_top comparator dispenser_front dropper_front daylight_detector_side daylight_detector_top target_side target_top note_block iron_door_bottom iron_door_top oak_trapdoor composter_side composter_top composter_bottom barrel_side barrel_top barrel_bottom blast_furnace_side blast_furnace_top blast_furnace_front smoker_side smoker_top smoker_bottom smoker_front cartography_table_side1 cartography_table_top cartography_table_side3 fletching_table_side fletching_table_top fletching_table_front loom_side loom_top loom_bottom loom_front stonecutter_side stonecutter_top stonecutter_bottom grindstone_side grindstone_round lectern_sides lectern_top lectern_front soul_torch soul_lantern soul_fire chain gilded_blackstone lodestone_side lodestone_top nether_sprouts carrots_stage0 orange_wool magenta_wool light_blue_wool yellow_wool lime_wool pink_wool gray_wool light_gray_wool cyan_wool purple_wool blue_wool brown_wool green_wool red_wool black_wool white_concrete orange_concrete magenta_concrete light_blue_concrete yellow_concrete lime_concrete pink_concrete gray_concrete light_gray_concrete cyan_concrete purple_concrete blue_concrete brown_concrete green_concrete red_concrete black_concrete white_concrete_powder orange_concrete_powder magenta_concrete_powder light_blue_concrete_powder yellow_concrete_powder lime_concrete_powder pink_concrete_powder gray_concrete_powder light_gray_concrete_powder cyan_concrete_powder purple_concrete_powder blue_concrete_powder brown_concrete_powder green_concrete_powder red_concrete_powder black_concrete_powder white_terracotta orange_terracotta magenta_terracotta light_blue_terracotta yellow_terracotta lime_terracotta pink_terracotta gray_terracotta light_gray_terracotta cyan_terracotta purple_terracotta blue_terracotta brown_terracotta green_terracotta red_terracotta black_terracotta white_stained_glass orange_stained_glass magenta_stained_glass light_blue_stained_glass yellow_stained_glass lime_stained_glass pink_stained_glass gray_stained_glass light_gray_stained_glass cyan_stained_glass purple_stained_glass blue_stained_glass brown_stained_glass green_stained_glass red_stained_glass black_stained_glass polished_granite polished_diorite polished_andesite chiseled_stone_bricks cut_sandstone chiseled_sandstone quartz_bricks chiseled_quartz_block red_nether_bricks chiseled_nether_bricks cracked_nether_bricks prismarine_bricks dark_prismarine polished_blackstone polished_blackstone_bricks cut_red_sandstone observer_back observer_back_on dispenser_front_vertical dropper_front_vertical blast_furnace_front_on smoker_front_on composter_compost composter_ready comparator_on carrots_stage1 carrots_stage2 carrots_stage3 potatoes_stage0 potatoes_stage1 potatoes_stage2 potatoes_stage3 beetroots_stage0 beetroots_stage1 beetroots_stage2 beetroots_stage3'.split(' ')) TILE[t] = t;
TILE.soul_fire = 'soul_fire_0';
for (let i = 0; i < 8; i++) TILE['wheat' + i] = 'wheat_stage' + i;
// newer tiles the full pack has under the same names (first animation frame where animated)
for (const t of ('cauldron_side cauldron_top cauldron_inner cauldron_bottom brewing_stand brewing_stand_base beacon campfire_log campfire_log_lit soul_campfire_log_lit jukebox_side jukebox_top ' +
  'rail rail_corner powered_rail powered_rail_on detector_rail detector_rail_on activator_rail activator_rail_on turtle_egg bee_nest_side bee_nest_top bee_nest_bottom bee_nest_front ' +
  'bee_nest_front_honey beehive_side beehive_end beehive_front beehive_front_honey honey_block_side honey_block_top honeycomb_block sweet_berry_bush_stage0 sweet_berry_bush_stage1 ' +
  'sweet_berry_bush_stage2 sweet_berry_bush_stage3 kelp kelp_plant seagrass tall_seagrass_bottom tall_seagrass_top sea_pickle conduit dried_kelp_side dried_kelp_top flower_pot tripwire ' +
  'tripwire_hook bamboo_stalk bamboo_small_leaves sunflower_bottom sunflower_top lilac_bottom lilac_top rose_bush_bottom rose_bush_top peony_bottom peony_top weeping_vines weeping_vines_plant ' +
  'twisting_vines twisting_vines_plant cake_top cake_side cake_bottom cake_inner respawn_anchor_top respawn_anchor_top_off respawn_anchor_bottom scaffolding_side scaffolding_top scaffolding_bottom').split(' ')) TILE[t] = t;
// doors, trapdoors and the other blocks with a texture of the same name
for (const t of ['spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'crimson', 'warped'].flatMap(w => [w + '_door_bottom', w + '_door_top', w + '_trapdoor']).concat(['iron_trapdoor', 'chipped_anvil_top', 'damaged_anvil_top',
  'quartz_pillar', 'quartz_pillar_top', 'polished_basalt_side', 'polished_basalt_top', 'stripped_crimson_stem', 'stripped_crimson_stem_top', 'stripped_warped_stem', 'stripped_warped_stem_top', 'deepslate_emerald_ore',
  'tall_grass_bottom', 'tall_grass_top', 'large_fern_bottom', 'large_fern_top', 'deepslate_bricks', 'deepslate_tiles', 'polished_deepslate', 'chiseled_deepslate', 'cracked_deepslate_bricks', 'cracked_deepslate_tiles',
  'chiseled_polished_blackstone', 'cracked_polished_blackstone_bricks', 'chiseled_red_sandstone', 'quartz_block_bottom'])) TILE[t] = t;
for (const c of ['tube', 'brain', 'bubble', 'fire', 'horn']) for (const d of ['', 'dead_']) for (const k of ['_coral', '_coral_fan', '_coral_block']) TILE[d + c + k] = d + c + k;
for (const c of ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']) TILE[c + '_glazed_terracotta'] = c + '_glazed_terracotta';
Object.assign(TILE, { carved_pumpkin_face: 'carved_pumpkin', frosted_ice: 'frosted_ice_0', respawn_anchor_side: 'respawn_anchor_side0', bamboo_leaves: 'bamboo_large_leaves' });
const ANIM = { water: 'water_still', lava: 'lava_still', nether_portal: 'nether_portal', fire: 'fire_0', magma: 'magma' };
const TINTED = new Set(['grass_top', 'short_grass', 'fern', 'tall_grass_bottom', 'tall_grass_top', 'large_fern_bottom', 'large_fern_top', 'sugar_cane', 'oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves', 'lily_pad', 'vine', 'redstone_dust_dot', 'redstone_dust_line0', 'redstone_dust_line1', 'melon_stem', 'pumpkin_stem', 'attached_melon_stem', 'attached_pumpkin_stem']);
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
for (const k of ('white_dye orange_dye magenta_dye light_blue_dye yellow_dye lime_dye pink_dye gray_dye light_gray_dye cyan_dye purple_dye blue_dye brown_dye green_dye red_dye black_dye ' +
  'cookie pumpkin_pie carrot potato baked_potato poisonous_potato beetroot beetroot_seeds beetroot_soup golden_carrot cod cooked_cod salmon cooked_salmon dried_kelp ' +
  'chainmail_helmet chainmail_chestplate chainmail_leggings chainmail_boots totem_of_undying experience_bottle spider_eye prismarine_shard prismarine_crystals shulker_shell ' +
  'chorus_fruit popped_chorus_fruit elytra fishing_rod fishing_rod_cast cocoa_beans enchanted_book spruce_boat birch_boat jungle_boat acacia_boat dark_oak_boat ' +
  'chain soul_lantern nether_sprouts hopper comparator glass_bottle honey_bottle sweet_berries melon_seeds pumpkin_seeds rabbit_hide lead nether_star').split(' ')) ITEM[k] = 'item/' + k;
ITEM.clock = 'item/clock_00'; ITEM.compass = 'item/compass_16';
for (const k of ('honeycomb tropical_fish tropical_fish_bucket fermented_spider_eye glistering_melon_slice dragon_breath rabbit_foot pufferfish painting armor_stand ' +
  'music_disc_13 music_disc_cat music_disc_blocks music_disc_chirp music_disc_far music_disc_mall music_disc_mellohi music_disc_stal music_disc_strad music_disc_ward music_disc_11 music_disc_wait music_disc_pigstep ' +
  'trident rabbit cooked_rabbit rabbit_stew leather_horse_armor iron_horse_armor golden_horse_armor diamond_horse_armor phantom_membrane scute turtle_helmet heart_of_the_sea nautilus_shell map filled_map ' +
  'minecart chest_minecart hopper_minecart tnt_minecart furnace_minecart writable_book written_book firework_rocket firework_star carrot_on_a_stick warped_fungus_on_a_stick suspicious_stew item_frame ' +
  'oak_sign spruce_sign birch_sign jungle_sign acacia_sign dark_oak_sign crimson_sign warped_sign kelp seagrass bamboo sea_pickle cake campfire soul_campfire bell flower_pot ' +
  'pufferfish_bucket cod_bucket salmon_bucket').split(' ')) ITEM[k] = 'item/' + k;
Object.assign(ITEM, { crossbow: 'item/crossbow_standby', tripwire_hook: 'block/tripwire_hook', rail: 'block/rail', powered_rail: 'block/powered_rail', detector_rail: 'block/detector_rail', activator_rail: 'block/activator_rail',
  // potion bottles and tipped arrows are tinted by the game with each potion's colour (base + overlay)
  _potion: 'item/potion', _splash_potion: 'item/splash_potion', _lingering_potion: 'item/lingering_potion', _potion_overlay: 'item/potion_overlay', _arrow_base: 'item/tipped_arrow_base', _arrow_head: 'item/tipped_arrow_head', glass_bottle: 'item/glass_bottle' });
for (const k of ['jungle_sapling', 'acacia_sapling', 'dark_oak_sapling', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_the_valley', 'blue_orchid', 'wither_rose',
  'lily_pad', 'vine', 'soul_torch', 'end_rod', 'oak_trapdoor']) ITEM[k] = 'block/' + k;
const ITEM_TINT = { lily_pad: 0x208030, vine: 0x48b518, leather_helmet: 0xa06540, leather_chestplate: 0xa06540, leather_leggings: 0xa06540, leather_boots: 0xa06540, short_grass: 0x7cbd6b, fern: 0x7cbd6b };
const ENT = {
  zombie: 'entity/zombie/zombie', skeleton: 'entity/skeleton/skeleton', creeper: 'entity/creeper/creeper', spider: 'entity/spider/spider', pig: 'entity/pig/pig',
  cow: 'entity/cow/cow', sheep: 'entity/sheep/sheep', sheep_fur: 'entity/sheep/sheep_fur', chicken: 'entity/chicken', squid: 'entity/squid', steve: 'entity/steve',
  villager: 'entity/villager/villager', iron_golem: 'entity/iron_golem/iron_golem', enderman: 'entity/enderman/enderman', enderman_eyes: 'entity/enderman/enderman_eyes',
  blaze: 'entity/blaze', ghast: 'entity/ghast/ghast', ghast_shooting: 'entity/ghast/ghast_shooting', zombified_piglin: 'entity/piglin/zombified_piglin',
  magma_cube: 'entity/slime/magmacube', slime: 'entity/slime/slime', dragon: 'entity/enderdragon/dragon', dragon_eyes: 'entity/enderdragon/dragon_eyes',
  end_crystal: 'entity/end_crystal/end_crystal', trapped_chest: 'entity/chest/trapped', boat: 'entity/boat/oak', chest: 'entity/chest/normal', bed: 'entity/bed/red', xp_orb: 'entity/experience_orb',
};
Object.assign(ENT, {
  husk: 'entity/zombie/husk', drowned: 'entity/zombie/drowned', drowned_outer: 'entity/zombie/drowned_outer_layer', stray: 'entity/skeleton/stray', stray_overlay: 'entity/skeleton/stray_overlay',
  wither_skeleton: 'entity/skeleton/wither_skeleton', wither_skeleton_e: 'entity/skeleton/wither_skeleton_e', piglin: 'entity/piglin/piglin', hoglin: 'entity/hoglin/hoglin', hoglin_e: 'entity/hoglin/hoglin_e',
  zoglin: 'entity/hoglin/zoglin', zoglin_e: 'entity/hoglin/zoglin_e', strider: 'entity/strider/strider', strider_e: 'entity/strider/strider_e', strider_cold: 'entity/strider/strider_cold',
  shulker: 'entity/shulker/shulker', shulker_e: 'entity/shulker/shulker_e', silverfish: 'entity/silverfish', endermite: 'entity/endermite', endermite_e: 'entity/endermite_e',
  wolf: 'entity/wolf/wolf', wolf_tame: 'entity/wolf/wolf_tame', wolf_angry: 'entity/wolf/wolf_angry', wolf_angry_e: 'entity/wolf/wolf_angry_e', wolf_collar: 'entity/wolf/wolf_collar',
  bat: 'entity/bat', cod: 'entity/fish/cod', salmon: 'entity/fish/salmon', creeper_e: 'entity/creeper/creeper_e', iron_golem_e: 'entity/iron_golem/iron_golem_e',
  ghast_shooting_e: 'entity/ghast/ghast_shooting_e', shulker_bullet: 'entity/shulker/spark',
  ender_chest: 'entity/chest/ender', bell_body: 'entity/bell/bell_body',
  boat_spruce: 'entity/boat/spruce', boat_birch: 'entity/boat/birch', boat_jungle: 'entity/boat/jungle', boat_acacia: 'entity/boat/acacia', boat_dark_oak: 'entity/boat/dark_oak',
});
// OptiFine random entity skins and their emissive layers (optifine/random/entity/...)
for (const f of ['skeleton/skeleton2', 'skeleton/skeleton3', 'skeleton/skeleton4', 'skeleton/stray2', 'skeleton/wither_skeleton2', 'skeleton/wither_skeleton3', 'zombie/zombie12', 'zombie/zombie13',
  'zombie/husk2', 'zombie/husk3', 'zombie/husk4', 'zombie/drowned3', 'zombie/drowned4', 'creeper/creeper2', 'creeper/creeper3', 'cow/cow2'])
  for (const e of ['', '_e']) ENT['r_' + f.split('/')[1] + e] = '../optifine/random/entity/' + f + e;
for (const c of ['', 'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']) ENT['shulker_' + (c || 'plain')] = 'entity/shulker/shulker' + (c ? '_' + c : '');
// the newer mobs (Java model layouts; variants are separate textures)
for (const c of ['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'darkbrown']) ENT['horse_' + c] = 'entity/horse/horse_' + c;
for (const m of ['white', 'whitefield', 'whitedots', 'blackdots']) ENT['horse_markings_' + m] = 'entity/horse/horse_markings_' + m;
for (const k of ['skeleton', 'zombie']) ENT['horse_' + k] = 'entity/horse/horse_' + k;
Object.assign(ENT, { donkey: 'entity/horse/donkey', mule: 'entity/horse/mule' });
for (const a of ['leather', 'iron', 'gold', 'diamond']) ENT['horse_armor_' + a] = 'entity/horse/armor/horse_armor_' + a;
for (const c of ['tabby', 'black', 'red', 'siamese', 'british_shorthair', 'calico', 'persian', 'ragdoll', 'white', 'jellie', 'all_black', 'ocelot']) ENT['cat_' + c] = 'entity/cat/' + c;
for (const c of ['brown', 'white', 'black', 'white_splotched', 'gold', 'salt', 'toast', 'caerbannog']) ENT['rabbit_' + c] = 'entity/rabbit/' + c;
for (const c of ['fox', 'snow_fox', 'fox_sleep', 'snow_fox_sleep']) ENT[c] = 'entity/fox/' + c;
for (const c of ['bee', 'bee_angry', 'bee_nectar', 'bee_angry_nectar']) ENT[c] = 'entity/bee/' + c;
for (const c of ['pillager', 'vindicator', 'evoker', 'illusioner', 'ravager', 'vex', 'vex_charging']) ENT[c] = 'entity/illager/' + c;
for (const c of ['panda', 'lazy_panda', 'worried_panda', 'playful_panda', 'aggressive_panda', 'weak_panda', 'brown_panda']) ENT[c] = 'entity/panda/' + c;
for (const c of ['red_blue', 'blue', 'green', 'yellow_blue', 'grey']) ENT['parrot_' + c] = 'entity/parrot/parrot_' + c;
for (const c of ['creamy', 'white', 'brown', 'gray']) ENT['llama_' + c] = 'entity/llama/' + c;
for (const c of ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black', 'trader_llama']) ENT['llama_decor_' + c] = 'entity/llama/decor/' + c;
for (const c of ['zombie_villager', 'profession/farmer', 'profession/librarian', 'profession/armorer', 'profession/cleric', 'profession/butcher', 'profession/fletcher', 'profession/shepherd', 'profession/mason', 'profession/toolsmith', 'profession/weaponsmith', 'profession/leatherworker', 'profession/cartographer', 'profession/fisherman', 'profession/nitwit']) ENT['zv_' + c.replace('profession/', '')] = 'entity/zombie_villager/' + c;
for (const c of ['tropical_a', 'tropical_b']) { ENT[c] = 'entity/fish/' + c; for (let i = 1; i <= 6; i++) ENT[c + '_pattern_' + i] = 'entity/fish/' + c + '_pattern_' + i; }
Object.assign(ENT, { witch: 'entity/witch', wandering_trader: 'entity/wandering_trader', snow_golem: 'entity/snow_golem', polar_bear: 'entity/bear/polarbear', turtle: 'entity/turtle/big_sea_turtle',
  dolphin: 'entity/dolphin', phantom: 'entity/phantom', phantom_eyes: 'entity/phantom_eyes', cave_spider: 'entity/spider/cave_spider', red_mooshroom: 'entity/cow/red_mooshroom', brown_mooshroom: 'entity/cow/brown_mooshroom',
  guardian: 'entity/guardian', guardian_elder: 'entity/guardian_elder', wither: 'entity/wither/wither', wither_invulnerable: 'entity/wither/wither_invulnerable', pufferfish: 'entity/fish/pufferfish' });
// 1.17 mobs (not in Pixel Perfection CE; a vanilla 1.17 jar or newer pack has them)
Object.assign(ENT, { goat: 'entity/goat/goat', glow_squid: 'entity/squid/glow_squid' });
for (const c of ['lucy', 'wild', 'gold', 'cyan', 'blue']) ENT['axolotl_' + c] = 'entity/axolotl/axolotl_' + c;
for (const t of ['plains', 'desert', 'snow', 'taiga', 'swamp']) ENT['vtype_' + t] = 'entity/villager/type/' + t;
for (const p of ['farmer', 'librarian', 'armorer', 'toolsmith', 'weaponsmith', 'butcher', 'cleric', 'fletcher', 'shepherd', 'mason', 'leatherworker', 'cartographer', 'fisherman', 'nitwit']) ENT['vprof_' + p] = 'entity/villager/profession/' + p;

// tiles not in TILE are looked up under their own name (or these vanilla 1.17 names); files renamed in 1.17
const TILE_117 = { pointed_dripstone: 'pointed_dripstone_down_tip', small_dripleaf: 'small_dripleaf_stem_bottom', sculk_sensor_tendril: 'sculk_sensor_tendril_inactive' };
const ENT_ALT = { 'entity/squid': 'entity/squid/squid' };
const FILE_ALT = { grass_path_top: 'dirt_path_top', grass_path_side: 'dirt_path_side' };
// load(path) -> { w, h, px } | null, for paths like 'block/stone'; extraTiles / extraItems: more names to try as block/<name>, item/<name>
function packBuild(load, extraTiles = [], extraItems = []) {
  for (const t of extraTiles) if (!TILE[t]) TILE[t] = TILE_117[t] || t;
  for (const k of extraItems) if (!ITEM[k]) ITEM[k] = 'item/' + k;
  const loadT = f => load('block/' + f) || (FILE_ALT[f] ? load('block/' + FILE_ALT[f]) : null);
  const chunks = []; let off = 0;
  const put = px => { const o = off; chunks.push(px); off += px.length; return o; };
  const crop16 = img => img.w === 16 && img.h === 16 ? img.px : img.px.slice(0, 16 * 16 * 4); // first animation frame
  const out = { tiles: {}, anim: {}, items: {}, ent: {} };
  for (const [tile, f] of Object.entries(TILE)) {
    const img = loadT(f); if (!img) continue;
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
    const tc = load(ENT.trapped_chest);
    if (tc) {
      const P = tc.px, W = tc.w, tile = () => new Uint8Array(16 * 16 * 4);
      const blit = (dst, sx, sy, w, h, dx, dy) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((sy + y) * W + sx + x) * 4, d = ((dy + y) * 16 + dx + x) * 4; for (let c = 0; c < 4; c++) dst[d + c] = P[s + c]; } };
      const top = tile(); blit(top, 14, 0, 14, 14, 1, 1); out.tiles.trapped_chest_top = put(top);
      const front = tile(); blit(front, 14, 14, 14, 5, 1, 2); blit(front, 14, 34, 14, 9, 1, 7); blit(front, 1, 1, 2, 4, 7, 4); out.tiles.trapped_chest_front = put(front);
      const side = tile(); blit(side, 0, 14, 14, 5, 1, 2); blit(side, 0, 34, 14, 9, 1, 7); out.tiles.trapped_chest_side = put(side);
    }
    const ec = load(ENT.ender_chest);
    if (ec) {
      const P = ec.px, W = ec.w, tile = () => new Uint8Array(16 * 16 * 4);
      const blit = (dst, sx, sy, w, h, dx, dy) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((sy + y) * W + sx + x) * 4, d = ((dy + y) * 16 + dx + x) * 4; for (let c = 0; c < 4; c++) dst[d + c] = P[s + c]; } };
      const top = tile(); blit(top, 14, 0, 14, 14, 1, 1); out.tiles.ender_chest_top = put(top);
      const front = tile(); blit(front, 14, 14, 14, 5, 1, 2); blit(front, 14, 34, 14, 9, 1, 7); blit(front, 1, 1, 2, 4, 7, 4); out.tiles.ender_chest_front = put(front);
      const side = tile(); blit(side, 0, 14, 14, 5, 1, 2); blit(side, 0, 34, 14, 9, 1, 7); out.tiles.ender_chest_side = put(side);
    }
    for (const c of ['plain', 'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']) { // the lid's top face (16x16 at 16,0)
      const sh = load(ENT['shulker_' + c]); if (!sh) continue;
      const t = new Uint8Array(16 * 16 * 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = (y * sh.w + 16 + x) * 4, d = (y * 16 + x) * 4; for (let k = 0; k < 4; k++) t[d + k] = sh.px[s + k]; }
      out.tiles[c === 'plain' ? 'shulker_box' : c + '_shulker_box'] = put(t);
    }
    for (const [tile, f] of [['player_head', 'steve'], ['skeleton_skull', 'skeleton'], ['zombie_head', 'zombie'], ['creeper_head', 'creeper'], ['wither_skull', 'wither_skeleton']]) { // 8x8 head faces doubled to 16x16
      const img = load(ENT[f]); if (!img) continue;
      const face = (sx, sy) => { const t = new Uint8Array(16 * 16 * 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = ((sy + (y >> 1)) * img.w + sx + (x >> 1)) * 4, d = (y * 16 + x) * 4; for (let k = 0; k < 4; k++) t[d + k] = img.px[s + k]; t[d + 3] = 255; } return t; };
      out.tiles[tile + '_front'] = put(face(8, 8)); out.tiles[tile + '_side'] = put(face(0, 8)); if (tile === 'wither_skull') out.tiles.wither_skull_top = put(face(8, 0));
    }
    for (const c of ['red', 'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'black']) {
      const bed = load('entity/bed/' + c); if (!bed) continue;
      const P = bed.px, W = bed.w, sfx = c === 'red' ? '' : '_' + c;
      const rot = (sx, sy) => { const t = new Uint8Array(16 * 16 * 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = ((sy + y) * W + sx + x) * 4, d = (y * 16 + x) * 4; for (let c = 0; c < 4; c++) t[d + c] = P[s + c]; } return t; };
      const side = new Uint8Array(16 * 16 * 4); for (let r = 0; r < 6; r++) for (let x = 0; x < 16; x++) { const s = ((6 + x) * W + r) * 4, d = ((3 + r) * 16 + x) * 4; for (let k = 0; k < 4; k++) side[d + k] = P[s + k]; side[d + 3] = 255; }
      out.tiles['bed_head' + sfx] = put(rot(6, 6)); out.tiles['bed_foot' + sfx] = put(rot(6, 28)); out.tiles['bed_side' + sfx] = put(side);
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
  for (const [k, f] of Object.entries(ENT)) { if (k === 'chest' || k === 'bed') continue; const img = load(f) || (ENT_ALT[f] ? load(ENT_ALT[f]) : null); if (img) out.ent[k] = [put(new Uint8Array(img.px)), img.w, img.h]; }
  { // OptiFine custom night sky (optifine/sky/world0/nightbox.png), box-filtered to 128px faces
    const sk = load('../optifine/sky/world0/nightbox');
    if (sk) { const f = 4, w = sk.w / f, h = sk.h / f, px = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) { let a = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) a += sk.px[((y * f + j) * sk.w + x * f + i) * 4 + c]; px[(y * w + x) * 4 + c] = a / (f * f); } out.sky = [put(px), w, h]; }
  }

  const data = new Uint8Array(off); let p = 0; for (const c of chunks) { data.set(c, p); p += c.length; }
  return { out, data };
}
return { packBuild, TILE, ANIM, ITEM, ENT, TINTED };
})();
if (typeof module !== 'undefined') module.exports = PACKMAP;

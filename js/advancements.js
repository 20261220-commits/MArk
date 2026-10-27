// Advancements: all 91 of Java Edition 1.17 in their five tabs (Minecraft, Nether, The End, Adventure, Husbandry),
// with the vanilla parents, frames (task / goal / challenge), hidden ones, experience rewards and criteria,
// the toasts and chat lines, and the advancements screen (L) with the tree, tabs and progress tooltips.
const KILL_ALL = 'blaze cave_spider creeper drowned elder_guardian ender_dragon enderman endermite evoker ghast guardian hoglin husk magma_cube phantom piglin piglin_brute pillager ravager shulker silverfish skeleton slime spider stray vex vindicator witch wither_skeleton wither zoglin zombie_villager zombie zombified_piglin'.split(' ');
const ALL_FOODS = 'apple mushroom_stew bread porkchop cooked_porkchop golden_apple enchanted_golden_apple cod salmon tropical_fish pufferfish cooked_cod cooked_salmon cookie melon_slice beef cooked_beef chicken cooked_chicken rotten_flesh spider_eye carrot potato baked_potato poisonous_potato golden_carrot pumpkin_pie rabbit cooked_rabbit rabbit_stew mutton cooked_mutton chorus_fruit beetroot beetroot_soup dried_kelp suspicious_stew sweet_berries honey_bottle glow_berries'.split(' ');
const ALL_BREED = 'horse donkey mule sheep cow mooshroom pig chicken wolf ocelot rabbit llama cat panda fox bee hoglin strider goat axolotl turtle'.split(' ');
const ALL_CATS = 'tabby black red siamese british_shorthair calico persian ragdoll white jellie all_black'.split(' ');
const ADV_BIOMES = 'birch_forest_hills river swamp desert wooded_hills giant_tree_taiga_hills snowy_taiga badlands forest stone_shore snowy_tundra taiga_hills snowy_mountains wooded_badlands_plateau savanna plains frozen_river giant_tree_taiga snowy_beach jungle_hills jungle_edge mushroom_field_shore mountains desert_hills jungle beach savanna_plateau snowy_taiga_hills badlands_plateau dark_forest taiga birch_forest mushroom_fields wooded_mountains warm_ocean lukewarm_ocean cold_ocean deep_lukewarm_ocean deep_cold_ocean deep_frozen_ocean bamboo_jungle bamboo_jungle_hills'.split(' ');
const NETHER_BIOMES = 'nether_wastes soul_sand_valley warped_forest crimson_forest basalt_deltas'.split(' ');
const ALL_POTIONS = 'speed slowness strength jump_boost regeneration fire_resistance water_breathing invisibility night_vision weakness poison slow_falling resistance'.split(' ');
const ALL_EFFECTS = 'speed slowness strength jump_boost regeneration fire_resistance water_breathing invisibility night_vision weakness poison wither haste mining_fatigue levitation glowing absorption hunger nausea resistance slow_falling conduit_power dolphins_grace blindness bad_omen hero_of_the_village'.split(' ');
const ADV_TABS = [['story', 'Minecraft'], ['nether', '네더'], ['end', '디 엔드'], ['adventure', '모험'], ['husbandry', '농사']];
// [id, parent, icon, frame (t task, g goal, c challenge), hidden, xp, name, description, criteria (list; one is enough when any)]
const ADV2 = [
  ['story/root', null, 'grass_block', 't', 0, 0, 'Minecraft', '게임의 핵심과 이야기', ['crafting_table']],
  ['story/mine_stone', 'story/root', 'wooden_pickaxe', 't', 0, 0, '석기 시대', '새 곡괭이로 돌을 채굴하세요', ['get_stone']],
  ['story/upgrade_tools', 'story/mine_stone', 'stone_pickaxe', 't', 0, 0, '더욱더 좋게', '더 좋은 곡괭이를 만드세요', ['stone_pickaxe']],
  ['story/smelt_iron', 'story/upgrade_tools', 'iron_ingot', 't', 0, 0, '철이 철철 넘쳐', '철 주괴를 제련하세요', ['iron']],
  ['story/obtain_armor', 'story/smelt_iron', 'iron_chestplate', 't', 0, 0, '차려입기', '철 갑옷으로 스스로를 보호하세요', ['iron_helmet', 'iron_chestplate', 'iron_leggings', 'iron_boots'], 1],
  ['story/lava_bucket', 'story/smelt_iron', 'lava_bucket', 't', 0, 0, '화끈한 화제', '양동이에 용암을 채우세요', ['lava_bucket']],
  ['story/iron_tools', 'story/smelt_iron', 'iron_pickaxe', 't', 0, 0, '이젠 철 좀 들어라', '곡괭이를 개선하세요', ['iron_pickaxe']],
  ['story/deflect_arrow', 'story/obtain_armor', 'shield', 't', 0, 0, '저희는 그런 것 받지 않습니다', '방패로 발사체를 튕겨내세요', ['deflected_projectile']],
  ['story/form_obsidian', 'story/lava_bucket', 'obsidian', 't', 0, 0, '아이스 버킷 챌린지', '흑요석을 얻으세요', ['obsidian']],
  ['story/mine_diamond', 'story/iron_tools', 'diamond', 't', 0, 0, '다이아몬드다!', '다이아몬드를 얻으세요', ['diamond']],
  ['story/enter_the_nether', 'story/form_obsidian', 'flint_and_steel', 't', 0, 0, '더 깊은 곳으로', '네더 차원문을 짓고, 불을 붙여 들어가세요', ['entered_nether']],
  ['story/shiny_gear', 'story/mine_diamond', 'diamond_chestplate', 't', 0, 0, '다이아몬드로 날 감싸줘', '다이아몬드 갑옷은 생명을 구합니다', ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'], 1],
  ['story/enchant_item', 'story/mine_diamond', 'enchanted_book', 't', 0, 0, '마법 부여자', '마법 부여대로 아이템에 마법을 부여하세요', ['enchanted_item']],
  ['story/cure_zombie_villager', 'story/enter_the_nether', 'golden_apple', 'g', 0, 0, '좀비 의사', '좀비 주민을 약화시킨 후 치료하세요', ['cured_zombie']],
  ['story/follow_ender_eye', 'story/enter_the_nether', 'ender_eye', 't', 0, 0, '스무고개', '엔더의 눈을 따라가세요', ['in_stronghold']],
  ['story/enter_the_end', 'story/follow_ender_eye', 'end_stone', 't', 0, 0, '이걸로 끝이야?', '엔드 차원문에 진입하세요', ['entered_end']],
  ['nether/root', null, 'red_nether_bricks', 't', 0, 0, '네더', '여름옷을 가져오세요', ['entered_nether']],
  ['nether/return_to_sender', 'nether/root', 'fire_charge', 'c', 0, 50, '전해지지 않은 러브레터', '화염구로 가스트를 죽이세요', ['killed_ghast']],
  ['nether/find_bastion', 'nether/root', 'polished_blackstone_bricks', 't', 0, 0, '그때가 좋았지', '보루 잔해에 진입하세요', ['bastion']],
  ['nether/obtain_ancient_debris', 'nether/root', 'ancient_debris', 't', 0, 0, '깊이 파묻힌 잔해', '고대 잔해를 얻으세요', ['ancient_debris']],
  ['nether/fast_travel', 'nether/root', 'map', 'c', 0, 100, '천 리 길도 한 걸음', '네더를 이용해 오버월드의 7 km를 이동하세요', ['travelled']],
  ['nether/find_fortress', 'nether/root', 'nether_bricks', 't', 0, 0, '끔찍한 요새', '네더 요새 안으로 들어가세요', ['fortress']],
  ['nether/obtain_crying_obsidian', 'nether/root', 'crying_obsidian', 't', 0, 0, '누가 양파를 써나?', '우는 흑요석을 얻으세요', ['crying_obsidian']],
  ['nether/distract_piglin', 'nether/root', 'gold_ingot', 't', 0, 0, '반짝반짝 눈이 부셔', '금으로 피글린의 주의를 돌리세요', ['distract_piglin', 'distract_piglin_directly'], 1],
  ['nether/ride_strider', 'nether/root', 'warped_fungus_on_a_stick', 't', 0, 0, '두 발 달린 보트', '뒤틀린 균 낚싯대를 들고 스트라이더 위에 타세요', ['used_warped_fungus_on_a_stick']],
  ['nether/uneasy_alliance', 'nether/return_to_sender', 'ghast_tear', 'c', 0, 100, '쉽지 않은 동행', '네더에서 가스트를 구출해 오버월드로 안전하게 데려온 다음... 죽이세요', ['killed_ghast']],
  ['nether/loot_bastion', 'nether/find_bastion', 'chest', 't', 0, 0, '돼지와 전쟁', '보루 잔해에 있는 상자에서 노획물을 얻으세요', ['loot_bastion_other', 'loot_bastion_treasure', 'loot_bastion_hoglin_stable', 'loot_bastion_bridge'], 1],
  ['nether/use_lodestone', 'nether/obtain_ancient_debris', 'lodestone', 't', 0, 0, '집으로 이끌려가네', '자석석에 나침반을 사용하세요', ['use_lodestone']],
  ['nether/netherite_armor', 'nether/obtain_ancient_debris', 'netherite_chestplate', 'c', 0, 100, '잔해로 날 감싸줘', '네더라이트 갑옷을 모두 얻으세요', ['netherite_armor']],
  ['nether/get_wither_skull', 'nether/find_fortress', 'wither_skeleton_skull', 't', 0, 0, '으스스한 스켈레톤', '위더 스켈레톤의 해골을 얻으세요', ['wither_skull']],
  ['nether/obtain_blaze_rod', 'nether/find_fortress', 'blaze_rod', 't', 0, 0, '포화 속으로', '블레이즈의 막대기를 얻으세요', ['blaze_rod']],
  ['nether/charge_respawn_anchor', 'nether/obtain_crying_obsidian', 'respawn_anchor', 't', 0, 0, '목숨 충전', '리스폰 정박기를 최대로 충전하세요', ['charge_respawn_anchor']],
  ['nether/explore_nether', 'nether/ride_strider', 'netherite_boots', 'c', 0, 500, '화끈한 관광 명소', '모든 네더 생물 군계를 탐험하세요', NETHER_BIOMES],
  ['nether/summon_wither', 'nether/get_wither_skull', 'nether_star', 't', 0, 0, '시들어 버린 언덕', '위더를 소환하세요', ['summoned']],
  ['nether/brew_potion', 'nether/obtain_blaze_rod', 'potion', 't', 0, 0, '물약 양조장', '물약을 양조하세요', ['potion']],
  ['nether/create_beacon', 'nether/summon_wither', 'beacon', 't', 0, 0, '신호기 꾸리기', '신호기를 제작하고 설치하세요', ['beacon']],
  ['nether/all_potions', 'nether/brew_potion', 'milk_bucket', 'c', 0, 100, '뿅가는 폭탄주', '모든 물약 효과를 동시에 가지세요', ['all_effects']],
  ['nether/create_full_beacon', 'nether/create_beacon', 'beacon', 'g', 0, 0, '신호자', '신호기의 출력을 최대로 만드세요', ['beacon']],
  ['nether/all_effects', 'nether/all_potions', 'bucket', 'c', 1, 1000, '어쩌다 이 지경까지', '모든 효과를 동시에 가지세요', ['all_effects']],
  ['end/root', null, 'end_stone', 't', 0, 0, '디 엔드', '끝일까요, 아니면 시작일까요?', ['entered_end']],
  ['end/kill_dragon', 'end/root', 'dragon_head', 't', 0, 0, '엔드 해방', '행운을 빌어요', ['killed_dragon']],
  ['end/dragon_egg', 'end/kill_dragon', 'dragon_egg', 'g', 0, 0, '그다음 세대', '드래곤 알을 들어올리세요', ['dragon_egg']],
  ['end/enter_end_gateway', 'end/kill_dragon', 'ender_pearl', 't', 0, 0, '머나먼 휴양지', '섬에서 탈출하세요', ['entered_end_gateway']],
  ['end/respawn_dragon', 'end/kill_dragon', 'end_crystal', 'g', 0, 0, '끝 아녔어?', '엔더 드래곤을 다시 소환하세요', ['summoned_dragon']],
  ['end/dragon_breath', 'end/kill_dragon', 'dragon_breath', 'g', 0, 0, '양치질이 필요해 보이는걸', '드래곤의 숨결을 유리병에 담으세요', ['dragon_breath']],
  ['end/find_end_city', 'end/enter_end_gateway', 'purpur_block', 't', 0, 0, '게임의 끝에서 만난 도시', '들어가 보세요, 무슨 일이 일어날까요?', ['in_city']],
  ['end/elytra', 'end/find_end_city', 'elytra', 'g', 0, 0, '불가능은 없다', '겉날개를 찾으세요', ['elytra']],
  ['end/levitate', 'end/find_end_city', 'shulker_shell', 'c', 0, 50, '위쪽 공기 좋은데?', '셜커의 공격을 맞고 블록 50개어치만큼 공중 부양하세요', ['levitated']],
  ['adventure/root', null, 'map', 't', 0, 0, '모험', '모험, 탐사와 전투', ['killed_something', 'killed_by_something'], 1],
  ['adventure/voluntary_exile', 'adventure/root', 'white_banner', 't', 1, 0, '자진 유배', '습격 대장을 죽이세요.\n당분간 마을에서 떨어져 있는 게 좋을지도 몰라요...', ['voluntary_exile']],
  ['adventure/spyglass_at_parrot', 'adventure/root', 'spyglass', 't', 0, 0, '새인가?', '망원경으로 앵무새를 바라보세요', ['spyglass_at_parrot']],
  ['adventure/kill_a_mob', 'adventure/root', 'iron_sword', 't', 0, 0, '몬스터 사냥꾼', '적대적 몬스터를 죽이세요', KILL_ALL, 1],
  ['adventure/trade', 'adventure/root', 'emerald', 't', 0, 0, '훌륭한 거래군요!', '주민과 거래하세요', ['traded']],
  ['adventure/honey_block_slide', 'adventure/root', 'honey_block', 't', 0, 0, '달콤함에 몸을 맡기다', '꿀 블록을 향해 점프해 낙하를 멈추세요', ['honey_block_slide']],
  ['adventure/ol_betsy', 'adventure/root', 'crossbow', 't', 0, 0, '부러진 화살', '쇠뇌를 쏘세요', ['shot_crossbow']],
  ['adventure/lightning_rod_with_villager_no_fire', 'adventure/root', 'lightning_rod', 't', 0, 0, '번개 멈춰!', '주민의 감전 사고를 화재 없이 막으세요', ['lightning_rod_with_villager_no_fire']],
  ['adventure/sleep_in_bed', 'adventure/root', 'red_bed', 't', 0, 0, '달콤한 꿈', '침대에서 자서 리스폰 지점을 바꾸세요', ['slept_in_bed']],
  ['adventure/hero_of_the_village', 'adventure/voluntary_exile', 'white_banner', 'c', 1, 100, '마을의 영웅', '습격으로부터 마을을 지켜내세요', ['hero_of_the_village']],
  ['adventure/spyglass_at_ghast', 'adventure/spyglass_at_parrot', 'spyglass', 't', 0, 0, '풍선인가?', '망원경으로 가스트를 바라보세요', ['spyglass_at_ghast']],
  ['adventure/throw_trident', 'adventure/kill_a_mob', 'trident', 't', 0, 0, '준비하시고... 쏘세요!', '무언가를 향해 삼지창을 던지세요.\n참고: 가지고 있는 유일한 무기를 내던지는 것은 좋은 생각이 아닙니다.', ['shot_trident']],
  ['adventure/shoot_arrow', 'adventure/kill_a_mob', 'bow', 't', 0, 0, '정조준', '화살로 무언가를 맞추세요', ['shot_arrow']],
  ['adventure/kill_all_mobs', 'adventure/kill_a_mob', 'diamond_sword', 'c', 0, 100, '몬스터 도감', '모든 적대적 몬스터를 하나 이상씩 죽이세요', KILL_ALL],
  ['adventure/totem_of_undying', 'adventure/kill_a_mob', 'totem_of_undying', 'g', 0, 0, '죽음을 초월한 자', '불사의 토템으로 죽음을 면하세요', ['used_totem']],
  ['adventure/summon_iron_golem', 'adventure/trade', 'carved_pumpkin', 'g', 0, 0, '도우미 고용', '마을 방어를 돕기 위해 철 골렘을 소환하세요', ['summoned_golem']],
  ['adventure/two_birds_one_arrow', 'adventure/ol_betsy', 'crossbow', 'c', 0, 65, '일전쌍조', '관통 화살 한 발로 팬텀 두 마리를 죽이세요', ['two_birds']],
  ['adventure/whos_the_pillager_now', 'adventure/ol_betsy', 'crossbow', 't', 0, 0, '이제 누가 약탈자지?', '약탈자에게 똑같은 무기로 앙갚음해 주세요', ['kill_pillager']],
  ['adventure/arbalistic', 'adventure/ol_betsy', 'crossbow', 'c', 1, 85, '명사수', '쇠뇌 한 발로 종류가 다른 몹 다섯 마리를 죽이세요', ['arbalistic']],
  ['adventure/adventuring_time', 'adventure/sleep_in_bed', 'diamond_boots', 'c', 0, 500, '모험의 시간', '모든 생물 군계를 발견하세요', ADV_BIOMES],
  ['adventure/very_very_frightening', 'adventure/throw_trident', 'trident', 't', 0, 0, '동에 번쩍 서에 번쩍', '주민에게 벼락을 떨어뜨리세요', ['struck_villager']],
  ['adventure/sniper_duel', 'adventure/shoot_arrow', 'arrow', 'c', 0, 50, '저격 대결', '50미터 이상 떨어져 있는 스켈레톤을 죽이세요', ['killed_skeleton']],
  ['adventure/bullseye', 'adventure/shoot_arrow', 'target', 'c', 0, 50, '명중', '30미터 이상 떨어진 곳에서 과녁 블록의 정중앙을 맞추세요', ['bullseye']],
  ['adventure/walk_on_powder_snow_with_leather_boots', 'adventure/root', 'leather_boots', 't', 0, 0, '토끼처럼 가볍게', '가루눈 위를 걸으세요... 빠지지 않고요', ['walk_on_powder_snow_with_leather_boots']],
  ['adventure/spyglass_at_dragon', 'adventure/spyglass_at_ghast', 'spyglass', 't', 0, 0, '비행기인가?', '망원경으로 엔더 드래곤을 바라보세요', ['spyglass_at_dragon']],
  ['husbandry/root', null, 'hay_block', 't', 0, 0, '농사', '세상은 친구들과 음식으로 가득 차 있어요', ['consumed_item']],
  ['husbandry/safely_harvest_honey', 'husbandry/root', 'honey_bottle', 't', 0, 0, '벌집을 내 집처럼', '꿀벌을 자극하지 않도록 모닥불을 사용해 벌통에 든 꿀을 병에 담으세요', ['safely_harvest_honey']],
  ['husbandry/breed_an_animal', 'husbandry/root', 'wheat', 't', 0, 0, '아기는 어떻게 태어나?', '동물 두 마리를 교배시키세요', ['bred']],
  ['husbandry/tame_an_animal', 'husbandry/root', 'lead', 't', 0, 0, '인생의 동반자', '동물을 길들이세요', ['tamed_animal']],
  ['husbandry/fishy_business', 'husbandry/root', 'fishing_rod', 't', 0, 0, '강태공이 세월을 낚듯', '물고기를 잡으세요', ['cod', 'tropical_fish', 'pufferfish', 'salmon'], 1],
  ['husbandry/silk_touch_nest', 'husbandry/root', 'bee_nest', 't', 0, 0, '한 벌 한 벌 정성껏 모시겠습니다', '벌 3마리가 들어 있는 벌집을 섬세한 손길을 사용해 옮기세요', ['silk_touch_nest']],
  ['husbandry/plant_seed', 'husbandry/root', 'wheat', 't', 0, 0, '씨앗이 자라나는 곳', '씨앗을 심고 자라나는 것을 지켜보세요', ['wheat', 'pumpkin_stem', 'melon_stem', 'beetroots', 'nether_wart'], 1],
  ['husbandry/make_a_sign_glow', 'husbandry/root', 'glow_ink_sac', 't', 0, 0, '밝은 말 고운 말', '표지판의 글자가 빛나게 만드세요', ['make_a_sign_glow']],
  ['husbandry/ride_a_boat_with_a_goat', 'husbandry/root', 'oak_boat', 't', 0, 0, '염소 떴소', '염소와 함께 보트에 타세요', ['ride_a_boat_with_a_goat']],
  ['husbandry/wax_on', 'husbandry/safely_harvest_honey', 'honeycomb', 't', 0, 0, '밀랍을 칠하자', '구리 블록에 벌집 조각을 사용하세요!', ['wax_on']],
  ['husbandry/bred_all_animals', 'husbandry/breed_an_animal', 'golden_carrot', 'c', 0, 100, '짝지어주기', '모든 동물을 교배시키세요!', ALL_BREED],
  ['husbandry/complete_catalogue', 'husbandry/tame_an_animal', 'cod', 'c', 0, 50, '집사 그 자체', '모든 종류의 고양이를 길들이세요!', ALL_CATS],
  ['husbandry/tactical_fishing', 'husbandry/fishy_business', 'pufferfish_bucket', 't', 0, 0, '이 대신 잇몸으로', '물고기를 잡으세요... 낚싯대 없이요!', ['cod_bucket', 'tropical_fish_bucket', 'pufferfish_bucket', 'salmon_bucket'], 1],
  ['husbandry/balanced_diet', 'husbandry/plant_seed', 'apple', 'c', 0, 100, '균형 잡힌 식단', '먹을 수 있다면 모두 먹으세요. 그것이 건강에 좋지 않더라도 말이죠', ALL_FOODS],
  ['husbandry/obtain_netherite_hoe', 'husbandry/plant_seed', 'netherite_hoe', 'c', 0, 100, '도를 넘은 전념', '네더라이트 주괴로 괭이를 강화한 후, 삶의 선택들을 돌이켜 보세요', ['netherite_hoe']],
  ['husbandry/wax_off', 'husbandry/wax_on', 'stone_axe', 't', 0, 0, '밀랍을 벗기자', '구리 블록의 밀랍칠을 벗기세요!', ['wax_off']],
  ['husbandry/axolotl_in_a_bucket', 'husbandry/tactical_fishing', 'axolotl_bucket', 't', 0, 0, '귀여운 포식자', '양동이로 아홀로틀을 잡으세요', ['axolotl_bucket']],
  ['husbandry/kill_axolotl_target', 'husbandry/axolotl_in_a_bucket', 'tropical_fish_bucket', 't', 0, 0, '우정의 치유력', '아홀로틀과 협력해 싸워 이기세요', ['kill_axolotl_target']],
];
const ADVM = {}; for (const a of ADV2) ADVM[a[0]] = { id: a[0], parent: a[1], icon: a[2], frame: a[3], hidden: !!a[4], xp: a[5], name: a[6], desc: a[7], crit: a[8], any: !!a[9], tab: a[0].split('/')[0], kids: [] };
for (const a of Object.values(ADVM)) if (a.parent) ADVM[a.parent].kids.push(a.id);

// ---------- progress ----------
const advState = () => { if (UI.menu === 'advview' && ADVUI.view) return ADVUI.view.adv2 || {}; /* a saved world's, looked at from the title screen */ if (!W.meta) return null; const s = W.meta.adv2 || (W.meta.adv2 = {}); if (W.meta.adv && !W.meta.advMigrated) { migrateOldAdv(s); W.meta.advMigrated = true; } return s; };
function migrateOldAdv(s) { // worlds from before the full set: carry the old (subset) advancements over
  const MAP = { root: 'story/root', stone: 'story/mine_stone', upgrade: 'story/upgrade_tools', iron: 'story/smelt_iron', armor: 'story/obtain_armor', lava: 'story/lava_bucket', ironpick: 'story/iron_tools', diamond: 'story/mine_diamond', obsidian: 'story/form_obsidian', enchant: 'story/enchant_item', portal: 'story/enter_the_nether', nether: 'nether/root', blaze: 'nether/obtain_blaze_rod', debris: 'nether/obtain_ancient_debris', netherite: 'nether/netherite_armor', end: 'end/root', dragon: 'end/kill_dragon', trade: 'adventure/trade', wolf: 'husbandry/tame_an_animal', elytra: 'end/elytra', breed: 'husbandry/breed_an_animal', hunter: 'adventure/kill_a_mob', sleep: 'adventure/sleep_in_bed', seed: 'husbandry/plant_seed', snow: 'adventure/walk_on_powder_snow_with_leather_boots', spyglass: 'adventure/spyglass_at_parrot', cure: 'story/cure_zombie_villager', raid: 'adventure/hero_of_the_village', wither: 'nether/summon_wither', eye: 'story/follow_ender_eye' };
  for (const [k, t] of Object.entries(W.meta.adv)) if (MAP[k] && ADVM[MAP[k]]) s[MAP[k]] = { done: t, c: {} };
}
const advDone = id => { const s = advState(); return !!(s && s[id] && s[id].done); };
function advProgress(id) { const a = ADVM[id], st = (advState() || {})[id] || { c: {} }; const have = a.crit.filter(k => st.c && st.c[k]).length; return { have, need: a.any ? 1 : a.crit.length, done: !!st.done }; }
// grant one criterion; the advancement completes when its criteria are met (one, or all)
function advGrant(id, crit) {
  const a = ADVM[id]; if (!a) return;
  if (!W.meta || PL.mode === 'spectator') return;
  const s = advState(), st = s[id] || (s[id] = { c: {} }); if (st.done) return;
  if (crit == null) crit = a.crit[0];
  if (!a.crit.includes(crit) || (st.c[crit])) return;
  st.c[crit] = Date.now();
  const ok = a.any ? true : a.crit.every(k => st.c[k]);
  if (ok) advComplete(a, st);
}
function advComplete(a, st) {
  st.done = Date.now();
  const verb = a.frame === 'c' ? ['도전 과제', '을(를) 완료했습니다', '#aa00aa'] : a.frame === 'g' ? ['목표', '에 도달했습니다', '#55ff55'] : ['발전 과제', '을(를) 달성했습니다', '#55ff55'];
  if (gr('announceAdvancements')) { const who = typeof MP !== 'undefined' && MP.on ? MP.name + '님이' : '플레이어가', t = `${who} ${verb[0]} [${a.name}]${verb[1]}`; chatMsg(t, verb[2]); if (typeof MP !== 'undefined' && MP.on) mpSend({ t: 'sys', text: t, c: verb[2] }); } // everyone in the world hears about it
  if (a.xp) addXP(a.xp);
  advQueue.push(a); if (advQueue.length === 1) showAdv();
}
const advQueue = [];
function showAdv() {
  if (!W.active) { advQueue.length = 0; $('adv').classList.remove('show'); return; } // back at the title: the toasts go
  const a = advQueue[0]; if (!a) return;
  const el = $('adv'), title = a.frame === 'c' ? '도전 과제 완료!' : a.frame === 'g' ? '목표 달성!' : '발전 과제 달성!';
  el.innerHTML = `${icon(advIcon(a.icon))}<div><b class="${a.frame === 'c' ? 'ch' : ''}">${title}</b><span>${a.name}</span></div>`;
  el.classList.add('show'); play(a.frame === 'c' ? 'levelup' : 'click', a.frame === 'c' ? { vol: 0.6 } : { vol: 0.4, pitch: 1.6 });
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { advQueue.shift(); showAdv(); }, 400); }, 5000);
}
const advIcon = k => IID[k] != null ? IID[k] : k === 'potion' ? (POTION.awkward || POTION.water).items.potion : k === 'dragon_head' ? itemOfBlock(BID.mob_head, 3 << 2) : k === 'white_banner' ? (IID.white_banner || BID.banner) : k === 'red_bed' ? (IID.red_bed || BID.red_bed) : BID[k] != null ? BID[k] : IID.barrier || 1;
// old single-key calls (kept so every existing trigger site still works)
UI.advance = key => {
  const MAP = { breed: 'husbandry/breed_an_animal', trade: 'adventure/trade', eye: null, dragon: 'end/kill_dragon', portal: null, wolf: 'husbandry/tame_an_animal', horse: 'husbandry/tame_an_animal', raid: 'adventure/hero_of_the_village', wither: 'nether/summon_wither', sleep: 'adventure/sleep_in_bed', snow: 'adventure/walk_on_powder_snow_with_leather_boots', seed: null, cure: 'story/cure_zombie_villager', enchant: 'story/enchant_item' };
  if (MAP[key]) advGrant(MAP[key]);
};

// ---------- triggers ----------
const ADVT = {
  hitByPlayer(victim, proj) { // player_hurt_entity with a projectile
    if (!proj) return;
    if (proj.trident) advGrant('adventure/throw_trident'); else if (!proj.thrown) advGrant('adventure/shoot_arrow');
  },
  kill(e, proj) { // player_killed_entity (+ killed_by_crossbow, sniper duel, return to sender...)
    advGrant('adventure/root', 'killed_something');
    if (KILL_ALL.includes(e.type)) { advGrant('adventure/kill_a_mob', e.type); advGrant('adventure/kill_all_mobs', e.type); }
    if (e.type === 'ender_dragon') advGrant('end/kill_dragon');
    if (e.type === 'ghast' && proj && proj.fireball) advGrant('nether/return_to_sender');
    if (e.type === 'ghast' && W.dim === 0) advGrant('nether/uneasy_alliance'); // any way, as long as it's in the Overworld
    if (e.type === 'skeleton' && proj && !proj.fireball && proj.from && Math.hypot(e.x - proj.from[0], e.z - proj.from[1]) >= 50) advGrant('adventure/sniper_duel');
    if (e.captain) advGrant('adventure/voluntary_exile');
    if (proj && proj.crossbow) {
      if (e.type === 'pillager') advGrant('adventure/whos_the_pillager_now');
      const k = proj.kills || (proj.kills = []); k.push(e.type);
      if (k.filter(t => t === 'phantom').length >= 2) advGrant('adventure/two_birds_one_arrow');
      if (new Set(k).size >= 5) advGrant('adventure/arbalistic');
    }
    if (e.plHitT != null && ENT.some(o => o.type === 'axolotl' && !o.dead && o.target === e)) { addEffect(PL, 'regeneration', 100, 0); advGrant('husbandry/kill_axolotl_target'); }
  },
  killedBy() { advGrant('adventure/root', 'killed_by_something'); },
  bred(type) { stat('animals_bred'); advGrant('husbandry/breed_an_animal'); advGrant('husbandry/bred_all_animals', type); },
  tamed(e) { advGrant('husbandry/tame_an_animal'); if (e && e.type === 'cat') advGrant('husbandry/complete_catalogue', ALL_CATS[e.variant] || ''); },
  ate(id) { advGrant('husbandry/root'); advGrant('husbandry/balanced_diet', ITEMS[id].key); },
  dim(d) { if (d === -1) { advGrant('story/enter_the_nether'); advGrant('nether/root'); } if (d === 1) { advGrant('story/enter_the_end'); advGrant('end/root'); } },
  planted(id) { const k = id === BID.wheat ? 'wheat' : id === BID.pumpkin_stem ? 'pumpkin_stem' : id === BID.melon_stem ? 'melon_stem' : id === BID.beetroots ? 'beetroots' : id === BID.nether_wart ? 'nether_wart' : null; if (k) advGrant('husbandry/plant_seed', k); },
  fished(id) { stat('fish_caught'); const k = ITEMS[id] && ITEMS[id].key; if (['cod', 'tropical_fish', 'pufferfish', 'salmon'].includes(k)) advGrant('husbandry/fishy_business', k); },
  bucketed(key) { if (key === 'axolotl_bucket') advGrant('husbandry/axolotl_in_a_bucket'); else advGrant('husbandry/tactical_fishing', key); },
  spyglass(e) { if (!e) return; if (e.type === 'parrot') advGrant('adventure/spyglass_at_parrot'); if (e.type === 'ghast') advGrant('adventure/spyglass_at_ghast'); if (e.type === 'ender_dragon') advGrant('adventure/spyglass_at_dragon'); },
};
// travelling through the Nether: where the player went in and came out, in Overworld coordinates
function advNetherTravel(from, to) {
  if (from === 0 && to === -1) W.meta.netherIn = [PL.x, PL.z];
  if (from === -1 && to === 0 && W.meta.netherIn) { if (Math.hypot(PL.x - W.meta.netherIn[0], PL.z - W.meta.netherIn[1]) >= 7000) advGrant('nether/fast_travel'); W.meta.netherIn = null; }
}
// once a second: what the player carries, where they are, which effects they have
const ADV_INV = { 'story/root': 'crafting_table', 'story/upgrade_tools': 'stone_pickaxe', 'story/smelt_iron': 'iron_ingot', 'story/lava_bucket': 'lava_bucket', 'story/iron_tools': 'iron_pickaxe', 'story/form_obsidian': 'obsidian', 'story/mine_diamond': 'diamond', 'nether/get_wither_skull': 'wither_skeleton_skull', 'nether/obtain_ancient_debris': 'ancient_debris', 'nether/obtain_blaze_rod': 'blaze_rod', 'nether/obtain_crying_obsidian': 'crying_obsidian', 'end/dragon_breath': 'dragon_breath', 'end/dragon_egg': 'dragon_egg', 'end/elytra': 'elytra', 'husbandry/obtain_netherite_hoe': 'netherite_hoe' };
function advScan() {
  if (!W.meta || !W.active) return;
  const have = new Set(); for (const s of [...INV.slots, ...INV.armor, INV.off, INV.cursor]) if (s) have.add(ITEMS[s.id].key);
  for (const [id, k] of Object.entries(ADV_INV)) if (have.has(k)) advGrant(id);
  if (have.has('cobblestone') || have.has('blackstone') || have.has('cobbled_deepslate')) advGrant('story/mine_stone');
  for (const p of ['helmet', 'chestplate', 'leggings', 'boots']) { if (have.has('iron_' + p)) advGrant('story/obtain_armor', 'iron_' + p); if (have.has('diamond_' + p)) advGrant('story/shiny_gear', 'diamond_' + p); }
  if (['helmet', 'chestplate', 'leggings', 'boots'].every(p => have.has('netherite_' + p))) advGrant('nether/netherite_armor');
  // effects
  const eff = PL.eff || {};
  if (ALL_POTIONS.every(k => eff[k])) advGrant('nether/all_potions');
  if (ALL_EFFECTS.every(k => eff[k])) advGrant('nether/all_effects');
  // places
  const x = Math.floor(PL.x), y = Math.floor(PL.y), z = Math.floor(PL.z);
  if (W.dim === 0) {
    const key = biomeKey(biomeAt(x, z), x, z); if (key) advGrant('adventure/adventuring_time', key);
    for (const [sx, sy, sz] of S.strongholdsOf(W.seed)) if (Math.abs(x - sx) < 44 && Math.abs(z - sz) < 44 && y < sy + 12 && y > sy - 30) advGrant('story/follow_ender_eye');
  } else if (W.dim === -1) {
    const b = biomeAt(x, z), key = { 13: 'nether_wastes', 14: 'crimson_forest', 15: 'warped_forest', 16: 'soul_sand_valley', 17: 'basalt_deltas' }[b]; if (key) advGrant('nether/explore_nether', key);
    const rx = Math.floor((x >> 4) / S.FREG), rz = Math.floor((z >> 4) / S.FREG);
    for (let i = rx - 1; i <= rx + 1; i++) for (let j = rz - 1; j <= rz + 1; j++) { const f = S.fortressAt(W.seed, i, j); if (f && Math.abs(y - f.y) < 16 && Math.abs(x - f.x) < Math.max(...f.arms) + 4 && Math.abs(z - f.z) < Math.max(...f.arms) + 4) advGrant('nether/find_fortress'); }
    const bx = Math.floor((x >> 4) / S.BREG), bz = Math.floor((z >> 4) / S.BREG);
    for (let i = bx - 1; i <= bx + 1; i++) for (let j = bz - 1; j <= bz + 1; j++) { const o = S.bastionAt(W.seed, i, j); if (o && Math.abs(x - o.x) < 36 && Math.abs(z - o.z) < 36 && y > o.y - 4 && y < o.y + 40) advGrant('nether/find_bastion'); }
  } else if (W.dim === 1) {
    const nA = S.makeNoise(W.seed + 201), nB = S.makeNoise(W.seed + 202), rx = Math.floor((x >> 4) / 20), rz = Math.floor((z >> 4) / 20);
    for (let i = rx - 1; i <= rx + 1; i++) for (let j = rz - 1; j <= rz + 1; j++) { const c = S.endCityAt(W.seed, i, j, nA, nB); if (c && Math.abs(x - c.x) < 24 && Math.abs(z - c.z) < 24) advGrant('end/find_end_city'); }
  }
  // levitation: 50 blocks up while levitating
  if (eff.levitation) { if (PL.levStart == null) PL.levStart = PL.y; else if (PL.y - PL.levStart >= 50) advGrant('end/levitate'); } else PL.levStart = null;
}
// the advancement key of a biome (adventuring time)
function biomeKey(b) { const r = S.BIOMES[b]; return r && r[8] ? r[8] : '' || ['ocean', 'plains', 'forest', 'birch_forest', 'taiga', 'snowy_tundra', 'desert', 'mountains', 'beach', 'river', 'swamp', 'snowy_taiga', 'frozen_ocean', '', '', '', '', '', '', 'jungle', 'savanna', 'dark_forest', 'badlands', 'warm_ocean', 'lukewarm_ocean', 'cold_ocean', 'mushroom_fields', 'ice_spikes', 'bamboo_jungle', 'flower_forest'][b] || ''; }

// ---------- the screen ----------
const ADVUI = { tab: 'story', px: 0, py: 0, view: null };
// vanilla-like tidy tree: children to the right of their parent, leaves stacked, parents centred on their children
function advLayout(tab) {
  const root = Object.values(ADVM).find(a => a.tab === tab && !a.parent), pos = {}; let row = 0;
  const walk = (id, d) => { const a = ADVM[id], kids = a.kids.filter(advVisible); if (!kids.length) { pos[id] = [d, row++]; return; } for (const k of kids) walk(k, d + 1); pos[id] = [d, (pos[kids[0]][1] + pos[kids[kids.length - 1]][1]) / 2]; };
  if (root && advVisible(root.id)) walk(root.id, 0);
  return pos;
}
const advDescDone = a => a.kids.some(k => advDone(k) || advDescDone(ADVM[k])); // hasChildrenDone: any descendant
function advVisible(id) { // ClientAdvancementManager / PlayerAdvancementTracker.canSee
  let a = ADVM[id];
  for (let i = 0; a && i <= 2; i++) {
    if (i === 0 && advDescDone(a)) return true;
    if (advDone(a.id)) return true;
    if (a.hidden) return false;
    a = a.parent ? ADVM[a.parent] : null;
  }
  return false;
}
function advScreenHtml() {
  const tabs = ADV_TABS.filter(([t]) => advVisible(t + '/root'));
  if (!tabs.length) return `<div class="panel advp"><div class="cap">발전 과제</div><div class="advempty">여기에는 아무것도 없는 것 같아요... :(</div></div>`;
  if (!tabs.some(([t]) => t === ADVUI.tab)) ADVUI.tab = tabs[0][0];
  const pos = advLayout(ADVUI.tab), SX = 34, SY = 28, ids = Object.keys(pos);
  let w = 0, h = 0; for (const id of ids) { w = Math.max(w, pos[id][0]); h = Math.max(h, pos[id][1]); }
  const node = id => { const [c, r] = pos[id]; return [12 + c * SX, 10 + r * SY]; };
  let lines = '';
  for (const id of ids) { const a = ADVM[id]; if (!a.parent || !pos[a.parent]) continue; const [x0, y0] = node(a.parent), [x1, y1] = node(id), mx = (x0 + x1) / 2 + 6.5; lines += `<path d="M${x0 + 13} ${y0 + 13}H${mx}V${y1 + 13}H${x1 + 13}" />`; }
  const nodes = ids.map(id => { const a = ADVM[id], [x, y] = node(id), p = advProgress(id), cls = `adn f${a.frame} ${p.done ? 'done' : ''}`;
    const tip = `${a.name}${p.done ? '' : p.need > 1 ? ` (${p.have}/${p.need})` : ''}\n${a.desc}`;
    return `<div class="${cls}" style="left:calc(${x} * var(--px));top:calc(${y} * var(--px))" data-tip="${tip.replace(/"/g, '&quot;')}">${icon(advIcon(a.icon))}</div>`; }).join('');
  const tabH = tabs.map(([t, n]) => `<button class="advtab ${t === ADVUI.tab ? 'on' : ''}" data-advtab="${t}" title="${n}">${icon(advIcon(ADVM[t + '/root'].icon))}</button>`).join('');
  const name = (ADV_TABS.find(([t]) => t === ADVUI.tab) || [])[1];
  return `<div class="panel advp"><div class="advtabs">${tabH}</div><div class="cap">${name}</div><div class="advview" id="advview" style="background-image:var(--advbg-${ADVUI.tab}, var(--dirt))"><div class="advcanvas" style="width:calc(${24 + w * SX + 30} * var(--px));height:calc(${20 + h * SY + 30} * var(--px));transform:translate(${ADVUI.px}px,${ADVUI.py}px)"><svg viewBox="0 0 ${24 + w * SX + 30} ${20 + h * SY + 30}" preserveAspectRatio="none">${lines}</svg>${nodes}</div><div class="advtip" id="advtip" hidden></div></div></div>`;
}
document.addEventListener('click', e => { const t = e.target.closest('[data-advtab]'); if (t && advOpen()) { ADVUI.tab = t.dataset.advtab; ADVUI.px = ADVUI.py = 0; play('click', { vol: 0.3 }); if (UI.menu === 'advview') showMenu('advview'); else UI.renderScreen(); } });
document.addEventListener('pointerover', e => { if (!advOpen()) return; const n = e.target.closest('.adn'), tip = $('advtip'); if (!tip) return; if (!n) { tip.hidden = true; return; } const v = $('advview').getBoundingClientRect(), r = n.getBoundingClientRect(); tip.textContent = n.dataset.tip; tip.hidden = false; tip.style.left = Math.max(2, Math.min(r.left - v.left, v.width - tip.offsetWidth - 4)) + 'px'; tip.style.top = (r.bottom - v.top + tip.offsetHeight + 4 > v.height ? r.top - v.top - tip.offsetHeight - 2 : r.bottom - v.top + 2) + 'px'; });
const advOpen = () => UI.screen === 'adv' || UI.menu === 'advview';
// drag the tree around
let advDrag = null;
document.addEventListener('pointerdown', e => { if (advOpen() && e.target.closest('#advview')) advDrag = [e.clientX - ADVUI.px, e.clientY - ADVUI.py]; });
document.addEventListener('pointermove', e => { if (!advDrag) return; ADVUI.px = Math.min(0, e.clientX - advDrag[0]); ADVUI.py = Math.min(0, e.clientY - advDrag[1]); const c = document.querySelector('.advcanvas'); if (c) c.style.transform = `translate(${ADVUI.px}px,${ADVUI.py}px)`; });
document.addEventListener('pointerup', () => { advDrag = null; });

// ---------- every tick: honey block sliding, what the spyglass looks at, goats in boats ----------
function advTick() {
  if (!W.active || PL.dead) return;
  // sliding down the side of a honey block slows the fall (Java's honey slide) and counts for the advancement
  if (!PL.onGround && PL.vy < -0.08 && !PL.flying) {
    const x = PL.x, y = Math.floor(PL.y + 0.5), z = PL.z;
    for (const [dx, dz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) if (getBlock(Math.floor(x + dx), y, Math.floor(z + dz)) === BID.honey_block) { PL.vy = Math.max(PL.vy, -0.05); PL.fallDist = 0; advGrant('adventure/honey_block_slide'); break; }
  }
  // the spyglass: the mob nearest the middle of the view
  if (USE.kind === 'spy' && W.tickN % 5 === 0) {
    const [dx, dy, dz] = lookDir(); let best = null, bd = 0.9995;
    for (const e of ENT) { if (e.kind !== 'mob' || e.dead) continue; const ex = e.x - PL.x, ey = e.y + e.h / 2 - PL.y - PL.eyeH, ez = e.z - PL.z, l = Math.hypot(ex, ey, ez); if (l > 256 || l < 0.5) continue; const c = (ex * dx + ey * dy + ez * dz) / l; if (c > bd - (e.w + e.h) / l * 0.05) { bd = c; best = e; } }
    if (best) ADVT.spyglass(best);
  }
  // a goat that walks into the boat the player sits in takes the second seat
  const boat = PL.riding && PL.riding.kind === 'boat' ? PL.riding : null;
  if (boat && !seat2Busy(boat)) for (const o of ENT) if (o.kind === 'mob' && !o.dead && !o.def.hostile && o.w < 0.7 && !o.inBoat && !o.leashed && Math.hypot(o.x - boat.x, o.z - boat.z) < 0.9 && Math.abs(o.y - boat.y) < 0.8) { boat.mob = o; o.inBoat = boat; if (o.type === 'goat') advGrant('husbandry/ride_a_boat_with_a_goat'); break; }
}
// brewed potions picked up from a stand; bastion chests opened
const advScan0 = advScan;
advScan = function () {
  advScan0();
  for (const s of INV.slots) if (s && s.brewed) { delete s.brewed; if (ITEMS[s.id].potion && ITEMS[s.id].potion !== 'water') advGrant('nether/brew_potion'); }
};
{
  const open0 = UI.openScreen;
  UI.openScreen = (type, ctx) => {
    open0(type, ctx); if (type === 'chest') stat('open_chest'); if (type === 'trade') stat('talked_to_villager');
    if (type === 'chest' && W.dim === -1 && ctx && ctx.x != null) { const bx = Math.floor((ctx.x >> 4) / S.BREG), bz = Math.floor((ctx.z >> 4) / S.BREG); for (let i = bx - 1; i <= bx + 1; i++) for (let j = bz - 1; j <= bz + 1; j++) { const o = S.bastionAt(W.seed, i, j); if (o && Math.abs(ctx.x - o.x) < 40 && Math.abs(ctx.z - o.z) < 40) advGrant('nether/loot_bastion', 'loot_bastion_other'); } }
  };
}

// the title screen: pick a saved world and look at its advancements
function advWorldsHtml() {
  const total = ADV2.length;
  listWorlds().then(ws => {
    ws = (ws || []).filter(w => !w.remote).sort((a, b) => b.last - a.last); UI.advWorlds = ws; const el = $('advwl'); if (!el) return;
    el.innerHTML = ws.length ? ws.map(w => { const n = Object.values(w.adv2 || {}).filter(x => x && x.done).length; return `<div class="mpi"><div><b>${esc(w.name)}</b><span>${new Date(w.last).toLocaleString()} · ${MODE_NAME[w.mode] || w.mode} · 발전 과제 ${n}/${total}</span></div>${btn('보기', 'advw_' + w.id, 'sm')}</div>`; }).join('') : '<p class="muted mpempty">아직 세계가 없어요. 발전 과제는 세계마다 따로 기록됩니다.</p>';
  });
  return `<h2>발전 과제</h2><p class="muted">발전 과제는 세계마다 따로 기록됩니다. 볼 세계를 고르세요 (게임 중에는 L 키)</p><div class="wlist mpl" id="advwl"><p class="muted mpempty">불러오는 중...</p></div><div class="btncol">${btn('완료', 'title')}</div>`;
}

// The off hand (F swaps it with the main hand). Right-click uses the main-hand item first; when that has nothing to
// do (empty hand, a sword or pickaxe, a plain material) the off-hand item is used instead: a shield is raised, a torch
// or block placed, food eaten, a map shown. While an off-hand use lasts, the two hands are swapped behind the scenes
// so every item rule (consuming, durability, shield blocking) keeps working on the right stack.
const OFF = { swapped: false, slot: 0 };
const MAIN_USE_IDS = () => OFF.ids || (OFF.ids = new Set(['bow', 'crossbow', 'trident', 'shield', 'spyglass', 'bucket', 'water_bucket', 'lava_bucket', 'powder_snow_bucket', 'axolotl_bucket', 'tropical_fish_bucket', 'pufferfish_bucket', 'cod_bucket', 'salmon_bucket',
  'milk_bucket', 'flint_and_steel', 'fire_charge', 'ender_pearl', 'ender_eye', 'snowball', 'egg', 'experience_bottle', 'fishing_rod', 'oak_boat', 'bone_meal', 'map', 'writable_book', 'written_book', 'firework_rocket',
  'lead', 'carrot_on_a_stick', 'warped_fungus_on_a_stick', 'saddle', 'name_tag', 'shears', 'item_frame', 'glow_item_frame', 'painting', 'armor_stand', 'glass_bottle', 'honeycomb', 'compass', 'redstone', 'string', 'goat_horn'].map(k => IID[k])));
// (as Java: the main hand's use comes first and the off hand's only when that does nothing - an axe not aimed at a log,
// a block with nothing to put it against, food when full, a bow with no arrows)
const OFF_AXE = /(_log|_stem|_wood|_hyphae)$|copper/, OFF_SHOVEL = new Set(['grass_block', 'dirt', 'podzol', 'mycelium', 'coarse_dirt', 'rooted_dirt', 'campfire', 'soul_campfire']), OFF_HOE = new Set(['grass_block', 'dirt', 'dirt_path', 'coarse_dirt', 'rooted_dirt']);
function mainHandIdle(h) {
  if (!h) return true;
  const d = ITEMS[h.id], tb = TARGET && TARGET.type === 'block' ? TARGET : null, tk = tb && BLOCKS[tb.id] ? BLOCKS[tb.id].key || '' : '';
  if (d.tool) { const T = S.TOOL, t = d.tool.type; if (t === T.SWORD || t === T.PICK) return true;
    if (t === T.AXE) return !(tb && OFF_AXE.test(tk) && !/^stripped_/.test(tk)); if (t === T.SHOVEL) return !(tb && OFF_SHOVEL.has(tk)); if (t === T.HOE) return !(tb && OFF_HOE.has(tk)); return false; }
  if (d.food && !d.drink && h.id !== IID.milk_bucket) return !(PL.food < 20 || d.always || creative() || PL.difficulty === 0) && !(tb && (d.place != null || h.id === IID.glow_berries)); /* (full: nothing to eat; a carrot can still be planted) */
  if ((h.id === IID.bow || h.id === IID.crossbow) && !creative() && !h.ch && typeof arrowSlot === 'function' && arrowSlot() < 0) return true;
  if (d.place != null && !tb && !d.food) return true;
  return d.place == null && !d.food && !d.drink && !d.cart && !d.boat && !d.splash && !d.lingering && d.candle == null && !MAIN_USE_IDS().has(h.id) && !ITEMS[h.id].key.endsWith('_dye');
}
function offSwap() { const i = INV.sel, a = INV.slots[i]; INV.slots[i] = INV.off; INV.off = a; OFF.swapped = true; OFF.slot = i; UI.hudDirty = true; }
function offUnswap() { if (!OFF.swapped) return; const i = OFF.slot, a = INV.slots[i]; INV.slots[i] = INV.off; INV.off = a; OFF.swapped = false; UI.hudDirty = true; }
// player.js onUsePress: true when the off hand took the click
function offhandUse(press) {
  if (OFF.swapped || !INV.off || PL.sleeping) return false;
  if (!mainHandIdle(PL.held())) return false;
  if (TARGET && TARGET.type === 'block' && interactBlock(TARGET, true)) return false; // doors, chests... open with the main hand
  if (TARGET && TARGET.type === 'ent' && PL.held() === null && TARGET.e.kind === 'mob' && (TARGET.e.def.villager || TARGET.e.type === 'wandering_trader')) return false;
  offSwap(); press();
  if (!USE.kind || USE.kind === 'place') offUnswap(); // instant uses swap straight back; held uses wait for the release
  return true;
}
// keep the hands straight: the use ended, or the game is about to save
function offhandTick() { if (OFF.swapped && (!IN.use || !USE.kind || USE.kind === 'place' || INV.sel !== OFF.slot)) offUnswap(); }
function swapHands() {
  if (OFF.swapped) offUnswap();
  const i = INV.sel, a = INV.slots[i]; INV.slots[i] = INV.off; INV.off = a; USE.kind = null; UI.hudDirty = true; play('click', { vol: 0.3 });
}
// the HUD slot to the left of the hotbar
function offhandHud() {
  let el = $('offslot');
  if (!el) { el = document.createElement('div'); el.id = 'offslot'; el.className = 'hs'; $('hotbar').appendChild(el); }
  const s = OFF.swapped ? INV.slots[OFF.slot] : INV.off; el.hidden = !s; el.classList.toggle('right', OPT.mainHand === 'left'); el.innerHTML = s ? icon(s.id, s.n, s.d, s.e, s.col) : '';
}
const offItem = () => OFF.swapped ? INV.slots[OFF.slot] : INV.off;


// The off hand (F swaps it with the main hand). Right-click uses the main-hand item first; when that has nothing to
// do (empty hand, a sword or pickaxe, a plain material) the off-hand item is used instead: a shield is raised, a torch
// or block placed, food eaten, a map shown. While an off-hand use lasts, the two hands are swapped behind the scenes
// so every item rule (consuming, durability, shield blocking) keeps working on the right stack.
const OFF = { swapped: false, slot: 0 };
const MAIN_USE_IDS = () => OFF.ids || (OFF.ids = new Set(['bow', 'crossbow', 'trident', 'shield', 'spyglass', 'bucket', 'water_bucket', 'lava_bucket', 'powder_snow_bucket', 'axolotl_bucket', 'tropical_fish_bucket',
  'milk_bucket', 'flint_and_steel', 'fire_charge', 'ender_pearl', 'ender_eye', 'snowball', 'egg', 'experience_bottle', 'fishing_rod', 'oak_boat', 'bone_meal', 'map', 'writable_book', 'written_book', 'firework_rocket',
  'lead', 'carrot_on_a_stick', 'warped_fungus_on_a_stick', 'saddle', 'name_tag', 'shears', 'item_frame', 'glow_item_frame', 'painting', 'armor_stand', 'glass_bottle', 'honeycomb', 'compass', 'redstone', 'string'].map(k => IID[k])));
function mainHandIdle(h) {
  if (!h) return true;
  const d = ITEMS[h.id];
  if (d.tool) return d.tool.type === S.TOOL.SWORD || d.tool.type === S.TOOL.PICK;
  return d.place == null && !d.food && !d.drink && !d.cart && !d.splash && !d.lingering && d.candle == null && !MAIN_USE_IDS().has(h.id) && !ITEMS[h.id].key.endsWith('_dye');
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
  const s = OFF.swapped ? INV.slots[OFF.slot] : INV.off; el.hidden = !s; el.innerHTML = s ? icon(s.id, s.n, s.d, s.e) : '';
}
const offItem = () => OFF.swapped ? INV.slots[OFF.slot] : INV.off;

// ---------- armour drawn on the player model (third person) ----------
// boxes per slot: [bone, x0, y0, z0, w, h, d, grow] in the model's pixel coordinates (as HUM_BODY)
const PL_ARMOR_BOXES = [
  [['head', -4, -8, -4, 8, 8, 8, 1]],
  [['body', -4, 0, -2, 8, 12, 4, 1], ['rarm', -3, -2, -2, 4, 12, 4, 1], ['larm', -1, -2, -2, 4, 12, 4, 1]],
  [['body', -4, 7, -2, 8, 5, 4, 0.5], ['rleg', -2, 0, -2, 4, 9, 4, 0.5], ['lleg', -2, 0, -2, 4, 9, 4, 0.5]],
  [['rleg', -2, 8, -2, 4, 4, 4, 1], ['lleg', -2, 8, -2, 4, 4, 4, 1]],
];
const PLA = { key: '', meshes: [] };
function playerArmorTick(model, light) {
  const key = INV.armor.map(s => s ? s.id : 0).join(',');
  if (key !== PLA.key) {
    PLA.key = key; for (const m of PLA.meshes) { m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } PLA.meshes = [];
    const P = model.userData.parts;
    INV.armor.forEach((st, slot) => {
      if (!st) return;
      const a = ITEMS[st.id].armor, col = ARMOR_COL[a && a.mat] || (st.id === BID.pumpkin || st.id === BID.carved_pumpkin ? 0xe88a1a : st.id === BID.wither_skeleton_skull ? 0x2a2a2a : 0x888888);
      const boxes = a && a.mat === 'elytra' ? [['body', -5, 0, 2, 10, 14, 1, 0]] : PL_ARMOR_BOXES[slot];
      for (const [bone, x0, y0, z0, w, h, d, g] of boxes) {
        if (!P[bone]) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry((w + g * 2) / 16, (h + g * 2) / 16, (d + g * 2) / 16), new THREE.MeshBasicMaterial({ color: col }));
        m.position.set(-(x0 + w / 2) / 16, -(y0 + h / 2) / 16, (z0 + d / 2) / 16); m.userData.col = new THREE.Color(col);
        P[bone].add(m); PLA.meshes.push(m);
      }
    });
  }
  for (const m of PLA.meshes) m.material.color.copy(m.userData.col).multiplyScalar(light);
}

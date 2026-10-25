// Java Edition models for the mobs added after the first resource-pack pass, so they wear the Pixel Perfection CE
// textures instead of flat colours. Part boxes are Java's ModelPart definitions ([u, v, x, y, z, w, h, d, grow,
// mirror], pivots and rotations as in Java); part names follow the ones the animations already use.
const PI2 = Math.PI / 2;
// several pack textures alpha-composited (variant skins with markings, carpets, armour)
function packLayers(keys) {
  const key = 'L:' + keys.join('+'); if (entTex[key]) return entTex[key];
  const base = PACKPX.ent[keys[0]]; if (!base) return null;
  const px = new Uint8Array(base.px);
  for (const k of keys.slice(1)) { const o = PACKPX.ent[k]; if (!o || o.w !== base.w || o.h !== base.h) continue; for (let i = 0; i < px.length; i += 4) { const a = o.px[i + 3] / 255; if (!a) continue; for (let c = 0; c < 3; c++) px[i + c] = px[i + c] * (1 - a) + o.px[i + c] * a; px[i + 3] = Math.max(px[i + 3], o.px[i + 3]); } }
  const t = new THREE.DataTexture(px, base.w, base.h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return entTex[key] = t;
}
const QUAD4 = (lx, ly, fz, bz, u, v, w, h, d, uf, vf) => [ // four legs: front pair at fz, back pair at bz
  { n: 'rleg', o: [-lx, ly, fz], b: [[uf != null ? uf : u, vf != null ? vf : v, -w / 2, 0, -d / 2, w, h, d]] }, { n: 'lleg', o: [lx, ly, fz], b: [[uf != null ? uf : u, vf != null ? vf : v, -w / 2, 0, -d / 2, w, h, d, 0, 1]] },
  { n: 'rleg2', o: [-lx, ly, bz], b: [[u, v, -w / 2, 0, -d / 2, w, h, d]] }, { n: 'lleg2', o: [lx, ly, bz], b: [[u, v, -w / 2, 0, -d / 2, w, h, d, 0, 1]] }];

// ---------- horses, donkeys, mules, skeleton and zombie horses (64x64) ----------
const HORSE_PARTS = donkey => [
  { n: 'body', o: [0, 11, 5], b: [[0, 32, -5, -8, -17, 10, 10, 22, 0.05]] },
  { n: 'tail', p: 'body', o: [0, -5, 2], r: [0.5236, 0, 0], b: [[42, 36, -1.5, 0, 0, 3, 14, 4]] },
  { n: 'saddle', p: 'body', o: [0, 0, 0], b: [[26, 0, -5, -8, -9, 10, 9, 9, 0.5]] },
  { n: 'rchest', p: 'body', o: [-8.5, -3, 3], r: [0, PI2, 0], b: [[26, 21, -3, 0, 0, 8, 8, 3]] }, { n: 'lchest', p: 'body', o: [5.5, -3, 3], r: [0, PI2, 0], b: [[26, 21, -3, 0, 0, 8, 8, 3]] },
  { n: 'neck', o: [0, 4, -12], r: [0.5236, 0, 0], b: [[0, 35, -2.05, -6, -2, 4, 12, 7]] },
  { n: 'head', p: 'neck', o: [0, 0, 0], b: [[0, 13, -3, -11, -2, 6, 5, 7], [0, 25, -2, -11, -7, 4, 5, 5]] },
  { n: 'mane', p: 'neck', o: [0, 0, 0], b: [[56, 36, -1, -11, 5.01, 2, 16, 2]] },
  ...(donkey ? [{ n: 'ear1', p: 'head', o: [1.25, -10, 4], r: [0, 0, 0.2618], b: [[0, 12, -1, -7, 0, 2, 7, 1]] }, { n: 'ear2', p: 'head', o: [-1.25, -10, 4], r: [0, 0, -0.2618], b: [[0, 12, -1, -7, 0, 2, 7, 1]] }]
    : [{ n: 'ear1', p: 'head', o: [0, 0, 0], b: [[19, 16, 0.55, -13, 4, 2, 3, 1, -0.001]] }, { n: 'ear2', p: 'head', o: [0, 0, 0], b: [[19, 16, -2.55, -13, 4, 2, 3, 1, -0.001]] }]),
  { n: 'rleg', o: [-4, 14, -12], b: [[48, 21, -1, -1.01, -1.9, 4, 11, 4]] }, { n: 'lleg', o: [4, 14, -12], b: [[48, 21, -3, -1.01, -1.9, 4, 11, 4, 0, 1]] },
  { n: 'rleg2', o: [-4, 14, 7], b: [[48, 21, -1, -1.01, -1, 4, 11, 4]] }, { n: 'lleg2', o: [4, 14, 7], b: [[48, 21, -3, -1.01, -1, 4, 11, 4, 0, 1]] },
];
const HORSE_COLS = ['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'darkbrown', 'skeleton', 'zombie'], HORSE_MARKS = [null, 'white', 'whitefield', 'whitedots', 'blackdots'];
const HORSE_ARMOR_TEX = { leather_horse_armor: 'horse_armor_leather', iron_horse_armor: 'horse_armor_iron', golden_horse_armor: 'horse_armor_gold', diamond_horse_armor: 'horse_armor_diamond' };
function horseSkin(e) {
  const keys = e.type === 'donkey' || e.type === 'mule' ? [e.type] : e.type === 'skeleton_horse' ? ['horse_skeleton'] : e.type === 'zombie_horse' ? ['horse_zombie'] : ['horse_' + HORSE_COLS[(e.variant || 0) & 15]];
  const mk = HORSE_MARKS[((e.variant || 0) >> 4) & 7]; if (mk && e.type === 'horse') keys.push('horse_markings_' + mk);
  return packLayers(keys);
}
// ---------- cats and ocelots (64x32, Java OcelotModel) ----------
const CAT_TEX = ['tabby', 'black', 'red', 'siamese', 'british_shorthair', 'calico', 'persian', 'ragdoll', 'white', 'jellie', 'all_black', 'ocelot'];
const CAT_PARTS = [
  { n: 'head', o: [0, 15, -9], b: [[0, 0, -2.5, -2, -3, 5, 4, 5], [0, 24, -1.5, 0, -4, 3, 2, 2], [0, 10, -2, -3, 0, 1, 1, 2], [6, 10, 1, -3, 0, 1, 1, 2]] },
  { n: 'body', o: [0, 12, -10], r: [PI2, 0, 0], b: [[20, 0, -2, 3, -8, 4, 16, 6]] },
  { n: 'tail', o: [0, 15, 8], r: [0.9, 0, 0], b: [[0, 15, -0.5, 0, 0, 1, 8, 1]] }, { n: 'tail2', p: 'tail', o: [0, 8, 0], r: [0.6, 0, 0], b: [[4, 15, -0.5, 0, 0, 1, 8, 1]] },
  { n: 'rleg', o: [-1.2, 14.1, -5], b: [[40, 0, -1, 0, 0, 2, 10, 2]] }, { n: 'lleg', o: [1.2, 14.1, -5], b: [[40, 0, -1, 0, 0, 2, 10, 2]] },
  { n: 'rleg2', o: [-1.1, 18, 5], b: [[8, 13, -1, 0, 1, 2, 6, 2]] }, { n: 'lleg2', o: [1.1, 18, 5], b: [[8, 13, -1, 0, 1, 2, 6, 2]] },
];
// ---------- rabbits (64x32) ----------
const RABBIT_TEX = ['brown', 'white', 'black', 'white_splotched', 'gold', 'salt', 'toast', 'caerbannog'];
const RABBIT_PARTS = [
  { n: 'lleg2', o: [3, 17.5, 3.7], b: [[26, 24, -1, 5.5, -3.7, 2, 1, 7, 0, 1], [30, 15, -1, 0, 0, 2, 4, 5, 0, 1]] }, { n: 'rleg2', o: [-3, 17.5, 3.7], b: [[8, 24, -1, 5.5, -3.7, 2, 1, 7], [16, 15, -1, 0, 0, 2, 4, 5]] },
  { n: 'body', o: [0, 19, 8], r: [-0.349, 0, 0], b: [[0, 0, -3, -2, -10, 6, 5, 10]] },
  { n: 'lleg', o: [3, 17, -1], r: [-0.1745, 0, 0], b: [[8, 15, -1, 0, -1, 2, 7, 2, 0, 1]] }, { n: 'rleg', o: [-3, 17, -1], r: [-0.1745, 0, 0], b: [[0, 15, -1, 0, -1, 2, 7, 2]] },
  { n: 'head', o: [0, 16, -1], b: [[32, 0, -2.5, -4, -5, 5, 4, 5], [32, 9, -0.5, -2.5, -5.5, 1, 1, 1]] },
  { n: 'ear1', p: 'head', o: [0, 0, 0], r: [0, -0.2618, 0], b: [[52, 0, -2.5, -9, -1, 2, 5, 1]] }, { n: 'ear2', p: 'head', o: [0, 0, 0], r: [0, 0.2618, 0], b: [[58, 0, 0.5, -9, -1, 2, 5, 1, 0, 1]] },
  { n: 'tail', o: [0, 20, 7], r: [-0.349, 0, 0], b: [[52, 6, -1.5, -1.5, 0, 3, 3, 2]] },
];
// ---------- foxes (48x32) ----------
const FOX_PARTS = [
  { n: 'head', o: [-1, 16.5, -3], b: [[1, 5, -3, -2, -5, 8, 6, 6], [8, 1, -3, -4, -4, 2, 2, 1], [15, 1, 3, -4, -4, 2, 2, 1], [6, 18, -1, 2.01, -8, 4, 2, 3]] },
  { n: 'body', o: [0, 16, -6], r: [PI2, 0, 0], b: [[24, 15, -3, 3.999, -3.5, 6, 11, 6]] },
  { n: 'tail', p: 'body', o: [-4, 15, -1], r: [-0.05, 0, 0], b: [[30, 0, 2, 0, -1, 4, 9, 5]] },
  { n: 'rleg2', o: [-5, 17.5, 7], b: [[13, 24, 2, 0.5, -1, 2, 6, 2, 0.001]] }, { n: 'lleg2', o: [-1, 17.5, 7], b: [[4, 24, 2, 0.5, -1, 2, 6, 2, 0.001]] },
  { n: 'rleg', o: [-5, 17.5, 0], b: [[13, 24, 2, 0.5, -1, 2, 6, 2, 0.001]] }, { n: 'lleg', o: [-1, 17.5, 0], b: [[4, 24, 2, 0.5, -1, 2, 6, 2, 0.001]] },
];
// ---------- bees (64x64) ----------
const BEE_PARTS = [
  { n: 'bone', o: [0, 19, 0], b: [] },
  { n: 'body', p: 'bone', o: [0, 0, 0], b: [[0, 0, -3.5, -4, -5, 7, 7, 10], [26, 7, 0, -1, 5, 0, 1, 2]] },
  { n: 'ant1', p: 'body', o: [0, -2, -5], b: [[2, 0, 1.5, -2, -3, 1, 2, 3]] }, { n: 'ant2', p: 'body', o: [0, -2, -5], b: [[2, 3, -2.5, -2, -3, 1, 2, 3]] },
  { n: 'rwing', p: 'bone', o: [-1.5, -4, -3], r: [0, -0.2618, 0], b: [[0, 18, -9, 0, 0, 9, 0, 6]] }, { n: 'lwing', p: 'bone', o: [1.5, -4, -3], r: [0, 0.2618, 0], b: [[0, 18, 0, 0, 0, 9, 0, 6, 0, 1]] },
  { n: 'legs1', p: 'bone', o: [1.5, 3, -2], b: [[26, 1, -5, 0, 0, 7, 2, 0]] }, { n: 'legs2', p: 'bone', o: [1.5, 3, 0], b: [[26, 3, -5, 0, 0, 7, 2, 0]] }, { n: 'legs3', p: 'bone', o: [1.5, 3, 2], b: [[26, 5, -5, 0, 0, 7, 2, 0]] },
];
// ---------- illagers, the witch, the wandering trader (villager-shaped) ----------
const ILLAGER_PARTS = [
  { n: 'head', o: [0, 0, 0], b: [[0, 0, -4, -10, -4, 8, 10, 8]] },
  { n: 'nose', p: 'head', o: [0, -2, 0], b: [[24, 0, -1, -1, -6, 2, 4, 2]] },
  { n: 'body', o: [0, 0, 0], b: [[16, 20, -4, 0, -3, 8, 12, 6], [0, 38, -4, 0, -3, 8, 18, 6, 0.5]] },
  { n: 'arms', o: [0, 3, -1], r: [-0.75, 0, 0], b: [[44, 22, -8, -2, -2, 4, 8, 4], [44, 22, 4, -2, -2, 4, 8, 4, 0, 1], [40, 38, -4, 2, -2, 8, 4, 4]] },
  { n: 'rleg', o: [-2, 12, 0], b: [[0, 22, -2, 0, -2, 4, 12, 4]] }, { n: 'lleg', o: [2, 12, 0], b: [[0, 22, -2, 0, -2, 4, 12, 4, 0, 1]] },
  { n: 'rarm', o: [-5, 2, 0], b: [[40, 46, -3, -2, -2, 4, 12, 4]] }, { n: 'larm', o: [5, 2, 0], b: [[40, 46, -1, -2, -2, 4, 12, 4, 0, 1]] },
];
const WITCH_PARTS = [...MCMODELS.villager.parts,
  { n: 'hat', p: 'head', o: [-5, -10.03, -5], b: [[0, 64, 0, 0, 0, 10, 2, 10]] },
  { n: 'hat2', p: 'hat', o: [1.75, -4, 2], r: [-0.0524, 0, 0.0262], b: [[0, 76, 0, 0, 0, 7, 4, 7]] },
  { n: 'hat3', p: 'hat2', o: [1.75, -4, 2], r: [-0.1047, 0, 0.0524], b: [[0, 87, 0, 0, 0, 4, 4, 4]] },
  { n: 'hat4', p: 'hat3', o: [1.75, -2, 2], r: [-0.2094, 0, 0.1047], b: [[0, 95, 0, 0, 0, 1, 2, 1, 0.25]] },
];
// ---------- snow golem (64x64; the pumpkin is a real block on its head) ----------
const SNOWG_PARTS = [
  { n: 'head', o: [0, 4, 0], b: [[0, 0, -4, -8, -4, 8, 8, 8, -0.5]] },
  { n: 'rarm', o: [-5, 6, 0], r: [0, 0, -1], b: [[32, 0, -11, 0, -1, 12, 2, 2, -0.5]] }, { n: 'larm', o: [5, 6, 0], r: [0, 0, 1], b: [[32, 0, -1, 0, -1, 12, 2, 2, -0.5]] },
  { n: 'mid', o: [0, 13, 0], b: [[0, 16, -5, -10, -5, 10, 10, 10, -0.5]] },
  { n: 'body', o: [0, 24, 0], b: [[0, 36, -6, -12, -6, 12, 12, 12, -0.5]] },
];
// ---------- polar bear (128x64) ----------
const BEAR_PARTS = [
  { n: 'head', o: [0, 10, -16], b: [[0, 0, -3.5, -3, -3, 7, 7, 7], [0, 44, -2.5, 1, -6, 5, 3, 3], [26, 0, -4.5, -4, -1, 2, 2, 1], [26, 0, 2.5, -4, -1, 2, 2, 1, 0, 1]] },
  { n: 'body', o: [-2, 9, 12], r: [PI2, 0, 0], b: [[0, 19, -5, -13, -7, 14, 14, 11], [39, 0, -4, -25, -7, 12, 12, 10]] },
  { n: 'rleg2', o: [-4.5, 14, 6], b: [[50, 22, -2, 0, -2, 4, 10, 8]] }, { n: 'lleg2', o: [4.5, 14, 6], b: [[50, 22, -2, 0, -2, 4, 10, 8]] },
  { n: 'rleg', o: [-3.5, 14, -8], b: [[50, 40, -2, 0, -2, 4, 10, 6]] }, { n: 'lleg', o: [3.5, 14, -8], b: [[50, 40, -2, 0, -2, 4, 10, 6]] },
];
// ---------- panda (64x64) ----------
const PANDA_TEX = { normal: 'panda', lazy: 'lazy_panda', worried: 'worried_panda', playful: 'playful_panda', aggressive: 'aggressive_panda', weak: 'weak_panda', brown: 'brown_panda' };
const PANDA_PARTS = [
  { n: 'head', o: [0, 11.5, -17], b: [[0, 6, -6.5, -5, -4, 13, 10, 9], [45, 16, -3.5, 0, -6, 7, 5, 2], [52, 25, -8.5, -8, -1, 5, 4, 1], [52, 25, 3.5, -8, -1, 5, 4, 1]] },
  { n: 'body', o: [0, 10, 0], r: [PI2, 0, 0], b: [[0, 25, -9.5, -13, -6.5, 19, 26, 13]] },
  ...QUAD4(5.5, 15, -9, 9, 40, 0, 6, 9, 6),
];
// ---------- llamas (128x64; carpets are a second texture painted over the body) ----------
const LLAMA_TEX = ['creamy', 'white', 'brown', 'gray'];
const LLAMA_PARTS = [
  { n: 'head', o: [0, 7, -6], b: [[0, 0, -2, -14, -10, 4, 4, 9], [0, 14, -4, -16, -6, 8, 18, 6], [17, 0, -4, -19, -4, 3, 3, 2], [17, 0, 1, -19, -4, 3, 3, 2]] },
  { n: 'body', o: [0, 5, 2], r: [PI2, 0, 0], b: [[29, 0, -6, -10, -7, 12, 18, 10]] },
  { n: 'rchest', o: [-8.5, 3, 3], r: [0, PI2, 0], b: [[45, 28, -3, 0, 0, 8, 8, 3]] }, { n: 'lchest', o: [5.5, 3, 3], r: [0, PI2, 0], b: [[45, 41, -3, 0, 0, 8, 8, 3]] },
  { n: 'rleg2', o: [-3.5, 10, 6], b: [[29, 29, -2, 0, -2, 4, 14, 4]] }, { n: 'lleg2', o: [3.5, 10, 6], b: [[29, 29, -2, 0, -2, 4, 14, 4]] },
  { n: 'rleg', o: [-3.5, 10, -5], b: [[29, 29, -2, 0, -2, 4, 14, 4]] }, { n: 'lleg', o: [3.5, 10, -5], b: [[29, 29, -2, 0, -2, 4, 14, 4]] },
];
// ---------- parrots (32x32) ----------
const PARROT_TEX = ['red_blue', 'blue', 'green', 'yellow_blue', 'grey'];
const PARROT_PARTS = [
  { n: 'body', o: [0, 16.5, -3], r: [0.4937, 0, 0], b: [[2, 8, -1.5, 0, -1.5, 3, 6, 3]] },
  { n: 'tail', o: [0, 21.07, 1.16], r: [1.015, 0, 0], b: [[22, 1, -1.5, -1, -1, 3, 4, 1]] },
  { n: 'lwing', o: [1.5, 16.94, -2.76], r: [-0.6981, -Math.PI, 0], b: [[19, 8, -0.5, 0, -1.5, 1, 5, 3]] }, { n: 'rwing', o: [-1.5, 16.94, -2.76], r: [-0.6981, -Math.PI, 0], b: [[19, 8, -0.5, 0, -1.5, 1, 5, 3]] },
  { n: 'head', o: [0, 15.69, -2.76], b: [[2, 2, -1, -1.5, -1, 2, 3, 2]] },
  { n: 'head2', p: 'head', o: [0, -2, -1], b: [[10, 0, -1, -0.5, -2, 2, 1, 4]] },
  { n: 'beak1', p: 'head', o: [0, -0.5, -1.5], b: [[11, 7, -0.5, -1, -0.5, 1, 2, 1]] }, { n: 'beak2', p: 'head', o: [0, -1.75, -2.45], b: [[16, 7, -0.5, 0, -0.5, 1, 2, 1]] },
  { n: 'feather', p: 'head', o: [0, -2.15, 0.15], r: [-0.2214, 0, 0], b: [[2, 18, 0, -4, -2, 0, 5, 4]] },
  { n: 'lleg', o: [1, 22, -1.05], r: [-0.0299, 0, 0], b: [[14, 18, -0.5, 0, -0.5, 1, 2, 1]] }, { n: 'rleg', o: [-1, 22, -1.05], r: [-0.0299, 0, 0], b: [[14, 18, -0.5, 0, -0.5, 1, 2, 1]] },
];
// ---------- sea turtle (128x64) ----------
const TURTLE_PARTS = [
  { n: 'head', o: [0, 19, -10], b: [[3, 0, -3, -1, -3, 6, 5, 6]] },
  { n: 'body', o: [0, 11, -10], r: [PI2, 0, 0], b: [[7, 37, -9.5, 3, -10, 19, 20, 6], [31, 1, -5.5, 3, -13, 11, 18, 3]] },
  { n: 'rleg2', o: [-3.5, 22, 11], b: [[1, 23, -2, 0, 0, 4, 1, 10]] }, { n: 'lleg2', o: [3.5, 22, 11], b: [[1, 12, -2, 0, 0, 4, 1, 10]] },
  { n: 'rleg', o: [-5, 21, -4], b: [[27, 30, -13, 0, -2, 13, 1, 5]] }, { n: 'lleg', o: [5, 21, -4], b: [[27, 24, 0, 0, -2, 13, 1, 5]] },
];
// ---------- dolphin (64x64) ----------
const DOLPHIN_PARTS = [
  { n: 'body', o: [0, 22, -5], b: [[22, 0, -4, -7, 0, 8, 7, 13]] },
  { n: 'fin', p: 'body', o: [0, 0, 0], r: [1.0472, 0, 0], b: [[51, 0, -0.5, 0, 8, 1, 4, 5]] },
  { n: 'lfin', p: 'body', o: [2, -2, 4], r: [1.0472, 0, 2.0944], b: [[48, 20, -0.5, -4, 0, 1, 4, 7, 0, 1]] }, { n: 'rfin', p: 'body', o: [-2, -2, 4], r: [1.0472, 0, -2.0944], b: [[48, 20, -0.5, -4, 0, 1, 4, 7]] },
  { n: 'tail', p: 'body', o: [0, -2.5, 11], r: [-0.1047, 0, 0], b: [[0, 19, -2, -2.5, 0, 4, 5, 11]] },
  { n: 'fluke', p: 'tail', o: [0, 0, 9], b: [[19, 20, -5, -0.5, 0, 10, 1, 6]] },
  { n: 'head', p: 'body', o: [0, -4, -3], b: [[0, 0, -4, -3, -3, 8, 7, 6], [0, 13, -1, 2, -7, 2, 2, 4]] },
];
// ---------- phantom (64x64) ----------
const PHANTOM_PARTS = [
  { n: 'body', o: [0, 20, 0], r: [-0.1, 0, 0], b: [[0, 8, -3, -2, -8, 5, 3, 9]] },
  { n: 'tail', p: 'body', o: [0, -2, 1], b: [[3, 20, -2, 0, 0, 3, 2, 6]] }, { n: 'tail2', p: 'tail', o: [0, 0.5, 6], b: [[4, 29, -1, 0, 0, 1, 1, 6]] },
  { n: 'lwing', p: 'body', o: [2, -2, -8], b: [[23, 12, 0, 0, 0, 6, 2, 9]] }, { n: 'lwing2', p: 'lwing', o: [6, 0, 0], b: [[16, 24, 0, 0, 0, 13, 1, 9]] },
  { n: 'rwing', p: 'body', o: [-3, -2, -8], b: [[23, 12, -6, 0, 0, 6, 2, 9, 0, 1]] }, { n: 'rwing2', p: 'rwing', o: [-6, 0, 0], b: [[16, 24, -13, 0, 0, 13, 1, 9, 0, 1]] },
  { n: 'head', p: 'body', o: [0, 1, -7], r: [0.2, 0, 0], b: [[0, 0, -4, -2, -5, 7, 3, 5]], e: 1 },
];
// ---------- ravager (128x128) ----------
const RAVAGER_PARTS = [
  { n: 'neck', o: [0, -7, 5.5], b: [[68, 73, -5, -1, -18, 10, 10, 18]] },
  { n: 'head', p: 'neck', o: [0, 16, -17], b: [[0, 0, -8, -20, -14, 16, 20, 16], [0, 0, -2, -6, -18, 4, 8, 4]] },
  { n: 'horns', p: 'head', o: [0, -14, -2], r: [1.0996, 0, 0], b: [[74, 55, -10, -14, -8, 2, 14, 4], [74, 55, 8, -14, -8, 2, 14, 4, 0, 1]] },
  { n: 'mouth', p: 'head', o: [0, -2, 2], b: [[0, 36, -8, 0, -16, 16, 3, 16]] },
  { n: 'body', o: [0, 1, 2], r: [PI2, 0, 0], b: [[0, 55, -7, -10, -7, 14, 16, 20], [0, 91, -6, 6, -7, 12, 13, 18]] },
  { n: 'rleg2', o: [-8, -13, 18], b: [[96, 0, -4, 0, -4, 8, 37, 8]] }, { n: 'lleg2', o: [8, -13, 18], b: [[96, 0, -4, 0, -4, 8, 37, 8, 0, 1]] },
  { n: 'rleg', o: [-8, -13, -5], b: [[64, 0, -4, 0, -4, 8, 37, 8]] }, { n: 'lleg', o: [8, -13, -5], b: [[64, 0, -4, 0, -4, 8, 37, 8, 0, 1]] },
];
// ---------- vex (64x64, a small winged humanoid) ----------
const VEX_PARTS = [...HUM_BODY(false).filter(p => p.n !== 'rleg' && p.n !== 'lleg'),
  { n: 'rleg', o: [-1.9, 12, 0], b: [[32, 0, -1, -1, -2, 6, 10, 4]] },
  { n: 'rwing', o: [0, 0, 0], b: [[0, 32, -20, 0, 0, 20, 12, 1]] }, { n: 'lwing', o: [0, 0, 0], b: [[0, 32, 0, 0, 0, 20, 12, 1, 0, 1]] },
];
// ---------- guardians (64x64) ----------
const GUARDIAN_SPIKES = [[1.75, 0, 0, -1, 0, 0], [-1.75, 0, 0, 1, 0, 0], [0, 0, 1.75, 0, 0, 1], [0, 0, -1.75, 0, 0, -1], [1.25, -1.25, 1.25, 1, -1, 1], [-1.25, -1.25, 1.25, -1, -1, 1], [1.25, 1.25, -1.25, 1, 1, -1], [-1.25, 1.25, -1.25, -1, 1, -1]];
const GUARDIAN_PARTS = [
  { n: 'head', o: [0, 0, 0], b: [[0, 0, -6, 10, -8, 12, 12, 16], [0, 28, -8, 10, -6, 2, 12, 12], [0, 28, 6, 10, -6, 2, 12, 12, 0, 1], [16, 40, -6, 8, -6, 12, 2, 12], [16, 40, -6, 22, -6, 12, 2, 12]] },
  { n: 'eye', p: 'head', o: [0, 0, -8.25], b: [[8, 0, -1, 15, 0, 2, 2, 1]] },
  { n: 'tail1', p: 'head', o: [0, 0, 0], b: [[40, 0, -2, 14, 7, 4, 4, 8]] },
  { n: 'tail2', p: 'tail1', o: [-1.5, 0.5, 14], b: [[0, 54, 0, 14, 0, 3, 3, 7]] },
  { n: 'tail3', p: 'tail2', o: [0.5, 0.5, 6], b: [[41, 32, 0, 14, 0, 2, 2, 6], [25, 19, 1, 10.5, 3, 1, 9, 9]] },
  ...GUARDIAN_SPIKES.map(([x, y, z, ax, ay, az], i) => ({ n: 'sp' + i, p: 'head', o: [x * 8, 16 + y * 8, z * 8], r: [az ? az * PI2 * (ay ? 0.5 : 1) : 0, 0, ax ? -ax * PI2 * (ay ? 0.5 : 1) : 0], b: [[0, 0, -1, -4.5, -1, 2, 9, 2]] })),
];
// ---------- wither (64x64) ----------
const WITHER_PARTS = [
  { n: 'spine', o: [0, 0, 0], b: [[0, 16, -10, 3.9, -0.5, 20, 3, 3]] },
  { n: 'ribs', o: [-2, 6.9, -0.5], r: [0.065, 0, 0], b: [[0, 22, 0, 0, 0, 3, 10, 3], [24, 22, -4, 1.5, 0.5, 11, 2, 2], [24, 22, -4, 4, 0.5, 11, 2, 2], [24, 22, -4, 6.5, 0.5, 11, 2, 2]] },
  { n: 'tail', o: [-2, 16.9, 0], r: [0.83, 0, 0], b: [[12, 22, 0, 0, 0, 3, 6, 3]] },
  { n: 'head', o: [0, 4, 0], b: [[0, 0, -4, -4, -4, 8, 8, 8]] },
  { n: 'head2', o: [-8, 4, 0], b: [[32, 0, -4, -4, -4, 6, 6, 6]] }, { n: 'head3', o: [10, 4, 0], b: [[32, 0, -4, -4, -4, 6, 6, 6]] },
];
// ---------- pufferfish (32x32, the puffed-up model) ----------
const PUFFER_PARTS = [
  { n: 'body', o: [0, 22, 0], b: [[0, 0, -4, -8, -4, 8, 8, 8]] },
  { n: 'rfin', o: [-4, 15, -2], b: [[24, 0, -2, 0, -1, 2, 1, 2]] }, { n: 'lfin', o: [4, 15, -2], b: [[24, 3, 0, 0, -1, 2, 1, 2]] },
  { n: 'spikes', o: [0, 14, -4], b: [[15, 17, -4, -1, 0, 8, 1, 0], [14, 16, -4, -1, 8, 8, 1, 1], [23, 18, -4, 0, 0, 1, 8, 1], [5, 17, -4, 0, 8, 1, 8, 1]] },
];

// Java draws horse armour and llama carpets on a slightly larger copy of the model with their own texture
const layerOf = (parts, names, grow) => parts.filter(p => names.includes(p.n)).map(p => ({ n: 'L_' + p.n, p: p.n, o: [0, 0, 0], t: 1, b: p.b.map(b => [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], (b[8] || 0) + grow, b[9]]) }));
const HORSE_LAYER = layerOf(HORSE_PARTS(false), ['body', 'neck', 'head', 'ear1', 'ear2', 'rleg', 'lleg', 'rleg2', 'lleg2'], 0.1);
const LLAMA_LAYER = layerOf(LLAMA_PARTS, ['head', 'body', 'rleg', 'lleg', 'rleg2', 'lleg2'], 0.5);
Object.assign(MCMODELS, {
  horse: { tex: 'horse_brown', tex2: 'horse_armor_iron', tw: 64, th: 64, parts: [...HORSE_PARTS(false), ...HORSE_LAYER] }, skeleton_horse: { tex: 'horse_skeleton', tw: 64, th: 64, parts: HORSE_PARTS(false) }, zombie_horse: { tex: 'horse_zombie', tw: 64, th: 64, parts: HORSE_PARTS(false) },
  donkey: { tex: 'donkey', tw: 64, th: 64, parts: HORSE_PARTS(true) }, mule: { tex: 'mule', tw: 64, th: 64, parts: HORSE_PARTS(true) },
  cat: { tex: 'cat_tabby', tw: 64, th: 32, parts: CAT_PARTS, scale: 0.8 }, ocelot: { tex: 'cat_ocelot', tw: 64, th: 32, parts: CAT_PARTS },
  rabbit: { tex: 'rabbit_brown', tw: 64, th: 32, parts: RABBIT_PARTS, scale: 0.6 }, fox: { tex: 'fox', tw: 48, th: 32, parts: FOX_PARTS }, bee: { tex: 'bee', tw: 64, th: 64, parts: BEE_PARTS },
  pillager: { tex: 'pillager', tw: 64, th: 64, parts: ILLAGER_PARTS }, vindicator: { tex: 'vindicator', tw: 64, th: 64, parts: ILLAGER_PARTS }, evoker: { tex: 'evoker', tw: 64, th: 64, parts: ILLAGER_PARTS },
  witch: { tex: 'witch', tw: 64, th: 128, parts: WITCH_PARTS }, wandering_trader: { tex: 'wandering_trader', tw: 64, th: 64, parts: MCMODELS.villager.parts },
  snow_golem: { tex: 'snow_golem', tw: 64, th: 64, parts: SNOWG_PARTS }, polar_bear: { tex: 'polar_bear', tw: 128, th: 64, parts: BEAR_PARTS, scale: 1.2 },
  panda: { tex: 'panda', tw: 64, th: 64, parts: PANDA_PARTS }, llama: { tex: 'llama_creamy', tex2: 'llama_decor_white', tw: 128, th: 64, parts: [...LLAMA_PARTS, ...LLAMA_LAYER] }, trader_llama: { tex: 'llama_creamy', tex2: 'llama_decor_trader_llama', tw: 128, th: 64, parts: [...LLAMA_PARTS, ...LLAMA_LAYER] },
  parrot: { tex: 'parrot_red_blue', tw: 32, th: 32, parts: PARROT_PARTS }, turtle: { tex: 'turtle', tw: 128, th: 64, parts: TURTLE_PARTS }, dolphin: { tex: 'dolphin', tw: 64, th: 64, parts: DOLPHIN_PARTS },
  phantom: { tex: 'phantom', eyes: 'phantom_eyes', tw: 64, th: 64, parts: PHANTOM_PARTS }, cave_spider: { ...MCMODELS.spider, tex: 'cave_spider' },
  mooshroom: { ...MCMODELS.cow, tex: 'red_mooshroom' }, ravager: { tex: 'ravager', tw: 128, th: 128, parts: RAVAGER_PARTS }, vex: { tex: 'vex', tw: 64, th: 64, parts: VEX_PARTS, scale: 0.4 },
  guardian: { tex: 'guardian', tw: 64, th: 64, parts: GUARDIAN_PARTS }, elder_guardian: { tex: 'guardian_elder', tw: 64, th: 64, parts: GUARDIAN_PARTS },
  wither: { tex: 'wither', tw: 64, th: 64, parts: WITHER_PARTS, scale: 2 }, pufferfish: { tex: 'pufferfish', tw: 32, th: 32, parts: PUFFER_PARTS, scale: 0.6 },
  zombie_villager: { ...MCMODELS.villager, tex: 'zombie_villager' },
});
// variants pick their own pack texture
const MCVTEX = {
  horse: e => horseSkin(e), donkey: horseSkin, mule: horseSkin, skeleton_horse: horseSkin, zombie_horse: horseSkin,
  cat: e => packTexture('cat_' + (CAT_TEX[e.variant] || 'tabby')), ocelot: () => packTexture('cat_ocelot'),
  rabbit: e => packTexture('rabbit_' + (RABBIT_TEX[e.variant] || 'brown')), fox: e => packTexture(e.variant === 1 ? 'snow_fox' : 'fox'),
  parrot: e => packTexture('parrot_' + (PARROT_TEX[e.variant] || 'red_blue')),
  llama: e => packTexture('llama_' + (LLAMA_TEX[e.variant] || 'creamy')), trader_llama: e => packTexture('llama_' + (LLAMA_TEX[e.variant] || 'creamy')),
  panda: e => packTexture(PANDA_TEX[e.gene ? pandaShown(e) : null] || (e.variant === 1 ? 'brown_panda' : 'panda')),
  bee: e => packTexture(e.target ? (e.nectar ? 'bee_angry_nectar' : 'bee_angry') : e.nectar ? 'bee_nectar' : 'bee'),
  zombie_villager: e => packLayers(['zv_zombie_villager', ...(e.prof ? ['zv_' + e.prof] : [])]),
};
const LAYER_TEX = { horse: e => e.harmor && HORSE_ARMOR_TEX[e.harmor], llama: e => e.carpet != null && 'llama_decor_' + S.COLORS[e.carpet], trader_llama: () => 'llama_decor_trader_llama' };
// skins are refreshed when what decides them changes (armour, carpets, genes, anger)
const skinKey = e => [e.variant, e.harmor, e.carpet, e.gene, e.gene2, !!e.target, e.nectar, e.prof].join('|');
function mcSkinTick() {
  if (W.tickN % 10) return;
  for (const e of ENT) {
    if (e.kind !== 'mob' || !e.mesh || !MCVTEX[e.type] || !e.mesh.userData.mc) continue;
    const k = skinKey(e); if (e.skinK === k) continue; e.skinK = k;
    const t = MCVTEX[e.type](e); if (!t) continue;
    e.mesh.userData.mat.map = t; e.mesh.userData.mat.needsUpdate = true;
    if (e.matOwn) for (const m of e.mesh.userData.own) if (m.map && m.skinning && !m.userData.layer) { m.map = t; m.needsUpdate = true; }
    // the armour / carpet layer
    const lk = LAYER_TEX[e.type] && LAYER_TEX[e.type](e), lt = lk && packTexture(lk);
    for (const n in e.mesh.userData.parts) if (n.startsWith('L_')) hidePart(e, n, !!lt);
    if (lt) for (const m of [...e.mesh.userData.mats, ...(e.matOwn ? e.mesh.userData.own : [])]) if (m.userData && m.userData.layer) { m.map = lt; m.needsUpdate = true; }
  }
}
// colour variants keep choosing a variant at spawn, but now return the pack skin for it
for (const k of Object.keys(MCVTEX)) if (MOBDEF[k] && MOBDEF[k].vtex) MOBDEF[k].vtex = v => MCVTEX[k]({ type: k, variant: v });
// horses: Java's head hangs from the neck, so grazing turns the neck (not the head's position)
for (const k of ['horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse', 'llama', 'trader_llama']) if (MOBDEF[k]) MOBDEF[k].anim = (e, P) => {
  if (P.tail) P.tail.rotation.x = -0.5236 - Math.sin(e.walk * 0.5) * 0.15 * e.walkAmt;
  const graze = e.rider ? 0 : (e.walkAmt < 0.1 && (e.age % 400) < 60 ? 1 : 0);
  if (P.neck) P.neck.rotation.x = -(0.5236 + graze * 1.2);
};
// the snow golem wears a real carved pumpkin until it is sheared
function snowGolemHead(e) {
  const P = e.mesh.userData.parts; if (!P.head) return;
  if (!e.noPumpkin && !e.pumpkinMesh) { const m = R.itemMesh(BID.carved_pumpkin); m.scale.setScalar(0.62); m.position.set(0, 0.25, 0); m.rotation.y = Math.PI; P.head.add(m); e.pumpkinMesh = m; }
  else if (e.noPumpkin && e.pumpkinMesh) { P.head.remove(e.pumpkinMesh); e.pumpkinMesh = null; }
}
function mcmodels2Tick() { mcSkinTick(); if (W.tickN % 10 === 0) for (const e of ENT) if (e.type === 'snow_golem' && e.mesh && e.mesh.userData.mc) snowGolemHead(e); }
// animations written for the old models set absolute rotations; Java models have parts built rotated (bodies
// lying along z), so these animate relative to each part's base pose
const baseRot = (p, ax) => p.userData.base ? p.userData.base[ax] : 0;
for (const k of ['cat', 'ocelot']) if (MOBDEF[k]) MOBDEF[k].anim = (e, P) => {
  if (!e.mesh.userData.mc) return catAnim(e, P);
  if (P.tail) P.tail.rotation.x = baseRot(P.tail, 'x') + (e.sitting ? -0.9 : Math.sin(e.walk * 0.4) * 0.15);
  if (P.body) P.body.rotation.x = baseRot(P.body, 'x') + (e.sitting ? 0.785 : 0);
  if (e.sitting) { e.mesh.position.y -= 0.1; for (const n of ['rleg2', 'lleg2']) if (P[n]) P[n].rotation.x = -1.57; }
};
if (MOBDEF.panda) { const old = MOBDEF.panda.anim; MOBDEF.panda.anim = (e, P) => {
  if (!e.mesh.userData.mc) return old && old(e, P);
  if (P.body) { P.body.rotation.x = baseRot(P.body, 'x') + (e.roll > 0 ? (e.roll / 30) * Math.PI * 2 : 0); P.body.rotation.z = e.lying > 0 ? 0.9 : 0; }
  if (P.head) P.head.rotation.z = e.lying > 0 ? 0.9 : 0;
}; }
// illagers fold their arms until they fight (pillagers always hold their crossbow out)
for (const k of ['pillager', 'vindicator', 'evoker']) if (MOBDEF[k]) { const old = MOBDEF[k].anim; MOBDEF[k].anim = (e, P, now) => {
  if (old) old(e, P, now);
  if (!e.mesh.userData.mc) return;
  const fight = k === 'pillager' || !!e.target || e.cast > 0 || e.swing > 0;
  hidePart(e, 'arms', !fight); hidePart(e, 'rarm', fight); hidePart(e, 'larm', fight);
}; }
// ---------- tropical fish (32x32 model A): white base and pattern textures tinted with the fish's two colours ----------
function tintedLayers(layers) { // [[key, colour], ...]
  const key = 'T:' + layers.map(l => l.join('#')).join('+'); if (entTex[key]) return entTex[key];
  const base = PACKPX.ent[layers[0][0]]; if (!base) return null;
  const px = new Uint8Array(base.px.length);
  for (const [k, col] of layers) { const o = PACKPX.ent[k]; if (!o) continue; const c = [(col >> 16) & 255, (col >> 8) & 255, col & 255];
    for (let i = 0; i < px.length; i += 4) { const a = o.px[i + 3] / 255; if (!a) continue; for (let j = 0; j < 3; j++) px[i + j] = px[i + j] * (1 - a) + o.px[i + j] * c[j] / 255 * a; px[i + 3] = Math.max(px[i + 3], o.px[i + 3]); } }
  const t = new THREE.DataTexture(px, base.w, base.h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return entTex[key] = t;
}
MCMODELS.tropical_fish = { tex: 'tropical_a', tw: 32, th: 32, parts: [
  { n: 'body', o: [0, 22, 0], b: [[0, 0, -1, -1.5, -3, 2, 3, 6]] },
  { n: 'tail', o: [0, 22, 3], b: [[22, -6, 0, -1.5, 0, 0, 3, 6]] },
  { n: 'rfin', o: [-1, 22.5, 0], r: [0, Math.PI / 4, 0], b: [[2, 16, -2, -1, 0, 2, 2, 0]] }, { n: 'lfin', o: [1, 22.5, 0], r: [0, -Math.PI / 4, 0], b: [[2, 12, 0, -1, 0, 2, 2, 0]] },
  { n: 'fin', o: [0, 20.5, -3], b: [[10, -5, 0, -3, 0, 0, 3, 6]] }] };
MCVTEX.tropical_fish = e => { const v = e.variant || 0, [bc, pc] = TFISH_COL[v % TFISH_COL.length]; return tintedLayers([['tropical_a', bc], ['tropical_a_pattern_' + (1 + ((v >> 1) % 6)), pc]]); };
if (MOBDEF.tropical_fish) MOBDEF.tropical_fish.vtex = v => MCVTEX.tropical_fish({ variant: v });

// ---------- 1.17 mobs, Java model layouts (used when the loaded resource pack has their textures; otherwise the
// built-in models with painted skins stay) ----------
Object.assign(MCMODELS, {
  goat: { tex: 'goat', tw: 64, th: 64, parts: [
    { n: 'head', o: [1, 14, 0], b: [[2, 61, -6, -11, -10, 3, 2, 1], [2, 61, 2, -11, -10, 3, 2, 1, 0, 1], [23, 52, -0.5, -3, -14, 0, 7, 5]] },
    { n: 'horn2', p: 'head', o: [0, 0, 0], b: [[12, 55, -0.01, -16, -10, 2, 7, 2]] }, { n: 'horn', p: 'head', o: [0, 0, 0], b: [[12, 55, -2.99, -16, -10, 2, 7, 2]] },
    { n: 'nose', p: 'head', o: [0, -8, -8], r: [0.9599, 0, 0], b: [[34, 46, -3, -4, -8, 5, 7, 10]] },
    { n: 'body', o: [0, 24, 0], b: [[1, 1, -4, -17, -7, 9, 11, 16], [0, 28, -5, -18, -8, 11, 14, 11]] },
    { n: 'lleg2', o: [1, 14, 4], b: [[36, 29, 0, 4, 0, 3, 6, 3]] }, { n: 'rleg2', o: [-3, 14, 4], b: [[49, 29, 0, 4, 0, 3, 6, 3]] },
    { n: 'lleg', o: [1, 14, -6], b: [[49, 2, 0, 0, 0, 3, 10, 3]] }, { n: 'rleg', o: [-3, 14, -6], b: [[35, 2, 0, 0, 0, 3, 10, 3]] }] },
  axolotl: { tex: 'axolotl_lucy', tw: 64, th: 64, parts: [
    { n: 'body', o: [0, 20, 5], b: [[0, 11, -4, -2, -9, 8, 4, 10], [2, 17, 0, -3, -8, 0, 5, 9]] },
    { n: 'head', p: 'body', o: [0, 0, -9], b: [[0, 1, -4, -3, -5, 8, 5, 5, 0.001]] },
    { n: 'gillt', p: 'head', o: [0, -3, -1], b: [[3, 37, -4, -3, 0, 8, 3, 0, 0.001]] },
    { n: 'gilll', p: 'head', o: [-4, 0, -1], b: [[0, 40, -3, -5, 0, 3, 7, 0, 0.001]] }, { n: 'gillr', p: 'head', o: [4, 0, -1], b: [[11, 40, 0, -5, 0, 3, 7, 0, 0.001]] },
    { n: 'rleg2', p: 'body', o: [-3.5, 1, -1], b: [[2, 13, -2, 0, 0, 3, 5, 0, 0.001]] }, { n: 'lleg2', p: 'body', o: [3.5, 1, -1], b: [[2, 13, -1, 0, 0, 3, 5, 0, 0.001]] },
    { n: 'rleg', p: 'body', o: [-3.5, 1, -8], b: [[2, 13, -2, 0, 0, 3, 5, 0, 0.001]] }, { n: 'lleg', p: 'body', o: [3.5, 1, -8], b: [[2, 13, -1, 0, 0, 3, 5, 0, 0.001]] },
    { n: 'tail', p: 'body', o: [0, 0, 1], b: [[2, 19, 0, -3, 0, 0, 5, 12]] }] },
  glow_squid: { ...MCMODELS.squid, tex: 'glow_squid' },
});
const AXO_TEX = ['axolotl_lucy', 'axolotl_wild', 'axolotl_gold', 'axolotl_cyan', 'axolotl_blue'];
MCVTEX.axolotl = e => packTexture(AXO_TEX[e.variant] || AXO_TEX[0]);
// the variant skin set at spawn has to match whichever model the mob got
if (MOBDEF.axolotl) { const painted = MOBDEF.axolotl.vtex; MOBDEF.axolotl.vtex = v => PACKPX.ent[AXO_TEX[0]] ? packTexture(AXO_TEX[v] || AXO_TEX[0]) : painted(v); }

// ---------- items mobs hold in their right hand, as in vanilla (bows, crossbows, swords, axes, tridents) ----------
// The item hangs off the right-arm bone, so it hides with the arm (vindicators only show the axe while fighting).
const MOB_HELD = { skeleton: 'bow', stray: 'bow', wither_skeleton: 'stone_sword', illusioner: 'bow', pillager: 'crossbow', vindicator: 'iron_axe', vex: 'iron_sword',
  piglin: e => (e.id % 2 ? 'crossbow' : 'golden_sword'), piglin_brute: 'golden_axe', zombified_piglin: 'golden_sword', drowned: e => e.hasTrident && 'trident' };
function mobHeldTick() {
  for (const e of ENT) {
    if (e.kind !== 'mob' || !e.mesh || e.dead) continue;
    const h = MOB_HELD[e.type], key = typeof h === 'function' ? h(e) : h;
    if (!key) continue;
    const P = e.mesh.userData.parts, arm = P && P.rarm; if (!arm || IID[key] == null) continue;
    if (!e.heldItem || e.heldItem.parent !== arm) {
      const m = R.itemMesh(IID[key]), g = new THREE.Group(); g.add(m); m.scale.setScalar(0.62);
      const bow = key === 'bow';
      // grip at the bottom of the arm; blades point forward and up, bows stand upright facing out
      // sprites are drawn diagonally (grip bottom-left): turn them upright, shift the grip into the hand, then lay
      // blades, axes and crossbows pointing forward and stand bows up beside the arm
      g.position.set(e.mesh.userData.mc ? 1 / 16 : 0, -10 / 16, -1 / 16);
      m.rotation.z = Math.PI / 4; m.position.y = 0.18;
      if (bow) { g.rotation.set(0, Math.PI / 2, 0); m.position.y = 0; }
      else g.rotation.set(-Math.PI / 2, 0, 0);
      if (key === 'trident') { m.scale.setScalar(0.9); m.position.y = 0.1; }
      arm.add(g); e.heldItem = g;
    }
    R.setMeshLight(e.heldItem.children[0], lightBright(e.x, e.y + e.h * 0.6, e.z));
  }
}
{ const tick = mcmodels2Tick; mcmodels2Tick = function () { tick(); mobHeldTick(); }; }

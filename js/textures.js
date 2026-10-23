// Procedural pixel textures: block atlas (16px tiles), item icon sheet, crack stages.
const TS = 16, ATLAS_W = S.ATL, TPR = S.TPR;
const TINT_A = 240; // alpha marker: pixel takes the biome tint in the shader
const atlasCanvas = document.createElement('canvas'); atlasCanvas.width = atlasCanvas.height = ATLAS_W;
const atlasCtx = atlasCanvas.getContext('2d');
const atlasImg = atlasCtx.createImageData(ATLAS_W, ATLAS_W);
const AD = atlasImg.data;

const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const shade = (c, f) => [Math.max(0, Math.min(255, c[0] * f)), Math.max(0, Math.min(255, c[1] * f)), Math.max(0, Math.min(255, c[2] * f))];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const gray = v => [v, v, v];
function trng(seed) { let s = (seed * 2654435761) >>> 0 || 7; const f = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; f.int = n => Math.floor(f() * n); return f; }
// tileable value noise on a 16px tile
function tnoise(r, cells) {
  const g = []; for (let i = 0; i < cells * cells; i++) g.push(r());
  return (x, y) => {
    const fx = x / TS * cells, fy = y / TS * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const G = (a, b) => g[((b % cells + cells) % cells) * cells + ((a % cells + cells) % cells)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (G(ix, iy) * (1 - sx) + G(ix + 1, iy) * sx) * (1 - sy) + (G(ix, iy + 1) * (1 - sx) + G(ix + 1, iy + 1) * sx) * sy;
  };
}
let curTile = 0;
function P(x, y, c, a = 255) {
  if (x < 0 || y < 0 || x > 15 || y > 15 || !c) return;
  const i = ((((curTile / TPR) | 0) * TS + y) * ATLAS_W + (curTile % TPR) * TS + x) * 4;
  AD[i] = c[0]; AD[i + 1] = c[1]; AD[i + 2] = c[2]; AD[i + 3] = a;
}
function fill(fn) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = fn(x, y); if (c) P(x, y, c, c[3] != null ? c[3] : 255); } }
function pal(r, cols) { return cols[r.int(cols.length)]; }
function quant(c, step = 6) { return [Math.round(c[0] / step) * step, Math.round(c[1] / step) * step, Math.round(c[2] / step) * step]; }

const PAINT = {};
const STONE_C = hex(0x7d7d7d);
function stoneLike(base, r, amt = 0.28, streak) {
  const nz = tnoise(r, 4), nz2 = tnoise(r, 8);
  fill((x, y) => { let f = 1 + (nz(x, y) - 0.5) * amt + (nz2(x, y) - 0.5) * amt * 0.7 + (r() - 0.5) * 0.08; if (streak && r() < 0.05) f *= 0.82; return quant(shade(base, f), 4); });
}
PAINT.stone = r => stoneLike(STONE_C, r, 0.3, 1);
PAINT.smooth_stone = r => { stoneLike(hex(0x9e9e9e), r, 0.1); for (let i = 0; i < 16; i++) { P(i, 0, gray(0xae)); P(i, 15, gray(0x6f)); P(0, i, gray(0xa8)); P(15, i, gray(0x74)); } };
PAINT.smooth_stone_slab_side = r => { stoneLike(hex(0x9e9e9e), r, 0.1); for (let i = 0; i < 16; i++) { P(i, 0, gray(0xae)); P(i, 7, gray(0x6f)); P(i, 8, gray(0xae)); P(i, 15, gray(0x6f)); P(0, i, gray(0xa8)); P(15, i, gray(0x74)); } };
PAINT.andesite = r => { stoneLike(hex(0x888888), r, 0.25); for (let i = 0; i < 26; i++) P(r.int(16), r.int(16), pal(r, [gray(0x9f), gray(0x6a), gray(0xa8)])); };
PAINT.diorite = r => { stoneLike(hex(0xbcbcbc), r, 0.18); for (let i = 0; i < 30; i++) { const x = r.int(16), y = r.int(16); P(x, y, pal(r, [gray(0x7d), gray(0x8a), gray(0xe6)])); if (r() < .4) P(x + 1, y, gray(0x86)); } };
PAINT.granite = r => { stoneLike(hex(0x956755), r, 0.22); for (let i = 0; i < 30; i++) P(r.int(16), r.int(16), pal(r, [hex(0xb98a74), hex(0x6f4a3e), hex(0xc69c86), hex(0x7f5848)])); };
PAINT.tuff = r => { stoneLike(hex(0x6d6e66), r, 0.22); for (let i = 0; i < 24; i++) P(r.int(16), r.int(16), pal(r, [hex(0x8a8b80), hex(0x55564e), hex(0x7c7a6c)])); };
PAINT.calcite = r => { stoneLike(hex(0xdcdcd5), r, 0.12); for (let i = 0; i < 14; i++) P(r.int(16), r.int(16), pal(r, [hex(0xbfc0bb), hex(0xeeeee8)])); };
PAINT.smooth_basalt = r => stoneLike(hex(0x4c4b51), r, 0.16);
PAINT.deepslate = r => { const nz = tnoise(r, 4); fill((x, y) => quant(shade(hex(0x515155), 1 + (nz(x, y) - .5) * .25 + (r() - .5) * .1 + ((y % 4 === 0 && r() < .5) ? -0.12 : 0)), 3)); };
PAINT.deepslate_top = r => { const nz = tnoise(r, 4); fill((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return quant(shade(hex(0x58585c), 1 + (nz(x, y) - .5) * .2 + (Math.floor(d) % 3 === 0 ? -0.1 : 0) + (r() - .5) * .08), 3); }); };
PAINT.bedrock = r => { const nz = tnoise(r, 8); fill((x, y) => { const v = nz(x, y) + (r() - .5) * .5; return v < .3 ? gray(0x2e) : v < .5 ? gray(0x55) : v < .7 ? gray(0x6e) : gray(0x8c); }); };
PAINT.obsidian = r => { const nz = tnoise(r, 6); fill((x, y) => { const v = nz(x, y) + (r() - .5) * .3; return v > .72 ? hex(0x3b2754) : v > .55 ? hex(0x1d1528) : v < .25 ? hex(0x06050a) : hex(0x0f0b18); }); };
function cobble(base, r, mortar, moss) {
  const pts = []; for (let i = 0; i < 11; i++) pts.push([r() * 16, r() * 16, 0.82 + r() * 0.35]);
  fill((x, y) => {
    let d1 = 99, d2 = 99, k = 0;
    for (let i = 0; i < pts.length; i++) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
      const dx = x + .5 - pts[i][0] - ox, dy = y + .5 - pts[i][1] - oy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 1.1) return mortar;
    let c = shade(base, pts[k][2] * (1 + (r() - .5) * .12) * (d2 - d1 < 2.2 ? 0.88 : 1.06));
    if (moss && moss(x, y)) c = mixc(c, hex(0x5a7a32), 0.75);
    return quant(c, 4);
  });
}
PAINT.cobblestone = r => cobble(hex(0x8a8a8a), r, gray(0x4a));
PAINT.cobbled_deepslate = r => cobble(hex(0x5a5a5e), r, hex(0x2c2c30));
PAINT.mossy_cobblestone = r => { const nz = tnoise(r, 4); cobble(hex(0x8a8a8a), r, gray(0x4a), (x, y) => nz(x, y) > 0.55); };
PAINT.dirt = r => { const nz = tnoise(r, 4); fill((x, y) => { const v = r(); const base = v < 0.1 ? hex(0x5d4129) : v > 0.94 ? hex(0x9a7457) : hex(0x866043); return quant(shade(base, 1 + (nz(x, y) - .5) * .25 + (r() - .5) * .14), 3); }); };
function grassGray(r) { const nz = tnoise(r, 4); return (x, y) => { const v = 0.62 + (nz(x, y) - .5) * .22 + (r() - .5) * .22; return gray(Math.round(v * 255 / 6) * 6); }; }
PAINT.grass_top = r => { const g = grassGray(r); fill((x, y) => [...g(x, y), TINT_A]); };
PAINT.grass_side = r => {
  PAINT.dirt(r); const g = grassGray(r);
  for (let x = 0; x < 16; x++) { const h = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0); for (let y = 0; y < h; y++) { const c = g(x, y); P(x, y, c, TINT_A); } }
};
PAINT.grass_side_snowed = r => { PAINT.dirt(r); for (let x = 0; x < 16; x++) { const h = 3 + (r() < 0.5 ? 1 : 0) + (r() < .2 ? 1 : 0); for (let y = 0; y < h; y++) P(x, y, pal(r, [hex(0xffffff), hex(0xeef6f8), hex(0xdde9ee)])); } };
PAINT.sand = r => { const nz = tnoise(r, 4); fill((x, y) => quant(shade(hex(0xdbd3a0), 1 + (nz(x, y) - .5) * .1 + (r() - .5) * .1), 3)); for (let i = 0; i < 10; i++) P(r.int(16), r.int(16), hex(0xc4b98a)); };
PAINT.sandstone = r => { const nz = tnoise(r, 4); fill((x, y) => { let c = shade(hex(0xd9cf9c), 1 + (nz(x, y) - .5) * .08 + (r() - .5) * .06); if (y === 3 || y === 9) c = shade(c, .9); if (y >= 12) c = shade(c, 0.95 - (y - 12) * 0.02); return quant(c, 3); }); };
PAINT.sandstone_top = r => { const nz = tnoise(r, 4); fill((x, y) => quant(shade(hex(0xdcd2a0), 1 + (nz(x, y) - .5) * .1 + (r() - .5) * .06), 3)); };
PAINT.sandstone_bottom = r => { PAINT.sandstone_top(r); for (let i = 0; i < 16; i++) { P(i, 0, hex(0xc9bd86)); P(0, i, hex(0xc9bd86)); } };
PAINT.gravel = r => { fill((x, y) => pal(r, [hex(0x837f7e), hex(0x6b6463), hex(0x9a9493), hex(0x5c5655), hex(0x8d7a73)])); for (let i = 0; i < 9; i++) { const x = r.int(15), y = r.int(15), c = pal(r, [hex(0xaaa4a2), hex(0x4f4a49), hex(0x7a6f6b)]); P(x, y, c); P(x + 1, y, shade(c, .9)); P(x, y + 1, shade(c, .8)); P(x + 1, y + 1, shade(c, .7)); } };
PAINT.clay = r => { const nz = tnoise(r, 4); fill((x, y) => quant(shade(hex(0xa0a6b4), 1 + (nz(x, y) - .5) * .1 + (r() - .5) * .07), 3)); };
PAINT.snow = r => fill(() => pal(r, [hex(0xffffff), hex(0xf6fbfc), hex(0xeaf2f5), hex(0xffffff)]));
PAINT.powder_snow = r => { const nz = tnoise(r, 4); fill((x, y) => quant(shade(hex(0xf2f6f8), 1 + (nz(x, y) - .5) * .06 + (r() - .5) * .04), 2)); };
PAINT.ice = r => { fill((x, y) => [...pal(r, [hex(0x9cbcf4), hex(0x93b4ef), hex(0xa7c4f6)]), 190]); for (let i = 0; i < 5; i++) { let x = r.int(16), y = r.int(16); for (let k = 0; k < 5; k++) { P(x, y, hex(0xd6e4fb), 210); x++; y += r() < .5 ? 1 : 0; } } };
PAINT.water = r => paintWater(r, 0);
PAINT.lava = r => paintLava(r, 0);
function paintWater(r, t) {
  fill((x, y) => { const w = Math.sin((x + t * 0.7) * 0.8 + Math.sin((y + t) * 0.5) * 1.5) + Math.sin((y * 0.9 - t * 0.4) + x * 0.3); const v = 0.72 + w * 0.06 + (((x * 7 + y * 13) % 5) - 2) * 0.012; return [...gray(Math.round(v * 220)), 168]; });
}
function paintLava(r, t) {
  fill((x, y) => { const w = Math.sin((x + t * 0.3) * 0.7 + Math.cos((y - t * 0.2) * 0.6) * 2) + Math.sin(y * 0.8 + x * 0.4 + t * 0.25); const v = w + (((x * 5 + y * 3) % 4) - 1.5) * 0.15; return v > 1.1 ? hex(0xfff09a) : v > 0.4 ? hex(0xfdb02c) : v > -0.4 ? hex(0xe3731b) : hex(0xc84a10); });
}
function planks(base, r, dark) {
  const off = [3, 11, 6, 14];
  fill((x, y) => {
    const row = y >> 2; if ((y & 3) === 3) return shade(base, 0.72);
    if (x === off[row]) return shade(base, 0.8);
    let f = 1 + (r() - .5) * .08 + ((row & 1) ? -0.04 : 0.02);
    if (r() < 0.12) f -= 0.1;
    return quant(shade(base, f), 3);
  });
}
PAINT.oak_planks = r => planks(hex(0xa88754), r);
PAINT.spruce_planks = r => planks(hex(0x735531), r);
PAINT.birch_planks = r => planks(hex(0xc4b27c), r);
function bark(base, r, dark) { const nz = tnoise(r, 4); fill((x, y) => { const stripe = (x * 5 + Math.floor(nz(x, y) * 3)) % 4 === 0; return quant(shade(stripe ? dark : base, 1 + (r() - .5) * .14), 3); }); }
PAINT.oak_log = r => bark(hex(0x6b5433), r, hex(0x4a3a22));
PAINT.spruce_log = r => bark(hex(0x3d2914), r, hex(0x2a1c0d));
PAINT.birch_log = r => { fill(() => pal(r, [hex(0xd9d7cf), hex(0xe6e4dc), hex(0xcfccc2)])); for (let i = 0; i < 8; i++) { const x = r.int(14), y = r.int(16), l = 2 + r.int(3); for (let k = 0; k < l; k++) P(x + k, y, k === 0 || k === l - 1 ? hex(0x5a5a52) : hex(0x2e2e2a)); } };
PAINT.hay_side = r => { fill((x, y) => { let c = pal(r, [hex(0xc7a32f), hex(0xb48f22), hex(0xd8b43a)]); if ((x & 1) === 0) c = shade(c, .9); if (y === 3 || y === 12) c = hex(0x8a2b1f); if (y === 4 || y === 11) c = hex(0x6e2017); return c; }); };
PAINT.hay_top = r => fill((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return shade(pal(r, [hex(0xc7a32f), hex(0xb48f22), hex(0xd8b43a)]), (Math.floor(d) % 2) ? 0.88 : 1); });
function logTop(barkC, inner, ring, r) {
  fill((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); if (d > 6.5) return quant(shade(barkC, 1 + (r() - .5) * .15), 3); const c = Math.floor(d) % 2 ? ring : inner; return quant(shade(c, 1 + (r() - .5) * .08), 3); });
}
PAINT.oak_log_top = r => logTop(hex(0x6b5433), hex(0xb08f5a), hex(0x977649), r);
PAINT.spruce_log_top = r => logTop(hex(0x3d2914), hex(0x7a5a35), hex(0x634729), r);
PAINT.birch_log_top = r => logTop(hex(0xd9d7cf), hex(0xc8b77d), hex(0xad9d66), r);
function leaves(r, opaque, dens) {
  const nz = tnoise(r, 8);
  fill((x, y) => {
    const v = nz(x, y) + (r() - .5) * .5;
    if (!opaque && v < dens) return null;
    const g = v < dens ? 0.32 : 0.45 + v * 0.4;
    return [...gray(Math.round(Math.min(1, g) * 255 / 5) * 5), TINT_A];
  });
}
PAINT.oak_leaves = r => leaves(r, false, 0.22);
PAINT.spruce_leaves = r => leaves(r, false, 0.25);
PAINT.birch_leaves = r => leaves(r, false, 0.2);
PAINT.oak_leaves_o = r => leaves(r, true, 0.22);
PAINT.spruce_leaves_o = r => leaves(r, true, 0.25);
PAINT.birch_leaves_o = r => leaves(r, true, 0.2);
PAINT.glass = r => { for (let i = 0; i < 16; i++) { P(i, 0, hex(0xdbeff4)); P(i, 15, hex(0xa9cdd7)); P(0, i, hex(0xdbeff4)); P(15, i, hex(0xa9cdd7)); } for (let k = 0; k < 3; k++) { P(3 + k, 2 + k, hex(0xffffff)); P(4 + k, 2 + k, hex(0xffffff)); } P(10, 11, hex(0xffffff)); P(11, 12, hex(0xffffff)); };
PAINT.tinted_glass = r => { fill((x, y) => [...pal(r, [hex(0x2c2234), hex(0x352a40), hex(0x271f2e)]), 200]); for (let i = 0; i < 16; i++) { P(i, 0, hex(0x4b3a5c), 235); P(i, 15, hex(0x1c1622), 235); P(0, i, hex(0x4b3a5c), 235); P(15, i, hex(0x1c1622), 235); } };
// ores
const ORE_SPOTS = [[2, 2], [9, 1], [5, 6], [12, 6], [2, 10], [8, 10], [12, 12], [5, 13]];
function ore(baseFn, cols, r, n = 6) {
  baseFn(r);
  const spots = ORE_SPOTS.slice().sort(() => r() - .5).slice(0, n);
  for (const [sx, sy] of spots) {
    const shape = [[0, 0], [1, 0], [0, 1], [1, 1]]; if (r() < .6) shape.push([2, 1]); if (r() < .5) shape.push([1, 2]); if (r() < .3) shape.push([-1, 1]);
    for (const [dx, dy] of shape) { const x = sx + dx, y = sy + dy; P(x, y, dx + dy === 0 ? cols[0] : (dx + dy >= 2 ? cols[2] : cols[1])); }
  }
}
const ORE_COLS = { coal: [hex(0x4a4a4a), hex(0x2a2a2a), hex(0x111111)], iron: [hex(0xe9d1bf), hex(0xd8af93), hex(0xa27e63)], gold: [hex(0xfffb9e), hex(0xfcd43b), hex(0xb88a12)],
  copper: [hex(0xeb9b6a), hex(0xc8613a), hex(0x4fa587)], diamond: [hex(0xd2fff8), hex(0x5decf5), hex(0x1aa8a2)], redstone: [hex(0xff4b4b), hex(0xd40000), hex(0x7a0000)],
  lapis: [hex(0x3f73e0), hex(0x1d47a6), hex(0x102c70)], emerald: [hex(0xa2ffc4), hex(0x17dd62), hex(0x007a2d)] };
for (const k in ORE_COLS) {
  PAINT[k + '_ore'] = r => ore(PAINT.stone, ORE_COLS[k], r, k === 'diamond' || k === 'emerald' ? 5 : 6);
  PAINT['deepslate_' + k + '_ore'] = r => ore(PAINT.deepslate, ORE_COLS[k], r, 5);
}
function metal(base, r, bevel = true) {
  const nz = tnoise(r, 4);
  fill((x, y) => { let c = shade(base, 1 + (nz(x, y) - .5) * .06 + (r() - .5) * .03); if (bevel) { if (x === 0 || y === 0) c = shade(base, 1.18); if (x === 15 || y === 15) c = shade(base, .74); if ((x === 1 || y === 1) && x < 15 && y < 15) c = shade(base, 1.08); } return quant(c, 3); });
}
PAINT.iron_block = r => { metal(hex(0xdcdcdc), r); for (let i = 2; i < 14; i++) { P(i, 7, gray(0xc4)); P(i, 8, gray(0xeeeeee & 255)); } };
PAINT.gold_block = r => metal(hex(0xf6d23c), r);
PAINT.diamond_block = r => { metal(hex(0x62e4dc), r); for (let i = 3; i < 13; i += 3) { P(i, i, hex(0xd2fff8)); P(i + 1, i, hex(0xa9f7ef)); } };
PAINT.emerald_block = r => metal(hex(0x2ecc6b), r);
PAINT.lapis_block = r => { metal(hex(0x2357b5), r); for (let i = 0; i < 20; i++) P(r.int(16), r.int(16), hex(0x3d78d8)); };
PAINT.redstone_block = r => { metal(hex(0xb51c0c), r); for (let i = 0; i < 20; i++) P(r.int(16), r.int(16), hex(0xe03a24)); };
PAINT.coal_block = r => { metal(hex(0x1c1c1c), r); for (let i = 0; i < 18; i++) P(r.int(16), r.int(16), hex(0x3a3a3a)); };
function copperTex(base, patch, r, cut) {
  const nz = tnoise(r, 4);
  fill((x, y) => { let c = shade(base, 1 + (nz(x, y) - .5) * .15 + (r() - .5) * .08); if (patch && nz(x * 1.3, y * 1.3) > 0.62) c = shade(patch, 1 + (r() - .5) * .1); if (cut && (x % 8 === 0 || y % 8 === 0)) c = shade(c, .78); if (cut && (x % 8 === 1 || y % 8 === 1)) c = shade(c, 1.12); return quant(c, 3); });
}
PAINT.copper_block = r => copperTex(hex(0xc06b4f), null, r);
PAINT.exposed_copper = r => copperTex(hex(0xa77e67), hex(0x6a9a7d), r);
PAINT.weathered_copper = r => copperTex(hex(0x5f9a6f), hex(0xa77e67), r);
PAINT.oxidized_copper = r => copperTex(hex(0x52a284), hex(0x3f8e74), r);
PAINT.cut_copper = r => copperTex(hex(0xbf6a4f), null, r, true);
PAINT.exposed_cut_copper = r => copperTex(hex(0xa77e67), hex(0x6a9a7d), r, true);
PAINT.weathered_cut_copper = r => copperTex(hex(0x5f9a6f), hex(0xa77e67), r, true);
PAINT.oxidized_cut_copper = r => copperTex(hex(0x52a284), hex(0x3f8e74), r, true);
// amethyst buds grow from a small nub to nearly a full cluster
function budTex(cr) { for (const [x, top] of cr) for (let y = top; y <= 15; y++) { P(x, y, hex(0xcfa0f3)); P(x + 1, y, hex(0x9a6ad1)); if (y > top + 1) P(x - 1, y, hex(0x7f55b4)); } }
PAINT.small_amethyst_bud = r => budTex([[7, 12], [5, 14], [9, 13]]);
PAINT.medium_amethyst_bud = r => budTex([[7, 9], [4, 12], [10, 11], [6, 13]]);
PAINT.large_amethyst_bud = r => budTex([[7, 5], [4, 9], [10, 8], [2, 12], [12, 11]]);
// cauldron: dark iron, a rim on top, the bowl darker inside
const CAUL = hex(0x4a4a4e);
PAINT.cauldron_side = r => fill((x, y) => quant(shade(CAUL, 1 + (r() - .5) * .14 + (y === 0 ? .25 : 0) + (x === 0 || x === 15 ? -.12 : 0)), 3));
PAINT.cauldron_top = r => fill((x, y) => quant(shade(CAUL, 1.25 + (r() - .5) * .1), 3));
PAINT.cauldron_inner = r => fill((x, y) => quant(shade(CAUL, 0.72 + (r() - .5) * .1), 3));
PAINT.cauldron_bottom = r => fill((x, y) => quant(shade(CAUL, 0.85 + (r() - .5) * .12), 3));
PAINT.lightning_rod = r => copperTex(hex(0xd47a55), hex(0xe89a74), r);
// candles (1.17): plain wax plus the 16 dye colours; the mesher maps candle boxes onto these pixel-exactly
const CANDLE_COL = { candle: 0xe8d8a8, white: 0xe4e8ea, orange: 0xe8792a, magenta: 0xb84ab8, light_blue: 0x4aa8d8, yellow: 0xf0c430, lime: 0x78c030, pink: 0xe88aa8, gray: 0x50585c,
  light_gray: 0x9a9a94, cyan: 0x188a96, purple: 0x7a30b0, blue: 0x3448a0, brown: 0x7a4c28, green: 0x4a6a1c, red: 0xa82a24, black: 0x26242c };
function candleTex(col, r) { const c = hex(col); fill((x, y) => quant(shade(c, 1 + (x % 2 ? -0.08 : 0.06) + (y % 5 === 0 ? 0.05 : 0) + (r() - .5) * .06), 3)); }
for (const k in CANDLE_COL) PAINT[k === 'candle' ? 'candle' : k + '_candle'] = r => candleTex(CANDLE_COL[k], r);
PAINT.candle_wick = r => fill(() => hex(0x2a2420));
PAINT.candle_flame = r => fill((x, y) => y < 6 ? hex(0xfff2b0) : y < 11 ? hex(0xffc040) : hex(0xff8a20));
function rawBlock(cols, r) { const nz = tnoise(r, 4); fill((x, y) => { const v = nz(x, y) + (r() - .5) * .3; return v > .65 ? cols[0] : v > .35 ? cols[1] : cols[2]; }); }
PAINT.raw_iron_block = r => rawBlock([hex(0xe6c7ad), hex(0xa68166), hex(0x6e5444)], r);
PAINT.raw_gold_block = r => rawBlock([hex(0xfff17a), hex(0xdea52b), hex(0x8f6514)], r);
PAINT.raw_copper_block = r => rawBlock([hex(0xf0a07a), hex(0xc0603c), hex(0x7c3a24)], r);
PAINT.amethyst_block = r => { const nz = tnoise(r, 4); fill((x, y) => { const v = nz(x, y) + ((x + y) % 5 === 0 ? .2 : 0) + (r() - .5) * .2; return v > .75 ? hex(0xcfa0f3) : v > .5 ? hex(0x9a6ad1) : v > .3 ? hex(0x7f55b4) : hex(0x5d3e8d); }); };
PAINT.budding_amethyst = r => { PAINT.amethyst_block(r); for (let i = 0; i < 6; i++) { const x = 1 + r.int(13), y = 1 + r.int(13); P(x, y, hex(0x3a2160)); P(x + 1, y, hex(0x3a2160)); P(x, y + 1, hex(0x2a1648)); P(x + 1, y + 1, hex(0xe2c4fa)); } };
PAINT.amethyst_cluster = r => { const cr = [[7, 2, 15], [4, 6, 15], [10, 5, 15], [2, 10, 15], [12, 9, 15]]; for (const [x, top, bot] of cr) for (let y = top; y <= bot; y++) { P(x, y, hex(0xcfa0f3)); P(x + 1, y, hex(0x9a6ad1)); if (y > top + 2) P(x - 1, y, hex(0x7f55b4)); } };
PAINT.dripstone_block = r => { const nz = tnoise(r, 4); fill((x, y) => quant(shade(hex(0x86685a), 1 + (nz(x, y * 0.4) - .5) * .25 + ((x * 3) % 5 === 0 ? -0.08 : 0) + (r() - .5) * .08), 3)); };
PAINT.pointed_dripstone = r => { for (let y = 0; y < 16; y++) { const w = Math.max(0, Math.round((16 - y) / 4)); for (let x = 8 - w; x <= 7 + w; x++) P(x, y, shade(hex(0x86685a), 1 + (r() - .5) * .2 + (x < 8 ? .08 : -0.08))); } };
// ---- lush caves (1.17) ----
const AZ = [hex(0x5e7a2a), hex(0x6e8c34), hex(0x4c6522), hex(0x7d9b3c)], AZFL = [hex(0xd86aa8), hex(0xf09ac8), hex(0xb24a86)];
function azaleaLeafy(r, rows, flowers, holes) { fill((x, y) => { if (y >= rows) return null; if (holes && r() < 0.18) return null; return quant(shade(pal(r, AZ), 1 + (r() - .5) * .15), 3); }); if (flowers) for (let i = 0; i < 7; i++) { const x = r.int(15), y = r.int(Math.max(1, rows - 1)); P(x, y, pal(r, AZFL)); P(x + 1, y, AZFL[2]); if (y + 1 < rows) P(x, y + 1, AZFL[0]); } }
PAINT.azalea_top = r => azaleaLeafy(r, 16, false); PAINT.azalea_side = r => azaleaLeafy(r, 8, false);
PAINT.flowering_azalea_top = r => azaleaLeafy(r, 16, true); PAINT.flowering_azalea_side = r => azaleaLeafy(r, 8, true);
PAINT.azalea_plant = r => fill((x, y) => quant(shade(hex(0x6a4f2e), 1 + ((x % 4) === 0 ? -.2 : 0) + (r() - .5) * .12), 3));
PAINT.azalea_leaves = r => azaleaLeafy(r, 16, false, true); PAINT.azalea_leaves_o = r => azaleaLeafy(r, 16, false, false);
PAINT.flowering_azalea_leaves = r => azaleaLeafy(r, 16, true, true); PAINT.flowering_azalea_leaves_o = r => azaleaLeafy(r, 16, true, false);
function vine(r, berries) {
  for (let y = 0; y < 16; y++) { const x = 7 + Math.round(Math.sin(y * 0.7) * 1.2); P(x, y, hex(0x4a6a24)); P(x + 1, y, hex(0x3a5a1c)); if (y % 3 === 0) { P(x - 1, y, hex(0x6a9a34)); P(x - 2, y + 1, hex(0x5a8a2c)); } if (y % 3 === 1) { P(x + 2, y, hex(0x6a9a34)); P(x + 3, y + 1, hex(0x5a8a2c)); } }
  if (berries) for (const [x, y] of [[4, 4], [10, 9], [5, 13]]) { P(x, y, hex(0xffb030)); P(x + 1, y, hex(0xf08a20)); P(x, y + 1, hex(0xe07a10)); P(x + 1, y + 1, hex(0xffd060)); }
}
PAINT.cave_vines = r => vine(r, false); PAINT.cave_vines_lit = r => vine(r, true);
PAINT.spore_blossom = r => fill((x, y) => { const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx); if (d > 7.5) return null; if (d < 2) return hex(0x6a9a34); const petal = Math.cos(a * 4) > 0.2; return petal ? quant(shade(hex(0xe87ab8), 1 - d / 30 + (r() - .5) * .1), 3) : d < 4 ? hex(0x8ab83c) : null; });
PAINT.big_dripleaf_top = r => fill((x, y) => { const vein = x === 7 || x === 8 || (Math.abs(x - 7.5) - Math.abs(y - 14) * 0.6 < 0.6 && Math.abs(x - 7.5) - Math.abs(y - 14) * 0.6 > -0.6); const edge = x === 0 || x === 15 || y === 0 || y === 15; return quant(shade(hex(0x6aa83a), edge ? 0.78 : vein ? 1.18 : 1 + (r() - .5) * .1), 3); });
PAINT.big_dripleaf_stem = r => fill((x, y) => x < 6 || x > 9 ? null : quant(shade(hex(0x5a8a2c), 1 + (x === 6 ? .12 : x === 9 ? -.15 : 0) + (r() - .5) * .08), 3)); // a thin stalk in the middle
PAINT.small_dripleaf = r => { for (const [x0, lean] of [[6, -0.15], [9, 0.15]]) for (let y = 0; y < 16; y++) P(Math.round(x0 + (15 - y) * lean), y, hex(0x5a8a2c)); };
PAINT.small_dripleaf_top = r => { for (let y = 8; y < 16; y++) { P(6, y, hex(0x5a8a2c)); P(9, y, hex(0x5a8a2c)); } for (const [cx, cy] of [[4, 5], [11, 4]]) for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) if (dx * dx / 9 + dy * dy / 4 <= 1) P(cx + dx, cy + dy, shade(hex(0x6aa83a), 1 + (r() - .5) * .15)); };
PAINT.rooted_dirt = r => { PAINT.dirt(r); for (let i = 0; i < 5; i++) { let x = r.int(16), y = r.int(16); for (let k = 0; k < 5; k++) { P(x, y, hex(0xb08a5a)); x = (x + (r() < .5 ? 1 : 0)) & 15; y = (y + 1) & 15; } } };
PAINT.hanging_roots = r => { for (const x0 of [3, 6, 9, 12]) { let x = x0; for (let y = 0; y < 10 + r.int(6); y++) { P(x, y, hex(0x9a7448)); if (r() < 0.25) x += r() < .5 ? -1 : 1; } } };
// sculk sensor (1.17): dark teal with glowing cyan spots
const SCULK = [hex(0x0b2f34), hex(0x0f3d44), hex(0x08262a)];
PAINT.sculk_sensor_side = r => fill((x, y) => y < 8 ? (r() < 0.12 ? hex(0x1a8a96) : pal(r, SCULK)) : pal(r, SCULK));
PAINT.sculk_sensor_top = r => fill((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d < 3 ? hex(0x2ad1d8) : d < 4.2 ? hex(0x137a84) : r() < 0.08 ? hex(0x1a8a96) : pal(r, SCULK); });
PAINT.sculk_sensor_bottom = r => fill(() => pal(r, SCULK));
PAINT.sculk_sensor_tendril = r => fill((x, y) => (x + y) % 5 === 0 || r() < 0.4 ? hex(0x14646c) : null);
PAINT.sculk_sensor_tendril_active = r => fill((x, y) => (x + y) % 5 === 0 || r() < 0.4 ? hex(0x5af0f4) : null);
PAINT.brewing_stand = r => fill((x, y) => x >= 6 && x <= 9 ? quant(shade(hex(0xc8a24a), 1 + (x === 6 ? .15 : x === 9 ? -.2 : 0) + (r() - .5) * .1), 3) : null);
PAINT.brewing_stand_base = r => stoneLike(hex(0x5a5a5a), r, 0.2);
PAINT.brewing_bottle = r => fill((x, y) => [200 + r.int(30), 220 + r.int(20), 240, 150]);
PAINT.beacon = r => fill((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return d > 6 ? hex(0x6ad8d0) : quant(shade(hex(0xd8fff8), 1 - d / 20 + (r() - .5) * .08), 3); });
PAINT.campfire_log = r => fill((x, y) => quant(shade(hex(0x6a5030), 1 + ((y + (x >> 2)) % 4 === 0 ? -.25 : 0) + (r() - .5) * .12), 3));
PAINT.campfire_log_lit = r => fill((x, y) => r() < 0.35 ? hex(0xff9a30) : quant(shade(hex(0x4a3420), 1 + (r() - .5) * .2), 3));
PAINT.soul_campfire_log_lit = r => fill((x, y) => r() < 0.35 ? hex(0x5ae8f0) : quant(shade(hex(0x4a3420), 1 + (r() - .5) * .2), 3));
PAINT.bell_body = r => fill((x, y) => quant(shade(hex(0xf0c838), 1 + (x < 3 ? .2 : x > 12 ? -.25 : 0) + (y < 2 ? .15 : 0) + (r() - .5) * .08), 3));
PAINT.jukebox_side = r => { planks(hex(0x8a5a3a), r); for (let i = 0; i < 16; i++) { P(i, 0, hex(0x5a3a22)); P(i, 15, hex(0x5a3a22)); P(0, i, hex(0x5a3a22)); P(15, i, hex(0x5a3a22)); } };
PAINT.jukebox_top = r => { PAINT.jukebox_side(r); for (let x = 3; x < 13; x++) { P(x, 7, hex(0x1a1a1a)); P(x, 8, hex(0x2a2a2a)); } };
PAINT.moss_block = r => { const nz = tnoise(r, 4); fill((x, y) => quant(shade(hex(0x5a7a2c), 1 + (nz(x, y) - .5) * .3 + (r() - .5) * .2), 3)); };
PAINT.bricks = r => fill((x, y) => { if (y % 4 === 3) return gray(0x9c + r.int(10)); const off = (y >> 2) % 2 ? 4 : 0; if ((x + off) % 8 === 7) return gray(0xa0); return quant(shade(pal(r, [hex(0x965040), hex(0xa25a47), hex(0x8a4636)]), 1 + (r() - .5) * .1), 3); });
PAINT.stone_bricks = r => { stoneLike(hex(0x7c7c7c), r, 0.18); for (let x = 0; x < 16; x++) { P(x, 7, gray(0x4a)); P(x, 15, gray(0x4a)); P(x, 0, gray(0x95)); P(x, 8, gray(0x95)); } for (let y = 0; y < 8; y++) { P(15, y, gray(0x4a)); P(0, y, gray(0x95)); } for (let y = 8; y < 16; y++) { P(7, y, gray(0x4a)); P(8, y, gray(0x95)); } };
PAINT.white_wool = r => fill((x, y) => quant(shade(hex(0xe9ecec), 1 + ((x + y * 2) % 4 === 0 ? -.07 : 0) + (r() - .5) * .07), 3));
PAINT.short_grass = r => { for (let i = 0; i < 9; i++) { let x = 1 + r.int(14), y = 15, h = 6 + r.int(9); for (let k = 0; k < h; k++) { P(x, y - k, gray(140 + r.int(70)), TINT_A); if (r() < .25) x += r() < .5 ? 1 : -1; x = Math.max(0, Math.min(15, x)); } } };
PAINT.fern = r => { for (let y = 2; y < 16; y++) { P(7, y, gray(130), TINT_A); const w = Math.min(6, Math.floor((16 - y) / 2) + 1); if (y % 2) for (let k = 1; k <= w; k++) { P(7 - k, y - (k >> 1), gray(150 + r.int(60)), TINT_A); P(7 + k, y - (k >> 1), gray(150 + r.int(60)), TINT_A); } } };
function stem(x0, top, col) { for (let y = top; y < 16; y++) P(x0, y, col); }
function flower(r, petal, center, stemC = hex(0x3f8a2a)) { stem(7, 6, stemC); P(6, 11, stemC); P(5, 10, stemC); P(8, 12, stemC); P(9, 11, stemC);
  for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [-1, 0], [1, 0], [0, 1]]) P(7 + dx, 4 + dy, shade(petal, 1 + (r() - .5) * .2)); P(7, 4, center); }
PAINT.dandelion = r => { stem(7, 7, hex(0x3f8a2a)); P(6, 12, hex(0x3f8a2a)); P(8, 11, hex(0x3f8a2a)); for (let y = 3; y < 8; y++) for (let x = 5; x < 10; x++) if (Math.hypot(x - 7, y - 5) < 2.4) P(x, y, pal(r, [hex(0xffec4f), hex(0xf6d01c), hex(0xffff82)])); };
PAINT.poppy = r => { flower(r, hex(0xd0251c), hex(0x2a1a10)); };
PAINT.cornflower = r => flower(r, hex(0x4867d6), hex(0x2a3f99));
PAINT.oxeye_daisy = r => flower(r, hex(0xf4f4f0), hex(0xf2c522));
PAINT.dead_bush = r => { const c = hex(0x7a5a2a); for (let k = 0; k < 4; k++) { let [x, y] = [7, 15]; const dx = [-1, 1, -1, 1][k]; for (let i = 0; i < 9; i++) { P(x, y, shade(c, 1 + (r() - .5) * .3)); y--; if (r() < .6) x += dx; if (x < 1 || x > 14) break; } } };
PAINT.sugar_cane = r => { for (const x0 of [3, 8, 12]) for (let y = 0; y < 16; y++) { const knot = (y + x0) % 6 === 0; P(x0, y, gray(knot ? 210 : 170), TINT_A); P(x0 + 1, y, gray(knot ? 180 : 140), TINT_A); if (y % 6 === 2 && x0 !== 12) P(x0 + 2, y - 1, gray(160), TINT_A); } };
PAINT.cactus_side = r => fill((x, y) => { if (x === 0 || x === 15) return null; let c = shade(hex(0x2f7a24), 1 + (r() - .5) * .1); if (x % 4 === 1) c = hex(0x1f5c18); if ((x % 4 === 3) && (y % 4 === 1)) c = hex(0xd9d9a0); return c; });
PAINT.cactus_top = r => fill((x, y) => { if (x === 0 || x === 15 || y === 0 || y === 15) return null; const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return Math.floor(d) % 3 === 0 ? hex(0x2f7a24) : hex(0x58a53d); });
PAINT.cactus_bottom = r => fill((x, y) => (x === 0 || x === 15 || y === 0 || y === 15) ? null : hex(0x58a53d));
function sapling(r, leaf, trunk) { stem(7, 9, trunk); stem(8, 10, shade(trunk, .8)); for (let i = 0; i < 40; i++) { const x = 3 + r.int(10), y = 1 + r.int(10); if (Math.hypot(x - 7.5, y - 5.5) < 5) P(x, y, shade(leaf, 0.8 + r() * .4)); } }
PAINT.oak_sapling = r => sapling(r, hex(0x4a8f2a), hex(0x6b5433));
PAINT.spruce_sapling = r => { stem(7, 8, hex(0x3d2914)); for (let y = 1; y < 12; y++) { const w = Math.floor((y % 4) + y / 4); for (let x = 7 - w; x <= 8 + w; x++) if (r() < .85) P(x, y, shade(hex(0x2f5a35), 0.8 + r() * .4)); } };
PAINT.birch_sapling = r => sapling(r, hex(0x6c9a3a), hex(0xd9d7cf));
PAINT.brown_mushroom = r => { stem(7, 9, hex(0xd9cfc0)); stem(8, 9, hex(0xbfb5a5)); for (let y = 5; y < 10; y++) for (let x = 3; x < 13; x++) if (Math.abs(x - 7.5) < (y - 3) * 1.4) P(x, y, shade(hex(0x9a7458), 1 + (r() - .5) * .15)); };
PAINT.red_mushroom = r => { stem(7, 9, hex(0xd9cfc0)); stem(8, 9, hex(0xbfb5a5)); for (let y = 4; y < 10; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, (y - 9) * 1.3) < 5.5) P(x, y, (x * 7 + y * 3) % 9 === 0 ? hex(0xffffff) : hex(0xd8261c)); };
PAINT.cobweb = r => { const c = hex(0xe8e8e8); for (let i = 0; i < 16; i++) { P(i, i, c, 220); P(15 - i, i, c, 220); P(i, 8, c, 200); P(8, i, c, 200); } for (const rad of [3, 6]) for (let a = 0; a < 32; a++) { const x = Math.round(8 + Math.cos(a / 32 * Math.PI * 2) * rad), y = Math.round(8 + Math.sin(a / 32 * Math.PI * 2) * rad); P(x, y, c, 200); } };
PAINT.crafting_table_top = r => { planks(hex(0xa88754), r); for (let i = 1; i < 15; i++) { P(i, 1, hex(0x6b5433)); P(i, 14, hex(0x6b5433)); P(1, i, hex(0x6b5433)); P(14, i, hex(0x6b5433)); } for (let i = 2; i < 14; i++) { P(i, 5, hex(0x4a3a22)); P(i, 10, hex(0x4a3a22)); P(5, i, hex(0x4a3a22)); P(10, i, hex(0x4a3a22)); } };
PAINT.crafting_table_side = r => { planks(hex(0xa88754), r); for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) P(x, y, shade(hex(0x6b5433), 1 + (r() - .5) * .1)); for (let y = 6; y < 13; y++) { P(4, y, hex(0x8c8c8c)); P(5, y, hex(0x5a5a5a)); } for (let x = 9; x < 14; x++) { P(x, 6, hex(0x8c8c8c)); P(x, 7, hex(0x5a5a5a)); } for (let y = 8; y < 13; y++) P(11, y, hex(0x5a3f22)); };
PAINT.crafting_table_front = r => { PAINT.crafting_table_side(r); for (let x = 3; x < 13; x++) P(x, 9, hex(0x5a3f22)); for (let x = 4; x < 12; x += 2) { P(x, 10, hex(0xc0c0c0)); P(x, 11, hex(0x8c8c8c)); } };
function furnaceBase(r) { stoneLike(hex(0x8a8a8a), r, 0.22); for (let i = 0; i < 16; i++) { P(i, 0, gray(0x5a)); P(i, 15, gray(0x5a)); P(0, i, gray(0x5a)); P(15, i, gray(0x5a)); } }
PAINT.furnace_side = r => furnaceBase(r);
PAINT.furnace_top = r => { stoneLike(hex(0x8f8f8f), r, 0.15); for (let i = 0; i < 16; i++) { P(i, 0, gray(0x6a)); P(i, 15, gray(0x6a)); P(0, i, gray(0x6a)); P(15, i, gray(0x6a)); } };
PAINT.furnace_front = r => { furnaceBase(r); for (let x = 3; x < 13; x++) P(x, 3, gray(0x4a)); for (let x = 4; x < 12; x++) for (let y = 8; y < 13; y++) P(x, y, y === 8 ? gray(0x3a) : gray(0x1a)); for (let x = 3; x < 13; x++) P(x, 13, gray(0x5a)); };
PAINT.furnace_front_on = r => { PAINT.furnace_front(r); for (let x = 4; x < 12; x++) for (let y = 9; y < 13; y++) P(x, y, (y > 10 || (x * 3 + y) % 4 === 0) ? pal(r, [hex(0xffd84a), hex(0xff9a2e), hex(0xffffa0)]) : hex(0x3a1a08)); };
function chestBase(r) { planks(hex(0xa0712f), r); for (let i = 0; i < 16; i++) { P(i, 0, hex(0x3a2810)); P(i, 15, hex(0x3a2810)); P(0, i, hex(0x3a2810)); P(15, i, hex(0x3a2810)); } }
PAINT.chest_side = r => { chestBase(r); for (let x = 0; x < 16; x++) P(x, 5, hex(0x3a2810)); };
PAINT.chest_top = r => chestBase(r);
PAINT.chest_front = r => { PAINT.chest_side(r); for (let x = 7; x < 9; x++) for (let y = 4; y < 8; y++) P(x, y, y === 4 ? hex(0xe8e8e8) : hex(0xb8b8b8)); P(7, 7, hex(0x3a3a3a)); P(8, 7, hex(0x3a3a3a)); };
PAINT.torch = r => { for (let y = 8; y < 16; y++) { P(7, y, hex(0x8a6a3b)); P(8, y, hex(0x5e4422)); } P(7, 6, hex(0xffffa0)); P(8, 6, hex(0xffd84a)); P(7, 7, hex(0xff9a2e)); P(8, 7, hex(0xffd84a)); P(7, 5, hex(0xffe9a8)); };
PAINT.bookshelf = r => { planks(hex(0xa88754), r); const bc = [hex(0x8a2a1f), hex(0x2a4a8a), hex(0x2f6b2a), hex(0x7a5a2a), hex(0x5a2a6a), hex(0xb08a3a)]; for (const y0 of [1, 9]) { let x = 1; while (x < 15) { const w = 1 + r.int(2), c = pal(r, bc), h = 5 + r.int(2); for (let k = 0; k < w && x < 15; k++, x++) for (let y = y0 + (7 - h); y < y0 + 6; y++) P(x, y, shade(c, k ? .85 : 1)); if (r() < .3) x++; } for (let x2 = 0; x2 < 16; x2++) { P(x2, y0 - 1, hex(0x6b5433)); P(x2, y0 + 6, hex(0x6b5433)); } } };
PAINT.pumpkin_side = r => fill((x, y) => { let c = shade(hex(0xd4801b), 1 + (r() - .5) * .08); if (x % 4 === 0) c = hex(0xb36614); if (x % 4 === 2) c = hex(0xe39a33); if (y === 0 || y === 15) c = shade(c, .85); return c; });
PAINT.pumpkin_top = r => { fill((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return shade(hex(0xd4801b), (Math.floor(d) % 3 === 0 ? .85 : 1) + (r() - .5) * .08); }); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) P(x, y, hex(0x5b6b24)); };
function carved(r, lit) { PAINT.pumpkin_side(r); const inside = lit ? hex(0xffd84a) : hex(0x2a1608); const eye = [[3, 5], [4, 5], [4, 4], [5, 5], [10, 5], [11, 5], [11, 4], [12, 5], [4, 6], [11, 6]]; for (const [x, y] of eye) P(x, y, inside); for (let x = 3; x < 13; x++) { P(x, 10, inside); if (x % 3 !== 0) P(x, 11, inside); } }
PAINT.pumpkin_face = r => carved(r, false);
PAINT.jack_o_lantern = r => carved(r, true);
PAINT.melon_side = r => fill((x, y) => { const s = (x + Math.floor(y / 5)) % 4; return shade(s === 0 ? hex(0x9cb22f) : hex(0x5c8a1c), 1 + (r() - .5) * .12); });
PAINT.melon_top = r => fill((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return shade(Math.floor(d) % 3 === 0 ? hex(0x9cb22f) : hex(0x5c8a1c), 1 + (r() - .5) * .1); });
PAINT.melon_stem = r => stem(7, 4, hex(0x8a9a2a));
PAINT.farmland = r => fill((x, y) => { const furrow = y % 4 === 0 || y % 4 === 3; return quant(shade(hex(0x77553a), (furrow ? 0.72 : 1) + (r() - .5) * .14), 3); });
PAINT.farmland_wet = r => fill((x, y) => { const furrow = y % 4 === 0 || y % 4 === 3; return quant(shade(hex(0x4f331d), (furrow ? 0.72 : 1) + (r() - .5) * .14), 3); });
for (let s = 0; s < 8; s++) PAINT['wheat' + s] = r => {
  const h = 3 + Math.round(s * 1.7), col = s < 4 ? hex(0x3f9a2a) : s < 7 ? mixc(hex(0x6a9a2a), hex(0xbfa33a), (s - 3) / 4) : hex(0xc8a53a);
  for (const x of [1, 4, 7, 10, 13]) { const xx = x + (r() < .5 ? 1 : 0); for (let y = 16 - h; y < 16; y++) P(xx, y, shade(col, 0.85 + r() * .3)); if (s >= 5) for (let y = 16 - h; y < 16 - h + 3; y++) { P(xx - 1, y, shade(hex(0xd8b84a), .9 + r() * .2)); P(xx + 1, y + 1, shade(hex(0xb8982a), .9 + r() * .2)); } }
};
PAINT.tnt_side = r => { fill((x, y) => { let c = (x % 4 === 0) ? hex(0xa0281a) : hex(0xd73a24); if (y < 2 || y > 13) c = shade(c, .85); return c; }); for (let x = 0; x < 16; x++) for (let y = 5; y < 11; y++) P(x, y, hex(0xe8e8e8)); const glyph = ['XXX.X..X.XXX', '.X..XX.X..X.', '.X..X.XX..X.', '.X..X..X..X.']; glyph.forEach((row, gy) => { for (let gx = 0; gx < row.length; gx++) if (row[gx] === 'X') P(2 + gx, 6 + gy, hex(0x1a1a1a)); }); };
PAINT.tnt_top = r => { fill((x, y) => (x % 4 === 0 || y % 4 === 0) ? hex(0xa0281a) : hex(0xd73a24)); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) P(x, y, hex(0x3a3a3a)); P(7, 5, hex(0x8a8a8a)); };
PAINT.tnt_bottom = r => fill((x, y) => (x % 4 === 0 || y % 4 === 0) ? hex(0xa0281a) : hex(0xd73a24));
PAINT.bed_head = r => fill((x, y) => { if (y < 7 && x > 1 && x < 14) return shade(hex(0xf0f0f0), 1 + (r() - .5) * .05); if (x === 0 || x === 15) return hex(0x8a1a12); return shade(hex(0xb2241a), 1 + (r() - .5) * .08); });
PAINT.bed_foot = r => fill((x, y) => { if (x === 0 || x === 15 || y === 15) return hex(0x8a1a12); return shade(hex(0xb2241a), 1 + (r() - .5) * .08); });
PAINT.bed_side = r => fill((x, y) => y < 9 && y >= 3 ? (y < 5 ? hex(0xf0f0f0) : hex(0xb2241a)) : hex(0x8a6a3b));
PAINT.oak_door_bottom = r => { planks(hex(0x9c7b47), r); for (let i = 0; i < 16; i++) { P(i, 15, hex(0x5e4422)); P(0, i, hex(0x6b5433)); P(15, i, hex(0x6b5433)); } for (let y = 2; y < 14; y += 4) for (let x = 2; x < 14; x++) P(x, y, hex(0x7a5a32)); P(12, 2, hex(0x3a3a3a)); };
PAINT.oak_door_top = r => { planks(hex(0x9c7b47), r); for (let i = 0; i < 16; i++) { P(i, 0, hex(0x5e4422)); P(0, i, hex(0x6b5433)); P(15, i, hex(0x6b5433)); } for (const [x0, y0] of [[2, 2], [9, 2], [2, 9], [9, 9]]) for (let x = x0; x < x0 + 5; x++) for (let y = y0; y < y0 + 5; y++) P(x, y, null) || (AD[((((curTile / TPR) | 0) * TS + y) * ATLAS_W + (curTile % TPR) * TS + x) * 4 + 3] = 0); P(12, 14, hex(0x3a3a3a)); };
PAINT.ladder = r => { for (let y = 0; y < 16; y++) { P(2, y, hex(0x8a6a3b)); P(3, y, hex(0x6b5433)); P(12, y, hex(0x8a6a3b)); P(13, y, hex(0x6b5433)); } for (const y of [1, 5, 9, 13]) for (let x = 2; x < 14; x++) { P(x, y, hex(0x9c7b47)); P(x, y + 1, hex(0x6b5433)); } };
PAINT.lantern = r => { for (let x = 0; x < 6; x++) for (let y = 2; y < 9; y++) P(x, y, (y === 2 || y === 8 || x === 0 || x === 5) ? hex(0x3a3d44) : (y > 3 && y < 8) ? pal(r, [hex(0xffd84a), hex(0xffa830), hex(0xfff0a0)]) : hex(0x4a4d55)); for (let x = 0; x < 6; x++) for (let y = 9; y < 15; y++) P(x, y, hex(0x3f424a)); for (let x = 1; x < 5; x++) { P(x, 10, hex(0x3a3d44)); P(x, 0, hex(0x3a3d44)); P(x, 1, hex(0x2a2d33)); } for (let y = 1; y < 7; y++) { P(11, y, hex(0x3a3d44)); P(12, y, hex(0x2a2d33)); } };
PAINT.spawner = r => fill((x, y) => { if (x % 4 === 0 || y % 4 === 0 || x === 15 || y === 15) return shade(hex(0x2a3a4a), 1 + (r() - .5) * .3); return null; });
PAINT.smooth_basalt = r => stoneLike(hex(0x4c4b51), r, 0.14);
PAINT.enchanting_table_top = r => { PAINT.obsidian(r); for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) P(x, y, (x + y) % 5 === 0 ? hex(0xa8202a) : hex(0xc8303a)); for (const [x, y] of [[0, 0], [14, 0], [0, 14], [14, 14]]) { P(x, y, hex(0x8af0e8)); P(x + 1, y, hex(0x3ac8c0)); P(x, y + 1, hex(0x3ac8c0)); P(x + 1, y + 1, hex(0x1a8a84)); } };
PAINT.enchanting_table_side = r => { PAINT.obsidian(r); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) P(x, y, y === 3 ? hex(0x6a1018) : (x + y) % 5 === 0 ? hex(0xa8202a) : hex(0xc8303a)); for (const x of [2, 6, 10, 13]) { P(x, 8, hex(0x3ac8c0)); P(x, 9, hex(0x1a8a84)); } };
PAINT.glow_lichen = r => { const nz = tnoise(r, 4); fill((x, y) => { const v = nz(x, y) + (r() - .5) * .35; return v > 0.62 ? (r() < 0.25 ? hex(0xd8ffe0) : hex(0x86c8a0)) : v > 0.5 ? hex(0x5f9478) : null; }); };

PAINT.end_portal = r => fill(() => { const v = r(); return v > 0.96 ? pal(r, [hex(0x9fe8d8), hex(0xd8f0ff), hex(0x6fc8ff)]) : v > 0.9 ? hex(0x1b3a40) : pal(r, [hex(0x050a10), hex(0x08101a), hex(0x0a1420)]); });
function paintAtlas() {
  S.TILES.forEach((name, i) => {
    curTile = i;
    const f = PAINT[name];
    if (f) f(trng(i * 7919 + 13)); else fill(() => hex(0xff00ff));
  });
  atlasCtx.putImageData(atlasImg, 0, 0);
}
paintAtlas();
// animate water/lava frames (called a few times per second)
let animT = 0;
function animateAtlas(dt) {
  animT += dt * 6;
  curTile = S.T.water; paintWater(null, animT);
  curTile = S.T.lava; paintLava(null, animT * 0.5);
  for (const t of [S.T.water, S.T.lava]) atlasCtx.putImageData(atlasImg, 0, 0, (t % TPR) * TS, ((t / TPR) | 0) * TS, TS, TS);
}

// ---------- resource pack (Pixel Perfection CE, CC BY-SA 4.0) ----------
// js/pack.js holds raw RGBA pixels (gzip+base64); they are written straight into the atlas
// and sprite buffers, so no image decoding or canvas readback happens at runtime.
const PACKPX = { data: null, items: {}, ent: {}, anim: {} };
async function loadPack() {
  if (typeof PACK === 'undefined' || !window.DecompressionStream) return false;
  try {
    const bin = Uint8Array.from(atob(PACK.data), c => c.charCodeAt(0));
    const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const D = new Uint8Array(buf); PACKPX.data = D;
    for (const [name, off] of Object.entries(PACK.tiles)) {
      const t = S.T[name]; if (t == null) continue;
      const tx = (t % TPR) * TS, ty = ((t / TPR) | 0) * TS;
      for (let y = 0; y < TS; y++) AD.set(D.subarray(off + y * 64, off + y * 64 + 64), ((ty + y) * ATLAS_W + tx) * 4);
    }
    for (const [k, [off, frames]] of Object.entries(PACK.anim)) if (S.T[k] != null) PACKPX.anim[k] = { off, frames };
    for (const [k, off] of Object.entries(PACK.items)) PACKPX.items[k] = D.subarray(off, off + 1024);
    for (const [k, [off, w, h]] of Object.entries(PACK.ent)) PACKPX.ent[k] = { px: D.subarray(off, off + w * h * 4), w, h };
    if (PACK.sky) { const [off, w, h] = PACK.sky; PACKPX.sky = { px: D.subarray(off, off + w * h * 4), w, h }; }
    for (const k in PACKPX.anim) { const a = PACKPX.anim[k], t = S.T[k], tx = (t % TPR) * TS, ty = ((t / TPR) | 0) * TS; for (let y = 0; y < TS; y++) AD.set(D.subarray(a.off + y * 64, a.off + y * 64 + 64), ((ty + y) * ATLAS_W + tx) * 4); }
    atlasCtx.putImageData(atlasImg, 0, 0);
    return true;
  } catch (e) { console.warn('texture pack unavailable', e); return false; }
}
// one 16x16 frame of an animated tile (water, lava, portal, fire, magma)
function animFrame(k, i) { const a = PACKPX.anim[k]; if (!a) return null; const f = i % a.frames; return PACKPX.data.subarray(a.off + f * 1024, a.off + f * 1024 + 1024); }

// ---------- tinted tile canvas helper (for icons, particles) ----------
const DEFAULT_TINT = { 1: hex(0x7cbd6b), 2: hex(0x59ae30), 3: hex(0x3f76e4), 4: hex(0x80a755), 5: hex(0x619961) };
function tileCanvas(t, tint, scale = 1) {
  const c = document.createElement('canvas'); c.width = c.height = TS * scale; const g = c.getContext('2d');
  const img = g.createImageData(TS, TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const si = ((((t / TPR) | 0) * TS + y) * ATLAS_W + (t % TPR) * TS + x) * 4, di = (y * TS + x) * 4;
    let r = AD[si], gg = AD[si + 1], b = AD[si + 2], a = AD[si + 3];
    if (a === TINT_A) { const tc = tint || DEFAULT_TINT[1]; r = r * tc[0] / 255; gg = gg * tc[1] / 255; b = b * tc[2] / 255; a = 255; }
    img.data[di] = r; img.data[di + 1] = gg; img.data[di + 2] = b; img.data[di + 3] = a;
  }
  c._px = img.data;
  if (scale === 1) { g.putImageData(img, 0, 0); return c; }
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = TS; tmp.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(tmp, 0, 0, TS * scale, TS * scale); return c;
}

// ---------- item icon sheet ----------
const ICON = 32, ICON_COLS = 32;
const iconCanvas = document.createElement('canvas');
const iconIndex = {}; // item id -> cell
const spritePix = {}; // item id -> 16x16 RGBA of flat item sprites
let iconCount = 0;
function iconCell() { const k = iconCount++; return k; }

// small sprite DSL on a 16x16 grid
// sprites keep their pixels in c._px so item meshes never need a (slow) canvas readback
function sprite(draw) { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); const px = new Uint8ClampedArray(16 * 16 * 4); const p = (x, y, col) => { if (x < 0 || y < 0 || x > 15 || y > 15 || !col) return; const rgb = typeof col === 'string' ? hex(parseInt(col.slice(1), 16)) : col; const i = (y * 16 + x) * 4; px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255; }; draw(p, g); g.putImageData(new ImageData(px, 16, 16), 0, 0); c._px = px; return c; }
function line(p, x0, y0, x1, y1, col) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) p(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), typeof col === 'function' ? col(i, n) : col); }
// mask -> shaded pixels (light top-left, dark bottom-right edges)
function maskDraw(p, pts, cols) {
  const set = new Set(pts.map(([x, y]) => x + ',' + y)); const has = (x, y) => set.has(x + ',' + y);
  for (const [x, y] of pts) {
    let c = cols[1];
    if (!has(x - 1, y) || !has(x, y - 1)) c = cols[0];
    if (!has(x + 1, y) || !has(x, y + 1)) c = cols[2];
    if (!has(x + 1, y + 1) && !has(x + 1, y) && !has(x, y + 1)) c = cols[3] || cols[2];
    p(x, y, c);
  }
}
const MATC = { wooden: [hex(0xc29d62), hex(0x9c7b47), hex(0x6b5433), hex(0x46351d)], stone: [hex(0xa8a8a8), hex(0x838383), hex(0x5c5c5c), hex(0x3a3a3a)],
  iron: [hex(0xffffff), hex(0xd8d8d8), hex(0x9a9a9a), hex(0x4f4f4f)], golden: [hex(0xfffd9e), hex(0xf2d43a), hex(0xbf8f1b), hex(0x6e4e0a)],
  diamond: [hex(0xd2fff8), hex(0x4aedd9), hex(0x1aa59a), hex(0x0c5c55)], leather: [hex(0xc88a5a), hex(0xa0603a), hex(0x7a4424), hex(0x4f2a14)],
  netherite: [hex(0x6a6266), hex(0x4d4649), hex(0x3a3436), hex(0x221e1f)], chainmail: [hex(0xd0d0d0), hex(0x9a9a9a), hex(0x6a6a6a), hex(0x3a3a3a)], elytra: [hex(0xa8a0c0), hex(0x7a7090), hex(0x5a5070), hex(0x3a3050)] };
const HANDLE = [hex(0x8a6a3b), hex(0x5e4422)];
function handle(p, x0, y0, x1, y1) { line(p, x0, y0, x1, y1, HANDLE[0]); line(p, x0 + 1, y0, x1 + 1, y1, HANDLE[1]); }
function toolSprite(kind, m) {
  const c = MATC[m];
  return sprite(p => {
    const pts = [];
    if (kind === 'sword') {
      for (let t = 0; t <= 9; t++) { pts.push([14 - t, 1 + t], [13 - t, 1 + t], [14 - t, 2 + t]); } pts.push([15, 0], [14, 0], [15, 1]);
      line(p, 2, 13, 4, 11, HANDLE[0]); line(p, 3, 13, 5, 11, HANDLE[1]); p(1, 14, c[3]); p(2, 14, c[2]); p(1, 13, c[2]);
      maskDraw(p, pts.filter(([x, y]) => x + y < 17 ? true : true), c);
      line(p, 2, 9, 7, 14, c[3]); line(p, 3, 9, 7, 13, c[2]);
    } else {
      handle(p, 2, 13, 10, 5);
      if (kind === 'pickaxe') { for (let s = -6; s <= 6; s++) { const bend = Math.round(s * s / 12); const x = 10 + Math.round(s * 0.72) - bend, y = 5 + Math.round(s * 0.72) * -1 * -1 - bend; pts.push([x, y], [x + 1, y], [x, y - 1]); } maskDraw(p, pts.map(([x, y]) => [x, y]).filter(([x, y]) => x >= 0 && y >= 0), c); handle(p, 8, 7, 10, 5); }
      else if (kind === 'axe') { for (let y = 1; y <= 7; y++) for (let x = 5; x <= 11; x++) { const dx = x - 8, dy = y - 3.5; if (dx * dx / 10 + dy * dy / 9 < 1 && x - y < 8 && !(x >= 9 && y >= 4)) pts.push([x, y]); } maskDraw(p, pts, c); handle(p, 9, 6, 12, 3); }
      else if (kind === 'shovel') { for (let y = 0; y <= 7; y++) for (let x = 8; x <= 15; x++) { const u = (x - 12) + (y - 3.5), v = (x - 12) - (y - 3.5); if (Math.abs(u) <= 3.6 && Math.abs(v) <= 2.6) pts.push([x, y]); } maskDraw(p, pts, c); }
      else if (kind === 'hoe') { for (let x = 6; x <= 12; x++) pts.push([x, 2], [x, 3]); pts.push([12, 4]); maskDraw(p, pts, c); handle(p, 10, 5, 12, 3); }
    }
  });
}
function armorSprite(slot, m) {
  const c = MATC[m];
  const shapes = [
    ['................', '................', '...##########...', '..############..', '..############..', '..###......###..', '..##........##..', '..##........##..'],
    ['..####....####..', '.##############.', '.##############.', '.##############.', '..############..', '...##########...', '...##########...', '...##########...', '...##########...', '...##########...', '...##########...', '....########....'],
    ['..############..', '..############..', '..############..', '..#####..#####..', '..####....####..', '..####....####..', '..####....####..', '..####....####..', '..####....####..', '..####....####..', '..####....####..', '..####....####..'],
    ['................', '................', '................', '................', '..###......###..', '..###......###..', '..###......###..', '.####......####.', '#####......#####', '#####......#####'],
  ];
  return sprite(p => { const pts = []; const sh = shapes[slot], oy = slot === 0 ? 3 : slot === 1 ? 2 : slot === 2 ? 2 : 2; sh.forEach((row, y) => { for (let x = 0; x < 16; x++) if (row[x] === '#') pts.push([x, y + oy]); }); maskDraw(p, pts, c); });
}
function blob(p, cx, cy, rx, ry, cols, rnd) { const pts = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2; if (d < 1 - (rnd ? rnd(x, y) : 0)) pts.push([x, y]); } maskDraw(p, pts, cols); return pts; }
const jag = (x, y) => (((x * 7 + y * 13) % 5) / 5) * 0.35;
const SPR = {
  stick: () => sprite(p => { line(p, 3, 12, 12, 3, HANDLE[0]); line(p, 4, 12, 13, 3, HANDLE[1]); }),
  coal: () => sprite(p => { blob(p, 8, 8.5, 5.5, 5, [hex(0x4a4a4a), hex(0x2a2a2a), hex(0x1a1a1a), hex(0x0a0a0a)], jag); p(6, 6, hex(0x6a6a6a)); }),
  charcoal: () => sprite(p => { blob(p, 8, 8.5, 5.5, 5, [hex(0x5a4a3a), hex(0x3a2e24), hex(0x2a2018), hex(0x14100c)], jag); }),
  raw_iron: () => sprite(p => blob(p, 8, 8.5, 5.5, 5, [hex(0xf0d8c6), hex(0xd8af93), hex(0xa27e63), hex(0x6e5444)], jag)),
  raw_gold: () => sprite(p => blob(p, 8, 8.5, 5.5, 5, [hex(0xfffb9e), hex(0xf6c836), hex(0xb88a12), hex(0x7a5a0a)], jag)),
  raw_copper: () => sprite(p => blob(p, 8, 8.5, 5.5, 5, [hex(0xf6b48a), hex(0xd67a4a), hex(0x9c4d2f), hex(0x5f2a14)], jag)),
  iron_ingot: () => ingot(MATC.iron), gold_ingot: () => ingot(MATC.golden), copper_ingot: () => ingot([hex(0xf6b48a), hex(0xd67a4a), hex(0x9c4d2f), hex(0x5f2a14)]),
  iron_nugget: () => sprite(p => blob(p, 8, 9, 3.5, 3, MATC.iron)), gold_nugget: () => sprite(p => blob(p, 8, 9, 3.5, 3, MATC.golden)),
  diamond: () => sprite(p => { const rows = [[6, 9], [4, 11], [3, 12], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]]; const pts = []; rows.forEach(([a, b], k) => { for (let x = a; x <= b; x++) pts.push([x, 4 + k]); }); maskDraw(p, pts, MATC.diamond); p(5, 6, hex(0xffffff)); }),
  emerald: () => sprite(p => { const pts = []; for (let y = 2; y < 14; y++) { const w = y < 5 ? y - 1 : y > 10 ? 14 - y : 3; for (let x = 8 - w; x < 8 + w; x++) pts.push([x, y]); } maskDraw(p, pts, [hex(0xa2ffc4), hex(0x17dd62), hex(0x00a03a), hex(0x005a20)]); }),
  lapis_lazuli: () => sprite(p => blob(p, 8, 8, 5, 5.5, [hex(0x5a8ae8), hex(0x2357b5), hex(0x163c84), hex(0x0c2050)], jag)),
  redstone: () => sprite(p => { for (let i = 0; i < 26; i++) { const a = i * 2.4, r = (i % 7) * 0.8; p(Math.round(8 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r * 0.8), i % 3 ? hex(0xd40000) : hex(0xff4b4b)); } }),
  flint: () => sprite(p => { const pts = []; for (let y = 3; y < 14; y++) for (let x = 4; x < 12; x++) if (Math.abs(x - 8 + (y - 8) * 0.3) < (y < 8 ? (y - 2) * 0.8 : (14 - y) * 0.6)) pts.push([x, y]); maskDraw(p, pts, [hex(0x8a8a8a), hex(0x4a4a4a), hex(0x2a2a2a), hex(0x111111)]); }),
  flint_and_steel: () => sprite(p => { for (let a = 0; a < 20; a++) { const x = Math.round(6 + Math.cos(a / 20 * 6.28) * 3.5), y = Math.round(6 + Math.sin(a / 20 * 6.28) * 3.5); p(x, y, a < 10 ? hex(0xd8d8d8) : hex(0x8a8a8a)); } const pts = []; for (let y = 9; y < 15; y++) for (let x = 9; x < 15; x++) if (Math.abs(x - 11.5) + Math.abs(y - 11.5) < 3.5) pts.push([x, y]); maskDraw(p, pts, [hex(0x8a8a8a), hex(0x4a4a4a), hex(0x2a2a2a), hex(0x111111)]); }),
  string: () => sprite(p => { let x = 3, y = 3; for (let i = 0; i < 16; i++) { p(x, y, hex(0xf0f0f0)); p(x + 1, y, hex(0xc8c8c8)); x += i % 3 === 0 ? 0 : 1; y += i % 3 === 2 ? 0 : 1; x = Math.min(14, x); y = Math.min(14, y); } }),
  feather: () => sprite(p => { line(p, 3, 13, 12, 3, hex(0x9a9a9a)); for (let i = 0; i < 9; i++) { const x = 4 + i, y = 12 - i; for (let k = 1; k <= 2 + (i > 2 && i < 7 ? 1 : 0); k++) { p(x - k, y - k, hex(0xffffff)); p(x + k, y + k, hex(0xd8d8d8)); } } }),
  gunpowder: () => sprite(p => { for (let i = 0; i < 40; i++) { const a = i * 2.39, r = Math.sqrt(i) * 0.9; p(Math.round(8 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r * 0.7), i % 3 ? hex(0x4a4a4a) : hex(0x8a8a8a)); } }),
  bone: () => sprite(p => { line(p, 4, 11, 11, 4, hex(0xf2efe0)); line(p, 5, 11, 11, 5, hex(0xc8c4b0)); for (const [x, y] of [[2, 11], [3, 12], [4, 13], [2, 12], [11, 2], [12, 3], [13, 4], [12, 2]]) p(x, y, hex(0xf2efe0)); }),
  bone_meal: () => sprite(p => { for (let i = 0; i < 40; i++) { const a = i * 2.39, r = Math.sqrt(i) * 0.95; p(Math.round(8 + Math.cos(a) * r), Math.round(10 + Math.sin(a) * r * 0.6), i % 4 ? hex(0xf2efe0) : hex(0xb8b4a0)); } }),
  arrow: () => sprite(p => { line(p, 3, 12, 12, 3, hex(0x8a6a3b)); for (const [x, y] of [[12, 3], [13, 2], [11, 2], [13, 4], [12, 2], [13, 3]]) p(x, y, hex(0xb8b8b8)); for (const [x, y] of [[2, 13], [3, 14], [1, 12], [2, 11], [4, 13], [3, 12]]) p(x, y, hex(0xf0f0f0)); }),
  bow: () => sprite(p => { for (let i = 0; i < 12; i++) { const t = i / 11, x = Math.round(2 + t * 11 + Math.sin(t * Math.PI) * 3), y = Math.round(13 - t * 11 + Math.sin(t * Math.PI) * 3); p(x, y, i % 2 ? hex(0x8a6a3b) : hex(0x5e4422)); p(x - 1, y, hex(0x5e4422)); } line(p, 2, 12, 12, 2, hex(0xe8e8e8)); }),
  leather: () => sprite(p => blob(p, 8, 8, 6, 5.5, MATC.leather, (x, y) => ((x * 3 + y * 5) % 7) / 7 * 0.3)),
  wheat_seeds: () => sprite(p => { for (const [x, y] of [[5, 6], [9, 5], [7, 9], [11, 9], [4, 11], [8, 12], [12, 12], [6, 4]]) { p(x, y, hex(0x5aa82a)); p(x + 1, y, hex(0x3a7a1a)); p(x, y + 1, hex(0x2a5a12)); } }),
  wheat: () => sprite(p => { for (const x0 of [4, 7, 10]) { line(p, x0, 15, x0 + 2, 3, hex(0xb8982a)); for (let y = 2; y < 8; y++) { p(x0 + 2 - ((y - 2) >> 2) - 1, y, hex(0xd8b84a)); p(x0 + 3 - ((y - 2) >> 2), y, hex(0xc8a53a)); } } }),
  bread: () => sprite(p => { const pts = []; for (let y = 5; y < 12; y++) for (let x = 1; x < 15; x++) if (((x - 8) / 7) ** 2 + ((y - 8.5) / 3.5) ** 2 < 1) pts.push([x, y]); maskDraw(p, pts, [hex(0xe8b060), hex(0xc8862e), hex(0x9a5e1a), hex(0x5a3a0a)]); for (const x of [5, 8, 11]) p(x, 7, hex(0xf0d090)); }),
  apple: () => apple([hex(0xff6a5a), hex(0xd8261c), hex(0x9a1410), hex(0x5a0a08)]),
  golden_apple: () => apple(MATC.golden),
  porkchop: () => meat([hex(0xffb0b0), hex(0xf08a8a), hex(0xc86464), hex(0x8a3a3a)]), cooked_porkchop: () => meat([hex(0xd8a070), hex(0xb07a48), hex(0x7a5028), hex(0x4a2a10)]),
  beef: () => meat([hex(0xf06a5a), hex(0xc8382a), hex(0x8a1a12), hex(0x5a0a08)]), cooked_beef: () => meat([hex(0xa0704a), hex(0x7a4a28), hex(0x50301a), hex(0x2a1608)]),
  chicken: () => drum([hex(0xf8d8c8), hex(0xe8b8a0), hex(0xb88a72)]), cooked_chicken: () => drum([hex(0xe0a860), hex(0xb87a38), hex(0x7a4a1a)]),
  mutton: () => meat([hex(0xf08a7a), hex(0xd05a4a), hex(0x9a2a1a), hex(0x5a0a08)]), cooked_mutton: () => meat([hex(0xc08a5a), hex(0x9a6038), hex(0x6a3a1a), hex(0x3a1a08)]),
  rotten_flesh: () => meat([hex(0xb8a060), hex(0x8a7a3a), hex(0x6a5a2a), hex(0x3a2a10)]),
  melon_slice: () => sprite(p => { for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot(x - 2, y - 14); if (d < 11 && d > 9.6) p(x, y, hex(0x3a7a1a)); else if (d <= 9.6 && x - 2 > 0 && 14 - y > 0) p(x, y, (x * 3 + y) % 7 === 0 ? hex(0x1a1a1a) : hex(0xe0402a)); } }),
  bowl: () => bowl(null), mushroom_stew: () => bowl(hex(0xb08a5a)),
  sugar: () => sprite(p => { for (let i = 0; i < 36; i++) { const a = i * 2.39, r = Math.sqrt(i) * 0.95; p(Math.round(8 + Math.cos(a) * r), Math.round(10 + Math.sin(a) * r * 0.6), i % 3 ? hex(0xffffff) : hex(0xd8d8e8)); } }),
  paper: () => sprite(p => { for (let y = 2; y < 14; y++) for (let x = 3 + (y >> 3); x < 13 + (y >> 3); x++) p(x, y, (x + y) % 9 === 0 ? hex(0xd8d8d0) : hex(0xf4f4ec)); }),
  book: () => sprite(p => { for (let y = 2; y < 14; y++) for (let x = 3; x < 13; x++) p(x, y, x < 5 ? hex(0x5a3a1a) : y > 11 ? hex(0xf0f0e0) : hex(0x8a5a2a)); for (let x = 5; x < 13; x++) p(x, 12, hex(0xe8e8d8)); }),
  bucket: () => bucket(null), water_bucket: () => bucket(hex(0x3f76e4)), lava_bucket: () => bucket(hex(0xfd8a2c)), milk_bucket: () => bucket(hex(0xffffff)), powder_snow_bucket: () => bucket(hex(0xeef4f8)),
  snowball: () => sprite(p => blob(p, 8, 8, 5, 5, [hex(0xffffff), hex(0xeef4f8), hex(0xc8d4dc), hex(0x9aa8b0)])),
  egg: () => sprite(p => blob(p, 8, 8.5, 4.2, 5.5, [hex(0xfff4dc), hex(0xe8d8b0), hex(0xc8b088), hex(0x8a7a58)])),
  clay_ball: () => sprite(p => blob(p, 8, 8.5, 5, 4.5, [hex(0xc0c6d4), hex(0xa0a6b4), hex(0x7a8090), hex(0x4a5060)], jag)),
  brick: () => sprite(p => { const pts = []; for (let y = 5; y < 12; y++) for (let x = 2 + Math.max(0, 7 - y); x < 14 - Math.max(0, y - 9); x++) pts.push([x, y]); maskDraw(p, pts, [hex(0xd8806a), hex(0xb05a44), hex(0x8a3a28), hex(0x5a1a10)]); }),
  amethyst_shard: () => sprite(p => { const pts = []; for (let t = 0; t < 10; t++) { pts.push([4 + t, 12 - t], [5 + t, 12 - t], [4 + t, 11 - t]); } maskDraw(p, pts, [hex(0xe8c8fa), hex(0xb18de6), hex(0x7f55b4), hex(0x4a2a80)]); }),
  spyglass: () => sprite(p => { line(p, 3, 12, 12, 3, hex(0xd67a4a)); line(p, 4, 12, 13, 3, hex(0x9c4d2f)); line(p, 3, 11, 12, 2, hex(0xf6b48a)); p(12, 2, hex(0xb18de6)); p(13, 2, hex(0x7f55b4)); p(13, 3, hex(0x7f55b4)); p(5, 10, hex(0x4a2a1a)); p(6, 9, hex(0x4a2a1a)); }),
  shears: () => sprite(p => { line(p, 3, 4, 11, 12, hex(0xd8d8d8)); line(p, 4, 4, 12, 12, hex(0x8a8a8a)); line(p, 11, 4, 3, 12, hex(0xd8d8d8)); for (const [x, y] of [[2, 12], [3, 13], [12, 12], [13, 13], [2, 13], [13, 12]]) p(x, y, hex(0xa02a1a)); }),
  saddle: () => sprite(p => blob(p, 8, 9, 6, 4, MATC.leather)),
  ink_sac: () => sprite(p => { blob(p, 8, 9, 5, 5.5, [hex(0x4a4a5a), hex(0x2a2a36), hex(0x16161e), hex(0x08080c)]); p(7, 3, hex(0x2a2a36)); p(8, 3, hex(0x2a2a36)); p(6, 7, hex(0x6a6a7a)); }),
  glow_ink_sac: () => sprite(p => { blob(p, 8, 9, 5, 5.5, [hex(0x9afff0), hex(0x2ad9c5), hex(0x14907f), hex(0x0a4a42)]); p(7, 3, hex(0x2ad9c5)); p(8, 3, hex(0x2ad9c5)); p(6, 7, hex(0xffffff)); }),
  name_tag: () => sprite(p => { const pts = []; for (let y = 5; y < 12; y++) for (let x = 3; x < 14; x++) if (x - 3 > Math.abs(y - 8.5) - 2) pts.push([x, y]); maskDraw(p, pts, [hex(0xf0e0c0), hex(0xd0b890), hex(0xa08a60), hex(0x6a5a3a)]); p(5, 8, hex(0x3a3a3a)); }),
  bed_item: () => sprite(p => { for (let x = 1; x < 15; x++) for (let y = 6; y < 11; y++) p(x, y, x < 5 && y < 9 ? hex(0xf0f0f0) : hex(0xb2241a)); for (let x = 1; x < 15; x++) p(x, 11, hex(0x8a6a3b)); p(1, 12, hex(0x6b5433)); p(14, 12, hex(0x6b5433)); }),
  oak_door_item: () => sprite(p => { for (let y = 1; y < 15; y++) for (let x = 4; x < 12; x++) p(x, y, (y === 1 || y === 14 || x === 4 || x === 11) ? hex(0x6b5433) : (y < 7 && (x === 6 || x === 9) ? hex(0x3a2a14) : hex(0x9c7b47))); p(10, 8, hex(0x3a3a3a)); }),
  lantern_item: () => sprite(p => { for (let x = 5; x < 11; x++) for (let y = 5; y < 13; y++) p(x, y, (y === 5 || y === 12 || x === 5 || x === 10) ? hex(0x3a3d44) : hex(0xffc84a)); for (let x = 6; x < 10; x++) p(x, 4, hex(0x3a3d44)); p(7, 2, hex(0x3a3d44)); p(8, 2, hex(0x3a3d44)); p(7, 3, hex(0x2a2d33)); p(8, 3, hex(0x2a2d33)); }),
  sugar_cane_item: () => sprite(p => { for (const x0 of [4, 8, 11]) for (let y = 1; y < 15; y++) { p(x0, y, (y + x0) % 5 === 0 ? hex(0xa8d878) : hex(0x88c060)); p(x0 + 1, y, hex(0x5a9a3a)); } }),
};
function candleSprite(col) { return sprite(p => { const c = hex(col); for (let y = 5; y < 15; y++) for (let x = 6; x < 10; x++) p(x, y, shade(c, x === 6 ? 1.15 : x === 9 ? 0.75 : 1)); for (let x = 6; x < 10; x++) p(x, 5, shade(c, 1.25)); p(7, 3, hex(0x2a2420)); p(7, 4, hex(0x2a2420)); }); }
Object.assign(SPR, {
  honeycomb: () => sprite(p => { for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) { const dx = Math.abs(x - 7.5), dy = Math.abs(y - 8); if (dx + dy * 0.6 > 7) continue; const cell = ((x >> 1) + (y >> 2)) % 3 === 0; p(x, y, cell ? hex(0xb8701a) : (x + y) % 5 === 0 ? hex(0xffd860) : hex(0xf0a828)); } }),
  candle_item: () => candleSprite(CANDLE_COL.candle),
  lightning_rod_item: () => sprite(p => { for (let y = 5; y < 16; y++) { p(7, y, hex(0xe89a74)); p(8, y, hex(0xa8553a)); } for (let y = 1; y < 5; y++) for (let x = 6; x < 10; x++) p(x, y, x === 6 || y === 1 ? hex(0xf6b48a) : x === 9 ? hex(0x9c4d2f) : hex(0xd47a55)); }),
  tropical_fish: () => sprite(p => { for (let y = 5; y < 12; y++) for (let x = 3; x < 12; x++) if (((x - 7) / 4.5) ** 2 + ((y - 8.5) / 3.2) ** 2 < 1) p(x, y, x === 7 || x === 8 ? hex(0xf4f4f4) : hex(0xf08a20)); for (let y = 6; y < 12; y++) p(12 + (Math.abs(y - 8.5) > 1.5 ? 1 : 0), y, hex(0xf08a20)); p(5, 7, hex(0x101010)); }),
  axolotl_bucket: () => sprite(p => { const b = SPR.water_bucket(); const d = b._px; for (let i = 0; i < 256; i++) if (d[i * 4 + 3]) p(i & 15, i >> 4, [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]); for (const [x, y] of [[6, 5], [7, 5], [8, 5], [9, 5], [7, 6], [8, 6], [5, 4], [10, 4]]) p(x, y, hex(0xf5a0c4)); p(7, 5, hex(0x2a1a2a)); }),
  tropical_fish_bucket: () => sprite(p => { const b = SPR.water_bucket(); const d = b._px; for (let i = 0; i < 256; i++) if (d[i * 4 + 3]) p(i & 15, i >> 4, [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]); for (const [x, y] of [[6, 5], [7, 5], [8, 5], [9, 5], [7, 6], [8, 6]]) p(x, y, x === 7 ? hex(0xf4f4f4) : hex(0xf08a20)); }),
});
for (const c of S.COLORS) SPR[c + '_candle_item'] = () => candleSprite(CANDLE_COL[c]);
// potions: bottle (drinkable), round splash flask, lingering flask with a long neck, tipped arrow with a coloured head
function potionSprite(col, form) {
  const c = hex(col), glass = hex(0xd8e8f4), dark = shade(c, 0.6), light = mixc(c, [255, 255, 255], 0.4);
  if (form === 3) return sprite(p => { line(p, 3, 12, 11, 4, hex(0x8a6a3b)); for (const [x, y] of [[11, 4], [12, 3], [10, 3], [12, 5], [11, 3], [12, 4], [13, 2]]) p(x, y, c); for (const [x, y] of [[2, 13], [3, 14], [1, 12], [2, 11], [4, 13], [3, 12]]) p(x, y, hex(0xf0f0f0)); });
  return sprite(p => {
    const neck = form === 2 ? 5 : 3, top = 2;
    for (let y = top; y < top + neck; y++) { p(7, y, glass); p(8, y, glass); }
    p(6, top, hex(0x8a6a3b)); p(7, top, hex(0x8a6a3b)); p(8, top, hex(0x8a6a3b)); p(9, top, hex(0x8a6a3b));
    const cy = form === 1 ? 10 : 10.5, rx = form === 1 ? 5 : 4.5, ry = form === 1 ? 4.5 : 4.5;
    for (let y = top + neck; y < 16; y++) for (let x = 1; x < 15; x++) { const d = ((x + .5 - 8) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2; if (d > 1) continue; p(x, y, d > 0.72 ? glass : y < cy - 1 ? light : x < 7 ? c : dark); }
    p(6, Math.round(cy) - 1, hex(0xffffff));
  });
}
for (const d of ITEMS) if (d && d.pcol != null) SPR[d.key] = () => potionSprite(d.pcol, d.form);
SPR.glass_bottle = () => potionSprite(0xd8e8f4, 0); SPR.dragon_breath = () => potionSprite(0xc87ad8, 0);
SPR.fermented_spider_eye = () => sprite(p => { blob(p, 8, 9, 5, 4.5, [hex(0xc86a5a), hex(0x9a3a3a), hex(0x6a1a2a), hex(0x3a0a1a)]); p(6, 8, hex(0x2a0a0a)); p(9, 8, hex(0x2a0a0a)); p(5, 6, hex(0xa8805a)); p(10, 6, hex(0xa8805a)); });
SPR.glistering_melon_slice = () => sprite(p => { for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot(x - 2, y - 14); if (d < 11 && d > 9.6) p(x, y, hex(0xe8c040)); else if (d <= 9.6 && x - 2 > 0 && 14 - y > 0) p(x, y, (x * 3 + y) % 5 === 0 ? hex(0xfff090) : hex(0xe8402a)); } });
SPR.rabbit_foot = () => sprite(p => { blob(p, 8, 10, 3, 4, [hex(0xd8c8a8), hex(0xb8a080), hex(0x8a7058), hex(0x5a4830)]); line(p, 8, 2, 8, 6, hex(0xb8a080)); });
SPR.pufferfish = () => sprite(p => { blob(p, 8, 8, 5, 5, [hex(0xf8e060), hex(0xe8c030), hex(0xb89020), hex(0x7a5a10)]); for (const [x, y] of [[8, 2], [3, 8], [13, 8], [8, 14], [4, 4], [12, 4], [4, 12], [12, 12]]) p(x, y, hex(0xf0f0e0)); p(6, 7, hex(0x101010)); p(10, 7, hex(0x101010)); });
const frameSprite = edge => sprite(p => { for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) p(x, y, x < 3 || y < 3 || x > 12 || y > 12 ? edge : hex(0x8a5a2a)); });
SPR.glow_berries = () => sprite(p => { line(p, 8, 1, 8, 5, hex(0x4a6a24)); for (const [cx, cy] of [[6, 8], [10, 8], [8, 12]]) { blob(p, cx, cy, 2.6, 2.6, [hex(0xffd060), hex(0xf8a028), hex(0xe07a10), hex(0x9a4a08)]); p(cx - 1, cy - 1, hex(0xfff0b0)); } });
SPR.shield = () => sprite(p => { for (let y = 2; y < 15; y++) for (let x = 3; x < 13; x++) { if (y > 11 && Math.abs(x - 7.5) > 15 - y) continue; const edge = x === 3 || x === 12 || y === 2 || (y > 10 && Math.abs(x - 7.5) > 14 - y); p(x, y, edge ? hex(0x8a8a8a) : (x + y) % 4 === 0 ? hex(0x7a5a30) : hex(0x9c7b47)); } line(p, 7, 3, 7, 13, hex(0x6a6a6a)); });
SPR.crossbow = () => sprite(p => { line(p, 3, 12, 12, 3, hex(0x6b5433)); line(p, 4, 12, 13, 3, hex(0x8a6a3b)); for (let i = 0; i < 9; i++) { p(2 + i, 6 - Math.round(Math.sin(i / 8 * Math.PI) * 3) + 4 - i % 1, hex(0xb8b8b8)); } line(p, 2, 8, 8, 2, hex(0x9a9a9a)); line(p, 8, 14, 14, 8, hex(0x9a9a9a)); line(p, 2, 8, 8, 14, hex(0xdddddd)); });
SPR.trident = () => sprite(p => { line(p, 2, 13, 11, 4, hex(0x3a8a7a)); line(p, 3, 13, 12, 4, hex(0x5ab8a0)); for (const [x, y] of [[11, 1], [12, 2], [13, 3], [14, 4], [9, 3], [10, 2], [13, 5], [12, 6], [14, 1], [11, 4]]) p(x, y, hex(0x8ae8d0)); });
SPR.tripwire_hook = () => sprite(p => { for (let y = 3; y < 9; y++) for (let x = 6; x < 10; x++) p(x, y, x === 6 || y === 3 ? hex(0xc8c8c8) : hex(0x8a8a8a)); line(p, 8, 9, 8, 14, hex(0x8a6a3b)); line(p, 7, 9, 7, 14, hex(0x6b5433)); });
function discSprite(col) { return sprite(p => { for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 6.8) continue; p(x, y, d < 1 ? hex(0x101010) : d < 2.8 ? hex(col) : d > 6 ? hex(0x2a2a2a) : (x + y) % 3 === 0 ? hex(0x3a3a3a) : hex(0x1a1a1a)); } }); }
for (const d of ITEMS) if (d && d.disc) SPR[d.key] = () => discSprite(d.dcol);
const BANNER_DYE = [0xf9fffe, 0xf9801d, 0xc74ebd, 0x3ab3da, 0xfed83d, 0x80c71f, 0xf38baa, 0x474f52, 0x9d9d97, 0x169c9c, 0x8932b8, 0x3c44aa, 0x835432, 0x5e7c16, 0xb02e26, 0x1d1d21];
S.COLORS.forEach((c, i) => { SPR[c + '_banner_item'] = () => sprite(p => { for (let x = 3; x < 13; x++) p(x, 1, hex(0x8a6a3b)); for (let y = 2; y < 15; y++) for (let x = 4; x < 12; x++) p(x, y, shade(hex(BANNER_DYE[i]), x === 4 ? 1.1 : x === 11 ? 0.8 : 1)); line(p, 7, 15, 8, 15, hex(0x8a6a3b)); }); });
SPR.painting = () => sprite(p => { for (let y = 2; y < 14; y++) for (let x = 1; x < 15; x++) p(x, y, x < 2 || x > 13 || y < 3 || y > 12 ? hex(0x8a6a3b) : y < 8 ? hex(0x6ab0e8) : x < 8 ? hex(0x5aa84a) : hex(0xe8c040)); });
SPR.armor_stand = () => sprite(p => { for (let x = 3; x < 13; x++) p(x, 14, hex(0x9a9a9a)); line(p, 7, 2, 7, 13, hex(0xa8865a)); line(p, 8, 2, 8, 13, hex(0x8a6a3b)); for (let x = 4; x < 12; x++) p(x, 5, hex(0xa8865a)); for (let x = 5; x < 11; x++) p(x, 9, hex(0xa8865a)); });
SPR.item_frame_item = () => frameSprite(hex(0x9c7b47)); SPR.glow_item_frame_item = () => frameSprite(hex(0x5ac8b8));
function ingot(c) { return sprite(p => { const pts = []; for (let y = 5; y < 12; y++) { const pad = Math.max(0, 8 - y); for (let x = 2 + pad; x <= 13 - Math.max(0, y - 9); x++) pts.push([x, y]); } maskDraw(p, pts, c); }); }
function apple(c) { return sprite(p => { blob(p, 8, 9, 5.5, 5, c); p(8, 3, hex(0x5a3a1a)); p(8, 4, hex(0x5a3a1a)); p(9, 3, hex(0x3a8a2a)); p(10, 2, hex(0x3a8a2a)); p(6, 7, hex(0xffffff)); }); }
function meat(c) { return sprite(p => { const pts = []; for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) if (((x - 8) / 6) ** 2 + ((y - 7.5) / 4.5) ** 2 < 1 - ((x + y) % 4) * 0.04) pts.push([x, y]); maskDraw(p, pts, c); for (let i = 0; i < 4; i++) p(5 + i * 2, 6 + (i & 1), hex(0xf8f0e8)); }); }
function drum(c) { return sprite(p => { blob(p, 7, 7, 4.5, 4.5, [c[0], c[1], c[2], c[2]]); line(p, 10, 10, 13, 13, hex(0xf2efe0)); p(13, 12, hex(0xf2efe0)); p(12, 13, hex(0xf2efe0)); }); }
function bowl(fillc) { return sprite(p => { for (let y = 7; y < 13; y++) for (let x = 2; x < 14; x++) if (((x - 7.5) / 6) ** 2 + ((y - 7) / 5.5) ** 2 < 1) p(x, y, y === 7 ? hex(0x5a3a1a) : hex(0x8a6a3b)); if (fillc) for (let x = 3; x < 13; x++) { p(x, 7, fillc); p(x, 6, x > 4 && x < 11 ? shade(fillc, 1.1) : null); } }); }
function bucket(fillc) { return sprite(p => { for (let y = 4; y < 14; y++) { const w = 5 - Math.floor((y - 4) / 4); for (let x = 8 - w; x < 8 + w; x++) p(x, y, x === 8 - w ? hex(0xffffff) : x === 7 + w ? hex(0x7a7a7a) : hex(0xc8c8c8)); } for (let x = 3; x < 13; x++) p(x, 4, fillc || hex(0x4a4a4a)); for (let x = 4; x < 12; x++) p(x, 5, fillc ? shade(fillc, .85) : hex(0x6a6a6a)); for (let a = 0; a < 9; a++) p(3 + a + (a > 4 ? 0 : 0), Math.round(3 - Math.sin(a / 8 * Math.PI) * 2), hex(0x5a5a5a)); }); }

function isoBlock(g, iid, ox, oy, size, hgt = 1) {
  const it = ITEMS[iid], id = it && it.place != null ? it.place : iid, meta = it && it.vi ? it.vi << S.VSH[id] : 0, tf = (slot) => S.tileFor(id, meta, slot);
  const top = tileCanvas(tf(1), DEFAULT_TINT[S.TINT[id]]), side = tileCanvas(tf(0), DEFAULT_TINT[S.TINT[id]]), front = tileCanvas(S.FACING[id] || id === S.BID.crafting_table ? tf(3) : tf(0), DEFAULT_TINT[S.TINT[id]]);
  const k = 1 / TS;
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 32; const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
  const yTop = 2 + (1 - hgt) * 18;
  const tcan = (img, darkness) => { const c = document.createElement('canvas'); c.width = c.height = TS; const cg = c.getContext('2d'); cg.drawImage(img, 0, 0); if (darkness) { cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = `rgba(0,0,0,${darkness})`; cg.fillRect(0, 0, TS, TS); } return c; };
  const sideH = Math.max(1, Math.round(TS * hgt));
  const L = tcan(front, 0.2), R = tcan(side, 0.4);
  tg.save(); tg.setTransform(14 * k, 7 * k, 0, 17 * hgt * k, 2, yTop + 7); tg.drawImage(L, 0, TS - sideH, TS, sideH, 0, 0, TS, TS); tg.restore();
  tg.save(); tg.setTransform(14 * k, -7 * k, 0, 17 * hgt * k, 16, yTop + 14); tg.drawImage(R, 0, TS - sideH, TS, sideH, 0, 0, TS, TS); tg.restore();
  tg.save(); tg.setTransform(14 * k, -7 * k, 14 * k, 7 * k, 2, yTop + 7); tg.drawImage(top, 0, 0); tg.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(tmp, ox, oy, size, size);
}
function buildIcons() {
  const ids = ITEMS.map((d, i) => d ? i : -1).filter(i => i >= 0);
  const rows = Math.ceil(ids.length / ICON_COLS);
  iconCanvas.width = ICON_COLS * ICON; iconCanvas.height = rows * ICON;
  const g = iconCanvas.getContext('2d'); g.imageSmoothingEnabled = false;
  for (const id of ids) {
    const d = ITEMS[id], cell = iconCell(), ox = (cell % ICON_COLS) * ICON, oy = Math.floor(cell / ICON_COLS) * ICON;
    iconIndex[id] = cell;
    let spr = null;
    if (d.block && !d.sprite && !PACKPX.items[d.key]) {
      const h = id === S.BID.snow ? 0.18 : (id >= 109 && id <= 111) || (id >= 1031 && id <= 1034) ? 0.5 : id === S.BID.farmland ? 0.94 : 1;
      isoBlock(g, id, ox, oy, ICON, h);
      continue;
    }
    const packKey = PACKPX.items[d.key] ? d.key : null;
    if (packKey) { const c = document.createElement('canvas'); c.width = c.height = 16; const px = new Uint8ClampedArray(PACKPX.items[packKey]); c.getContext('2d').putImageData(new ImageData(px, 16, 16), 0, 0); c._px = px; spr = c; }
    else if (d.sprite && SPR[d.sprite]) spr = SPR[d.sprite]();
    else if (d.sprite && S.T[d.sprite] != null) spr = tileCanvas(S.T[d.sprite], DEFAULT_TINT[S.TINT[id]]);
    else if (d.tool) spr = toolSprite(d.tool.kind, d.tool.mat);
    else if (d.armor) spr = armorSprite(d.armor.slot, d.armor.mat);
    else if (SPR[d.key]) spr = SPR[d.key]();
    if (spr) { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(spr, ox, oy, ICON, ICON); spritePix[id] = spr._px; }
  }
}
let ICON_URL = '';
function iconStyle(id, px = 32) {
  const cell = iconIndex[id]; if (cell == null) return '';
  const sc = px / ICON;
  return `background-image:url(${ICON_URL});background-size:${iconCanvas.width * sc}px ${iconCanvas.height * sc}px;background-position:-${(cell % ICON_COLS) * ICON * sc}px -${Math.floor(cell / ICON_COLS) * ICON * sc}px`;
}

// crack overlay stages
const crackCanvases = [];
(function () {
  const r = trng(4242); const paths = [];
  for (let k = 0; k < 8; k++) { const pt = [[7.5 + (r() - .5) * 2, 7.5 + (r() - .5) * 2]]; let a = r() * Math.PI * 2; for (let i = 0; i < 10; i++) { a += (r() - .5) * 1.3; const l = pt[pt.length - 1]; pt.push([l[0] + Math.cos(a) * 1.2, l[1] + Math.sin(a) * 1.2]); } paths.push(pt); }
  for (let st = 1; st <= 10; st++) {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    for (const pt of paths) { const n = Math.ceil(pt.length * st / 10); for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,.55)' : 'rgba(30,30,30,.65)'; g.fillRect(Math.floor(pt[i][0]), Math.floor(pt[i][1]), 1, 1); } }
    crackCanvases.push(c);
  }
})();

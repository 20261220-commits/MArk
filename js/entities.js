// Entities: shared AABB physics, mobs with box models, items, XP orbs, arrows, TNT, falling blocks.
const ENT = [];
const _bx = [];
const PHYS = { snowSolid: false }; // set while moving a player in leather boots
function gatherBoxes(x0, y0, z0, x1, y1, z1) {
  _bx.length = 0;
  const ax = Math.floor(x0), bx = Math.floor(x1), ay = Math.floor(y0) - 1, by = Math.floor(y1), az = Math.floor(z0), bz = Math.floor(z1);
  for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) {
    if (!isLoaded(x, z)) { _bx.push([x, ay, z, x + 1, by + 1, z + 1]); continue; }
    for (let y = ay; y <= by; y++) {
      if (y < 0) { _bx.push([x, y, z, x + 1, y + 1, z + 1]); continue; }
      const id = getBlock(x, y, z);
      if (!SOLID[id]) { if (id === BID.powder_snow && PHYS.snowSolid) _bx.push([x, y, z, x + 1, y + 1, z + 1]); continue; }
      const bs = S.collide(id, getMeta(x, y, z));
      if (!bs) { _bx.push([x, y, z, x + 1, y + 1, z + 1]); continue; }
      for (const b of bs) _bx.push([x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16]);
    }
  }
  return _bx;
}
// move an AABB entity (x,y,z = feet centre, w = half width, h = height); stepUp for players/mobs
function physMove(e, dx, dy, dz, stepUp = 0) {
  const w = e.w, eps = 1e-7;
  const bx = gatherBoxes(e.x - w + Math.min(dx, 0) - 1, e.y + Math.min(dy, 0), e.z - w + Math.min(dz, 0) - 1, e.x + w + Math.max(dx, 0) + 1, e.y + e.h + Math.max(dy, 0) + stepUp, e.z + w + Math.max(dz, 0) + 1);
  const odx = dx, ody = dy, odz = dz;
  const clipY = (x, y, z, d) => { for (const b of bx) { if (b[3] <= x - w + eps || b[0] >= x + w - eps || b[5] <= z - w + eps || b[2] >= z + w - eps) continue; if (d > 0 && b[1] >= y + e.h - eps) d = Math.min(d, b[1] - (y + e.h)); else if (d < 0 && b[4] <= y + eps) d = Math.max(d, b[4] - y); } return d; };
  const clipX = (x, y, z, d) => { for (const b of bx) { if (b[4] <= y + eps || b[1] >= y + e.h - eps || b[5] <= z - w + eps || b[2] >= z + w - eps) continue; if (d > 0 && b[0] >= x + w - eps) d = Math.min(d, b[0] - (x + w)); else if (d < 0 && b[3] <= x - w + eps) d = Math.max(d, b[3] - (x - w)); } return d; };
  const clipZ = (x, y, z, d) => { for (const b of bx) { if (b[4] <= y + eps || b[1] >= y + e.h - eps || b[3] <= x - w + eps || b[0] >= x + w - eps) continue; if (d > 0 && b[2] >= z + w - eps) d = Math.min(d, b[2] - (z + w)); else if (d < 0 && b[5] <= z - w + eps) d = Math.max(d, b[5] - (z - w)); } return d; };
  let x = e.x, y = e.y, z = e.z;
  dy = clipY(x, y, z, dy); y += dy;
  dx = clipX(x, y, z, dx); x += dx;
  dz = clipZ(x, y, z, dz); z += dz;
  const onGround = ody < 0 && dy !== ody;
  if (stepUp > 0 && (e.onGround || onGround) && (dx !== odx || dz !== odz)) {
    // try stepping up
    let sx = e.x, sy = e.y, sz = e.z;
    let up = clipY(sx, sy, sz, stepUp); sy += up;
    let ddx = clipX(sx, sy, sz, odx); sx += ddx;
    let ddz = clipZ(sx, sy, sz, odz); sz += ddz;
    let down = clipY(sx, sy, sz, -up + (ody < 0 ? ody : 0)); sy += down;
    if (ddx * ddx + ddz * ddz > dx * dx + dz * dz + 1e-6) { x = sx; y = sy; z = sz; dx = ddx; dz = ddz; dy = sy - e.y; }
  }
  e.x = x; e.y = y; e.z = z;
  e.hitH = dx !== odx || dz !== odz; e.hitX = dx !== odx; e.hitZ = dz !== odz;
  e.onGround = onGround || (ody < 0 && e.onGround && dy === 0 && ody !== 0 && Math.abs(ody) < 1e-3);
  if (dy !== ody) e.vy = 0;
  if (dx !== odx) e.vx = 0;
  if (dz !== odz) e.vz = 0;
  return e;
}
function boxBlocks(e, fn) { // iterate blocks overlapping the entity box
  for (let x = Math.floor(e.x - e.w); x <= Math.floor(e.x + e.w); x++) for (let y = Math.floor(e.y); y <= Math.floor(e.y + e.h - 0.01); y++) for (let z = Math.floor(e.z - e.w); z <= Math.floor(e.z + e.w); z++) if (fn(getBlock(x, y, z), x, y, z)) return true;
  return false;
}
function fluidAt(x, y, z) { const b = getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); if (!FLUID[b]) return 0; const m = getMeta(Math.floor(x), Math.floor(y), Math.floor(z)); const top = Math.floor(y) + ((m & 8) || getBlock(Math.floor(x), Math.floor(y) + 1, Math.floor(z)) === b ? 1 : (m ? (8 - (m & 7)) / 9 : 0.89)); return y < top ? FLUID[b] : 0; }
function lightBright(x, y, z) {
  const l = getLight(Math.floor(x), Math.floor(y), Math.floor(z));
  const cv = v => { const b = v / (4 - 3 * v); return b + (1 - Math.pow(1 - b, 4) - b) * R.gamma; };
  const sky = cv((l >> 4) / 15 * (0.18 + 0.82 * dayFactor())), blk = cv((l & 15) / 15);
  return Math.max(0.06, Math.min(1, Math.max(sky, blk * 0.95)));
}

// ---------- mob model textures (MC box UV layout) ----------
function mobCanvas(paint) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); paint(g); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; return t; }
function boxRegions(u, v, w, h, d) {
  return { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + d + w + d, v + d, w, h] };
}
function paintBox(g, u, v, w, h, d, col, r, amt = 0.12, faces) {
  const R0 = boxRegions(u, v, w, h, d);
  for (const k in R0) {
    const [x0, y0, ww, hh] = R0[k];
    for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) {
      let c = typeof col === 'function' ? col(k, x, y, ww, hh) : hex(col);
      if (!c) continue;
      c = shade(c, 1 + (r() - .5) * amt);
      g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; g.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
  if (faces) for (const k in faces) { const [x0, y0] = R0[k]; faces[k](g, x0, y0); }
}
const px = (g, x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
// geometry for one box with given uv origin
function boxGeo(w, h, d, u, v, ox, oy, oz, inflate = 0) {
  const R0 = boxRegions(u, v, w, h, d), s = 1 / 16, i = inflate;
  const x0 = (ox - i) * s, y0 = (oy - i) * s, z0 = (oz - i) * s, x1 = (ox + w + i) * s, y1 = (oy + h + i) * s, z1 = (oz + d + i) * s;
  // faces: [corners bl,br,tr,tl], region, mirror
  // corners bl, br, tr, tl seen from outside (CCW); texture regions follow MC's box UV layout
  const F = [
    [[[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], 'right'],
    [[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 'left'],
    [[[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], 'top'],
    [[[x1, y0, z1], [x0, y0, z1], [x0, y0, z0], [x1, y0, z0]], 'bottom'],
    [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 'back'],
    [[[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], 'front'],
  ];
  const shadeF = { right: 0.75, left: 0.75, top: 1, bottom: 0.55, back: 0.85, front: 0.95 };
  const pos = [], uv = [], col = [];
  for (const [cs, reg] of F) {
    const [ru, rv, rw, rh] = R0[reg];
    const U = [[ru, rv + rh], [ru + rw, rv + rh], [ru + rw, rv], [ru, rv]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...cs[k]); uv.push(U[k][0] / 64, U[k][1] / 64); col.push(shadeF[reg], shadeF[reg], shadeF[reg]); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
// ---------- mob definitions ----------
const r4 = () => trng(77);
const HUMAN = (armW = 4) => [
  ['body', [0, 24, 0], [-4, -12, -2, 8, 12, 4], [16, 16]],
  ['head', [0, 24, 0], [-4, 0, -4, 8, 8, 8], [0, 0]],
  ['rarm', [4 + armW / 2 + (armW === 4 ? 1 : 1), 22, 0], [-armW / 2, -10, -armW / 2, armW, 12, armW], [40, 16]],
  ['larm', [-4 - armW / 2 - 1, 22, 0], [-armW / 2, -10, -armW / 2, armW, 12, armW], [40, 16]],
  ['rleg', [2, 12, 0], [-armW / 2, -12, -armW / 2, armW, 12, armW], [0, 16]],
  ['lleg', [-2, 12, 0], [-armW / 2, -12, -armW / 2, armW, 12, armW], [0, 16]],
];
const QUAD = (legH, bodyY, bodyBox, headP, headBox, legX, legZ0, legZ1) => [
  ['body', [0, bodyY, 0], bodyBox, [28, 0]],
  ['head', headP, headBox, [0, 0]],
  ['rleg', [legX, legH, legZ0], [-2, -legH, -2, 4, legH, 4], [0, 32]], ['lleg', [-legX, legH, legZ0], [-2, -legH, -2, 4, legH, 4], [0, 32]],
  ['rleg2', [legX, legH, legZ1], [-2, -legH, -2, 4, legH, 4], [0, 32]], ['lleg2', [-legX, legH, legZ1], [-2, -legH, -2, 4, legH, 4], [0, 32]],
];
const MOBDEF = {
  zombie: { hp: 20, w: 0.3, h: 1.95, speed: 0.12, hostile: 1, dmg: 3, burn: 1, xp: 5, snd: 'groan', drops: [['rotten_flesh', 0, 2]], parts: HUMAN(4), armsOut: 1,
    tex: () => mobCanvas(g => { const r = r4(); paintBox(g, 0, 0, 8, 8, 8, (k, x, y) => k === 'top' ? hex(0x3a5a2a) : hex(0x5d8f4c), r, .15, { front: (g, x, y) => { px(g, x + 1, y + 3, '#1a2a12', 2, 1); px(g, x + 5, y + 3, '#1a2a12', 2, 1); px(g, x + 3, y + 5, '#3a5a2a', 2, 1); } });
      paintBox(g, 16, 16, 8, 12, 4, (k, x, y) => y > 9 ? hex(0x3b3fa0) : hex(0x1fa0a8), r); paintBox(g, 40, 16, 4, 12, 4, (k, x, y) => y < 4 ? hex(0x1fa0a8) : hex(0x5d8f4c), r); paintBox(g, 0, 16, 4, 12, 4, (k, x, y) => y > 9 ? hex(0x4a4a4a) : hex(0x3b3fa0), r); }) },
  skeleton: { hp: 20, w: 0.3, h: 1.99, speed: 0.12, hostile: 1, ranged: 1, burn: 1, xp: 5, snd: 'rattle', drops: [['bone', 0, 2], ['arrow', 0, 2]], parts: HUMAN(2),
    tex: () => mobCanvas(g => { const r = r4(); paintBox(g, 0, 0, 8, 8, 8, () => hex(0xbcbcbc), r, .15, { front: (g, x, y) => { px(g, x + 1, y + 3, '#1a1a1a', 2, 2); px(g, x + 5, y + 3, '#1a1a1a', 2, 2); px(g, x + 3, y + 6, '#3a3a3a', 2, 1); px(g, x + 2, y + 7, '#5a5a5a', 4, 1); } });
      paintBox(g, 16, 16, 8, 12, 4, (k, x, y) => (k === 'front' || k === 'back') ? ((y % 3 === 1 && x > 0 && x < 7) || x === 3 || x === 4 ? hex(0xc8c8c8) : null) || hex(0x3a3a3a) : hex(0x9a9a9a), r); paintBox(g, 40, 16, 2, 12, 2, () => hex(0xbcbcbc), r); paintBox(g, 0, 16, 2, 12, 2, () => hex(0xb0b0b0), r); }) },
  creeper: { hp: 20, w: 0.3, h: 1.7, speed: 0.11, hostile: 1, explode: 1, xp: 5, snd: 'hiss', drops: [['gunpowder', 0, 2]],
    parts: [['body', [0, 18, 0], [-4, -12, -2, 8, 12, 4], [16, 16]], ['head', [0, 18, 0], [-4, 0, -4, 8, 8, 8], [0, 0]],
      ['rleg', [2, 6, -4], [-2, -6, -2, 4, 6, 4], [0, 16]], ['lleg', [-2, 6, -4], [-2, -6, -2, 4, 6, 4], [0, 16]], ['rleg2', [2, 6, 4], [-2, -6, -2, 4, 6, 4], [0, 16]], ['lleg2', [-2, 6, 4], [-2, -6, -2, 4, 6, 4], [0, 16]]],
    tex: () => mobCanvas(g => { const r = r4(); const cr = () => pal(r, [hex(0x4fbf3a), hex(0x3d9a2c), hex(0x6fd05a), hex(0x2e7a22), hex(0x8cd87a)]);
      paintBox(g, 0, 0, 8, 8, 8, cr, r, .05, { front: (g, x, y) => { px(g, x + 1, y + 2, '#000', 2, 2); px(g, x + 5, y + 2, '#000', 2, 2); px(g, x + 3, y + 4, '#000', 2, 3); px(g, x + 2, y + 5, '#000', 1, 3); px(g, x + 5, y + 5, '#000', 1, 3); } });
      paintBox(g, 16, 16, 8, 12, 4, cr, r, .05); paintBox(g, 0, 16, 4, 6, 4, cr, r, .05); }) },
  spider: { hp: 16, w: 0.7, h: 0.9, speed: 0.16, hostile: 1, dmg: 2, climb: 1, neutralDay: 1, xp: 5, snd: 'spider', drops: [['string', 0, 2]],
    parts: [['body', [0, 9, 3], [-5, -4, 0, 10, 8, 12], [0, 12]], ['neck', [0, 9, 0], [-3, -3, -3, 6, 6, 6], [0, 0]], ['head', [0, 9, -3], [-4, -4, -8, 8, 8, 8], [32, 4]],
      ...[0, 1, 2, 3].flatMap(i => [['leg' + i, [3, 9, -1 + i], [0, -1, -1, 16, 2, 2], [18, 0]], ['legl' + i, [-3, 9, -1 + i], [-16, -1, -1, 16, 2, 2], [18, 0]]])],
    tex: () => mobCanvas(g => { const r = r4(); paintBox(g, 0, 12, 10, 8, 12, () => hex(0x3a332e), r, .2); paintBox(g, 0, 0, 6, 6, 6, () => hex(0x2e2824), r, .2);
      paintBox(g, 32, 4, 8, 8, 8, () => hex(0x2e2824), r, .2, { front: (g, x, y) => { px(g, x + 1, y + 2, '#d01818', 2, 1); px(g, x + 5, y + 2, '#d01818', 2, 1); px(g, x + 2, y + 4, '#d01818'); px(g, x + 5, y + 4, '#d01818'); px(g, x + 3, y + 3, '#ff3030', 2, 1); } });
      paintBox(g, 18, 0, 16, 2, 2, () => hex(0x2a2420), r, .2); }) },
  pig: { hp: 10, w: 0.45, h: 0.9, speed: 0.05, xp: 2, snd: 'oink', drops: [['porkchop', 1, 3]], food: 'wheat',
    parts: [...QUAD(6, 9, [-5, -4, -8, 10, 8, 16], [0, 12, -6], [-4, -4, -8, 8, 8, 8], 3, -5, 6), ['snout', [0, 12, -6], [-2, -3, -9, 4, 3, 1], [16, 16]]],
    tex: () => mobCanvas(g => { const r = r4(); const pk = () => hex(0xf0a5a2); paintBox(g, 28, 0, 10, 8, 16, pk, r, .08); paintBox(g, 0, 0, 8, 8, 8, pk, r, .08, { front: (g, x, y) => { px(g, x, y + 2, '#fff'); px(g, x + 1, y + 2, '#000'); px(g, x + 6, y + 2, '#000'); px(g, x + 7, y + 2, '#fff'); } }); paintBox(g, 0, 32, 4, 6, 4, (k, x, y) => y > 4 ? hex(0x9a6a6a) : pk(), r, .08); paintBox(g, 16, 16, 4, 3, 1, () => hex(0xe8807a), r, .05, { front: (g, x, y) => { px(g, x + 1, y + 1, '#9a4a4a'); px(g, x + 2, y + 1, '#9a4a4a'); } }); }) },
  cow: { hp: 10, w: 0.45, h: 1.4, speed: 0.05, xp: 2, snd: 'moo', drops: [['beef', 1, 3], ['leather', 0, 2]], food: 'wheat', milk: 1,
    parts: [...QUAD(12, 17, [-6, -5, -9, 12, 10, 18], [0, 20, -8], [-4, -4, -6, 8, 8, 6], 4, -6, 7), ['horn', [0, 20, -8], [-5, 3, -4, 1, 3, 1], [22, 0]], ['horn2', [0, 20, -8], [4, 3, -4, 1, 3, 1], [22, 0]]],
    tex: () => mobCanvas(g => { const r = r4(); const n = tnoise(r, 4); const cc = (k, x, y) => n(x * 2 + (k.length * 3), y * 2) > 0.6 ? hex(0xe8e8e8) : hex(0x433626); paintBox(g, 28, 0, 12, 10, 18, cc, r, .08); paintBox(g, 0, 0, 8, 8, 6, cc, r, .08, { front: (g, x, y) => { px(g, x + 1, y + 3, '#fff'); px(g, x + 2, y + 3, '#000'); px(g, x + 5, y + 3, '#000'); px(g, x + 6, y + 3, '#fff'); px(g, x + 2, y + 5, '#c8a8a0', 4, 3); px(g, x + 3, y + 6, '#4a3a3a'); px(g, x + 4, y + 6, '#4a3a3a'); } }); paintBox(g, 0, 32, 4, 12, 4, (k, x, y) => y > 10 ? hex(0x2a2018) : cc(k, x, y), r, .08); paintBox(g, 22, 0, 1, 3, 1, () => hex(0xd8d0c0), r); }) },
  sheep: { hp: 8, w: 0.45, h: 1.3, speed: 0.05, xp: 2, snd: 'baa', drops: [['mutton', 1, 2]], food: 'wheat', shear: 1,
    parts: [...QUAD(12, 17, [-4, -3, -8, 8, 6, 16], [0, 19, -8], [-3, -3, -6, 6, 6, 8], 3, -5, 7), ['wool', [0, 17, 0], [-4, -3, -8, 8, 6, 16], [0, 44], 1.75], ['whead', [0, 19, -8], [-3, -3, -4, 6, 6, 6], [40, 0], 0.6]],
    tex: () => mobCanvas(g => { const r = r4(); const sk = () => hex(0xd8c0a8); paintBox(g, 28, 0, 8, 6, 16, sk, r, .08); paintBox(g, 0, 0, 6, 6, 8, sk, r, .08, { front: (g, x, y) => { px(g, x, y + 2, '#fff'); px(g, x + 1, y + 2, '#000'); px(g, x + 4, y + 2, '#000'); px(g, x + 5, y + 2, '#fff'); px(g, x + 2, y + 4, '#e8a8a0', 2, 1); } }); paintBox(g, 0, 32, 4, 12, 4, (k, x, y) => y < 6 ? hex(0xe8e8e8) : sk(), r, .08); paintBox(g, 0, 44, 8, 6, 16, () => hex(0xe9ecec), r, .1); paintBox(g, 40, 0, 6, 6, 6, (k, x, y) => k === 'front' ? null : hex(0xe9ecec), r, .1); }) },
  chicken: { hp: 4, w: 0.2, h: 0.7, speed: 0.05, xp: 1, snd: 'cluck', drops: [['chicken', 1, 1], ['feather', 0, 2]], food: 'wheat_seeds', flap: 1,
    parts: [['body', [0, 8, 0], [-3, -3, -4, 6, 6, 8], [0, 9]], ['head', [0, 9, -4], [-2, 0, -2, 4, 6, 3], [0, 0]], ['beak', [0, 9, -4], [-2, 2, -4, 4, 2, 2], [14, 0]], ['wattle', [0, 9, -4], [-1, 0, -3, 2, 2, 2], [14, 4]],
      ['rleg', [1.5, 5, 1], [-1, -5, -1, 2, 5, 2], [26, 0]], ['lleg', [-1.5, 5, 1], [-1, -5, -1, 2, 5, 2], [26, 0]], ['rwing', [3, 10, 0], [0, -4, -3, 1, 4, 6], [24, 13]], ['lwing', [-3, 10, 0], [-1, -4, -3, 1, 4, 6], [24, 13]]],
    tex: () => mobCanvas(g => { const r = r4(); const w = () => hex(0xf4f4f4); paintBox(g, 0, 9, 6, 6, 8, w, r, .06); paintBox(g, 0, 0, 4, 6, 3, w, r, .06, { front: (g, x, y) => { px(g, x, y + 1, '#000'); px(g, x + 3, y + 1, '#000'); } }); paintBox(g, 14, 0, 4, 2, 2, () => hex(0xf2b43a), r); paintBox(g, 14, 4, 2, 2, 2, () => hex(0xd82020), r); paintBox(g, 26, 0, 2, 5, 2, () => hex(0xf2b43a), r); paintBox(g, 24, 13, 1, 4, 6, w, r, .06); }) },
  goat: { hp: 10, w: 0.45, h: 1.3, speed: 0.06, xp: 2, snd: 'bleat', drops: [], food: 'wheat', jumpy: 1,
    parts: [...QUAD(10, 15, [-4, -4, -8, 9, 8, 16], [0, 18, -7], [-3, -3, -7, 6, 6, 7], 3, -5, 6), ['horn', [0, 18, -7], [-3, 3, -3, 1, 6, 1], [22, 0]], ['horn2', [0, 18, -7], [2, 3, -3, 1, 6, 1], [22, 0]], ['beard', [0, 18, -7], [-1, -6, -7, 2, 3, 1], [24, 0]]],
    tex: () => mobCanvas(g => { const r = r4(); const w = () => hex(0xe8e2d6); paintBox(g, 28, 0, 9, 8, 16, w, r, .1); paintBox(g, 0, 0, 6, 6, 7, w, r, .1, { front: (g, x, y) => { px(g, x, y + 2, '#c8a83a'); px(g, x + 5, y + 2, '#c8a83a'); px(g, x + 1, y + 2, '#000'); px(g, x + 4, y + 2, '#000'); } }); paintBox(g, 0, 32, 4, 10, 4, (k, x, y) => y > 8 ? hex(0x5a5048) : w(), r, .1); paintBox(g, 22, 0, 1, 6, 1, () => hex(0xa8a294), r); paintBox(g, 24, 0, 2, 3, 1, () => hex(0xd8d0c0), r); }) },
  squid: { hp: 10, w: 0.4, h: 0.8, speed: 0.04, xp: 2, snd: 'splash', drops: [['ink_sac', 1, 3]], water: 1,
    parts: [['body', [0, 8, 0], [-6, -8, -6, 12, 16, 12], [0, 0]], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['t' + i, [Math.round(Math.cos(i / 8 * 6.283) * 5), 0, Math.round(Math.sin(i / 8 * 6.283) * 5)], [-1, -18, -1, 2, 18, 2], [48, 0]])],
    tex: () => mobCanvas(g => { const r = r4(); paintBox(g, 0, 0, 12, 16, 12, (k, x, y) => k === 'front' && (y === 10 || y === 11) && (x === 2 || x === 9) ? hex(0x101820) : hex(y > 12 ? 0x3a5a7a : 0x2b3d5a), r, .12); paintBox(g, 48, 0, 2, 18, 2, (k, x, y) => hex(y > 14 ? 0x4a6a8a : 0x2b3d5a), r, .1); }) },
  glow_squid: { hp: 10, w: 0.4, h: 0.8, speed: 0.04, xp: 2, snd: 'splash', drops: [['glow_ink_sac', 1, 3]], water: 1, glow: 1,
    parts: [['body', [0, 8, 0], [-6, -8, -6, 12, 16, 12], [0, 0]], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['t' + i, [Math.round(Math.cos(i / 8 * 6.283) * 5), 0, Math.round(Math.sin(i / 8 * 6.283) * 5)], [-1, -18, -1, 2, 18, 2], [48, 0]])],
    tex: () => mobCanvas(g => { const r = r4(); paintBox(g, 0, 0, 12, 16, 12, (k, x, y) => k === 'front' && (y === 10 || y === 11) && (x === 2 || x === 9) ? hex(0xffffff) : ((x * 3 + y * 5) % 7 === 0 ? hex(0x9afff0) : hex(0x1fb8a8)), r, .15); paintBox(g, 48, 0, 2, 18, 2, (k, x, y) => hex(y % 5 === 0 ? 0x9afff0 : 0x1fb8a8), r, .1); }) },
  player: { hp: 20, w: 0.3, h: 1.8, parts: HUMAN(4),
    tex: () => mobCanvas(g => { const r = r4(); paintBox(g, 0, 0, 8, 8, 8, (k, x, y) => (k === 'top' || y < 2 || (k !== 'front' && y < 4) || k === 'back' && y < 7) ? hex(0x3b2a16) : hex(0xc98e6a), r, .1, { front: (g, x, y) => { px(g, x + 1, y + 4, '#fff'); px(g, x + 2, y + 4, '#4a3aa8'); px(g, x + 5, y + 4, '#4a3aa8'); px(g, x + 6, y + 4, '#fff'); px(g, x + 3, y + 6, '#8a4a3a', 2, 1); } });
      paintBox(g, 16, 16, 8, 12, 4, (k, x, y) => y > 10 ? hex(0x3b3fa0) : hex(0x1fa0a8), r); paintBox(g, 40, 16, 4, 12, 4, (k, x, y) => y < 4 ? hex(0x1fa0a8) : hex(0xc98e6a), r); paintBox(g, 0, 16, 4, 12, 4, (k, x, y) => y > 10 ? hex(0x4a4a4a) : hex(0x3b3fa0), r); }) },
};
const mobTex = {};
const mobGeoCache = {};
function buildModel(type) {
  const def = MOBDEF[type];
  if (!mobTex[type]) mobTex[type] = def.tex();
  const mat = new THREE.MeshBasicMaterial({ map: mobTex[type], vertexColors: true, alphaTest: 0.5 });
  const root = new THREE.Group(), parts = {};
  for (const [name, pivot, box, uv, infl] of def.parts) {
    const key = type + ':' + name;
    const geo = mobGeoCache[key] || (mobGeoCache[key] = boxGeo(box[3], box[4], box[5], uv[0], uv[1], box[0], box[1], box[2], infl || 0));
    const m = new THREE.Mesh(geo, mat); m.position.set(pivot[0] / 16, pivot[1] / 16, pivot[2] / 16);
    root.add(m); parts[name] = m;
  }
  if (type === 'spider') for (let i = 0; i < 4; i++) { parts['leg' + i].rotation.set(0, (i - 1.5) * 0.35, -0.55); parts['legl' + i].rotation.set(0, -(i - 1.5) * 0.35, 0.55); }
  root.userData = { parts, mat };
  return root;
}

// ---------- entity base ----------
let entId = 1;
function Ent(type, x, y, z) { return { id: entId++, type, x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, w: 0.25, h: 0.5, onGround: false, age: 0, dead: false, yaw: 0, pyaw: 0, mesh: null }; }
function addEnt(e) { ENT.push(e); if (e.mesh) scene.add(e.mesh); return e; }
function removeEnt(e) { e.dead = true; if (e.mesh) { scene.remove(e.mesh); if (e.kind === 'mob') { if (e.matOwn) e.mesh.userData.mat.dispose(); } else if (e.mesh.material && e.mesh.material.dispose) e.mesh.material.dispose(); } }
function countMobs(f) { let n = 0; for (const e of ENT) if (e.kind === 'mob' && !e.dead && f(e)) n++; return n; }

// ---------- items ----------
function dropItem(x, y, z, id, n, vel, delay = 10, dur) {
  if (!n || ITEMS[id] == null) return null;
  const e = Ent('item', x, y, z); e.kind = 'item'; e.w = 0.125; e.h = 0.25; e.stack = { id, n }; if (dur != null) e.stack.d = dur;
  e.vx = vel ? vel[0] : (Math.random() - .5) * 0.2; e.vy = vel ? vel[1] : 0.2; e.vz = vel ? vel[2] : (Math.random() - .5) * 0.2;
  e.pickup = delay; e.spin = Math.random() * 6;
  const m = R.itemMesh(id); const g = new THREE.Group(); g.add(m); m.scale.setScalar(m.userData.isBlock ? 0.25 : 0.4); e.inner = m; e.mesh = g;
  if (n > 1) { const m2 = R.itemMesh(id); m2.scale.copy(m.scale); m2.position.set(0.06, 0.05, 0.06); g.add(m2); }
  return addEnt(e);
}
function dropStack(x, y, z, st, vel, delay) { if (st && st.n > 0) return dropItem(x, y, z, st.id, st.n, vel, delay, st.d); }
W.onDrop = (x, y, z, items, xp) => { for (const [id, n] of items) dropItem(x + 0.5, y + 0.3, z + 0.5, id, n); if (xp) spawnXP(x + .5, y + .5, z + .5, xp); };
const xpMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#3a5a00'; g.fillRect(1, 1, 6, 6); g.fillStyle = '#c8ff3a'; g.fillRect(2, 2, 4, 4); g.fillStyle = '#ffff9a'; g.fillRect(2, 2, 2, 2); return c; })()), fog: true });
xpMat.map.magFilter = THREE.NearestFilter;
function spawnXP(x, y, z, amt) {
  while (amt > 0) {
    const v = amt >= 17 ? 17 : amt >= 7 ? 7 : amt >= 3 ? 3 : 1; amt -= v;
    const e = Ent('xp', x, y, z); e.kind = 'xp'; e.w = 0.125; e.h = 0.25; e.value = v; e.vx = (Math.random() - .5) * .2; e.vy = .2; e.vz = (Math.random() - .5) * .2;
    const sp = new THREE.Sprite(xpMat); sp.scale.setScalar(0.18 + Math.min(v, 17) * 0.01); e.mesh = sp; addEnt(e);
  }
}
// ---------- falling blocks & TNT ----------
W.onFall = (x, y, z, id) => {
  const e = Ent('falling', x + .5, y, z + .5); e.kind = 'falling'; e.block = id; e.w = 0.49; e.h = 0.98;
  e.mesh = new THREE.Mesh(R.blockGeometry(id), R.blockMaterial()); addEnt(e);
};
function primeTNT(x, y, z, fuse = 80) {
  const e = Ent('tnt', x + .5, y, z + .5); e.kind = 'tnt'; e.fuse = fuse; e.w = 0.49; e.h = 0.98; e.vy = 0.2; e.vx = (Math.random() - .5) * 0.04; e.vz = (Math.random() - .5) * 0.04;
  e.mesh = new THREE.Mesh(R.blockGeometry(BID.tnt), R.blockMaterial()); addEnt(e); play('fuse');
}
// ---------- arrows ----------
const arrowGeo = (() => { const g = new THREE.BoxGeometry(0.04, 0.04, 0.6); return g; })();
const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8a6a3b });
function shootArrow(x, y, z, vx, vy, vz, owner, dmg) {
  const e = Ent('arrow', x, y, z); e.kind = 'arrow'; e.vx = vx; e.vy = vy; e.vz = vz; e.owner = owner; e.dmgMul = dmg || 2; e.w = 0.1; e.h = 0.1; e.stuck = false;
  e.mesh = new THREE.Mesh(arrowGeo, arrowMat.clone()); addEnt(e); play('bow', { vol: 0.6 });
  return e;
}
// ---------- explosions ----------
function resistance(b) { const d = BLOCKS[b]; if (!d || d.hard < 0) return 3600000; if (FLUID[b]) return 100; if (b === BID.obsidian) return 1200; if (d.tool === S.TOOL.PICK) return Math.max(3, d.hard * 4); return d.hard * 1.5 + 0.1; }
function explode(x, y, z, power, fire) {
  play('explode');
  const broken = new Map();
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) {
    if (i && j && k && i < 15 && j < 15 && k < 15) continue;
    let dx = i / 15 * 2 - 1, dy = j / 15 * 2 - 1, dz = k / 15 * 2 - 1; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    let f = power * (0.7 + Math.random() * 0.6), px2 = x, py2 = y, pz2 = z; // eslint-disable-line
    while (f > 0) {
      const bx = Math.floor(px2), by = Math.floor(py2), bz = Math.floor(pz2), b = getBlock(bx, by, bz);
      if (b) f -= (resistance(b) + 0.3) * 0.3;
      if (f > 0 && b && by > 0) broken.set(bx + ',' + by + ',' + bz, b);
      px2 += dx * 0.3; py2 += dy * 0.3; pz2 += dz * 0.3; f -= 0.225;
    }
  }
  for (const [k, b] of broken) {
    const [bx, by, bz] = k.split(',').map(Number);
    if (getBlock(bx, by, bz) !== b) continue;
    if (b === BID.tnt) { setBlock(bx, by, bz, 0); primeTNT(bx, by, bz, 10 + Math.floor(Math.random() * 20)); continue; }
    const m = getMeta(bx, by, bz);
    const t = getTile(bx, by, bz); if (t) dropTileContents(bx, by, bz, t);
    setBlock(bx, by, bz, 0);
    if (Math.random() < 1 / power && !FLUID[b]) { const d = blockDrops(b, m, { id: IID.diamond_pickaxe, n: 1 }); for (const [id, n] of d.items) dropItem(bx + .5, by + .5, bz + .5, id, n); }
  }
  for (let i = 0; i < 30; i++) R.simpleParticle(x + (Math.random() - .5) * power * 1.5, y + (Math.random() - .5) * power, z + (Math.random() - .5) * power * 1.5, [0.85, 0.85, 0.85], { size: 0.6 + Math.random() * 0.6, life: 0.6 + Math.random() * 0.6, grav: -0.05, vy: 0.5 });
  // damage entities & player
  const rad = power * 2;
  const hit = (e, isPl) => {
    const cx = e.x, cy = e.y + e.h / 2, cz = e.z, d = Math.hypot(cx - x, cy - y, cz - z) / rad; if (d > 1) return;
    const imp = 1 - d, dmg = Math.floor((imp * imp + imp) / 2 * 7 * rad + 1);
    const kx = (cx - x) / (d * rad + .01), ky = (cy - y) / (d * rad + .01), kz = (cz - z) / (d * rad + .01);
    if (isPl) { if (PL.mode !== 'creative') { hurtPlayer(dmg * DIFF_MUL(), 'explosion'); PL.vx += kx * imp * 1.2; PL.vy += ky * imp * 1.2; PL.vz += kz * imp * 1.2; } }
    else { if (e.kind === 'mob') hurtMob(e, dmg, null, kx * imp, kz * imp); else if (e.kind === 'item' || e.kind === 'xp') removeEnt(e); }
  };
  for (const e of ENT) if (!e.dead && e.kind !== 'tnt') hit(e, false);
  hit(PL, true);
}
function dropTileContents(x, y, z, t) {
  if (t.items) for (const st of t.items) if (st) dropStack(x + .5, y + .5, z + .5, st);
}
W.onTileRemoved = (x, y, z, t) => dropTileContents(x, y, z, t);
W.onTntCheck = () => {};

// ---------- mobs ----------
function spawnMob(type, x, y, z, opts = {}) {
  const d = MOBDEF[type];
  const e = Ent(type, x, y, z); e.kind = 'mob'; e.def = d; e.hp = d.hp; e.w = d.w; e.h = d.h; e.yaw = Math.random() * Math.PI * 2; e.headYaw = 0; e.headPitch = 0;
  e.walk = 0; e.walkAmt = 0; e.hurt = 0; e.inv = 0; e.fire = 0; e.attackCd = 0; e.target = null; e.goal = null; e.panic = 0; e.fuse = 0; e.love = 0; e.baby = opts.baby ? 24000 : 0;
  e.sheared = !!opts.sheared; e.persistent = !d.hostile; e.idleSnd = 200 + Math.random() * 400; e.deathT = 0; e.jumpCd = 0;
  if (e.baby) { e.w *= 0.5; e.h *= 0.5; }
  e.mesh = buildModel(type);
  if (e.baby) e.mesh.scale.setScalar(0.5);
  if (type === 'sheep' && e.sheared) { e.mesh.userData.parts.wool.visible = false; e.mesh.userData.parts.whead.visible = false; }
  return addEnt(e);
}
function hurtMob(e, dmg, attacker, kx = 0, kz = 0, src) {
  if (e.dead || e.deathT) return false;
  if (e.inv > 0) return false;
  e.hp -= dmg; e.hurt = 10; e.inv = 10;
  const kl = Math.hypot(kx, kz) || 1; if (kx || kz) { e.vx = kx / kl * 0.4; e.vz = kz / kl * 0.4; e.vy = 0.36; }
  play(e.def.snd === 'groan' || e.def.snd === 'rattle' || e.def.snd === 'hiss' || e.def.snd === 'spider' ? 'hurt' : e.def.snd, { vol: 0.8 });
  if (!e.def.hostile) e.panic = 60;
  if (attacker === PL && e.def.hostile) e.target = PL;
  if (e.hp <= 0) {
    e.deathT = 20;
    if (attacker === PL || src === 'player') {
      for (const [k, lo, hi] of e.def.drops) { let n = lo + Math.floor(Math.random() * (hi - lo + 1)); if (e.fire > 0) { const cooked = { porkchop: 'cooked_porkchop', beef: 'cooked_beef', chicken: 'cooked_chicken', mutton: 'cooked_mutton' }[k]; if (cooked) { dropItem(e.x, e.y + .5, e.z, IID[cooked], n); continue; } } if (n > 0 && !e.baby) dropItem(e.x, e.y + .5, e.z, IID[k], n); }
      if (e.type === 'sheep' && !e.sheared && !e.baby) dropItem(e.x, e.y + .5, e.z, BID.white_wool, 1);
      if (e.type === 'skeleton' && Math.random() < 0.085) dropItem(e.x, e.y + .5, e.z, IID.bow, 1, null, 10, Math.floor(Math.random() * 300));
      if (!e.baby) spawnXP(e.x, e.y + .5, e.z, e.def.hostile ? 5 : 1 + Math.floor(Math.random() * 3));
      if (e.def.hostile) UI.advance('hunter');
    }
  }
  return true;
}
function canSee(ax, ay, az, bx, by, bz) {
  const d = Math.hypot(bx - ax, by - ay, bz - az), n = Math.ceil(d * 3);
  for (let i = 1; i < n; i++) { const t = i / n; if (OPQ[getBlock(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t), Math.floor(az + (bz - az) * t))]) return false; }
  return true;
}
function mobTick(e) {
  const d = e.def;
  if (e.deathT) { e.deathT--; if (e.deathT <= 0) { for (let i = 0; i < 8; i++) R.simpleParticle(e.x + (Math.random() - .5) * e.w * 2, e.y + Math.random() * e.h, e.z + (Math.random() - .5) * e.w * 2, [0.9, 0.9, 0.9], { size: 0.25, vy: 0.5, grav: 0 }); removeEnt(e); } return; }
  if (e.hurt > 0) e.hurt--; if (e.inv > 0) e.inv--; if (e.attackCd > 0) e.attackCd--; if (e.panic > 0) e.panic--; if (e.love > 0) e.love--; if (e.jumpCd > 0) e.jumpCd--;
  if (e.baby > 0) { e.baby -= 1; if (e.baby <= 0) { e.w = d.w; e.h = d.h; e.mesh.scale.setScalar(1); } }
  const dx = PL.x - e.x, dz = PL.z - e.z, dist = Math.hypot(dx, dz, PL.y - e.y);
  // despawn
  if (d.hostile && !e.persistent) { if (dist > 128 || (dist > 32 && Math.random() < 1 / 800)) { removeEnt(e); return; } }
  // environment
  const fl = fluidAt(e.x, e.y + 0.4, e.z); e.inWater = fl === 1; e.inLava = fl === 2;
  if (e.inLava) { e.fire = 300; if (e.age % 10 === 0) hurtMob(e, 4, null); }
  if (e.inWater) e.fire = 0;
  if (d.burn && dayFactor() > 0.6 && W.rain < 0.2 && !e.inWater && !e.baby) { const l = getLight(Math.floor(e.x), Math.floor(e.y + e.h), Math.floor(e.z)); if ((l >> 4) === 15) e.fire = Math.max(e.fire, 160); }
  if (e.fire > 0) { e.fire--; if (e.fire % 20 === 0) { e.inv = 0; hurtMob(e, 1, null); } if (Math.random() < 0.3) R.simpleParticle(e.x + (Math.random() - .5) * e.w * 2, e.y + Math.random() * e.h, e.z + (Math.random() - .5) * e.w * 2, [1, 0.6, 0.1], { size: 0.12, vy: 1, grav: -0.2, life: 0.4 }); }
  if (--e.idleSnd <= 0) { e.idleSnd = 300 + Math.random() * 500; if (dist < 16) play(d.snd, { vol: 0.6 * (1 - dist / 16) }); }
  if (d.water) { squidTick(e); return; }
  // AI
  let mx = 0, mz = 0, speed = d.speed;
  const plVisible = PL.mode !== 'creative' && PL.mode !== 'spectator' && !PL.dead;
  const hostileNow = d.hostile && !(d.neutralDay && dayFactor() > 0.6 && e.target == null);
  if (hostileNow && plVisible && dist < 16 && (e.target === PL || canSee(e.x, e.y + e.h * 0.85, e.z, PL.x, PL.y + 1.6, PL.z))) e.target = PL;
  if (e.target && (!plVisible || dist > 24)) e.target = null;
  if (e.target) {
    const tx = dx / (Math.hypot(dx, dz) || 1), tz = dz / (Math.hypot(dx, dz) || 1);
    e.yawTarget = Math.atan2(-dx, -dz);
    if (d.ranged) {
      if (dist > 10) { mx = tx; mz = tz; } else if (dist < 5) { mx = -tx; mz = -tz; }
      else { mx = -tz * 0.5; mz = tx * 0.5; }
      if (e.attackCd <= 0 && dist < 15 && canSee(e.x, e.y + 1.6, e.z, PL.x, PL.y + 1.4, PL.z)) {
        e.attackCd = 40 + Math.floor(Math.random() * 20);
        const sx = e.x, sy = e.y + 1.5, sz = e.z, ddx = PL.x - sx, ddy = PL.y + PL.h / 3 - sy, ddz = PL.z - sz, hd = Math.hypot(ddx, ddz); // MC aims at 1/3 of target height
        const v = 1.6, l = Math.hypot(ddx, ddy + hd * 0.2, ddz);
        shootArrow(sx + ddx / hd * 0.6, sy, sz + ddz / hd * 0.6, ddx / l * v + (Math.random() - .5) * 0.05, (ddy + hd * 0.2) / l * v, ddz / l * v + (Math.random() - .5) * 0.05, e, 1.2);
      }
    } else if (d.explode) {
      if (dist < 3 || (e.fuse > 0 && dist < 7)) { if (e.fuse === 0) play('fuse'); e.fuse++; mx = mz = 0; if (e.fuse >= 30) { removeEnt(e); explode(e.x, e.y + 0.8, e.z, 3); return; } }
      else { e.fuse = Math.max(0, e.fuse - 1); mx = tx; mz = tz; }
    } else {
      mx = tx; mz = tz;
      if (dist < (d.w + 1.2) && Math.abs(PL.y - e.y) < 2 && e.attackCd <= 0) { e.attackCd = 20; attackPlayer(e, (d.dmg || 2), tx, tz); }
      if (d.climb && e.hitH) { e.vy = 0.2; }
    }
  } else {
    const food = d.food && PL.held() && PL.held().id === IID[d.food] && dist < 8 && plVisible;
    if (e.panic > 0) { if (!e.goal || Math.random() < 0.05) e.goal = [e.x + (Math.random() - .5) * 16, e.z + (Math.random() - .5) * 16]; speed = d.speed * 2.2; }
    else if (food) { e.goal = dist > 2 ? [PL.x, PL.z] : null; e.yawTarget = Math.atan2(-dx, -dz); }
    else if (e.love > 0) { let mate = null; for (const o of ENT) if (o !== e && o.type === e.type && o.love > 0 && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 8) { mate = o; break; } if (mate) { e.goal = [mate.x, mate.z]; if (Math.hypot(mate.x - e.x, mate.z - e.z) < 1.5) { e.love = mate.love = 0; spawnMob(e.type, e.x, e.y, e.z, { baby: true }); UI.advance('breed'); spawnXP(e.x, e.y + .5, e.z, 1 + Math.floor(Math.random() * 7)); } } }
    else if (!e.goal && Math.random() < 1 / 120) e.goal = [e.x + (Math.random() - .5) * 14, e.z + (Math.random() - .5) * 14];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } if (Math.random() < 1 / 400) e.goal = null; }
    if (d.flap && !e.onGround && e.vy < 0) e.vy *= 0.6;
    // goats (1.17) occasionally ram a nearby player
    if (e.type === 'goat' && !e.baby && plVisible) {
      if (e.ram > 0) { e.ram--; const l = Math.hypot(dx, dz) || 1; mx = dx / l; mz = dz / l; speed = 0.22; e.yawTarget = Math.atan2(-dx, -dz);
        if (dist < 1.3) { e.ram = 0; if (hurtPlayer(1 * DIFF_MUL() + 1, 'mob', e)) { PL.vx += dx / l * 1.2; PL.vz += dz / l * 1.2; PL.vy = 0.4; play('hit'); } } }
      else if (dist > 4 && dist < 12 && Math.random() < 1 / 1500) { e.ram = 40; play('bleat'); }
    }
    if (e.type === 'chicken' && Math.random() < 1 / 6000) dropItem(e.x, e.y + .3, e.z, IID.egg, 1);
  }
  if (e.yawTarget != null) { let dy = e.yawTarget - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += Math.max(-0.35, Math.min(0.35, dy)); }
  // movement physics
  const inF = e.inWater || e.inLava;
  const acc = e.onGround ? 0.5 : inF ? 0.2 : 0.1;
  e.vx += (mx * speed - e.vx) * acc; e.vz += (mz * speed - e.vz) * acc;
  if ((mx || mz) && e.hitH && e.onGround && e.jumpCd <= 0) { e.vy = d.jumpy ? 0.6 : 0.42; e.jumpCd = 10; }
  if (inF) { e.vy = Math.max(e.vy - 0.02, -0.1); if (mx || mz || e.target) e.vy += 0.04; e.vy *= 0.8; }
  else { e.vy -= 0.08; e.vy *= 0.98; }
  // entity cramming: push away from the player and nearby mobs
  const push = (o, ow, oh) => { const ddx = e.x - o.x, ddz = e.z - o.z, r = e.w + ow; if (Math.abs(ddx) < r && Math.abs(ddz) < r && e.y < o.y + oh && o.y < e.y + e.h) { const l = Math.hypot(ddx, ddz) || 0.01, f = 0.05; e.vx += ddx / l * f; e.vz += ddz / l * f; return [ddx / l * f, ddz / l * f]; } return null; };
  if (!PL.dead && !spectator()) { const pp = push(PL, PL.w, PL.h); if (pp) { PL.vx -= pp[0] * 0.5; PL.vz -= pp[1] * 0.5; } }
  if ((e.age & 1) === 0) for (const o of ENT) if (o !== e && o.kind === 'mob' && !o.dead) push(o, o.w, o.h);
  physMove(e, e.vx, e.vy, e.vz, 0.6);
  if (!e.onGround) { e.vx *= 0.91; e.vz *= 0.91; } else { e.vx *= 0.6; e.vz *= 0.6; }
  // fall damage
  if (e.onGround) { if (e.fallY != null && e.fallY - e.y > 3.5 && !inF) hurtMob(e, Math.floor(e.fallY - e.y - 3), null); e.fallY = null; }
  else if (e.vy < 0 && e.fallY == null) e.fallY = e.y; else if (inF) e.fallY = null;
  if (e.y < -40) removeEnt(e);
  const hs = Math.hypot(e.vx, e.vz);
  e.walkAmt += (Math.min(1, hs * 8) - e.walkAmt) * 0.3; e.walk += hs * 6;
  // spawner/despawn fuse visual
}
function squidTick(e) {
  if (e.inWater) {
    e.air = 300;
    if (!e.goal || Math.random() < 0.02) { const a = Math.random() * 6.283; e.goal = [Math.cos(a), (Math.random() - 0.5) * 0.6, Math.sin(a)]; e.pulse = 0; }
    if (e.panic > 0 && e.age % 10 === 0) e.goal = [(e.x - PL.x), 0.2, (e.z - PL.z)].map(v => v / (Math.hypot(e.x - PL.x, e.z - PL.z) || 1));
    e.pulse = (e.pulse || 0) + 1;
    const thrust = (e.pulse % 30) < 6 ? (e.panic > 0 ? 0.06 : 0.025) : 0;
    e.vx += e.goal[0] * thrust; e.vy += e.goal[1] * thrust; e.vz += e.goal[2] * thrust;
    if (fluidAt(e.x, e.y + e.h + 0.1, e.z) !== 1 && e.vy > 0) e.vy = -0.01; // stay under the surface
    e.vx *= 0.9; e.vy *= 0.9; e.vz *= 0.9;
    e.yawTarget = Math.atan2(-e.vx, -e.vz);
  } else {
    e.vy -= 0.08; e.vy *= 0.98; e.vx *= 0.6; e.vz *= 0.6;
    if (e.onGround && Math.random() < 0.1) { e.vy = 0.3; e.vx = (Math.random() - .5) * 0.2; e.vz = (Math.random() - .5) * 0.2; }
    e.air = (e.air || 300) - 1; if (e.air < -20) { e.air = 0; hurtMob(e, 2, null); }
  }
  if (e.yawTarget != null) { let dy = e.yawTarget - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += dy * 0.1; }
  physMove(e, e.vx, e.vy, e.vz, 0);
  e.walk += 0.15 + Math.hypot(e.vx, e.vy, e.vz) * 4; e.walkAmt = 1;
  if (e.y < -40) removeEnt(e);
}
function attackPlayer(e, dmg, tx, tz) {
  if (PL.mode === 'creative' || PL.dead) return;
  if (hurtPlayer(dmg * DIFF_MUL(), 'mob', e)) { PL.vx += tx * 0.4; PL.vz += tz * 0.4; PL.vy = Math.max(PL.vy, 0.3); }
}
const DIFF_MUL = () => PL.difficulty === 0 ? 0 : PL.difficulty === 1 ? 0.5 : PL.difficulty === 3 ? 1.5 : 1;
// ---------- per-tick update ----------
function entityTick() {
  for (const e of ENT) {
    if (e.dead) continue;
    e.px = e.x; e.py = e.y; e.pz = e.z; e.pyaw = e.yaw; e.age++;
    if (!isLoaded(Math.floor(e.x), Math.floor(e.z))) { if (e.kind !== 'mob') removeEnt(e); continue; }
    if (e.kind === 'mob') mobTick(e);
    else if (e.kind === 'item' || e.kind === 'xp') {
      const fl = fluidAt(e.x, e.y + 0.1, e.z);
      if (fl) { e.vy += 0.01; e.vy *= 0.9; e.vx *= 0.9; e.vz *= 0.9; } else e.vy -= 0.04;
      // push out of solid blocks
      if (SOLID[getBlock(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z))] && !S.collide(getBlock(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z)), 0)) e.y += 0.1;
      if (e.kind === 'xp') { const dx = PL.x - e.x, dy = PL.y + 0.8 - e.y, dz = PL.z - e.z, d = Math.hypot(dx, dy, dz); if (d < 8 && !PL.dead && PL.mode !== 'spectator') { const f = (1 - d / 8) ** 2 * 0.1; e.vx += dx / d * f; e.vy += dy / d * f; e.vz += dz / d * f; } if (d < 1 && !PL.dead) { addXP(e.value); removeEnt(e); continue; } }
      physMove(e, e.vx, e.vy, e.vz);
      const fr = e.onGround ? 0.6 * 0.98 : 0.98; e.vx *= fr; e.vz *= fr; e.vy *= 0.98;
      if (e.pickup > 0) e.pickup--;
      if (e.kind === 'item') {
        if (e.age > 6000) { removeEnt(e); continue; }
        if (e.age % 10 === 0) for (const o of ENT) if (o !== e && !o.dead && o.kind === 'item' && o.stack.id === e.stack.id && o.stack.d == null && e.stack.d == null && Math.abs(o.x - e.x) < 1 && Math.abs(o.y - e.y) < .5 && Math.abs(o.z - e.z) < 1 && o.stack.n + e.stack.n <= maxStack(e.stack.id)) { e.stack.n += o.stack.n; removeEnt(o); }
        if (e.pickup <= 0 && !PL.dead && PL.mode !== 'spectator' && Math.abs(PL.x - e.x) < 1.3 && e.y > PL.y - 0.8 && e.y < PL.y + 2.3 && Math.abs(PL.z - e.z) < 1.3) {
          const left = INV.add(e.stack); if (left < e.stack.n) { play('pop', { vol: 0.5 }); e.stack.n = left; if (left <= 0) { removeEnt(e); continue; } }
        }
      }
      if (e.y < -40) removeEnt(e);
    } else if (e.kind === 'falling') {
      e.vy -= 0.04; e.vy *= 0.98; physMove(e, 0, e.vy, 0);
      if (e.onGround || e.age > 600) {
        const bx = Math.floor(e.x), by = Math.floor(e.y + 0.5), bz = Math.floor(e.z), cur = getBlock(bx, by, bz);
        removeEnt(e);
        if (cur === 0 || (REPL[cur])) setBlock(bx, by, bz, e.block); else dropItem(e.x, e.y + .5, e.z, e.block, 1);
      }
      // suffocate/hit player
      if (!PL.dead && Math.abs(PL.x - e.x) < 0.8 && Math.abs(PL.z - e.z) < 0.8 && e.y > PL.y && e.y < PL.y + 1.8 && e.vy < -0.2) {}
    } else if (e.kind === 'tnt') {
      e.vy -= 0.04; physMove(e, e.vx, e.vy, e.vz); e.vx *= 0.98; e.vz *= 0.98; e.vy *= 0.98; if (e.onGround) { e.vx *= 0.7; e.vz *= 0.7; }
      if (--e.fuse <= 0) { removeEnt(e); explode(e.x, e.y + 0.49, e.z, 4); }
    } else if (e.kind === 'arrow') arrowTick(e);
  }
  // compact
  if (ENT.some(e => e.dead)) { for (let i = ENT.length - 1; i >= 0; i--) if (ENT[i].dead) ENT.splice(i, 1); }
}
function arrowTick(e) {
  if (e.stuck) { if (e.age > 1200) removeEnt(e); else if (e.owner === PL && !PL.dead && Math.hypot(PL.x - e.x, PL.y + 1 - e.y, PL.z - e.z) < 1.5 && e.age > 10) { if (PL.mode === 'creative' || INV.add({ id: IID.arrow, n: 1 }) === 0) { play('pop', { vol: .5 }); removeEnt(e); } } return; }
  const steps = Math.ceil(Math.hypot(e.vx, e.vy, e.vz) / 0.25);
  for (let s = 0; s < steps; s++) {
    const nx = e.x + e.vx / steps, ny = e.y + e.vy / steps, nz = e.z + e.vz / steps;
    const b = getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
    if (SOLID[b] && !(b === BID.water)) { e.stuck = true; e.age = 0; play('hit', { vol: 0.4 }); return; }
    // entity hits
    const speed = Math.hypot(e.vx, e.vy, e.vz), dmg = Math.ceil(speed * e.dmgMul);
    if (e.owner !== PL && !PL.dead && nx > PL.x - 0.4 && nx < PL.x + 0.4 && nz > PL.z - 0.4 && nz < PL.z + 0.4 && ny > PL.y && ny < PL.y + 1.8) {
      if (PL.mode !== 'creative') { hurtPlayer(dmg * DIFF_MUL(), 'arrow', e.owner); const l = Math.hypot(e.vx, e.vz) || 1; PL.vx += e.vx / l * 0.3; PL.vz += e.vz / l * 0.3; }
      removeEnt(e); return;
    }
    for (const o of ENT) if (o.kind === 'mob' && !o.dead && o !== e.owner && nx > o.x - o.w - .1 && nx < o.x + o.w + .1 && nz > o.z - o.w - .1 && nz < o.z + o.w + .1 && ny > o.y && ny < o.y + o.h) {
      hurtMob(o, dmg, e.owner === PL ? PL : null, e.vx, e.vz, e.owner === PL ? 'player' : null); removeEnt(e); return;
    }
    e.x = nx; e.y = ny; e.z = nz;
  }
  e.vy -= 0.05; e.vx *= 0.99; e.vy *= 0.99; e.vz *= 0.99;
  if (fluidAt(e.x, e.y, e.z)) { e.vx *= 0.6; e.vy *= 0.6; e.vz *= 0.6; }
  if (e.age > 1200 || e.y < -20) removeEnt(e);
}
// ---------- spawning ----------
function trySpawnHostile() {
  const cap = Math.round(14 * Math.min(1, R.rd / 8)) + 4;
  if (PL.difficulty === 0 || countMobs(e => e.def.hostile) >= cap) return;
  for (let a = 0; a < 2; a++) {
    const ang = Math.random() * Math.PI * 2, r = 24 + Math.random() * Math.max(8, R.rd * 16 - 30);
    const x = Math.floor(PL.x + Math.cos(ang) * r), z = Math.floor(PL.z + Math.sin(ang) * r);
    if (!isLoaded(x, z)) continue;
    const top = topY(x, z); const y = Math.random() < 0.5 ? top + 1 : 1 + Math.floor(Math.random() * top);
    if (!OPQ[getBlock(x, y - 1, z)] || SOLID[getBlock(x, y, z)] || SOLID[getBlock(x, y + 1, z)] || FLUID[getBlock(x, y, z)] || getBlock(x, y - 1, z) === BID.bedrock) continue;
    const l = getLight(x, y, z), sky = Math.max(0, (l >> 4) - skyDarken()), blk = l & 15;
    if (Math.max(sky, blk) > 7) continue;
    if (Math.hypot(x - PL.x, y - PL.y, z - PL.z) < 24) continue;
    const types = ['zombie', 'skeleton', 'creeper', 'spider'];
    const t = types[Math.floor(Math.random() * 4)];
    if (t === 'spider' && (SOLID[getBlock(x + 1, y, z)] || SOLID[getBlock(x, y, z + 1)])) continue;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) spawnMob(t, x + .5 + i * 0.3, y, z + .5);
    break;
  }
}
function spawnAnimalsForChunk(c) {
  const b = c.biome[8 * 16 + 8];
  const R0 = S.rng(S.hash32(W.seed, c.cx, c.cz, 9));
  if (R0() > 0.1) return;
  let types;
  if (b === S.BIO.OCEAN || b === S.BIO.RIVER || b === S.BIO.FROZEN_OCEAN) {
    const t = R0() < 0.3 ? 'glow_squid' : 'squid';
    for (let i = 2 + R0.int(3); i > 0; i--) { const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12), y = 46 + R0.int(12); if (c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] === 27 && c.blocks[((y + 1) << 8) | ((z & 15) << 4) | (x & 15)] === 27) spawnMob(t, x + .5, y, z + .5); }
    return;
  }
  if (b === S.BIO.MOUNTAINS) types = ['goat'];
  else if (b === S.BIO.PLAINS || b === S.BIO.FOREST || b === S.BIO.BIRCH || b === S.BIO.TAIGA || b === S.BIO.SWAMP || b === S.BIO.SNOWY_TAIGA || b === S.BIO.TUNDRA) types = ['pig', 'cow', 'sheep', 'chicken'];
  else return;
  const t = types[R0.int(types.length)], n = 2 + R0.int(3);
  for (let i = 0; i < n; i++) {
    const x = c.cx * 16 + 2 + R0.int(12), z = c.cz * 16 + 2 + R0.int(12);
    let y = CH - 2; while (y > 1 && !SOLID[c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]] && !FLUID[c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]]) y--;
    const g = c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
    if (g !== 2 && g !== 50 && g !== 3 && g !== 1 && g !== 51) continue;
    spawnMob(t, x + .5, y + 1, z + .5);
  }
}
function spawnerTick() {
  const px2 = Math.floor(PL.x), py2 = Math.floor(PL.y), pz2 = Math.floor(PL.z);
  for (let cx = (px2 >> 4) - 1; cx <= (px2 >> 4) + 1; cx++) for (let cz = (pz2 >> 4) - 1; cz <= (pz2 >> 4) + 1; cz++) {
    const c = chunkAt(cx, cz); if (!c) continue;
    for (const [i, t] of c.tiles) {
      if (t.type !== 'spawner') continue;
      const x = cx * 16 + (i & 15), y = i >> 8, z = cz * 16 + ((i >> 4) & 15);
      if (Math.hypot(x - PL.x, y - PL.y, z - PL.z) > 16) continue;
      if (Math.random() < 0.3) R.simpleParticle(x + Math.random(), y + Math.random(), z + Math.random(), [1, 0.5, 0.1], { size: 0.1, vy: 0.3, grav: 0, life: 0.5 });
      if (--t.delay > 0) continue;
      t.delay = 200 + Math.floor(Math.random() * 600);
      if (PL.difficulty === 0 || countMobs(e => e.def.hostile && Math.hypot(e.x - x, e.z - z) < 9) >= 6) continue;
      for (let k = 0; k < 4; k++) { const sx = x + Math.floor((Math.random() - .5) * 8), sz = z + Math.floor((Math.random() - .5) * 8), sy = y + Math.floor(Math.random() * 3) - 1; if (!SOLID[getBlock(sx, sy, sz)] && !SOLID[getBlock(sx, sy + 1, sz)] && SOLID[getBlock(sx, sy - 1, sz)]) spawnMob(t.mob, sx + .5, sy, sz + .5); }
    }
  }
}
// persist passive mobs with their chunk
R.onChunkUnloaded = c => {
  const keep = [];
  for (const e of ENT) {
    if (e.dead) continue;
    if (Math.floor(e.x) >> 4 !== c.cx || Math.floor(e.z) >> 4 !== c.cz) continue;
    if (e.kind === 'mob' && !e.def.hostile) keep.push([e.type, e.x, e.y, e.z, e.baby ? 1 : 0, e.sheared ? 1 : 0]);
    removeEnt(e);
  }
  if (keep.length || c.mobs) { c.mobs = keep; c.modified = true; saveChunkMobs(c); }
};
function saveChunkMobs(c) { saveChunk(c); }
W.onChunkLoaded = (c, fresh) => {
  if (W.pano) return; // title screen world stays empty and is never saved
  if (fresh) spawnAnimalsForChunk(c);
  if (c.mobs) for (const [t, x, y, z, baby, sh] of c.mobs) spawnMob(t, x, y, z, { baby, sheared: sh });
};

// ---------- render update (interpolated) ----------
function entityRender(alpha, now) {
  for (const e of ENT) {
    if (e.dead || !e.mesh) continue;
    const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha, z = e.pz + (e.z - e.pz) * alpha;
    const dx = x - camera.position.x, dz = z - camera.position.z;
    const far = dx * dx + dz * dz > Math.min(R.rd * 16, 80) ** 2; // keeps draw calls low on weak GPUs
    e.mesh.visible = !far; if (far) continue;
    const br = lightBright(x, y + Math.max(0.3, e.h * 0.6), z);
    if (e.kind === 'mob') {
      e.mesh.position.set(x, y, z);
      let yaw = e.pyaw + (((e.yaw - e.pyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * alpha;
      e.mesh.rotation.set(0, yaw, e.deathT ? (1 - e.deathT / 20) * Math.PI / 2 : 0);
      const P = e.mesh.userData.parts, sw = Math.sin(e.walk) * 0.9 * e.walkAmt;
      const legs = [['rleg', 1], ['lleg', -1], ['rleg2', -1], ['lleg2', 1]];
      for (const [n, s] of legs) if (P[n]) P[n].rotation.x = sw * s;
      if (P.rarm) { if (e.def.armsOut || (e.type === 'skeleton' && e.target)) { P.rarm.rotation.x = Math.PI / 2 + sw * 0.1; P.larm.rotation.x = Math.PI / 2 - sw * 0.1; } else { P.rarm.rotation.x = -sw; P.larm.rotation.x = sw; } }
      if (P.head && e.target) { const hy = Math.atan2(-(PL.x - x), -(PL.z - z)) - yaw; P.head.rotation.y = ((hy + Math.PI * 3) % (Math.PI * 2)) - Math.PI; P.head.rotation.y = Math.max(-1, Math.min(1, P.head.rotation.y)); }
      if (e.def.water) { for (let i = 0; i < 8; i++) P['t' + i].rotation.set(Math.sin(e.walk + i) * 0.25 + 0.15 * Math.cos(i / 8 * 6.283), 0, -0.15 * Math.sin(i / 8 * 6.283) + Math.cos(e.walk * 0.7 + i) * 0.1); e.mesh.rotation.x = Math.max(-0.6, Math.min(0.6, -e.vy * 8)); }
      if (e.type === 'chicken') { const f = e.onGround ? 0 : Math.sin(now / 40); P.rwing.rotation.z = f * 0.8; P.lwing.rotation.z = -f * 0.8; }
      if (e.type === 'spider') for (let i = 0; i < 4; i++) { const s = Math.sin(e.walk + i * 1.6) * 0.3 * e.walkAmt; P['leg' + i].rotation.y = (i - 1.5) * 0.35 + s; P['legl' + i].rotation.y = -(i - 1.5) * 0.35 - s; }
      const mat = e.mesh.userData.mat;
      if (!e.matOwn) { e.mesh.userData.mat = mat.clone(); e.mesh.traverse(o => { if (o.isMesh) o.material = e.mesh.userData.mat; }); e.matOwn = true; }
      const m2 = e.mesh.userData.mat;
      const flash = e.fuse > 0 && Math.floor(e.fuse / 3) % 2 === 0;
      const bb = e.def.glow ? Math.max(br, 0.9) : br;
      if (e.hurt > 0 || e.deathT) m2.color.setRGB(bb * 1.4, bb * 0.4, bb * 0.4); else if (flash) m2.color.setRGB(2, 2, 2); else m2.color.setScalar(bb);
      if (e.fuse > 0) e.mesh.scale.setScalar(1 + e.fuse / 30 * 0.15); else if (!e.baby) e.mesh.scale.setScalar(1);
    } else if (e.kind === 'item') {
      e.mesh.position.set(x, y + 0.15 + Math.sin(now / 400 + e.spin) * 0.05, z); e.mesh.rotation.y = now / 1000 + e.spin;
      e.mesh.traverse(o => { if (o.isMesh) R.setMeshLight(o, br); });
    } else if (e.kind === 'xp') { e.mesh.position.set(x, y + 0.15, z); e.mesh.material.color.setScalar(1); }
    else if (e.kind === 'falling') { e.mesh.position.set(x, y + 0.5, z); R.setMeshLight(e.mesh, br); }
    else if (e.kind === 'tnt') { e.mesh.position.set(x, y + 0.5, z); const fl = Math.floor(e.fuse / 5) % 2 === 0; R.setMeshLight(e.mesh, fl ? 2 : br); e.mesh.scale.setScalar(e.fuse < 10 ? 1 + (10 - e.fuse) / 50 : 1); }
    else if (e.kind === 'arrow') { e.mesh.position.set(x, y, z); if (!e.stuck) { e.mesh.lookAt(x + e.vx, y + e.vy, z + e.vz); } R.setMeshLight(e.mesh, br); }
  }
}

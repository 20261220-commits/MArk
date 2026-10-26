// Paintings, armor stands, banners and the loom (Java Edition).

// ---------- paintings: 26 motifs, drawn procedurally (16 px per block) ----------
const PAINTINGS = [ // key, width, height (blocks), palette
  ['kebab', 1, 1, ['#b05a2a', '#e8c070', '#5a3a1a']], ['aztec', 1, 1, ['#2a6a8a', '#d8a040', '#8a2a2a']], ['alban', 1, 1, ['#3a7a3a', '#e8e0c0', '#8a5a2a']], ['aztec2', 1, 1, ['#8a2a5a', '#e0c060', '#2a4a8a']],
  ['bomb', 1, 1, ['#2a2a2a', '#c0a080', '#e84a2a']], ['plant', 1, 1, ['#4a8a3a', '#a06a3a', '#e8e0b0']], ['wasteland', 1, 1, ['#8a7a5a', '#4a6a9a', '#3a3a3a']],
  ['pool', 2, 1, ['#3a8ad8', '#e8e0c0', '#c86a4a']], ['courbet', 2, 1, ['#5a7a4a', '#c8b080', '#3a4a6a']], ['sea', 2, 1, ['#2a5a9a', '#c8d8e8', '#7a8a5a']], ['sunset', 2, 1, ['#e88a3a', '#8a3a6a', '#3a2a4a']], ['creebet', 2, 1, ['#5aa84a', '#3a6a9a', '#c8c0a0']],
  ['wanderer', 1, 2, ['#4a6a9a', '#a07a5a', '#2a2a3a']], ['graham', 1, 2, ['#e8d8a0', '#6a4a8a', '#3a2a1a']],
  ['match', 2, 2, ['#e8c040', '#8a5a2a', '#3a3a3a']], ['bust', 2, 2, ['#8a8a8a', '#c84a2a', '#e8e0c0']], ['stage', 2, 2, ['#6a2a2a', '#e8c070', '#2a5a2a']], ['void', 2, 2, ['#1a1a3a', '#e8e8f0', '#6a6a9a']],
  ['skull_and_roses', 2, 2, ['#e8e0d0', '#c82a3a', '#2a2a2a']], ['wither', 2, 2, ['#2a2a2a', '#8a8a9a', '#4a3a6a']], ['fighters', 4, 2, ['#c8a070', '#3a6a3a', '#8a2a2a']],
  ['skeleton', 4, 3, ['#e8e0d0', '#3a3a3a', '#6a5a3a']], ['donkey_kong', 4, 3, ['#c84a2a', '#5a3a1a', '#3a6ad8']], ['pointer', 4, 4, ['#e8e0c0', '#3a5a8a', '#a05a3a']],
  ['pigscene', 4, 4, ['#e8a0a0', '#5a3a2a', '#8ac0e8']], ['burning_skull', 4, 4, ['#e86a1a', '#e8e0d0', '#2a1a1a']],
];
const paintTex = {};
function paintingTexture(key) {
  if (paintTex[key]) return paintTex[key];
  const pc = typeof entCanvas === 'function' && entCanvas('painting_' + key); // the game's own painting, when a jar or pack has it
  if (pc) { const t = new THREE.CanvasTexture(pc); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return paintTex[key] = t; }
  const [, w, h, pal] = PAINTINGS.find(p => p[0] === key), c = document.createElement('canvas'); c.width = w * 16; c.height = h * 16;
  const g = c.getContext('2d'), r = trng(key.length * 131 + key.charCodeAt(1));
  g.fillStyle = pal[1]; g.fillRect(0, 0, c.width, c.height);
  // a few large shapes and a figure, then grain
  for (let i = 0; i < 4 + w * h; i++) { g.fillStyle = pal[r.int(3)]; const bw = 3 + r.int(c.width / 2), bh = 3 + r.int(c.height / 2); g.fillRect(r.int(c.width - 2), r.int(c.height - 2), bw, bh); }
  g.fillStyle = pal[0]; g.beginPath(); g.arc(c.width * (0.3 + r() * 0.4), c.height * (0.3 + r() * 0.4), Math.min(c.width, c.height) * 0.22, 0, 6.283); g.fill();
  for (let i = 0; i < c.width * c.height / 6; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.15})`; g.fillRect(r.int(c.width), r.int(c.height), 1, 1); }
  g.strokeStyle = '#5a3a1a'; g.lineWidth = 2; g.strokeRect(1, 1, c.width - 2, c.height - 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return paintTex[key] = t;
}
const rightOf = n => [n[2], 0, -n[0]]; // the viewer's right when facing a wall whose outward normal is n
function paintingCells(ax, ay, az, f, w, h) { // the air blocks a painting covers, centred on the anchor like Java
  const n = S.DIR6[f], rt = rightOf(n), ox = -Math.floor((w - 1) / 2), oy = -Math.floor((h - 1) / 2), cells = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.push([ax + rt[0] * (ox + i), ay + oy + j, az + rt[2] * (ox + i)]);
  return cells;
}
function paintingFits(ax, ay, az, f, w, h, self) {
  const n = S.DIR6[f];
  return paintingCells(ax, ay, az, f, w, h).every(([x, y, z]) => { const b = getBlock(x, y, z); return (!b || REPL[b]) && SOLID[getBlock(x - n[0], y, z - n[2])] && !ENT.some(o => o !== self && !o.dead && (o.kind === 'painting' || o.kind === 'frame') && (o.cells || [[o.ax, o.ay, o.az]]).some(c => c[0] === x && c[1] === y && c[2] === z) && o.f === f); });
}
function spawnPainting(ax, ay, az, f, motif) {
  const [, w, h] = PAINTINGS.find(p => p[0] === motif), n = S.DIR6[f], rt = rightOf(n), ox = -Math.floor((w - 1) / 2), oy = -Math.floor((h - 1) / 2);
  const cx = ax + .5 + rt[0] * (ox + (w - 1) / 2) - n[0] * (0.5 - 1 / 32), cy = ay + oy + h / 2, cz = az + .5 + rt[2] * (ox + (w - 1) / 2) - n[2] * (0.5 - 1 / 32);
  const e = Ent('painting', cx, cy, cz); e.kind = 'painting'; e.hittable = true; Object.assign(e, { ax, ay, az, f, motif, pw: w, ph: h, cells: paintingCells(ax, ay, az, f, w, h) });
  const g = new THREE.Group(), front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: paintingTexture(motif) }));
  front.position.z = 1 / 32 + 0.001; g.add(front);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1 / 16), new THREE.MeshBasicMaterial({ color: 0x6a4a2a })); g.add(back);
  e.mesh = g; e.w = 0; e.h = 0;
  const hx = n[0] ? 1 / 32 : w / 2, hz = n[2] ? 1 / 32 : w / 2; e.box = [cx - hx, cy - h / 2, cz - hz, cx + hx, cy + h / 2, cz + hz];
  e.tick = pe => { if (pe.age % 20 === 0 && !paintingFits(pe.ax, pe.ay, pe.az, pe.f, pe.pw, pe.ph, pe)) { removeEnt(pe); dropItem(pe.x, pe.y, pe.z, IID.painting, 1); } };
  e.render = (pe, x, y, z, br) => { pe.mesh.position.set(x, y, z); pe.mesh.lookAt(x + n[0], y, z + n[2]); pe.mesh.traverse(o => { if (o.isMesh) o.material.color.setScalar(o === back ? br * 0.7 : br); }); };
  e.onHit = pe => { removeEnt(pe); if (!creative()) dropItem(pe.x, pe.y, pe.z, IID.painting, 1); play('break', { mat: 'wood' }); vibrate(pe.x, pe.y, pe.z); };
  return addEnt(e);
}
function placePainting(t) {
  if (t.ny !== 0) return false;
  const f = S.DIR6.findIndex(v => v[0] === t.nx && v[1] === 0 && v[2] === t.nz), ax = t.x + t.nx, ay = t.y, az = t.z + t.nz;
  const fit = PAINTINGS.filter(([, w, h]) => paintingFits(ax, ay, az, f, w, h)); if (!fit.length) return false;
  const big = Math.max(...fit.map(p => p[1] * p[2])), pick = fit.filter(p => p[1] * p[2] === big);
  spawnPainting(ax, ay, az, f, pick[(Math.random() * pick.length) | 0][0]); consume(); play('place', { mat: 'wood' }); swing(); vibrate(ax + .5, ay + .5, az + .5);
  return true;
}

// ---------- armor stands ----------
const ARMOR_COL = { leather: 0xa06540, chainmail: 0x9a9a9a, iron: 0xdadada, golden: 0xf0d040, diamond: 0x4ae0d8, netherite: 0x4a4040, turtle: 0x4aa84a, elytra: 0x8a8aa0 };
const ARMOR_BOX = [[0.56, 0.56, 0.56, 1.69], [0.6, 0.78, 0.36, 1.09], [0.5, 0.48, 0.34, 0.5], [0.52, 0.22, 0.34, 0.1]]; // helmet, chestplate, leggings, boots: w, h, d, centre y
const STAND_ARMOR = [[1, 1, [['head', [0, 1, 0], [0, 0, -4, -8, -4, 8, 8, 8]]]], [1, 1, [['body', [0, 0, 0], [16, 16, -4, 0, -2, 8, 12, 4]], ['rarm', [-5, 2, 0], [40, 16, -3, -2, -2, 4, 12, 4], [-0.262, 0, 0.175]], ['larm', [5, 2, 0], [40, 16, -1, -2, -2, 4, 12, 4, 0, 1], [-0.175, 0, -0.175]]]],
  [2, 0.5, [['body', [0, 0, 0], [16, 16, -4, 0, -2, 8, 12, 4]], ['rleg', [-1.9, 12, 0], [0, 16, -2, 0, -2, 4, 12, 4]], ['lleg', [1.9, 12, 0], [0, 16, -2, 0, -2, 4, 12, 4, 0, 1]]]], [1, 1, [['rleg', [-1.9, 12, 0], [0, 16, -2, 0, -2, 4, 12, 4]], ['lleg', [1.9, 12, 0], [0, 16, -2, 0, -2, 4, 12, 4, 0, 1]]]]];
const STAND_TEX = { leather: 'leather', chainmail: 'chainmail', iron: 'iron', golden: 'gold', diamond: 'diamond', netherite: 'netherite', turtle: 'turtle' };
function standMesh(e) {
  const tex = packTexture('armorstand');
  if (tex) { // ArmorStandEntityModel, wearing biped armour layers (inflated 1 and 0.5 px) from models/armor
    const g = new THREE.Group(), m = buildMCModel('armor_stand', MCMODELS.armor_stand, tex); g.add(m); const mats = [m.userData.mat];
    e.armor.forEach((st, i) => { if (!st) return; const a = ITEMS[st.id].armor;
      if (!a) { const im = R.itemMesh(st.id); im.scale.setScalar(0.625); im.position.y = 1.75; g.add(im); im.userData.c = 0xffffff; return; }
      const [layer, dil, parts] = STAND_ARMOR[i], tk = STAND_TEX[a.mat], at = tk && packTexture('armor_' + tk + '_' + layer); if (!at) return;
      const spec = { tex: 'armor_' + tk + '_' + layer, tw: 64, th: 32, parts: parts.map(([n, o, b, r]) => { const bb = b.slice(); bb[8] = dil; return { n, o, r, b: [bb] }; }) };
      const am = buildMCModel('stand_armor_' + i, spec, at); g.add(am); mats.push(am.userData.mat); if (a.mat === 'leather') am.userData.mat.userData.col = new THREE.Color(0xa06540);
      if (st.e) { const gl = buildMCModel('stand_armor_' + i, spec, at); gl.traverse(o => { if (o.isMesh) o.material = R.glintMaterial(true); }); g.add(gl); } });
    g.userData.mats = mats; return g;
  }
  const g = new THREE.Group(), wood = new THREE.MeshBasicMaterial({ color: 0xa8865a }), stone = new THREE.MeshBasicMaterial({ color: 0x9a9a9a });
  let box = (w, h, d, x, y, z, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.clone()); me.position.set(x, y, z); g.add(me); return me; };
  const box0 = box; box = (w, h, d, x, y, z, m) => { const me = box0(w, h, d, x, y, z, m); me.userData.c = m.color.getHex(); return me; };
  box(0.75, 0.06, 0.75, 0, 0.03, 0, stone); box(0.08, 0.7, 0.08, -0.09, 0.4, 0, wood); box(0.08, 0.7, 0.08, 0.09, 0.4, 0, wood); box(0.45, 0.08, 0.1, 0, 0.75, 0, wood);
  box(0.08, 0.45, 0.08, -0.09, 1.0, 0, wood); box(0.08, 0.45, 0.08, 0.09, 1.0, 0, wood); box(0.75, 0.1, 0.12, 0, 1.3, 0, wood); box(0.08, 0.3, 0.08, 0, 1.5, 0, wood);
  e.armor.forEach((st, i) => { if (!st) return; const a = ITEMS[st.id].armor, [w, h, d, y] = ARMOR_BOX[i], col = ARMOR_COL[a && a.mat] || (st.id === BID.pumpkin ? 0xe88a1a : 0x888888); box(w, h, d, 0, y, 0, new THREE.MeshBasicMaterial({ color: col })); });
  return g;
}
function spawnArmorStand(x, y, z, yaw, armor) {
  const e = Ent('armor_stand', x, y, z); e.kind = 'armor_stand'; e.hittable = true; e.w = 0.25; e.h = 1.975; e.yaw = yaw; e.armor = armor || [null, null, null, null];
  e.mesh = standMesh(e);
  e.tick = se => { se.vy -= 0.04; physMove(se, 0, se.vy, 0); if (se.onGround) se.vy = 0; if (se.y < -40) removeEnt(se); };
  e.render = (se, rx, ry, rz, br) => { se.mesh.position.set(rx, ry, rz); se.mesh.rotation.y = se.yaw;
    if (se.mesh.userData.mats) { for (const m of se.mesh.userData.mats) { m.color.setScalar(br); if (m.userData.col) m.color.multiply(m.userData.col); } return; }
    se.mesh.traverse(o => { if (o.isMesh) o.material.color.setHex(o.userData.c).multiplyScalar(br); }); };
  e.onHit = se => { removeEnt(se); if (!creative()) { dropItem(se.x, se.y + 0.5, se.z, IID.armor_stand, 1); for (const st of se.armor) if (st) dropStack(se.x, se.y + 1, se.z, st); } play('break', { mat: 'wood' }); vibrate(se.x, se.y, se.z); };
  return addEnt(e);
}
function standUse(e, h, hitY) { // put armor on, or take off the piece you aim at (by height)
  const d = h && ITEMS[h.id];
  if (d && (d.armor || h.id === BID.pumpkin)) {
    const slot = h.id === BID.pumpkin ? 0 : d.armor.slot, old = e.armor[slot];
    e.armor[slot] = { ...h, n: 1 }; if (!creative()) { h.n--; if (!h.n) INV.slots[INV.sel] = old; else if (old) INV.giveOrDrop(old); }
  } else {
    const rel = hitY - e.y, order = rel > 1.45 ? [0, 1, 2, 3] : rel > 0.75 ? [1, 0, 2, 3] : rel > 0.3 ? [2, 1, 3, 0] : [3, 2, 1, 0], k = order.find(i => e.armor[i]);
    if (k == null) return; INV.giveOrDrop(e.armor[k]); e.armor[k] = null;
  }
  scene.remove(e.mesh); e.mesh = standMesh(e); scene.add(e.mesh); play('place', { mat: 'metal' }); swing(); UI.hudDirty = true;
}

// ---------- banners ----------
// patterns: name and a mask over the 20x40 cloth (1 = colour, fractions for gradients)
const BW = 20, BH = 40;
const BANNER_PATTERNS = {
  stripe_bottom: ['아래 띠', (x, y) => y >= 27], stripe_top: ['위 띠', (x, y) => y < 13], stripe_left: ['왼쪽 줄', (x, y) => x < 7], stripe_right: ['오른쪽 줄', (x, y) => x >= 13],
  stripe_center: ['가운데 줄', (x, y) => x >= 7 && x < 13], stripe_middle: ['가운데 띠', (x, y) => y >= 13 && y < 27], stripe_downright: ['오른쪽 아래 대각선', (x, y) => Math.abs(x / BW - y / BH) < 0.14], stripe_downleft: ['왼쪽 아래 대각선', (x, y) => Math.abs(1 - x / BW - y / BH) < 0.14],
  small_stripes: ['가는 줄무늬', (x, y) => x % 4 < 2], cross: ['대각선 십자', (x, y) => Math.abs(x / BW - y / BH) < 0.12 || Math.abs(1 - x / BW - y / BH) < 0.12], straight_cross: ['십자', (x, y) => (x >= 8 && x < 12) || (y >= 17 && y < 23)],
  diagonal_left: ['왼쪽 위 반', (x, y) => x / BW + y / BH < 1], diagonal_right: ['오른쪽 위 반', (x, y) => (1 - x / BW) + y / BH < 1], diagonal_up_left: ['왼쪽 아래 반', (x, y) => x / BW < y / BH], diagonal_up_right: ['오른쪽 아래 반', (x, y) => 1 - x / BW < y / BH],
  half_vertical: ['왼쪽 반', (x, y) => x < 10], half_vertical_right: ['오른쪽 반', (x, y) => x >= 10], half_horizontal: ['위쪽 반', (x, y) => y < 20], half_horizontal_bottom: ['아래쪽 반', (x, y) => y >= 20],
  square_top_left: ['왼쪽 위 사각형', (x, y) => x < 7 && y < 13], square_top_right: ['오른쪽 위 사각형', (x, y) => x >= 13 && y < 13], square_bottom_left: ['왼쪽 아래 사각형', (x, y) => x < 7 && y >= 27], square_bottom_right: ['오른쪽 아래 사각형', (x, y) => x >= 13 && y >= 27],
  triangle_bottom: ['아래 삼각형', (x, y) => BH - 1 - y < 10 - Math.abs(x - 9.5)], triangle_top: ['위 삼각형', (x, y) => y < 10 - Math.abs(x - 9.5)],
  triangles_bottom: ['아래 톱니', (x, y) => BH - 1 - y < 4 - Math.abs((x % 5) - 2)], triangles_top: ['위 톱니', (x, y) => y < 4 - Math.abs((x % 5) - 2)],
  circle: ['원', (x, y) => Math.hypot(x - 9.5, y - 19.5) < 5.5], rhombus: ['마름모', (x, y) => Math.abs(x - 9.5) / 7 + Math.abs(y - 19.5) / 12 < 1], border: ['테두리', (x, y) => x < 2 || x >= 18 || y < 2 || y >= 38],
  gradient: ['그라데이션', (x, y) => 1 - y / BH], gradient_up: ['아래 그라데이션', (x, y) => y / BH],
  // these need their banner pattern item in the loom
  creeper: ['크리퍼', (x, y) => (y >= 13 && y < 17 && (x >= 5 && x < 8 || x >= 12 && x < 15)) || (y >= 17 && y < 20 && x >= 8 && x < 12) || (y >= 20 && y < 25 && (x >= 7 && x < 13) && !(y >= 23 && x >= 9 && x < 11)), 'creeper'],
  skull: ['해골', (x, y) => (Math.hypot(x - 9.5, (y - 17) * 1.1) < 4.5 && !(y >= 16 && y < 18 && (Math.abs(x - 7.5) < 1 || Math.abs(x - 11.5) < 1))) || (y >= 22 && y < 30 && (Math.abs((x - 9.5) - (y - 26)) < 1 || Math.abs((x - 9.5) + (y - 26)) < 1)), 'skull'],
  flower: ['꽃', (x, y) => { const d = Math.hypot(x - 9.5, y - 19.5), a = Math.atan2(y - 19.5, x - 9.5); return d < 2 || (d < 6 && Math.cos(a * 4) > 0.3 && d > 2.8); }, 'flower'],
  mojang: ['모장', (x, y) => { const d = Math.hypot(x - 9.5, y - 19.5); return d < 7 && d > 4.5 && !(x > 9.5 && Math.abs(y - 19.5) < 2.5) || (Math.abs(x - 9.5) < 2.5 && Math.abs(y - 19.5) < 2.5); }, 'mojang'],
  globe: ['지구본', (x, y) => { const d = Math.hypot(x - 9.5, y - 19.5); return d < 6.5 && ((Math.sin(x * 0.9) + Math.cos(y * 0.7)) > 0.4 || d > 5.8); }, 'globe'],
  piglin: ['피글린', (x, y) => (y >= 18 && y < 24 && x >= 6 && x < 14 && !(y >= 20 && y < 22 && (x === 8 || x === 11))) || (y >= 24 && y < 27 && (x === 6 || x === 13)), 'piglin'],
};
const DYE_HEX = ['#f9fffe', '#f9801d', '#c74ebd', '#3ab3da', '#fed83d', '#80c71f', '#f38baa', '#474f52', '#9d9d97', '#169c9c', '#8932b8', '#3c44aa', '#835432', '#5e7c16', '#b02e26', '#1d1d21'];
const bannerTex = {};
function bannerTexture(base, pats) {
  const key = base + ':' + JSON.stringify(pats || []); if (bannerTex[key]) return bannerTex[key];
  const cl = typeof bannerCloth === 'function' && bannerCloth(base, pats);
  if (cl) { const c = document.createElement('canvas'); c.width = BW; c.height = BH; c.getContext('2d').putImageData(new ImageData(cl, BW, BH), 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return bannerTex[key] = t; }
  const c = document.createElement('canvas'); c.width = BW; c.height = BH; const g = c.getContext('2d'), img = g.createImageData(BW, BH), r = trng(9);
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const col = new Array(BW * BH).fill(0).map(() => hexRGB(DYE_HEX[base]));
  for (const [p, ci] of pats || []) { const m = BANNER_PATTERNS[p] && BANNER_PATTERNS[p][1], pc = hexRGB(DYE_HEX[ci]); if (!m) continue; for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { let a = +m(x, y); if (a <= 0) continue; a = Math.min(1, a); const o = col[y * BW + x]; col[y * BW + x] = o.map((v, k) => v + (pc[k] - v) * a); } }
  col.forEach((v, i) => { const f = 0.92 + r() * 0.1; img.data[i * 4] = v[0] * f; img.data[i * 4 + 1] = v[1] * f; img.data[i * 4 + 2] = v[2] * f; img.data[i * 4 + 3] = 255; });
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return bannerTex[key] = t;
}
const BANNERS = trackBlocks(BID.banner), WALL_BANNERS = trackBlocks(BID.wall_banner), bannerMeshes = new Map();
function bannerMesh(wall, base, pats) {
  const g = new THREE.Group(), wood = new THREE.MeshBasicMaterial({ color: 0x8a6a3b });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(BW / 16, BH / 16), new THREE.MeshBasicMaterial({ map: bannerTexture(base, pats), side: THREE.DoubleSide }));
  const pivot = new THREE.Group(); cloth.position.y = -BH / 32; pivot.add(cloth); g.add(pivot); g.userData.cloth = pivot;
  if (wall) { const bar = new THREE.Mesh(new THREE.BoxGeometry(BW / 16, 2 / 16, 2 / 16), wood); bar.position.set(0, 0, 1 / 16); g.add(bar); pivot.position.set(0, 0, 2 / 16 + 0.01); }
  else { const pole = new THREE.Mesh(new THREE.BoxGeometry(2 / 16, 42 / 16, 2 / 16), wood); pole.position.y = 21 / 16; g.add(pole); const bar = new THREE.Mesh(new THREE.BoxGeometry(BW / 16, 2 / 16, 2 / 16), wood); bar.position.y = 42 / 16; g.add(bar); pivot.position.set(0, 42 / 16, 2 / 16); }
  return g;
}
function bannerTick() {
  const live = new Set();
  for (const set of [BANNERS, WALL_BANNERS]) for (const k of set) {
    live.add(k);
    const [x, y, z] = k.split(',').map(Number), b = getBlock(x, y, z), m = getMeta(x, y, z), t = getTile(x, y, z) || { p: [] }, wall = b === BID.wall_banner;
    const sig = b + ':' + m + ':' + JSON.stringify(t.p || []); let cur = bannerMeshes.get(k);
    if (!cur || cur.sig !== sig) {
      if (cur) scene.remove(cur.mesh);
      const mesh = bannerMesh(wall, m & 15, t.p);
      if (wall) { const f = (m >> 4) & 3, d = DIRS[f]; mesh.position.set(x + .5 - d[0] * 0.5, y + 0.99, z + .5 - d[2] * 0.5); mesh.rotation.y = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][f]; } // f: the way it faces; it hangs on the block behind
      else { mesh.position.set(x + .5, y, z + .5); mesh.rotation.y = -((m >> 4) & 15) / 16 * Math.PI * 2; }
      scene.add(mesh); cur = { sig, mesh }; bannerMeshes.set(k, cur);
    }
    const br = lightBright(x + .5, y + .5, z + .5); cur.mesh.traverse(o => { if (o.isMesh) o.material.color.setScalar(br); });
    cur.mesh.userData.cloth.rotation.x = Math.sin(performance.now() / 900 + x * 0.7 + z) * 0.06;
  }
  for (const [k, v] of bannerMeshes) if (!live.has(k)) { scene.remove(v.mesh); bannerMeshes.delete(k); }
}
function placeBanner(t, h) {
  const color = ITEMS[h.id].vi || 0, x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz, cur = getBlock(x, y, z);
  if ((cur && !REPL[cur]) || t.ny === -1) return false;
  if (t.ny === 1) { if (!SOLID[getBlock(x, y - 1, z)]) return false; setBlock(x, y, z, BID.banner, color | ((Math.round(-PL.yaw / (Math.PI * 2) * 16 + 8) & 15) << 4)); }
  else { const f = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dz]) => dx === t.nx && dz === t.nz); setBlock(x, y, z, BID.wall_banner, color | (f << 4)); }
  setTile(x, y, z, { type: 'banner', c: color, p: (h.bp || []).slice() }); consume(); play('place', { mat: 'wool' }); swing();
  return true;
}
// a banner's patterns travel with its item
function bannerItem(t) { const id = itemOfBlock(BID.banner, t.c || 0), it = { id, n: 1 }; if (t && t.p && t.p.length) it.bp = t.p.slice(); return it; }
const ominousBanner = () => ({ id: IID.white_banner, n: 1, name: '불길한 현수막', bp: [['rhombus', 9], ['stripe_bottom', 8], ['stripe_center', 7], ['border', 8], ['stripe_middle', 15], ['half_horizontal', 8], ['circle', 8], ['border', 15]] });
// loom: banner + dye, pick a pattern
function loomResult(ctx) {
  const [b, dye, pi] = ctx.items; if (!b || !dye || !ctx.pat) return null;
  const need = BANNER_PATTERNS[ctx.pat] && BANNER_PATTERNS[ctx.pat][2]; if (need && !(pi && ITEMS[pi.id].pattern === need)) return null;
  const d = ITEMS[b.id]; if (!d.block || d.place !== BID.banner) return null;
  const ci = S.COLORS.indexOf(ITEMS[dye.id].key.replace('_dye', '')); if (ci < 0 || (b.bp || []).length >= 6) return null;
  return { ...b, n: 1, bp: [...(b.bp || []), [ctx.pat, ci]] };
}
function loomHtml() {
  const c = GUI.ctx, pat = c.items[2] && ITEMS[c.items[2].id].pattern, list = Object.entries(BANNER_PATTERNS).filter(([, p]) => !p[2] || p[2] === pat), base = c.items[0] ? ITEMS[c.items[0].id].vi || 0 : 0, dye = c.items[1] ? Math.max(0, S.COLORS.indexOf(ITEMS[c.items[1].id].key.replace('_dye', ''))) : 15;
  const btns = list.map(([k, [nm]]) => `<button class="lpat ${c.pat === k ? 'on' : ''}" data-loom="${k}" title="${nm}" style="background-image:url(${bannerTexture(base, [[k, dye]]).image.toDataURL()})"></button>`).join('');
  return `<div class="panel"><div class="cap">베틀</div><div class="row top loom"><div class="col">${slotHtml(0)}${slotHtml(1)}${slotHtml(3)}</div><div class="lpats">${btns}</div><div class="arrow"></div>${slotHtml(2, 'big')}</div><div class="cap">인벤토리</div>${invRows(4)}</div>`;
}

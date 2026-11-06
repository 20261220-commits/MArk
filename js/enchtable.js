// The enchanting table's book and its bookshelves' glyphs, as Java 1.18 draws them.
//  - the book (EnchantmentTableBlockEntity + EnchantTableRenderer + BookModel): floats 0.85 above the table, bobbing;
//    with a player within 3 blocks it turns toward them, opens and flips its pages now and then; with nobody near it
//    closes and slowly turns round
//  - the glyphs (EnchantmentTableBlock.animateTick + EnchantmentTableParticle): from each bookshelf that counts (ui.js,
//    enchShelfOK), now and then a glyph flies from the shelf into the book, sinking as it comes
const ENCH_TABLES = trackBlocks(BID.enchanting_table);
const ETB = new Map(); // "x,y,z" -> the book's state and its model
// the book's texture: the game's own (entity/enchanting_table_book) when a jar or pack has it, else a plain one
function etbTexture() {
  if (ETB.tex) return ETB.tex;
  let t = typeof packTexture === 'function' && PACKPX.ent && PACKPX.ent.ench_book ? packTexture('ench_book') : null;
  if (!t) { const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
    g.fillStyle = '#6b3a1e'; g.fillRect(0, 0, 32, 10); g.fillStyle = '#8a5a2e'; g.fillRect(1, 1, 5, 8); g.fillRect(17, 1, 5, 8); // covers
    g.fillStyle = '#e8e0c8'; g.fillRect(0, 10, 36, 9); g.fillStyle = '#b8b0a0'; for (let y = 12; y < 18; y += 2) g.fillRect(1, y, 28, 1); // pages
    t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; }
  return ETB.tex = t;
}
// BookModel's parts: [name, pivot, box (x, y, z, w, h, d), texture u, v]; pixels, a 64 x 32 texture
const ETB_PARTS = [['leftLid', [0, 0, -1], [-6, -5, -0.005, 6, 10, 0.005], 0, 0], ['rightLid', [0, 0, 1], [0, -5, -0.005, 6, 10, 0.005], 16, 0],
  ['seam', [0, 0, 0], [-1, -5, 0, 2, 10, 0.005], 12, 0], ['leftPages', [0, 0, 0], [0, -4, -0.99, 5, 8, 1], 0, 10], ['rightPages', [0, 0, 0], [0, -4, -0.01, 5, 8, 1], 12, 10],
  ['flip1', [0, 0, 0], [0, -4, 0, 5, 8, 0.005], 24, 10], ['flip2', [0, 0, 0], [0, -4, 0, 5, 8, 0.005], 24, 10]];
function etbModel() {
  const mat = new THREE.MeshBasicMaterial({ map: etbTexture(), alphaTest: 0.1, side: THREE.DoubleSide, vertexColors: true }), root = new THREE.Group(), spin = new THREE.Group(), P = {};
  root.add(spin);
  for (const [n, pv, b, u, v] of ETB_PARTS) { const g = new THREE.Group(); g.position.set(pv[0] / 16, pv[1] / 16, pv[2] / 16); const m = new THREE.Mesh(boxGeo(b[3], b[4], b[5], u, v, b[0], b[1], b[2], 0, 64, 32), mat); g.add(m); spin.add(g); P[n] = g; }
  P.seam.rotation.y = Math.PI / 2;
  root.userData = { P, spin, mat }; return root;
}
function etbState(k) {
  let s = ETB.get(k); if (s) return s;
  const [x, y, z] = k.split(',').map(Number);
  s = { x, y, z, time: 0, flip: 0, oFlip: 0, flipT: 0, flipA: 0, open: 0, oOpen: 0, rot: 0, oRot: 0, tRot: Math.random() * Math.PI * 2, mesh: null };
  ETB.set(k, s); return s;
}
// every tick (Java's bookAnimationTick), for the tables near the player
function enchTableTick() {
  if (!ENCH_TABLES.size) { if (ETB.size) { for (const s of ETB.values()) if (s.mesh) scene.remove(s.mesh); ETB.clear(); } return; }
  for (const [k, s] of ETB) if (!ENCH_TABLES.has(k) || Math.hypot(s.x - PL.x, s.z - PL.z) > 48) { if (s.mesh) scene.remove(s.mesh); ETB.delete(k); }
  for (const k of ENCH_TABLES) {
    const [x, y, z] = k.split(',').map(Number); if (Math.hypot(x + .5 - PL.x, z + .5 - PL.z) > 40) continue;
    const s = etbState(k); s.oOpen = s.open; s.oRot = s.rot;
    const near = !PL.dead && PL.mode !== 'spectator' && Math.hypot(PL.x - x - .5, PL.y - y - .5, PL.z - z - .5) < 3;
    if (near) { s.tRot = Math.atan2(PL.z - z - .5, PL.x - x - .5); s.open += 0.1;
      if (s.open < 0.5 || Math.random() < 1 / 40) { const f1 = s.flipT; do { s.flipT += Math.floor(Math.random() * 4) - Math.floor(Math.random() * 4); } while (f1 === s.flipT); } }
    else { s.tRot += 0.02; s.open -= 0.1; }
    const wrap = a => { while (a >= Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    s.rot = wrap(s.rot); s.tRot = wrap(s.tRot); s.rot += wrap(s.tRot - s.rot) * 0.4;
    s.open = Math.max(0, Math.min(1, s.open)); s.time++; s.oFlip = s.flip;
    const f = Math.max(-0.2, Math.min(0.2, (s.flipT - s.flip) * 0.4)); s.flipA += (f - s.flipA) * 0.9; s.flip += s.flipA;
    enchGlyphs(x, y, z);
  }
}
// drawn between ticks (EnchantTableRenderer)
function enchTableRender(alpha) {
  for (const s of ETB.values()) {
    if (!s.mesh) { s.mesh = etbModel(); scene.add(s.mesh); }
    const t = s.time + alpha, U = s.mesh.userData, P = U.P;
    s.mesh.position.set(s.x + .5, s.y + 0.75 + 0.1 + Math.sin(t * 0.1) * 0.01, s.z + .5);
    let d = s.rot - s.oRot; while (d >= Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    s.mesh.rotation.set(0, -(s.oRot + d * alpha), 0); U.spin.rotation.set(0, 0, 80 * Math.PI / 180);
    const fl = s.oFlip + (s.flip - s.oFlip) * alpha, fr = v => Math.max(0, Math.min(1, v - Math.floor(v))) * 1.6 - 0.3, cl = v => Math.max(0, Math.min(1, v));
    const rf = cl(fr(fl + 0.25)), lf = cl(fr(fl + 0.75)), open = s.oOpen + (s.open - s.oOpen) * alpha;
    const a = (Math.sin(t * 0.02) * 0.1 + 1.25) * open, sx = Math.sin(a) / 16;
    P.leftLid.rotation.y = Math.PI + a; P.rightLid.rotation.y = -a; P.leftPages.rotation.y = a; P.rightPages.rotation.y = -a;
    P.flip1.rotation.y = a - a * 2 * rf; P.flip2.rotation.y = a - a * 2 * lf;
    for (const n of ['leftPages', 'rightPages', 'flip1', 'flip2']) P[n].position.x = sx * 16 / 16;
    const br = typeof lightBright === 'function' ? lightBright(s.x + .5, s.y + 1, s.z + .5) : 1;
    s.mesh.traverse(o => { if (o.isMesh && R.setMeshLight) R.setMeshLight(o, br); });
  }
  enchGlyphRender(alpha);
}
// ---------- the glyphs ----------
// Java picks blocks around the player at random for animateTick (667 a tick, close ones more often); a table gets a turn
// about this often, and then each shelf that counts sends a glyph 1 time in 16
const GLYPHS = []; let GLYPH_MAT = null;
function enchGlyphs(x, y, z) {
  const dx = Math.abs(x - Math.floor(PL.x)), dy = Math.abs(y - Math.floor(PL.y)), dz = Math.abs(z - Math.floor(PL.z)), tri = (d, r) => Math.max(0, r - d) / (r * r);
  const p = 667 * (tri(dx, 16) * tri(dy, 16) * tri(dz, 16) + tri(dx, 32) * tri(dy, 32) * tri(dz, 32));
  if (Math.random() >= Math.min(1, p)) return;
  for (const o of ENCH_SHELF_OFFSETS) if (Math.random() < 1 / 16 && enchShelfOK(x, y, z, o))
    GLYPHS.push({ x0: x + .5, y0: y + 2, z0: z + .5, vx: o[0] + Math.random() - 0.5, vy: o[1] - Math.random() - 1, vz: o[2] + Math.random() - 0.5, age: 0, life: Math.floor(Math.random() * 10 + 30), g: Math.floor(Math.random() * 26), c: Math.random() * 0.6 + 0.4, sp: null });
}
// a glyph of the standard galactic alphabet: the game's own particle when a pack has it, else a small mark drawn here
function glyphTex(i) {
  GLYPH_MAT = GLYPH_MAT || [];
  if (GLYPH_MAT[i]) return GLYPH_MAT[i];
  const own = PACKPX.ent && PACKPX.ent['sga_' + String.fromCharCode(97 + i)];
  let t;
  if (own) t = packTexture('sga_' + String.fromCharCode(97 + i));
  else { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#fff'; const r = S.rng(i * 977 + 13);
    for (let k = 0; k < 5; k++) { const vert = r() < 0.5, a = 1 + r.int(5), b = 1 + r.int(4); if (vert) g.fillRect(a, b, 1, 2 + r.int(3)); else g.fillRect(b, a, 2 + r.int(3), 1); }
    t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return GLYPH_MAT[i] = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.1, depthWrite: false });
}
function enchGlyphTick() {
  for (let i = GLYPHS.length - 1; i >= 0; i--) { const q = GLYPHS[i]; if (++q.age >= q.life) { if (q.sp) scene.remove(q.sp); GLYPHS.splice(i, 1); } }
}
function enchGlyphRender(alpha) {
  for (const q of GLYPHS) {
    if (!q.sp) { q.sp = new THREE.Sprite(glyphTex(q.g).clone()); q.sp.scale.setScalar(0.1 * (Math.random() * 0.5 + 0.2) * 2 + 0.05); q.sp.material.color.setRGB(0.9 * q.c, 0.9 * q.c, q.c); scene.add(q.sp); }
    const f = 1 - (q.age + alpha) / q.life, f1 = (1 - f) ** 4; // (EnchantmentTableParticle: from the shelf toward the book, sinking at the end)
    q.sp.position.set(q.x0 + q.vx * f, q.y0 + q.vy * f - f1 * 1.2, q.z0 + q.vz * f);
  }
}

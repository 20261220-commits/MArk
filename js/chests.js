// ---------- chests drawn as Java's chest model (ChestRenderer) ----------
// The block mesher leaves chests, trapped chests and ender chests out; here each one gets a body, a lid and a latch
// (14 x 14 pixels, the lid's hinge at the back), two halves of a large chest are one long chest with one latch in the
// middle, and the lid swings open while someone has the chest open (1 - (1 - t)^3 over half a second, as Java).
// The faces use the chest tiles in the block atlas, so the look follows the jar's chest textures, or the game's own.
const CHEST_IDS = () => CHESTS.ids || (CHESTS.ids = new Set([BID.chest, BID.trapped_chest, BID.ender_chest]));
const CHESTS = { m: new Map(), lids: new Map(), mat: null, scanAt: 0 };
const CHEST_TILE = { [44]: 'chest', [1102]: 'trapped_chest', [1094]: 'ender_chest' };
// the chunk's chest positions, found once and again after a chest is placed or broken in it
function chestList(c) {
  if (c.chests) return c.chests;
  const out = [], B = c.blocks, ids = CHEST_IDS();
  for (let i = 0; i < B.length; i++) if (ids.has(B[i])) out.push(i);
  return c.chests = out;
}
{ const sb = setBlock; setBlock = function (x, y, z, id) { const ids = CHEST_IDS(), was = getBlock(x, y, z), r = sb.apply(this, arguments); if (ids.has(id) || ids.has(was)) { const c = chunkAt(x >> 4, z >> 4); if (c) c.chests = null; } return r; }; }
// one quad: corners bottom-left, bottom-right, top-right, top-left (seen from outside), the tile's pixel rectangle
function chestQuad(G, tile, c, u0, v0, u1, v1, shade) {
  const tu = (tile % TPR) * 16, tv = ((tile / TPR) | 0) * 16, U = u => (tu + u) / ATLAS_W, V = v => (tv + v) / ATLAS_W, n = G.pos.length / 3;
  const uv = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
  for (let k = 0; k < 4; k++) { G.pos.push(c[k][0] / 16, c[k][1] / 16, c[k][2] / 16); G.uv.push(U(uv[k][0]), V(uv[k][1])); G.col.push(shade, shade, shade); }
  G.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
}
// a box of the model: x0..x1 (pixels, centred on the block), the side tile's rows for its height, whether it's the
// lid (top and bottom both from the top tile; the inner faces darker)
function chestBox(G, T, x0, y0, z0, x1, y1, z1, rows, halves, inner, zo) { // zo: where the box's z 0 is on the body (the lid is built around its hinge)
  const side = T.side, top = T.top;
  // along x: one quad per block half, so a large chest's long sides show each half's own side texture
  const spans = []; for (let h = 0; h < halves; h++) spans.push([Math.max(x0, -8 + 16 * h), Math.min(x1, 8 + 16 * h), h]);
  const uL = (x, h) => halves === 1 ? x + 8 : h === 0 ? 1 + (x + 7) * 14 / 15 : 1 + (x - 8) * 14 / 15;
  for (const [a, b, h] of spans) {
    chestQuad(G, side, [[a, y0, z1], [b, y0, z1], [b, y1, z1], [a, y1, z1]], uL(a, h), rows[0], uL(b, h), rows[1], 0.8); // front
    chestQuad(G, side, [[b, y0, z0], [a, y0, z0], [a, y1, z0], [b, y1, z0]], 16 - uL(b, h), rows[0], 16 - uL(a, h), rows[1], 0.8); // back
    chestQuad(G, top, [[a, y1, z1], [b, y1, z1], [b, y1, z0], [a, y1, z0]], uL(a, h), z0 + zo + 8, uL(b, h), z1 + zo + 8, inner === 'top' ? 0.45 : 1); // top
    chestQuad(G, top, [[a, y0, z0], [b, y0, z0], [b, y0, z1], [a, y0, z1]], uL(a, h), z0 + zo + 8, uL(b, h), z1 + zo + 8, inner === 'bottom' ? 0.4 : 0.5); // bottom
  }
  chestQuad(G, side, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], 1, rows[0], 15, rows[1], 0.6); // right end
  chestQuad(G, side, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 1, rows[0], 15, rows[1], 0.6); // left end
}
function chestGeo(G) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(G.col, 3)); g.setIndex(G.idx); return g; }
// the model: a group at the block's centre (the left half's, for a large chest) turned to face its front
function chestMesh(x, y, z, id, f, halves) {
  const k = CHEST_TILE[id], T = { side: S.T[k + '_side'], top: S.T[k + '_top'], front: S.T[k + '_front'] };
  if (!CHESTS.mat) CHESTS.mat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const x1 = 7 + 16 * (halves - 1), mid = 8 * (halves - 1);
  const base = { pos: [], uv: [], col: [], idx: [] }, lid = { pos: [], uv: [], col: [], idx: [] };
  chestBox(base, T, -7, 0, -7, x1, 9, 7, [7, 16], halves, 'top', 0); // body: 10 high in Java, the lid covers its top pixel
  chestBox(lid, T, -7, 0, 0, x1, 5, 14, [2, 7], halves, 'bottom', -7); // lid, around its hinge (0,0,0) = the body's back top edge
  // the latch: 2 x 4 x 1 pixels on the lid's front, the front tile's latch pixels
  const Lx0 = mid - 1, Lx1 = mid + 1;
  chestQuad(lid, T.front, [[Lx0, -2, 15], [Lx1, -2, 15], [Lx1, 2, 15], [Lx0, 2, 15]], 7, 4, 9, 8, 0.8);
  chestQuad(lid, T.front, [[Lx0, 2, 15], [Lx1, 2, 15], [Lx1, 2, 14], [Lx0, 2, 14]], 7, 4, 9, 5, 1);
  chestQuad(lid, T.front, [[Lx0, -2, 14], [Lx1, -2, 14], [Lx1, -2, 15], [Lx0, -2, 15]], 7, 7, 9, 8, 0.5);
  chestQuad(lid, T.front, [[Lx1, -2, 15], [Lx1, -2, 14], [Lx1, 2, 14], [Lx1, 2, 15]], 7, 4, 8, 8, 0.6);
  chestQuad(lid, T.front, [[Lx0, -2, 14], [Lx0, -2, 15], [Lx0, 2, 15], [Lx0, 2, 14]], 8, 4, 9, 8, 0.6);
  const grp = new THREE.Group(), body = new THREE.Mesh(chestGeo(base), CHESTS.mat.clone()), lidM = new THREE.Mesh(chestGeo(lid), body.material), hinge = new THREE.Group();
  hinge.position.set(0, 9 / 16, -7 / 16); hinge.add(lidM); // the lid turns about the body's back top edge
  grp.add(body, hinge); grp.userData.hinge = hinge; grp.userData.mat = body.material;
  const d = DIRS[f]; grp.rotation.y = Math.atan2(d[0], d[2]);
  grp.position.set(x + .5, y, z + .5);
  scene.add(grp); return grp;
}
function chestDrop(k) { const s = CHESTS.m.get(k); if (!s) return; scene.remove(s.g); s.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); s.g.userData.mat.dispose(); CHESTS.m.delete(k); }
// which chests stand open: the one on this screen, and the ones other players say they have open
function chestOpenHere() {
  if (UI.screen !== 'chest' || !GUI.ctx) return null;
  const c = GUI.ctx; if (c.at) return [c.at]; if (c.x == null) return null;
  return c.pair ? [[c.x, c.y, c.z], c.pair] : [[c.x, c.y, c.z]];
}
function chestTick() {
  if (!W.active) return;
  const now = performance.now(), here = chestOpenHere(), openK = new Set();
  if (here) for (const p of here) openK.add(p.join(','));
  for (const [k, t] of CHESTS.lids) { if (t < now) CHESTS.lids.delete(k); else openK.add(k); }
  // tell the others (again every few seconds while it stays open; closing says so at once)
  const hk = here ? here.map(p => p.join(',')).join(';') : '';
  if (typeof MP !== 'undefined' && MP.on && (hk !== CHESTS.sentK || (hk && now - CHESTS.sentAt > 3000))) {
    if (CHESTS.sentK && CHESTS.sentK !== hk) for (const k of CHESTS.sentK.split(';')) { const [x, y, z] = k.split(',').map(Number); mpSend({ t: 'lid', dim: W.dim, x, y, z, open: 0 }); }
    if (hk) for (const p of here) mpSend({ t: 'lid', dim: W.dim, x: p[0], y: p[1], z: p[2], open: 1 });
    CHESTS.sentK = hk; CHESTS.sentAt = now;
  }
  const scan = W.tickN % 5 === 0, seen = scan ? new Set() : null, R = 64;
  CHESTS.budget = 0;
  if (scan) for (const c of W.chunks.values()) {
    if (Math.abs(c.cx * 16 + 8 - PL.x) > R + 8 || Math.abs(c.cz * 16 + 8 - PL.z) > R + 8) continue;
    if (c.chests === undefined && (CHESTS.budget = (CHESTS.budget || 0) + 1) > 6) continue; // (a few new chunks looked through per pass, so entering a world doesn't stall)
    for (const i of chestList(c)) {
      const x = c.cx * 16 + (i & 15), y = (i >> 8) + MINY, z = c.cz * 16 + ((i >> 4) & 15), id = c.blocks[i], m = c.meta[i];
      if (Math.abs(y - PL.y) > R) continue;
      // a large chest is drawn from its left half; the right half draws nothing
      const pr = id !== BID.ender_chest && typeof chestPair === 'function' ? chestPair(x, y, z) : null;
      if (pr && (pr.right[0] === x && pr.right[2] === z)) continue;
      const k = x + ',' + y + ',' + z, v = id * 64 + (m & 3) * 2 + (pr ? 1 : 0); seen.add(k);
      const s = CHESTS.m.get(k);
      if (s && s.v === v) continue;
      if (s) chestDrop(k);
      CHESTS.m.set(k, { g: chestMesh(x, y, z, id, m & 3, pr ? 2 : 1), v, x, y, z, pair: pr ? pr.right.join(',') : null, t: 0, lightAt: -99 });
    }
  }
  if (scan) for (const k of [...CHESTS.m.keys()]) if (!seen.has(k)) chestDrop(k);
  for (const [k, s] of CHESTS.m) {
    const open = openK.has(k) || (s.pair && openK.has(s.pair)), t0 = s.t;
    s.t = Math.max(0, Math.min(1, s.t + (open ? 0.1 : -0.1)));
    if (s.t > 0 && t0 === 0 && open) play('door', { vol: 0.35, pitch: 0.8 }); else if (s.t === 0 && t0 > 0) play('door', { vol: 0.3, pitch: 0.65 });
    const a = 1 - Math.pow(1 - s.t, 3); s.g.userData.hinge.rotation.x = -a * Math.PI / 2;
    if (W.tickN - s.lightAt >= 20) { s.lightAt = W.tickN; s.g.userData.mat.color.setScalar(Math.max(0.2, lightBright(s.x + .5, s.y + .5, s.z + .5))); }
  }
}
// another player opened or closed a chest
function chestLidMsg(m) { if (m.dim !== W.dim || ![m.x, m.y, m.z].every(Number.isFinite)) return; const k = m.x + ',' + m.y + ',' + m.z; if (m.open) CHESTS.lids.set(k, performance.now() + 6000); else CHESTS.lids.delete(k); }
function chestsClear() { for (const k of [...CHESTS.m.keys()]) chestDrop(k); CHESTS.lids.clear(); }

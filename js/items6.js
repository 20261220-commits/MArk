// Items of S6: signs (text drawn in the world, dye and glow ink), books and quills, fireworks (and elytra boosts),
// leads, carrots and warped fungi on sticks for riding saddled pigs and striders, suspicious stew.
const SIGN = BID.oak_sign;
const CUSTOM_SCREENS = {};
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- signs ----------
function signPlace(t, x, y, z, meta) {
  if (t.ny === -1) return false;
  if (t.ny === 0) { const f = DIRS.findIndex(v => v[0] === t.nx && v[2] === t.nz); if (f < 0 || !OPQ[getBlock(x - t.nx, y, z - t.nz)]) return false; return (meta & ~31) | 16 | f; }
  return supportedBy(getBlock(x, y - 1, z)) ? (meta & ~31) | ((-Math.round(PL.yaw / (Math.PI / 8))) & 15) : false; // 16 rotations, facing the player
}
function signEdit(x, y, z) {
  let t = getTile(x, y, z); if (!t) { t = { type: 'sign', lines: ['', '', '', ''] }; setTile(x, y, z, t); }
  UI.openScreen('sign', { x, y, z, tile: t });
}
CUSTOM_SCREENS.sign = {
  html: () => `<div class="panel"><div class="cap">표지판 문구 편집</div>${GUI.ctx.tile.lines.map((l, i) => `<input class="signl" data-l="${i}" maxlength="15" value="${escH(l)}" autocomplete="off" style="display:block;width:16em;margin:4px auto;text-align:center">`).join('')}<button id="signok" class="btn" style="display:block;margin:8px auto">완료</button></div>`,
  bind: () => {
    const ins = [...document.querySelectorAll('.signl')];
    ins.forEach(el => { el.oninput = () => { GUI.ctx.tile.lines[+el.dataset.l] = el.value; GUI.ctx.tile.v = (GUI.ctx.tile.v || 0) + 1; markTileChunk(GUI.ctx.x, GUI.ctx.z); }; el.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { const n = ins[+el.dataset.l + 1]; if (n) n.focus(); else UI.closeScreen(); } if (e.key === 'Escape') UI.closeScreen(); }; el.onpointerdown = e => e.stopPropagation(); });
    $('signok').onclick = () => UI.closeScreen(); if (ins[0]) setTimeout(() => ins[0].focus(), 0);
  },
};
const markTileChunk = (x, z) => { const c = chunkAt(x >> 4, z >> 4); if (c) c.modified = true; };
// dye colours the text, a glow ink sac makes it glow (and an ink sac undoes that)
function signUse(t, h, dry) {
  const tile = getTile(t.x, t.y, t.z); if (!tile || !h) return false;
  const k = ITEMS[h.id].key;
  if (k.endsWith('_dye')) { const c = S.COLORS.indexOf(k.slice(0, -4)); if (c < 0 || tile.color === c) return false; if (!dry) { tile.color = c; tile.v = (tile.v || 0) + 1; consume(); play('place', { mat: 'wool', vol: 0.5 }); markTileChunk(t.x, t.z); } return true; }
  if (h.id === IID.glow_ink_sac && !tile.glow || h.id === IID.ink_sac && tile.glow) { if (!dry) { if (h.id === IID.glow_ink_sac) advGrant('husbandry/make_a_sign_glow'); tile.glow = h.id === IID.glow_ink_sac; tile.v = (tile.v || 0) + 1; consume(); play('splash', { vol: 0.3 }); markTileChunk(t.x, t.z); } return true; }
  return false;
}
const SIGN_TEXT_C = ['#f0f0f0', '#f9801d', '#c74ebd', '#3ab3da', '#fed83d', '#80c71f', '#f38baa', '#474f52', '#9d9d97', '#169c9c', '#8932b8', '#3c44aa', '#835432', '#5e7c16', '#b02e26', '#101010'];
const SIGNS = new Map(); // "x,y,z" -> { mesh, v }
function signTexture(t) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const col = SIGN_TEXT_C[t.color != null ? t.color : 15];
  t.lines.forEach((l, i) => { if (t.glow) { g.fillStyle = col === '#101010' ? '#f0f0d0' : col; g.shadowColor = g.fillStyle; g.shadowBlur = 8; } else g.fillStyle = col; g.fillText(l, 128, 16 + i * 32); });
  const tx = new THREE.CanvasTexture(c); tx.minFilter = THREE.LinearFilter; return tx;
}
// a box with every face showing (part of) one atlas tile
function atlasBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, tu = (tile % TPR) * 16 / ATLAS_W, tv = ((tile / TPR) | 0) * 16 / ATLAS_W, s = 16 / ATLAS_W;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, tu + uv.getX(i) * s, tv + (1 - uv.getY(i)) * s); // the atlas texture is not flipped
  return g;
}
function signMesh(x, y, z, m, t) {
  const grp = new THREE.Group(), text = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.475), new THREE.MeshBasicMaterial({ map: signTexture(t), transparent: true, depthWrite: false }));
  if (m & 16) { // on a wall: the board is drawn by the block mesh
    const f = m & 3, d = DIRS[f]; text.position.set(x + .5 - d[0] * 0.5 + d[0] * 0.135, y + 0.5, z + .5 - d[2] * 0.5 + d[2] * 0.135); text.rotation.y = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][f]; grp.add(text);
  } else { // standing: board and post turned to any of 16 directions (0 faces south)
    const wood = S.tileFor(SIGN, m, 0), mat = new THREE.MeshBasicMaterial({ map: atlasTex });
    const board = new THREE.Mesh(atlasBox(1, 0.5, 0.083, wood), mat), post = new THREE.Mesh(atlasBox(0.083, 0.583, 0.083, wood), mat);
    board.position.y = 0.833; post.position.y = 0.292; text.position.set(0, 0.833, 0.045);
    const pivot = new THREE.Group(); pivot.add(board, post, text); pivot.position.set(x + .5, y, z + .5); pivot.rotation.y = -(m & 15) * Math.PI / 8; grp.add(pivot);
  }
  scene.add(grp); return grp;
}
function dropSign(k) { const s = SIGNS.get(k); if (!s) return; scene.remove(s.mesh); s.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material.map && o.material.map !== atlasTex) o.material.map.dispose(); o.material.dispose(); } }); SIGNS.delete(k); }
function signTick() {
  if (W.tickN % 5) return;
  const seen = new Set();
  for (const c of W.chunks.values()) {
    if (!c.tiles || Math.abs(c.cx * 16 + 8 - PL.x) > 64 || Math.abs(c.cz * 16 + 8 - PL.z) > 64) continue;
    for (const [i, t] of c.tiles) {
      if (t.type !== 'sign') continue;
      const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15), k = x + ',' + y + ',' + z;
      if (getBlock(x, y, z) !== SIGN) continue;
      seen.add(k); const s = SIGNS.get(k), m = getMeta(x, y, z), v = (t.v || 0) * 64 + m;
      if (s && s.v === v) { if (W.tickN % 20 === 0) { const b = t.glow ? 1 : Math.max(0.25, lightBright(x + .5, y + .5, z + .5)); s.mesh.traverse(o => { if (o.isMesh) o.material.color.setScalar(o.material.map === atlasTex || !t.glow ? Math.max(0.25, lightBright(x + .5, y + .5, z + .5)) : b); }); } continue; }
      if (s) dropSign(k);
      SIGNS.set(k, { mesh: signMesh(x, y, z, m, t), v });
    }
  }
  for (const k of [...SIGNS.keys()]) if (!seen.has(k)) dropSign(k);
}

// ---------- books ----------
function bookOpen(h) { UI.openScreen('book', { st: h, page: 0, signing: false }); }
CUSTOM_SCREENS.book = {
  html: () => {
    const c = GUI.ctx, st = c.st, pages = st.pages || (st.pages = ['']), ro = st.id === IID.written_book || !!c.lectern;
    if (c.signing) return `<div class="panel"><div class="cap">책 서명</div><input id="btitle" maxlength="16" placeholder="제목" value="${escH(c.title || '')}" autocomplete="off" style="display:block;margin:6px auto;width:14em"><p class="tip">서명하면 더 이상 수정할 수 없어요.</p><button id="bsign" class="btn">서명하고 닫기</button> <button id="bcancel" class="btn">취소</button></div>`;
    const body = ro ? `<div style="white-space:pre-wrap;text-align:left;width:18em;min-height:14em;background:#f4ecd8;color:#222;padding:8px;margin:auto">${escH(pages[c.page] || '')}</div>` : `<textarea id="bpage" maxlength="256" style="width:18em;height:14em;background:#f4ecd8;color:#222">${escH(pages[c.page] || '')}</textarea>`;
    return `<div class="panel"><div class="cap">${ro ? escH(st.title || '서명된 책') + (st.author ? ' — ' + escH(st.author) : '') : '책과 깃펜'}</div>${body}<div class="row" style="justify-content:center;gap:8px;margin-top:6px"><button id="bprev" class="btn">◀</button><span>${c.page + 1} / ${pages.length}</span><button id="bnext" class="btn">▶</button>${ro ? '' : '<button id="bsignq" class="btn">서명</button>'}${c.lectern ? '<button id="btake" class="btn">책 꺼내기</button>' : ''}<button id="bdone" class="btn">완료</button></div></div>`;
  },
  bind: () => {
    const c = GUI.ctx, st = c.st, pages = st.pages, stop = el => { if (el) { el.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') UI.closeScreen(); }; el.onpointerdown = e => e.stopPropagation(); } };
    const ta = $('bpage'); stop(ta); if (ta) { ta.oninput = () => { pages[c.page] = ta.value; }; setTimeout(() => ta.focus(), 0); }
    const bt = $('btitle'); stop(bt); if (bt) { bt.oninput = () => { c.title = bt.value; }; setTimeout(() => bt.focus(), 0); }
    const on = (id, f) => { const el = $(id); if (el) el.onclick = () => { f(); if (UI.screen === 'book') UI.renderScreen(); }; };
    const lecternPage = () => { if (!c.lectern) return; const t = getTile(...c.lectern); if (t) t.page = c.page; lecternPulse(c.lectern); };
    on('bprev', () => { c.page = Math.max(0, c.page - 1); lecternPage(); });
    on('bnext', () => { if (c.page === pages.length - 1 && st.id === IID.writable_book && pages.length < 50) pages.push(''); c.page = Math.min(pages.length - 1, c.page + 1); lecternPage(); });
    on('btake', () => { const [x, y, z] = c.lectern, t = getTile(x, y, z); if (t && t.items[0]) { INV.giveOrDrop(t.items[0]); t.items[0] = null; } setMeta(x, y, z, getMeta(x, y, z) & ~4); UI.closeScreen(); });
    on('bsignq', () => { c.signing = true; }); on('bcancel', () => { c.signing = false; });
    on('bsign', () => { if (!(c.title || '').trim()) return; st.id = IID.written_book; st.title = c.title.trim(); st.name = st.title; st.author = '플레이어'; UI.hudDirty = true; UI.closeScreen(); play('levelup', { vol: 0.3 }); });
    on('bdone', () => UI.closeScreen());
  },
};

function lecternPulse([x, y, z]) { if (getBlock(x, y, z) !== BID.lectern) return; setMeta(x, y, z, getMeta(x, y, z) | 8); rsNotify(x, y, z); rsLater(x, y, z, 4); }

// ---------- fireworks ----------
const ROCKETS = [], SPARKS = [];
const FW_SHAPES = ['작은 공', '큰 공', '별 모양', '크리퍼 모양', '폭발형'];
const dyeRGB = c => { const v = BANNER_DYE[c]; return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
// stars: [{ colors, fade, shape, trail, twinkle }] (old saves kept only colours)
const rocketStars = fw => fw.stars || (fw.colors && fw.colors.length ? [{ colors: fw.colors, shape: 0 }] : []);
function launchRocket(x, y, z, st, rider, shot) {
  const fw = st.fw || { flight: 1 }, mesh = R.itemMesh(IID.firework_rocket); mesh.scale.setScalar(0.35); scene.add(mesh);
  ROCKETS.push({ x, y, z, vx: shot ? shot[0] : (Math.random() - .5) * 0.02, vy: shot ? shot[1] : 0.05, vz: shot ? shot[2] : (Math.random() - .5) * 0.02, shot: !!shot,
    life: 10 * ((fw.flight || 1) + 1) + Math.floor(Math.random() * 12), stars: rocketStars(fw), mesh, rider });
  play('bow', { vol: 0.5, pitch: 0.6 });
}
// the particle pattern of one star
function burstStar(x, y, z, st) {
  const cols = (st.colors.length ? st.colors : [0]).map(dyeRGB), fade = st.fade && st.fade.length ? st.fade.map(dyeRGB) : null, life = st.trail ? 2.2 : 1.3;
  const P = (vx, vy, vz, k) => { R.simpleParticle(x, y, z, cols[k % cols.length], { kind: 'spark', size: 0.32, vx, vy, vz, grav: 0.2, life, fade: fade ? fade[k % fade.length] : null }); if (st.twinkle) SPARKS.push({ t: W.tickN + 14 + Math.floor(Math.random() * 10), x: x + vx * 0.6, y: y + vy * 0.6, z: z + vz * 0.6, col: [1, 1, 1], tw: true }); };
  if (st.shape === 2 || st.shape === 3) { // flat shapes, turned to a random heading
    const a = Math.random() * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), pts = [];
    if (st.shape === 2) for (let k = 0; k < 10; k++) { const r0 = k % 2 ? 0.45 : 1, r1 = k % 2 ? 1 : 0.45, t0 = k / 10 * Math.PI * 2, t1 = (k + 1) / 10 * Math.PI * 2; for (let j = 0; j < 6; j++) { const f = j / 6, r = r0 + (r1 - r0) * f, t = t0 + (t1 - t0) * f; pts.push([Math.sin(t) * r, Math.cos(t) * r]); } }
    else { const FACE = ['11011', '11011', '00100', '01110', '01010']; FACE.forEach((row, j) => [...row].forEach((c, i) => { if (c === '1') pts.push([(i - 2) / 2.2, (2 - j) / 2.2]); })); }
    pts.forEach(([u, v], k) => P(u * ca * 6, v * 6, u * sa * 6, k));
  } else if (st.shape === 4) { for (let k = 0; k < 70; k++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; P(Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s, k); } }
  else { const n = st.shape === 1 ? 140 : 70, sp = st.shape === 1 ? 9 : 5; for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = sp * (0.85 + Math.random() * 0.3); P(Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, k); } }
}
function rocketExplode(r) {
  scene.remove(r.mesh);
  if (!r.stars.length) return;
  for (const st of r.stars) burstStar(r.x, r.y, r.z, st);
  const dist = Math.hypot(PL.x - r.x, PL.y - r.y, PL.z - r.z), big = r.stars.some(s => s.shape === 1);
  play('explode', { vol: Math.max(0.05, (big ? 0.6 : 0.4) * (1 - dist / 96)), pitch: big ? 1.3 : 1.7 });
  const dmg = 5 + 2 * r.stars.length; // stars hurt what is close
  if (dist < 5 && !creative()) hurtPlayer(Math.max(1, Math.round(dmg * (1 - dist / 5))), 'firework');
  for (const e of ENT) if (e.kind === 'mob' && !e.dead) { const d = Math.hypot(e.x - r.x, e.y - r.y, e.z - r.z); if (d < 5) hurtMob(e, Math.max(1, Math.round(dmg * (1 - d / 5))), PL); }
}
function rocketTick() {
  for (let i = SPARKS.length - 1; i >= 0; i--) { const s = SPARKS[i]; if (s.t > W.tickN) continue; SPARKS.splice(i, 1); R.simpleParticle(s.x, s.y, s.z, s.col, { kind: 'spark', size: s.tw ? 0.16 : 0.11, vx: 0.01, vy: -0.3, vz: 0.01, grav: 0.1, life: 0.6 }); if (s.tw && Math.random() < 0.08) play('pop', { vol: 0.15, pitch: 1.8 }); }
  for (let i = ROCKETS.length - 1; i >= 0; i--) {
    const r = ROCKETS[i];
    if (r.rider) { r.x = PL.x; r.y = PL.y + 0.5; r.z = PL.z; }
    else if (r.shot) { r.x += r.vx; r.y += r.vy; r.z += r.vz; } // from a crossbow: straight and fast
    else { r.vy = Math.min(1.2, r.vy * 1.15 + 0.04); r.x += r.vx; r.y += r.vy; r.z += r.vz; }
    r.mesh.position.set(r.x, r.y, r.z);
    R.simpleParticle(r.x, r.y - 0.3, r.z, [1, 0.9, 0.6], { size: 0.06, vy: -0.5, grav: 0 });
    let hit = !r.rider && SOLID[getBlock(Math.floor(r.x), Math.floor(r.y + 0.3), Math.floor(r.z))];
    if (r.shot && !hit) hit = ENT.some(e => e.kind === 'mob' && !e.dead && Math.abs(e.x - r.x) < e.w + 0.3 && Math.abs(e.z - r.z) < e.w + 0.3 && r.y > e.y - 0.2 && r.y < e.y + e.h + 0.2);
    if (--r.life > 0 && !hit) continue;
    ROCKETS.splice(i, 1); rocketExplode(r);
  }
}
// firework stars and their fades follow no fixed recipe: gunpowder, dyes and at most one each of a shape item,
// glowstone dust (twinkle) and a diamond (trail); a star with more dyes gets fade colours
const STAR_SHAPE_ITEM = () => ({ [IID.fire_charge]: 1, [IID.gold_nugget]: 2, [IID.feather]: 4, [IID.wither_skeleton_skull]: 3 });
function craftCustom(grid) {
  const st = grid.filter(Boolean), dyes = [], it = k => st.filter(s => s.id === IID[k]).length;
  for (const s of st) { const k = ITEMS[s.id].key; if (k.endsWith('_dye')) dyes.push(S.COLORS.indexOf(k.slice(0, -4))); }
  const shapeIt = st.filter(s => STAR_SHAPE_ITEM()[s.id] != null || ITEMS[s.id].place === BID.mob_head);
  const starIn = st.filter(s => s.id === IID.firework_star);
  if (starIn.length === 1 && dyes.length && st.length === 1 + dyes.length && starIn[0].star) { // fade
    const star = { ...starIn[0].star, fade: dyes }; return { id: IID.firework_star, n: 1, star, name: starName(star) };
  }
  const g = it('gunpowder'), gl = it('glowstone_dust'), di = it('diamond');
  if (g !== 1 || !dyes.length || shapeIt.length > 1 || gl > 1 || di > 1 || st.length !== 1 + dyes.length + shapeIt.length + gl + di) return null;
  const star = { colors: dyes, shape: shapeIt.length ? (STAR_SHAPE_ITEM()[shapeIt[0].id] || 3) : 0, trail: di > 0, twinkle: gl > 0 };
  return { id: IID.firework_star, n: 1, star, name: starName(star) };
}
const starName = st => '폭죽 탄약 (' + FW_SHAPES[st.shape] + ', ' + st.colors.map(c => S.COLKO[c]).join('·') + (st.fade ? ' → ' + st.fade.map(c => S.COLKO[c]).join('·') : '') + (st.trail ? ', 꼬리' : '') + (st.twinkle ? ', 반짝임' : '') + ')';
// gliding with an elytra: a rocket pushes you along the look direction (Java: v += l * 0.1 + (l * 1.5 - v) * 0.5)
function fireworkBoost() {
  if (!(PL.fwBoost > 0) || !PL.gliding) { PL.fwBoost = 0; return; }
  PL.fwBoost--; const [lx, ly, lz] = lookDir();
  PL.vx += lx * 0.1 + (lx * 1.5 - PL.vx) * 0.5; PL.vy += ly * 0.1 + (ly * 1.5 - PL.vy) * 0.5; PL.vz += lz * 0.1 + (lz * 1.5 - PL.vz) * 0.5;
}

// ---------- leads ----------
const LEASH_OK = e => e.kind === 'mob' && !e.dead && !e.def.hostile && !e.def.boss && e.type !== 'villager' && e.type !== 'wandering_trader';
const FENCES = new Set([BID.oak_fence, BID.nether_brick_fence, BID.fence2]);
function leashTick() {
  for (const e of ENT) {
    if (!e.leash) { if (e.leashLine) { scene.remove(e.leashLine); e.leashLine = null; } continue; }
    const fence = Array.isArray(e.leash) ? e.leash : null;
    if (e.dead || (fence && !FENCES.has(getBlock(...fence))) || (!fence && PL.dead)) { unleash(e, true); continue; }
    const ax = fence ? fence[0] + .5 : PL.x, ay = fence ? fence[1] + .6 : PL.y + 1, az = fence ? fence[2] + .5 : PL.z;
    const dx = ax - e.x, dy = ay - (e.y + e.h * 0.6), dz = az - e.z, d = Math.hypot(dx, dy, dz);
    if (d > 10) { unleash(e, true); continue; }
    if (d > 4) { const k = (d - 4) * 0.02; e.vx += dx / d * k; e.vz += dz / d * k; if (dy > 1 && e.onGround) e.vy = 0.3; e.goal = null; }
    if (!e.leashLine) { e.leashLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x6a4a24 })); scene.add(e.leashLine); }
    const p = e.leashLine.geometry.attributes.position; p.setXYZ(0, e.x, e.y + e.h * 0.6, e.z); p.setXYZ(1, ax, ay, az); p.needsUpdate = true; e.leashLine.geometry.computeBoundingSphere();
  }
}
function unleash(e, drop) { e.leash = null; if (e.leashLine) { scene.remove(e.leashLine); e.leashLine = null; } if (drop && !creative()) dropItem(e.x, e.y + .5, e.z, IID.lead, 1); }

// ---------- riding pigs and striders ----------
function stickRide(e, stickId, walk) {
  if (IN.sneak) { dismount(); return; }
  const h = PL.held(), steer = h && h.id === stickId;
  e.yawTarget = steer ? PL.yaw : e.yaw; turn(e, 0.3);
  if (e.boost > 0) e.boost--;
  const sp = steer ? (e.type === 'pig' ? 0.1 : 0.11) * (e.boost > 0 ? 2 : 1) : 0;
  walk(e, steer ? -Math.sin(PL.yaw) : 0, steer ? -Math.cos(PL.yaw) : 0, sp);
  e.fallY = null; PL.fallDist = 0;
}
const pigRide = e => stickRide(e, IID.carrot_on_a_stick, (e, mx, mz, sp) => walkPhysics(e, mx, mz, sp));
const striderRide = e => stickRide(e, IID.warped_fungus_on_a_stick, (e, mx, mz, sp) => { e.goal = [e.x + mx * 4, e.z + mz * 4]; if (!sp) e.goal = [e.x, e.z]; striderAI(e); if (sp) { e.vx = mx * sp * 2; e.vz = mz * sp * 2; } });
for (const [k, ride] of [['pig', pigRide], ['strider', striderRide]]) {
  const d = MOBDEF[k], save = d.save, init = d.init, drops = d.onDeathDrops;
  Object.assign(d, { ride, rideY: k === 'pig' ? 0.75 : 1.55,
    save: e => ({ ...(save ? save(e) : {}), saddle: !!e.saddle }), init: (e, o) => { if (init) init(e, o); if (o.saddle) e.saddle = true; },
    onDeathDrops: e => { if (drops) drops(e); if (e.saddle) dropItem(e.x, e.y + .5, e.z, IID.saddle, 1); } });
}

// ---------- using items (player.js useItem) ----------
function items6Use(t, h, d) {
  const ent = t && t.type === 'ent' ? t.e : null;
  if (ent && ent.kind === 'mob') {
    if (ent.leash === 'player' && !(h && h.id === IID.lead)) { unleash(ent, true); swing(); return true; }
    if (h && h.id === IID.lead && LEASH_OK(ent) && !ent.leash) { ent.leash = 'player'; ent.persistent = true; consume(); swing(); play('place', { mat: 'wool', vol: 0.5 }); return true; }
    if ((ent.type === 'pig' || ent.type === 'strider') && !ent.baby) {
      if (h && h.id === IID.saddle && !ent.saddle) { ent.saddle = true; consume(); play('place', { mat: 'wool' }); swing(); return true; }
      if (ent.saddle && !PL.sneaking && !(h && ent.def.food && isFood(ent.def, h.id))) { mount(ent); swing(); return true; }
    }
  }
  if (!h) return false;
  if (h.id === IID.lead && t && t.type === 'block' && FENCES.has(t.id)) { // tie up everything you lead
    const led = ENT.filter(e => e.leash === 'player'); if (!led.length) return false;
    for (const e of led) e.leash = [t.x, t.y, t.z]; play('place', { mat: 'wool' }); swing(); return true;
  }
  if (t && t.type === 'block' && lodestoneUse(t, h)) return true;
  if (h.id === IID.writable_book || h.id === IID.written_book) { if (!(t && t.type === 'block' && interactBlock(t, true))) { bookOpen(h); return true; } return false; }
  if (h.id === IID.firework_rocket) {
    if (PL.gliding) { launchRocket(PL.x, PL.y, PL.z, h, true); PL.fwBoost = 10 * ((h.fw && h.fw.flight) || 1) + 10; consume(); swing(); USE.placeCd = 10; return true; }
    if (t && t.type === 'block' && !(interactBlock(t, true))) { launchRocket(t.x + .5 + t.nx * .55, t.y + .5 + t.ny * .55, t.z + .5 + t.nz * .55, h, false); consume(); swing(); USE.placeCd = 6; return true; }
    return false;
  }
  if ((h.id === IID.carrot_on_a_stick || h.id === IID.warped_fungus_on_a_stick) && PL.riding && PL.riding.def.ride === (h.id === IID.carrot_on_a_stick ? pigRide : striderRide)) {
    if (h.id === IID.warped_fungus_on_a_stick) advGrant('nether/ride_strider');
    const e = PL.riding; if (e.boost > 0) return true;
    e.boost = 60 + Math.floor(Math.random() * 80); damageItem(INV.slots, INV.sel, 7);
    if (!INV.slots[INV.sel]) INV.slots[INV.sel] = { id: IID.fishing_rod, n: 1 }; // the bait is eaten, the rod stays
    swing(); USE.placeCd = 10; return true;
  }
  return false;
}
// crafting results that carry data: rocket flight and star colours, star colours, the stew's effect
function craftExtra(out, grid) {
  const d = ITEMS[out.id];
  if (d.key === 'firework_rocket') { const g = grid.filter(s => s && s.id === IID.gunpowder).length, stars = grid.filter(s => s && s.id === IID.firework_star && s.star).map(s => s.star); out.fw = { flight: g, stars }; out.name = '폭죽 로켓 (비행 시간 ' + g + (stars.length ? ', 탄약 ' + stars.length + '개' : '') + ')'; }
  if (d.key === 'suspicious_stew') { const f = grid.find(s => s && STEW_EFF[ITEMS[s.id].key]); if (f) out.stew = STEW_EFF[ITEMS[f.id].key]; }
}
// a saddle drawn on saddled pigs and striders (the resource pack has no saddle layer)
function saddleTick() {
  if (W.tickN % 10) return;
  for (const e of ENT) {
    if (e.kind !== 'mob' || !(e.type === 'pig' || e.type === 'strider') || !e.mesh) continue;
    if (e.saddle && !e.saddleMesh) { const pig = e.type === 'pig', m = tintedBox(pig ? 0.64 : 0.95, 0.07, pig ? 0.5 : 0.75, 0x6a3e1e); m.position.set(0, pig ? 0.92 : 1.2, pig ? 0.05 : 0); e.mesh.add(m); e.saddleMesh = m; }
    else if (!e.saddle && e.saddleMesh) { e.mesh.remove(e.saddleMesh); e.saddleMesh = null; }
  }
}
function items6Tick() { signTick(); rocketTick(); leashTick(); dialTick(); saddleTick(); }

// ---------- compasses and clocks: held, a dial shows where the needle points (a compass used on a lodestone points there) ----------
const DIAL = { el: null, g: null };
function lodestoneUse(t, h) {
  if (!h || h.id !== IID.compass || t.id !== BID.lodestone) return false;
  advGrant('nether/use_lodestone');
  const st = { id: IID.compass, n: 1, lode: [t.x, t.y, t.z, W.dim], name: '자석석 나침반' };
  if (h.n === 1 && !h.lode) INV.slots[INV.sel] = st; else { if (!h.lode) consume(); INV.giveOrDrop(st); }
  play('anvil', { vol: 0.3, pitch: 1.6 }); swing(); UI.hudDirty = true; return true;
}
function dialTick() {
  const isDial = s => s && (s.id === IID.compass || s.id === IID.clock), h = isDial(PL.held()) ? PL.held() : offItem(), show = h && (h.id === IID.compass || h.id === IID.clock) && !UI.screen;
  if (!DIAL.el) { DIAL.el = document.createElement('canvas'); DIAL.el.id = 'dialview'; DIAL.el.width = DIAL.el.height = 32; document.body.appendChild(DIAL.el); DIAL.g = DIAL.el.getContext('2d'); }
  DIAL.el.hidden = !show; if (!show) return;
  const g = DIAL.g; g.clearRect(0, 0, 32, 32);
  g.fillStyle = h.id === IID.clock ? '#d8b040' : '#8a8a8a'; g.beginPath(); g.arc(16, 16, 15, 0, 7); g.fill();
  if (h.id === IID.clock) { // the sun and moon turn on the face
    const a = ((W.time % 24000) / 24000) * Math.PI * 2;
    g.fillStyle = W.dim === 0 ? '#3a6ad8' : '#2a1a3a'; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.fill();
    if (W.dim !== 0) return; // spins elsewhere: nothing sensible to show
    g.fillStyle = '#ffe040'; g.beginPath(); g.arc(16 + Math.sin(a) * 8, 16 - Math.cos(a) * 8, 3, 0, 7); g.fill(); g.fillStyle = '#e8e8f0'; g.beginPath(); g.arc(16 - Math.sin(a) * 8, 16 + Math.cos(a) * 8, 2.5, 0, 7); g.fill();
    g.fillStyle = '#3a8a2a'; g.fillRect(3, 17, 26, 12); return;
  }
  g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.fill();
  let tgt = null;
  if (h.lode) { if (h.lode[3] === W.dim && (!isLoaded(h.lode[0], h.lode[2]) || getBlock(h.lode[0], h.lode[1], h.lode[2]) === BID.lodestone)) tgt = h.lode; }
  else if (W.dim === 0) tgt = W.worldSpawn;
  const ang = tgt ? Math.atan2(tgt[0] + .5 - PL.x, -(tgt[2] + .5 - PL.z)) + PL.yaw : performance.now() / 120; // the needle spins without a target
  g.save(); g.translate(16, 16); g.rotate(ang); g.fillStyle = '#c02020'; g.beginPath(); g.moveTo(0, -10); g.lineTo(3, 0); g.lineTo(-3, 0); g.fill(); g.fillStyle = '#303030'; g.beginPath(); g.moveTo(0, 10); g.lineTo(3, 0); g.lineTo(-3, 0); g.fill(); g.restore();
}

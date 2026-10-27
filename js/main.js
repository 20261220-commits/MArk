// Main loop, input, camera and world lifecycle.
const isTouch = matchMedia('(pointer:coarse)').matches && !matchMedia('(pointer:fine)').matches;
let locked = false, view = 0; // 0 first person, 1 back, 2 front
W.active = false; UI.paused = true;

// ---------- pointer lock ----------
function grabLock() { if (isTouch || !W.active || UI.screen || UI.chatOpen || UI.menu) return; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
document.addEventListener('pointerlockchange', () => {
  const was = locked; locked = document.pointerLockElement === canvas;
  if (was && !locked && W.active && !UI.screen && !UI.chatOpen && !UI.menu && !PL.dead) pauseGame();
});
canvas.addEventListener('click', () => { if (W.active && !locked && !UI.menu && !UI.screen) grabLock(); });
function clearInput() { IN.f = IN.s = 0; IN.jump = IN.sneak = IN.attack = IN.use = IN.sprintKey = false; keys.clear(); if (USE.kind) onUseRelease(); }

// ---------- keyboard ----------
// Chromebook keyboards have browser and system keys where a PC has F1-F10. Each is read as the F-key in the same place,
// so the layout matches Java Edition: back = F1 (hide HUD), forward = F2 (screenshot), refresh = F3 (debug and F3 combos),
// full screen = F11, overview = F5 (camera), screenshot key = F2. Search + top row (or the "top-row keys as function keys"
// setting) sends real F-keys, which work as they are.
const TOP_ROW = { BrowserBack: 'F1', BrowserForward: 'F2', BrowserRefresh: 'F3', ZoomToggle: 'F11', Zoom: 'F11', LaunchApplication1: 'F5', LaunchApp1: 'F5', LaunchMyComputer: 'F5', PrintScreen: 'F2' };
const keyCode = e => TOP_ROW[e.code] || TOP_ROW[e.key] || (e.code === 'Backquote' ? 'F3' : e.code);
const keys = new Set(), F3K = { down: false, used: false }, TOGGLE = { sprint: false, sneak: false };
function updateMoveKeys() {
  IN.f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  IN.s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const sneak = keys.has('ShiftLeft') || keys.has('ShiftRight'), sprint = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyR');
  IN.jump = keys.has('Space'); IN.sneak = OPT.toggleSneak ? TOGGLE.sneak : sneak; IN.sprintKey = OPT.toggleSprint ? TOGGLE.sprint : sprint;
}
// F3 + key, as in Java Edition (the debug screen only toggles when F3 is released without a combo)
function debugCombo(code) {
  const say = t => chatMsg('[디버그]: ' + t, '#ffe060');
  switch (code) {
    case 'KeyH': UI.advTips = !UI.advTips; say('고급 툴팁: ' + (UI.advTips ? '보임' : '숨김')); return true;
    case 'KeyB': UI.hitboxes = !UI.hitboxes; say('히트박스: ' + (UI.hitboxes ? '보임' : '숨김')); return true;
    case 'KeyG': UI.chunkBorders = !UI.chunkBorders; say('청크 경계: ' + (UI.chunkBorders ? '보임' : '숨김')); return true;
    case 'KeyC': { const t = `/tp ${PL.x.toFixed(2)} ${PL.y.toFixed(2)} ${PL.z.toFixed(2)}`; if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); say('위치를 클립보드에 복사했습니다: ' + t); return true; }
    case 'KeyN': if (!W.cheats) { say('명령어가 허용되지 않은 세계입니다'); return true; } runCommand(PL.mode === 'spectator' ? '/gamemode creative' : '/gamemode spectator'); return true;
    case 'KeyD': UI.msgs.length = 0; renderChat(); return true;
    case 'KeyA': for (const c of W.chunks.values()) c.dirty = true; say('청크를 다시 불러옵니다'); return true;
    case 'KeyP': OPT.pauseOnBlur = !OPT.pauseOnBlur; saveOpt(); say('포커스를 잃으면 일시 정지: ' + (OPT.pauseOnBlur ? '켜짐' : '꺼짐')); return true;
    case 'KeyQ': say('F3 + A 청크 다시 불러오기 · B 히트박스 · C 위치 복사 · D 채팅 지우기 · G 청크 경계 · H 고급 툴팁 · N 관전 모드 전환 · P 포커스 잃으면 일시 정지 · Q 도움말 (크롬북: 새로고침 키나 ` 키가 F3)'); return true;
  }
  return false;
}
// F3 + B entity hitboxes (white boxes, the eye line in red) and F3 + G the current chunk's borders
const DBG = { boxes: new Map(), chunk: null };
function debugOverlays(px, py, pz) {
  for (const [e, m] of DBG.boxes) if (!UI.hitboxes || e.dead || !ENT.includes(e)) { scene.remove(m); m.geometry.dispose(); DBG.boxes.delete(e); }
  if (UI.hitboxes) for (const e of ENT) {
    if (!e.mesh || e.dead || !e.mesh.visible || !e.w) continue;
    let m = DBG.boxes.get(e);
    if (!m) {
      const w = e.w * 2, h = e.h, g = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, w)); g.translate(0, h / 2, 0);
      m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff }));
      const eye = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-w / 2, h * 0.85, -w / 2), new THREE.Vector3(w / 2, h * 0.85, -w / 2), new THREE.Vector3(w / 2, h * 0.85, w / 2), new THREE.Vector3(-w / 2, h * 0.85, w / 2), new THREE.Vector3(-w / 2, h * 0.85, -w / 2)]), new THREE.LineBasicMaterial({ color: 0xff0000 }));
      m.add(eye); scene.add(m); DBG.boxes.set(e, m);
    }
    m.position.copy(e.mesh.position);
  }
  if (UI.chunkBorders && !DBG.chunk) {
    const pts = [];
    for (let i = 0; i <= 16; i += 2) for (const [x, z] of [[i, 0], [i, 16], [0, i], [16, i]]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, S.CH, z));
    for (let y = 0; y <= S.CH; y += 2) for (const [a, b] of [[[0, 0], [16, 0]], [[16, 0], [16, 16]], [[16, 16], [0, 16]], [[0, 16], [0, 0]]]) pts.push(new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(b[0], y, b[1]));
    DBG.chunk = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 }));
    scene.add(DBG.chunk);
  }
  if (DBG.chunk) { DBG.chunk.visible = !!UI.chunkBorders; DBG.chunk.position.set(Math.floor(px / 16) * 16, 0, Math.floor(pz / 16) * 16); }
}
// F2: save the frame as a PNG named like Java's screenshots
function takeScreenshot() { UI.shotPending = true; }
function screenshotAfterRender() {
  if (!UI.shotPending) return; UI.shotPending = false;
  const d = new Date(), p = n => String(n).padStart(2, '0'), name = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}.png`;
  canvas.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); chatMsg('스크린샷을 ' + name + '(으)로 저장했습니다'); });
}
function toggleFullscreen() {
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {}); grabLock(); }).catch(() => {});
}
addEventListener('keyup', e => { if (keyCode(e) === 'F3' && F3K.down) { F3K.down = false; if (!F3K.used && W.active && !UI.menu && !UI.screen && !UI.chatOpen) UI.debug = !UI.debug; } });
addEventListener('keydown', e => {
  audioInit();
  if (UI.chatOpen) return;
  const code = keyCode(e);
  if (/^F([1-9]|1[0-2])$/.test(code) || code === 'Tab') e.preventDefault(); // also stops the top-row keys navigating away
  if (code === 'F11') { toggleFullscreen(); return; }
  if (UI.screen) {
    if (e.code === 'Escape' || e.code === 'KeyE' || (e.code === 'KeyL' && UI.screen === 'adv')) { UI.closeScreen(); e.preventDefault(); return; }
    if (/^Digit[1-9]$/.test(e.code) && GUI.hover >= 0) { const k = +e.code.slice(5) - 1, sl = GUI.slots[GUI.hover]; if (sl && !sl.output) { const a = sl.get(), b = INV.slots[k]; if (!sl.accepts || sl.accepts(b)) { sl.set(b); INV.slots[k] = a; sl.onTake && a && sl.onTake(); afterClick(); } } return; }
    if (e.code === 'KeyF' && GUI.hover >= 0) { const sl = GUI.slots[GUI.hover]; if (sl && !sl.output && sl.group !== 'off' && (!sl.accepts || sl.accepts(INV.off))) { const a = sl.get(); sl.set(INV.off); INV.off = a; UI.renderScreen(); } return; } // F: swap with the off hand
    if (e.code === 'KeyQ' && GUI.hover >= 0) { const sl = GUI.slots[GUI.hover], s = sl.get(); if (s && !sl.output) { const n = e.ctrlKey ? s.n : 1; dropItem(PL.x, PL.y + 1.3, PL.z, s.id, n, lookDir().map(v => v * 0.3), 40, s.d); s.n -= n; if (!s.n) sl.set(null); afterClick(); } return; }
    return;
  }
  if (UI.menu) { if (e.code === 'Escape' && UI.menu === 'pause') resumeGame(); else if (e.code === 'Escape' && (UI.menu === 'options' || UI.menu === 'controls')) showMenu(UI.paused && W.active ? 'pause' : 'title'); return; }
  if (!W.active) return;
  if (e.code === 'Escape') { pauseGame(); return; }
  if (PL.dead) return;
  if (e.code === 'KeyT') { e.preventDefault(); openChat(''); return; }
  if (e.code === 'Slash') { e.preventDefault(); openChat('/'); return; }
  if (e.code === 'KeyE') { UI.openScreen('inv'); return; }
  if (e.code === 'KeyL') { UI.openScreen('adv'); return; }
  if (code === 'F3') { if (!F3K.down) { F3K.down = true; F3K.used = false; } return; }
  if (F3K.down && debugCombo(code)) { F3K.used = true; return; }
  // F1 / F2 / F5 (Chromebook: back / forward / overview keys); H and V stay as extra keys
  if (code === 'F1' || code === 'KeyH') { UI.hideHud = !UI.hideHud; return; }
  if (code === 'F2') { takeScreenshot(); return; }
  if (code === 'F5' || code === 'KeyV') { view = (view + 1) % 3; return; }
  if (code === 'KeyG') { pickBlock(); return; } // touchpads have no middle button (ChromeOS turns Alt + click into a right click)
  if (!e.repeat && OPT.toggleSprint && (code === 'ControlLeft' || code === 'ControlRight' || code === 'KeyR')) TOGGLE.sprint = !TOGGLE.sprint;
  if (!e.repeat && OPT.toggleSneak && (code === 'ShiftLeft' || code === 'ShiftRight')) TOGGLE.sneak = !TOGGLE.sneak;
  if (e.code === 'KeyQ') { dropHeld(e.ctrlKey); return; }
  if (e.code === 'KeyF') { swapHands(); return; }
  if (/^Digit[1-9]$/.test(e.code)) { INV.sel = +e.code.slice(5) - 1; if (USE.kind) onUseRelease(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { const t = performance.now(); if ((creative() || spectator()) && t - IN.lastSpace < 300) { if (!spectator()) PL.flying = !PL.flying; PL.vy = 0; IN.lastSpace = 0; } else IN.lastSpace = t; } }
  if (e.code === 'KeyW' && !e.repeat) { const t = performance.now(); if (t - IN.lastW < 280) IN.wTap = true; IN.lastW = t; }
  keys.add(e.code); updateMoveKeys();
});
addEventListener('keyup', e => { keys.delete(e.code); updateMoveKeys(); });
addEventListener('blur', () => { F3K.down = false; });
addEventListener('blur', () => { clearInput(); });

// ---------- mouse ----------
document.addEventListener('mousemove', e => { if (!locked || UI.paused || PL.dead) return; look(e.movementX, e.movementY, 0.0022 * OPT.sens / 100); });
function look(dx, dy, s) {
  if (PL.sleeping) return;
  const zoom = USE.kind === 'spy' ? 0.15 : 1;
  PL.yaw -= dx * s * zoom; PL.pitch -= dy * s * zoom * (OPT.invertY ? -1 : 1);
  PL.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, PL.pitch));
}
canvas.addEventListener('mousedown', e => {
  if (!locked || UI.paused || PL.dead) return;
  if (e.button === 0) { IN.attack = true; onAttackPress(); }
  else if (e.button === 2) { IN.use = true; onUsePress(); }
  else if (e.button === 1) { e.preventDefault(); pickBlock(); }
});
addEventListener('mouseup', e => { if (e.button === 0) IN.attack = false; if (e.button === 2) { IN.use = false; onUseRelease(); } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (!W.active || UI.paused || UI.screen || UI.chatOpen) return; INV.sel = (INV.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9; if (USE.kind) onUseRelease(); }, { passive: true });
$('hotbar').addEventListener('pointerdown', e => { const s = e.target.closest('.hs'); if (s) { INV.sel = +s.dataset.i; e.stopPropagation(); } });

// ---------- touch controls ----------
const joy = { id: null, x: 0, y: 0 };
if (isTouch) {
  const jEl = $('joy'), knob = $('knob');
  jEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; jEl.setPointerCapture(e.pointerId); joyMove(e); });
  jEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); });
  const end = () => { joy.id = null; IN.f = IN.s = 0; knob.style.transform = ''; };
  jEl.addEventListener('pointerup', end); jEl.addEventListener('pointercancel', end);
  function joyMove(e) { const r = jEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const L = Math.hypot(dx, dy), M = r.width * 0.38; if (L > M) { dx *= M / L; dy *= M / L; } IN.s = dx / M; IN.f = -dy / M; IN.wTap = IN.f > 0.95; knob.style.transform = `translate(${dx}px,${dy}px)`; }
  const drags = new Map();
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || UI.paused) return; drags.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), m: 0 }); });
  canvas.addEventListener('pointermove', e => { const d = drags.get(e.pointerId); if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.m += Math.abs(dx) + Math.abs(dy); look(dx, dy, 0.005 * OPT.sens / 100); });
  const up = e => { const d = drags.get(e.pointerId); drags.delete(e.pointerId); if (d && d.m < 10 && performance.now() - d.t < 250 && !UI.paused) { onUsePress(); onUseRelease(); } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => drags.delete(e.pointerId));
  const hold = (id, on, off) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); el.setPointerCapture(e.pointerId); el.classList.add('down'); on(); }); const u = () => { el.classList.remove('down'); off && off(); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); };
  hold('tJump', () => { IN.jump = true; const t = performance.now(); if (creative() && t - IN.lastSpace < 300) { PL.flying = !PL.flying; } IN.lastSpace = t; }, () => IN.jump = false);
  hold('tSneak', () => { IN.sneak = !IN.sneak; $('tSneak').classList.toggle('on', IN.sneak); });
  hold('tAttack', () => { IN.attack = true; onAttackPress(); }, () => IN.attack = false);
  hold('tUse', () => { IN.use = true; onUsePress(); }, () => { IN.use = false; onUseRelease(); });
  hold('tInv', () => UI.openScreen('inv'));
  hold('tDrop', () => dropHeld(false));
  hold('tPause', () => pauseGame());
  hold('tChat', () => openChat('/'));
}

// ---------- world lifecycle ----------
function seedFrom(s) { s = (s || '').trim(); if (!s) return (Math.random() * 2 ** 31) | 0; if (/^-?\d+$/.test(s)) return (+s) | 0; let h = 0; for (const ch of s) h = Math.imul(h, 31) + ch.charCodeAt(0) | 0; return h; }
async function createWorld(c) {
  const id = 'w' + Date.now().toString(36);
  const meta = { id, name: c.name, seed: seedFrom(c.seed), gen: 2, mode: c.mode === 'hardcore' ? 'survival' : c.mode, hardcore: c.mode === 'hardcore', diff: c.mode === 'hardcore' ? 3 : c.diff, cheats: c.cheats && c.mode !== 'hardcore', exp: !!c.exp, created: Date.now(), last: Date.now(), player: null };
  await putWorld(meta);
  startWorld(id, meta);
}
function findSpawn(seed) {
  const g = S.makeGen(seed);
  for (let r = 0; r < 2048; r += 16) for (let a = 0; a < Math.max(1, r / 4); a++) {
    const ang = a / Math.max(1, r / 4) * Math.PI * 2, x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
    const [h, b] = g.column(x, z);
    if (h > S.SEA + 1 && h < 95 && !S.isOceanBio(b) && b !== S.BIO.RIVER) return [x, h + 1, z];
  }
  return [0, 100, 0];
}
let loadingFrom = 0;
async function startWorld(id, meta) {
  audioInit();
  if (!meta) { const all = await listWorlds(); meta = (all || []).find(w => w.id === id); if (!meta) return; }
  showMenu('loading', '세계를 불러오는 중');
  stopPanorama(); resetWorld(); for (const e of ENT) removeEnt(e); ENT.length = 0; R.particles.length = 0;
  for (const k in remapCache) delete remapCache[k]; // item tables belong to one world
  W.id = meta.id; W.seed = meta.seed; W.gen = meta.gen || 1; S.setGenVersion(W.gen); W.genCache = null; W.meta = meta; W.dim = (meta.player && meta.dim) || 0; W.arrive = null; W.cheats = meta.cheats !== false; W.keepInv = !!meta.keepInv;
  W.exp = meta.exp !== undefined ? meta.exp : true; // worlds made before the option existed already have lush patches
  await loadSavedKeys(meta.id);
  W.mpLogs = meta.remote ? null : await mpLogKeys(meta.id); // changes from a multiplayer session still to be put in place
  const p = meta.player;
  W.worldSpawn = meta.spawn || findSpawn(meta.seed); meta.spawn = W.worldSpawn;
  INV.slots = new Array(36).fill(null); INV.armor = new Array(4).fill(null); INV.sel = 0; INV.cursor = null; INV.off = null;
  Object.assign(PL, { vx: 0, vy: 0, vz: 0, health: 20, food: 20, sat: 5, exh: 0, air: 300, level: 0, xpP: 0, xpTotal: 0, fallDist: 0, fire: 0, dead: false, flying: false, spawn: null, spawnDim: 0, sleeping: 0, absorb: 0, eff: {}, rest: 0, inv: 40, ender: new Array(27).fill(null) });
  PL.mode = meta.mode; PL.hardcore = !!meta.hardcore; PL.difficulty = meta.diff;
  if (p) {
    remapItems(p, itemRemapFor(p.it));
    Object.assign(PL, p.s);
    INV.slots = p.inv.map(s => s && ITEMS[s.id] ? s : null); while (INV.slots.length < 36) INV.slots.push(null);
    INV.armor = (p.armor || [null, null, null, null]).map(s => s && ITEMS[s.id] ? s : null); INV.sel = p.sel || 0;
    if (p.ender) PL.ender = p.ender.map(s => s && ITEMS[s.id] ? s : null);
    INV.off = p.off && ITEMS[p.off.id] ? p.off : null;
    W.time = meta.time || 1000; W.rain = meta.rain || 0; W.rainTarget = W.rain; W.thunderOn = !!meta.thunder; W.thunder = W.thunderOn && W.rain > 0.5 ? 1 : 0;
  } else {
    PL.x = W.worldSpawn[0] + .5; PL.y = W.worldSpawn[1] + 1; PL.z = W.worldSpawn[2] + .5; PL.yaw = Math.random() * 6; PL.pitch = 0; W.time = 1000; W.rain = 0; W.rainTarget = 0; W.thunderOn = false; W.thunder = 0;
    W.needSpawnFix = true;
  }
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.dead = false;
  W.active = true; UI.paused = true; loadingFrom = performance.now();
  UI.hudDirty = true; buildHud();
  meta.last = Date.now(); if (!meta.remote) putWorld(meta);
}
function worldReady() {
  const pcx = Math.floor(PL.x) >> 4, pcz = Math.floor(PL.z) >> 4; let need = 0, have = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { need++; const c = chunkAt(pcx + dx, pcz + dz); if (c && c.mesh !== undefined && c.mesh !== null && !c.dirty) have++; else if (c && !meshable(c)) {} }
  const el = $('loadbar'); if (el) el.style.width = (have / need * 100) + '%';
  const t = $('loadtxt'); if (t) t.textContent = `청크 ${W.chunks.size}개 생성됨`;
  return have >= need || (performance.now() - loadingFrom > 15000 && chunkAt(pcx, pcz));
}
// build one of every model and compile all shader programs while the loading screen is up,
// so the first zombie (or the dragon) doesn't cost a 50 ms shader compile mid-game
let prewarmed = false;
function prewarm() {
  if (prewarmed) return; prewarmed = true;
  const g = new THREE.Group(), keep = [];
  for (const t of Object.keys(MOBDEF)) { try { const m = buildModel(t, { vtype: 'plains', prof: 'farmer' }); m.position.set(PL.x, PL.y - 300, PL.z); g.add(m); keep.push(m); } catch (e) {} }
  scene.add(g); try { renderer.compile(scene, camera); } catch (e) {} scene.remove(g);
}
function finishLoading() {
  prewarm();
  if (W.arrive) arriveDim();
  if (W.needSpawnFix) {
    W.needSpawnFix = false;
    let x = Math.floor(PL.x), z = Math.floor(PL.z), y = topY(x, z);
    while (y < CH - 2 && (SOLID[getBlock(x, y + 1, z)] || SOLID[getBlock(x, y + 2, z)])) y++;
    PL.y = y + 1; PL.py = PL.y; W.worldSpawn = [x, y + 1, z]; W.meta.spawn = W.worldSpawn;
    if (PL.mode !== 'creative') { /* fresh survival start: empty inventory like MC */ }
    chatMsg('세계에 오신 것을 환영합니다! E: 인벤토리 · T: 채팅 · /help: 명령어', '#ffff55');
  }
  showMenu(null); resumeGame();
}
function saveWorldMeta() {
  if (!W.active || !W.meta || W.meta.remote) return;
  offUnswap();
  const s = {}; for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'health', 'food', 'sat', 'exh', 'air', 'level', 'xpP', 'xpTotal', 'mode', 'flying', 'spawn', 'fire', 'difficulty', 'absorb', 'dead', 'eff', 'rest', 'spawnDim']) s[k] = PL[k];
  W.meta.player = { s, inv: INV.slots, armor: INV.armor, sel: INV.sel, it: ITEM_TABLE, ender: PL.ender, off: INV.off };
  (W.meta.itables || (W.meta.itables = {}))[ITEM_TABLE] = ITEM_KEYS;
  W.meta.time = W.time; W.meta.rain = W.rain; W.meta.thunder = W.thunderOn; W.meta.dim = W.dim; W.meta.adv = W.meta.adv || {}; W.meta.keepInv = W.keepInv; W.meta.last = Date.now(); W.meta.mode = PL.mode; W.meta.diff = PL.difficulty;
  putWorld(W.meta);
}
function saveAll(sync) { if (!W.active) return; saveWorldMeta(); for (const c of W.chunks.values()) saveChunk(c, false, sync === true); }
function pauseGame() { if (!W.active || UI.menu) return; if (UI.screen) UI.closeScreen(); UI.paused = true; clearInput(); showMenu('pause'); saveAll(); }
function resumeGame() {
  if (PL.dead) return; if (!W.active) { UI.paused = false; showMenu('title'); return; } UI.paused = false; showMenu(null);
  if (OPT.fullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {}); grabLock(); }).catch(() => grabLock());
  else grabLock();
  if (isTouch) $('touch').hidden = false;
}
function quitToTitle() {
  if (MP.on) mpStop();
  saveAll(); for (const c of [...W.chunks.values()]) unloadChunk(c);
  resetWorld(); for (const e of ENT) removeEnt(e); ENT.length = 0;
  W.active = false; UI.paused = true; $('touch').hidden = true; showMenu('title'); startPanorama();
}
addEventListener('pagehide', () => saveAll(true));
// Ctrl+W (sprint + forward in Java) closes a Chrome tab: ask before leaving a running world
addEventListener('beforeunload', e => { if (W.active) { saveAll(true); e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveAll(true); if (W.active && !UI.paused && !PL.dead && OPT.pauseOnBlur !== false) pauseGame(); } });

// ---------- game tick ----------
function gameTick() {
  if (gr('doDaylightCycle')) W.time++;
  if (gr('doWeatherCycle') && --W.rainTimer <= 0) { W.rainTarget = W.rainTarget > 0 ? 0 : 1; W.rainTimer = W.rainTarget ? 3600 + Math.random() * 8000 : 12000 + Math.random() * 120000; }
  W.rain += Math.sign(W.rainTarget - W.rain) * Math.min(Math.abs(W.rainTarget - W.rain), 0.01);
  weatherTick();
  animalTick(); oceanTick(); mapViewTick(); templeTick(); blocks6Tick(); items6Tick(); mobs9Tick(); mcmodels2Tick(); villagerLifeTick();
  playerTick();
  statsTick();
  entityTick();
  tickScheduled();
  rsTick();
  tileTick();
  randomTicks(Math.floor(PL.x), Math.floor(PL.z));
  furnaceTick();
  const spawnOK = gr('doMobSpawning');
  if (spawnOK && W.tickN % 10 === 0) { if (W.dim === 0) trySpawnHostile(); else trySpawnDimension(); }
  if (W.tickN % 40 === 0) ensureDragon();
  if (spawnOK && W.tickN % 100 === 0) trySpawnStrider();
  if (spawnOK && W.tickN % 200 === 50) trySpawnAmbient();
  if (spawnOK && W.tickN % 200 === 150) trySpawnAxolotl();
  if (spawnOK && W.tickN % 200 === 100) trySpawnGlowSquid();
  displayTick();
  spawnerTick();
  if (W.tickN % 20 === 0) { UI.hudDirty = true; advScan(); renderEffects(); beaconTick(); jukeboxVolume(); }
  if (W.tickN % 40 === 0) campfireCleanup();
  bannerTick();
  if (W.tickN % 600 === 0) saveAll();
}

// ---------- camera ----------
let fovCur = 70, lastHealth = 20;
function updateCamera(alpha, dt) {
  const x = PL.px + (PL.x - PL.px) * alpha, y = PL.py + (PL.y - PL.py) * alpha, z = PL.pz + (PL.z - PL.pz) * alpha;
  let ey = y + PL.eyeH;
  if (PL.sleeping) ey = y + 0.3;
  const bobOn = OPT.bob && PL.onGround && view === 0 && !PL.flying;
  const bob = PL.bobPrev + (PL.bob - PL.bobPrev) * alpha, spd = Math.min(1, Math.hypot(PL.x - PL.px, PL.z - PL.pz) * 6);
  PL.bobAmt = (PL.bobAmt || 0) + ((bobOn ? spd : 0) - (PL.bobAmt || 0)) * Math.min(1, dt * 10);
  const ba = PL.bobAmt;
  const bx = Math.sin(bob * Math.PI) * 0.05 * ba, by = -Math.abs(Math.cos(bob * Math.PI)) * 0.07 * ba;
  const sn = Math.sin(PL.yaw), cs = Math.cos(PL.yaw);
  camera.position.set(x + cs * bx, ey + by, z - sn * bx);
  camera.rotation.set(PL.pitch, PL.yaw, Math.sin(bob * Math.PI) * 0.01 * ba + (PL.hurtT > 0 ? Math.sin(PL.hurtT / 10 * Math.PI) * 0.12 * (PL.hurtDir > 0 ? 1 : -1) : 0));
  if (PL.sleeping) camera.rotation.set(Math.PI / 2 - 0.4, PL.yaw, 0);
  if (view > 0) {
    const [dx, dy, dz] = lookDir(); const s = view === 1 ? -1 : 1;
    let d = 4; for (let t = 0.2; t <= 4; t += 0.2) { if (OPQ[getBlock(Math.floor(x + dx * s * t), Math.floor(ey + dy * s * t), Math.floor(z + dz * s * t))]) { d = t - 0.3; break; } }
    camera.position.set(x + dx * s * d, ey + dy * s * d, z + dz * s * d);
    if (view === 2) camera.rotation.set(-PL.pitch, PL.yaw + Math.PI, 0);
  }
  updatePlayerModel(dt, x, y, z, view > 0);
  // fov
  let fov = OPT.fov * (PL.sprinting ? 1.15 : 1) * (PL.flying && PL.sprinting ? 1.1 : 1);
  if (USE.kind === 'bow') fov *= 1 - Math.min(1, USE.t / 20) * 0.15;
  if (USE.kind === 'spy') fov = 10;
  fovCur += (fov - fovCur) * Math.min(1, dt * 12);
  if (Math.abs(camera.fov - fovCur) > 0.01) { camera.fov = fovCur; camera.updateProjectionMatrix(); }
  return [x, y, z];
}

// worker results also re-fill the job queue immediately (not only once per frame)
W.pump = () => { if (!W.active) return; processInbox(2, 2); streamChunks(PL.x, PL.z, R.rd, { fancy: OPT.fancy, smooth: OPT.smooth }, 2); };
// ---------- frame ----------
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0, fps = 60;
const PERF = { inbox: 0, stream: 0, tick: 0, ents: 0, render: 0, hud: 0, n: 0 };
const PERFMAX = {}; const pf = (k, t0) => { const d = performance.now() - t0; PERF[k] += d; if (!(PERFMAX[k] >= d)) PERFMAX[k] = d; };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  fpsN++; fpsT += dt; if (fpsT >= 1) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; autoRes(); }
  if (!W.active) { if (W.pano) panoramaFrame(dt); else { renderer.setClearColor(0x000000); renderer.clear(); } return; }
  // world streaming & worker results (time-budgeted)
  PERF.n++; let t0 = performance.now();
  processInbox(UI.menu === 'loading' ? 30 : 3, UI.menu === 'loading' ? 50 : (fps < 45 ? 2 : 4)); // fewer GPU uploads per frame when the frame rate dips pf('inbox', t0); t0 = performance.now();
  streamChunks(PL.x, PL.z, R.rd, { fancy: OPT.fancy, smooth: OPT.smooth }, UI.menu === 'loading' ? 8 : 3); pf('stream', t0);
  if (UI.menu === 'loading') { if (worldReady()) finishLoading(); }
  if (!UI.paused || (MP.on && W.active && UI.menu !== 'loading')) { // in multiplayer the world goes on while a menu is open
    acc += dt * 1000;
    let n = 0; t0 = performance.now(); while (acc >= 50 && n < 5) { gameTick(); acc -= 50; n++; } pf('tick', t0);
    if (n >= 5) acc = 0;
  }
  const alpha = UI.paused ? 1 : acc / 50;
  const [px, py, pz] = updateCamera(alpha, dt);
  // selection & crack
  const t = !UI.paused && TARGET && TARGET.type === 'block' ? TARGET : null;
  if (t && view === 0 && !UI.hideHud) R.setSelection(t.x, t.y, t.z, selShape(t.id, t.m) || [[0, 0, 0, 16, 16, 16]]); else R.sel.visible = false;
  if (t && MINE.prog > 0 && MINE.id === t.id && !creative()) R.setCrack(t.x, t.y, t.z, t.id, getMeta(t.x, t.y, t.z), Math.floor(MINE.prog * 10)); else R.crack.visible = false;
  // hand
  if (R.hand.swing > 0) R.hand.swing = Math.max(0, R.hand.swing - dt * 3.5);
  if (IN.attack && MINE.prog > 0 && R.hand.swing <= 0) R.hand.swing = 1;
  const h = PL.held();
  const hb = OPT.bob ? PL.bobAmt || 0 : 0, bob = PL.bobPrev + (PL.bob - PL.bobPrev) * alpha;
  { const [mh, oh] = handItems(); R.hand.glint = [mh && (mh.e || ITEMS[mh.id].glint), oh && (oh.e || ITEMS[oh.id].glint)]; R.updateHand(dt, PL.dead ? -1 : (mh ? mh.id : 0), lightBright(px, py + 1.6, pz), Math.sin(bob * Math.PI) * 0.03 * hb, -Math.abs(Math.cos(bob * Math.PI)) * 0.04 * hb, PL.dead ? -1 : (oh ? oh.id : 0), OFF.swapped ? 1 : 0); }
  dollTick();
  R.showHand = view === 0 && !UI.hideHud && !PL.sleeping && !spectator();
  t0 = performance.now(); entityRender(alpha, now); pf('ents', t0);
  // atlas animation (water/lava) ~8 fps
  R.stepAnimation(dt);
  updateSkyBox();
  R.updateRain(dt, px, py, pz, W.dim ? 0 : W.rain);
  ambientParticles(dt, px, py, pz);
  const eyeB = PL.eyeFluid === 1 ? 'water' : PL.eyeFluid === 2 ? 'lava' : PL.inSnow ? 'snow' : null;
  debugOverlays(px, py, pz);
  t0 = performance.now(); R.renderFrame(dt, camera.position, eyeB); pf('render', t0); screenshotAfterRender(); t0 = performance.now();
  // overlays & HUD
  $('ovWater').hidden = eyeB !== 'water'; $('ovSnow').hidden = !PL.inSnow;
  $('ovHurt').style.opacity = PL.hurtT > 0 ? PL.hurtT / 10 * 0.5 : (PL.health <= 4 && PL.mode !== 'creative' ? 0.25 + 0.1 * Math.sin(now / 200) : 0);
  $('ovSleep').style.opacity = PL.sleeping ? Math.min(1, PL.sleeping / 60) : 0;
  $('ovSpy').hidden = USE.kind !== 'spy';
  $('ovFire').hidden = !(PL.fire > 0 && PL.mode !== 'creative' && !PL.dead);
  $('cross').hidden = view !== 0 || USE.kind === 'spy';
  const tool = h && ITEMS[h.id] && ITEMS[h.id].tool, as = tool ? tool.as : 4, cd = Math.min(1, (PL.attackT + alpha) / (20 / as));
  $('attackInd').hidden = cd >= 1 || creative(); $('attackInd').firstElementChild.style.width = (cd * 100) + '%';
  if (PL.health !== lastHealth) { lastHealth = PL.health; UI.hudDirty = true; }
  renderHud(dt); renderDebug(dt, fps); pf('hud', t0);
  if ((frame.chatT = (frame.chatT || 0) + dt) > 0.5) { frame.chatT = 0; renderChat(); }
}
// ---------- title screen panorama: a real generated world, slowly rotating ----------
const PANO_SEED = 11711;
function startPanorama() {
  resetWorld(); for (const e of ENT) removeEnt(e); ENT.length = 0;
  W.pano = true; W.id = ''; W.dim = 0; W.seed = PANO_SEED; W.gen = 2; S.setGenVersion(2); W.genCache = null; W.time = 1500; W.rain = 0; W.rainTarget = 0; W.thunderOn = false; W.thunder = 0;
  const sp = findSpawn(PANO_SEED); PL.x = sp[0] + .5; PL.z = sp[2] + .5; PL.y = Math.max(sp[1] + 6, 80); PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.yaw = 0; PL.pitch = -0.12; PL.eyeH = 1.62;
  document.body.classList.add('pano'); $('hud').hidden = true;
}
function stopPanorama() { if (!W.pano) return; W.pano = false; document.body.classList.remove('pano'); }
function panoramaFrame(dt) {
  if (UI.menu === 'title' || UI.menu === 'worlds' || UI.menu === 'create' || UI.menu === 'options' || UI.menu === 'controls') {
    processInbox(4, 4); streamChunks(PL.x, PL.z, 4, { fancy: OPT.fancy, smooth: OPT.smooth }, 3);
  }
  PL.yaw += dt * 0.035;
  camera.position.set(PL.x, PL.y + 1.62, PL.z); camera.rotation.set(PL.pitch, PL.yaw, 0);
  if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
  const rd = R.rd; R.rd = 4; R.showHand = false; R.sel.visible = false; R.crack.visible = false;
  R.stepAnimation(dt);
  R.renderFrame(dt, camera.position, null); R.rd = rd;
}
// torch flames/smoke and lit furnaces near the player (light sources rescanned twice a second)
let ambT = 0, ambList = [];
function ambientParticles(dt, px, py, pz) {
  if ((ambT -= dt) <= 0) {
    ambT = 0.5; ambList = [];
    const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
    for (let x = bx - 12; x <= bx + 12; x++) for (let z = bz - 12; z <= bz + 12; z++) {
      const c = chunkAt(x >> 4, z >> 4); if (!c) continue;
      for (let y = Math.max(0, by - 8); y <= Math.min(CH - 1, by + 8); y++) {
        const i = (y << 8) | ((z & 15) << 4) | (x & 15), b = c.blocks[i];
        if (b === BID.torch || b === BID.lit_furnace) ambList.push(x, y, z, b, c.meta[i]);
      }
    }
    if (ambList.length > 200) ambList.length = 200;
  }
  for (let k = 0; k < ambList.length; k += 5) {
    if (Math.random() > dt * 4) continue;
    const x = ambList[k], y = ambList[k + 1], z = ambList[k + 2], b = ambList[k + 3], m = ambList[k + 4];
    if (b === BID.torch) {
      let ox = 0.5, oy = 0.7, oz = 0.5; if (m >= 1 && m <= 4) { ox += DIRS[m - 1][0] * 0.27; oz += DIRS[m - 1][2] * 0.27; oy += 0.2; }
      R.simpleParticle(x + ox, y + oy, z + oz, [1, 0.7, 0.25], { kind: 'flame', vx: 0, vz: 0, vy: 0.05, size: 0.06, life: 0.35, grav: 0 });
      if (Math.random() < 0.5) R.simpleParticle(x + ox, y + oy + 0.08, z + oz, [0.25, 0.25, 0.25], { kind: 'smoke', vx: (Math.random() - .5) * 0.1, vz: (Math.random() - .5) * 0.1, vy: 0.5, size: 0.08, life: 0.9, grav: 0 });
    } else if (Math.random() < 0.3) {
      R.simpleParticle(x + 0.3 + Math.random() * 0.4, y + 0.2 + Math.random() * 0.3, z + 0.3 + Math.random() * 0.4, [1, 0.6, 0.15], { kind: 'flame', vx: 0, vz: 0, vy: 0.1, size: 0.05, life: 0.4, grav: 0 });
    }
  }
}
// adaptive resolution: keep frame rate up on weak GPUs (e.g. Chromebooks)
function autoRes() {
  if (!OPT.autoRes || !W.active || UI.paused) return;
  const old = R.pixelScale;
  if (fps < 40 && R.pixelScale > 0.5) R.pixelScale = Math.max(0.5, R.pixelScale - 0.1);
  else if (fps >= 57 && R.pixelScale < 1) R.pixelScale = Math.min(1, R.pixelScale + 0.05);
  if (old !== R.pixelScale) R.resize();
}

// which block items Java draws flat (models/item/*.json: item/generated with a block texture) and which as their
// 3D block model even though a sprite-sized texture exists (end rods, trapdoors, the small dripleaf, spore blossoms)
function javaItemModels() {
  const flat = { glass_pane: 'glass', lilac: 'lilac_top', rose_bush: 'rose_bush_top', peony: 'peony_top', sunflower: 'sunflower_top', tall_grass: 'tall_grass_top', large_fern: 'large_fern_top', weeping_vines: 'weeping_vines_plant', twisting_vines: 'twisting_vines_plant' };
  for (const c of S.COLORS) flat[c + '_stained_glass_pane'] = c + '_stained_glass';
  for (const c of ['tube', 'brain', 'bubble', 'fire', 'horn']) for (const k of [c + '_coral', c + '_coral_fan', 'dead_' + c + '_coral', 'dead_' + c + '_coral_fan']) flat[k] = k;
  for (const k in flat) { const id = IID[k]; if (id != null && S.T[flat[k]] != null && !PACKPX.items[k]) ITEMS[id].sprite = flat[k]; }
  for (const k of ['end_rod', 'spore_blossom', 'small_dripleaf', ...['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'crimson', 'warped', 'iron'].map(w => w + '_trapdoor')]) { const id = IID[k]; if (id != null) ITEMS[id].sprite = null; }
}

// ---------- boot ----------
(async function boot() {
  applyOpt();
  if (await loadPack()) {
    atlasTex.needsUpdate = true;
    for (const k in PACKPX.items) { const id = IID[k]; if (id != null && ITEMS[id].block) ITEMS[id].sprite = k; } // block items drawn flat in Java (doors, torches...)
  }
  javaItemModels();
  if (UPACK.stale) setTimeout(() => UI.flash('설정 → 리소스 팩에서 client.jar 를 다시 불러오면 원작 텍스처가 더 많이 적용됩니다'), 1500);
  try { R.applyPackSky(); applyGuiPack(); R.buildParticleSheet(); R.applyPackWeather(); R.applyPackGlint(); R.applyPackCracks(); arrowPackModel(); } catch (e) { console.warn('pack sky / HUD unavailable', e); }
  try { await loadStructs(); } catch (e) { console.warn('stored structures unavailable', e); } // the game's own structure pieces, if a client.jar was chosen
  rebuildPlayer(); if (OPT.skin === 'custom') loadCustomSkin(ok => { if (ok) rebuildPlayer(); }); // the player model needs the pack's skin
  buildIcons(); try { R.renderBlockIcons(); } catch (e) { console.warn('3D icons unavailable', e); }
  ICON_URL = iconCanvas.toDataURL(); document.documentElement.style.setProperty('--icons', `url(${ICON_URL})`); // one copy of the sheet for every icon
  document.documentElement.style.setProperty('--dirt', `url(${tileCanvas(S.T.dirt, null, 4).toDataURL()})`);
  // the advancement tabs' backgrounds (Minecraft: stone, Nether: netherrack, The End: end stone, Adventure: dirt, Husbandry: hay bale side)
  for (const [k, t] of [['story', 'stone'], ['nether', 'netherrack'], ['end', 'end_stone'], ['adventure', 'dirt'], ['husbandry', 'hay_side']]) if (S.T[t] != null) document.documentElement.style.setProperty('--advbg-' + k, `url(${tileCanvas(S.T[t], null, 4).toDataURL()})`);
  document.documentElement.style.setProperty('--stoneTex', `url(${tileCanvas(S.T.stone, null, 4).toDataURL()})`);
  await dbOpen();
  if (isTouch) document.body.classList.add('touch');
  buildHud();
  showMenu('title'); startPanorama();
  requestAnimationFrame(t => { last = t; frame(t); });
  window.__game = { W, PL, INV, R, S, ENT, startWorld, createWorld, runCommand, UI, PERF, PERFMAX };
})();

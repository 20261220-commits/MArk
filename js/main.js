// Main loop, input, camera and world lifecycle.
const isTouch = matchMedia('(pointer:coarse)').matches && !matchMedia('(pointer:fine)').matches;
let locked = false, view = 0; // 0 first person, 1 back, 2 front
W.active = false; UI.paused = true;
const playerModel = buildModel('player'); playerModel.visible = false; scene.add(playerModel);

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
const keys = new Set();
function updateMoveKeys() {
  IN.f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  IN.s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  IN.jump = keys.has('Space'); IN.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight'); IN.sprintKey = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyR');
}
addEventListener('keydown', e => {
  audioInit();
  if (UI.chatOpen) return;
  if (e.code === 'F3' || e.code === 'F1' || e.code === 'F5' || e.code === 'Tab') e.preventDefault();
  if (UI.screen) {
    if (e.code === 'Escape' || e.code === 'KeyE') { UI.closeScreen(); e.preventDefault(); return; }
    if (/^Digit[1-9]$/.test(e.code) && GUI.hover >= 0) { const k = +e.code.slice(5) - 1, sl = GUI.slots[GUI.hover]; if (sl && !sl.output) { const a = sl.get(), b = INV.slots[k]; if (!sl.accepts || sl.accepts(b)) { sl.set(b); INV.slots[k] = a; sl.onTake && a && sl.onTake(); afterClick(); } } return; }
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
  // Chromebooks have no F-keys by default: H, ` and V are alternatives
  if (e.code === 'F1' || e.code === 'KeyH') { UI.hideHud = !UI.hideHud; return; }
  if (e.code === 'F3' || e.code === 'Backquote') { UI.debug = !UI.debug; return; }
  if (e.code === 'F5' || e.code === 'KeyV') { view = (view + 1) % 3; return; }
  if (e.code === 'KeyQ') { dropHeld(e.ctrlKey); return; }
  if (/^Digit[1-9]$/.test(e.code)) { INV.sel = +e.code.slice(5) - 1; if (USE.kind) onUseRelease(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { const t = performance.now(); if ((creative() || spectator()) && t - IN.lastSpace < 300) { if (!spectator()) PL.flying = !PL.flying; PL.vy = 0; IN.lastSpace = 0; } else IN.lastSpace = t; } }
  if (e.code === 'KeyW' && !e.repeat) { const t = performance.now(); if (t - IN.lastW < 280) IN.wTap = true; IN.lastW = t; }
  keys.add(e.code); updateMoveKeys();
});
addEventListener('keyup', e => { keys.delete(e.code); updateMoveKeys(); });
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
  const meta = { id, name: c.name, seed: seedFrom(c.seed), mode: c.mode === 'hardcore' ? 'survival' : c.mode, hardcore: c.mode === 'hardcore', diff: c.mode === 'hardcore' ? 3 : c.diff, cheats: c.cheats && c.mode !== 'hardcore', created: Date.now(), last: Date.now(), player: null };
  await putWorld(meta);
  startWorld(id, meta);
}
function findSpawn(seed) {
  const g = S.makeGen(seed);
  for (let r = 0; r < 2048; r += 16) for (let a = 0; a < Math.max(1, r / 4); a++) {
    const ang = a / Math.max(1, r / 4) * Math.PI * 2, x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
    const [h, b] = g.column(x, z);
    if (h > S.SEA + 1 && h < 95 && b !== S.BIO.OCEAN && b !== S.BIO.RIVER && b !== S.BIO.FROZEN_OCEAN) return [x, h + 1, z];
  }
  return [0, 100, 0];
}
let loadingFrom = 0;
async function startWorld(id, meta) {
  audioInit();
  if (!meta) { const all = await listWorlds(); meta = (all || []).find(w => w.id === id); if (!meta) return; }
  showMenu('loading', '세계를 불러오는 중');
  stopPanorama(); resetWorld(); for (const e of ENT) removeEnt(e); ENT.length = 0; R.particles.length = 0;
  W.id = meta.id; W.seed = meta.seed; W.meta = meta; W.dim = (meta.player && meta.dim) || 0; W.arrive = null; W.cheats = meta.cheats !== false; W.keepInv = !!meta.keepInv;
  await loadSavedKeys(meta.id);
  const p = meta.player;
  W.worldSpawn = meta.spawn || findSpawn(meta.seed); meta.spawn = W.worldSpawn;
  INV.slots = new Array(36).fill(null); INV.armor = new Array(4).fill(null); INV.sel = 0; INV.cursor = null;
  Object.assign(PL, { vx: 0, vy: 0, vz: 0, health: 20, food: 20, sat: 5, exh: 0, air: 300, level: 0, xpP: 0, xpTotal: 0, fallDist: 0, fire: 0, dead: false, flying: false, spawn: null, sleeping: 0, absorb: 0, regen: 0, inv: 40 });
  PL.mode = meta.mode; PL.hardcore = !!meta.hardcore; PL.difficulty = meta.diff;
  if (p) {
    Object.assign(PL, p.s);
    INV.slots = p.inv.map(s => s && ITEMS[s.id] ? s : null); while (INV.slots.length < 36) INV.slots.push(null);
    INV.armor = (p.armor || [null, null, null, null]).map(s => s && ITEMS[s.id] ? s : null); INV.sel = p.sel || 0;
    W.time = meta.time || 1000; W.rain = meta.rain || 0; W.rainTarget = W.rain;
  } else {
    PL.x = W.worldSpawn[0] + .5; PL.y = W.worldSpawn[1] + 1; PL.z = W.worldSpawn[2] + .5; PL.yaw = Math.random() * 6; PL.pitch = 0; W.time = 1000; W.rain = 0; W.rainTarget = 0;
    W.needSpawnFix = true;
  }
  PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; PL.dead = false;
  W.active = true; UI.paused = true; loadingFrom = performance.now();
  UI.hudDirty = true; buildHud();
  meta.last = Date.now(); putWorld(meta);
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
  if (!W.active || !W.meta) return;
  const s = {}; for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'health', 'food', 'sat', 'exh', 'air', 'level', 'xpP', 'xpTotal', 'mode', 'flying', 'spawn', 'fire', 'difficulty', 'absorb', 'dead']) s[k] = PL[k];
  W.meta.player = { s, inv: INV.slots, armor: INV.armor, sel: INV.sel };
  W.meta.time = W.time; W.meta.rain = W.rain; W.meta.dim = W.dim; W.meta.adv = W.meta.adv || {}; W.meta.keepInv = W.keepInv; W.meta.last = Date.now(); W.meta.mode = PL.mode; W.meta.diff = PL.difficulty;
  putWorld(W.meta);
}
function saveAll(sync) { if (!W.active) return; saveWorldMeta(); for (const c of W.chunks.values()) saveChunk(c, false, sync === true); }
function pauseGame() { if (!W.active || UI.menu) return; if (UI.screen) UI.closeScreen(); UI.paused = true; clearInput(); showMenu('pause'); saveAll(); }
function resumeGame() {
  if (PL.dead) return; UI.paused = false; showMenu(null);
  if (OPT.fullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {}); grabLock(); }).catch(() => grabLock());
  else grabLock();
  if (isTouch) $('touch').hidden = false;
}
function quitToTitle() {
  saveAll(); for (const c of [...W.chunks.values()]) unloadChunk(c);
  resetWorld(); for (const e of ENT) removeEnt(e); ENT.length = 0;
  W.active = false; UI.paused = true; $('touch').hidden = true; showMenu('title'); startPanorama();
}
addEventListener('pagehide', () => saveAll(true));
// Ctrl+W (sprint + forward in Java) closes a Chrome tab: ask before leaving a running world
addEventListener('beforeunload', e => { if (W.active) { saveAll(true); e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveAll(true); if (W.active && !UI.paused && !PL.dead) pauseGame(); } });

// ---------- game tick ----------
function gameTick() {
  W.time++;
  if (--W.rainTimer <= 0) { W.rainTarget = W.rainTarget > 0 ? 0 : 1; W.rainTimer = W.rainTarget ? 3600 + Math.random() * 8000 : 12000 + Math.random() * 120000; }
  W.rain += Math.sign(W.rainTarget - W.rain) * Math.min(Math.abs(W.rainTarget - W.rain), 0.01);
  playerTick();
  entityTick();
  tickScheduled();
  rsTick();
  tileTick();
  randomTicks(Math.floor(PL.x), Math.floor(PL.z));
  furnaceTick();
  if (W.tickN % 10 === 0) { if (W.dim === 0) trySpawnHostile(); else trySpawnDimension(); }
  if (W.tickN % 40 === 0) ensureDragon();
  if (W.tickN % 100 === 0) trySpawnStrider();
  if (W.tickN % 200 === 50) trySpawnAmbient();
  spawnerTick();
  if (W.tickN % 20 === 0) { UI.hudDirty = true; advScan(); }
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
  playerModel.visible = view > 0;
  if (view > 0) {
    const [dx, dy, dz] = lookDir(); const s = view === 1 ? -1 : 1;
    let d = 4; for (let t = 0.2; t <= 4; t += 0.2) { if (OPQ[getBlock(Math.floor(x + dx * s * t), Math.floor(ey + dy * s * t), Math.floor(z + dz * s * t))]) { d = t - 0.3; break; } }
    camera.position.set(x + dx * s * d, ey + dy * s * d, z + dz * s * d);
    if (view === 2) camera.rotation.set(-PL.pitch, PL.yaw + Math.PI, 0);
    playerModel.position.set(x, y, z); playerModel.rotation.y = PL.yaw;
    const P = playerModel.userData.parts, w = Math.sin(PL.bob * 2.2) * 0.8 * Math.min(1, spd * 2);
    P.rleg.rotation.x = w; P.lleg.rotation.x = -w; P.rarm.rotation.x = -w * 0.8 - (R.hand.swing > 0 ? Math.sin(R.hand.swing * Math.PI) : 0); P.larm.rotation.x = w * 0.8;
    P.head.rotation.x = -PL.pitch; if (PL.sneaking) { P.body.rotation.x = 0.3; } else P.body.rotation.x = 0;
    for (const m of playerModel.userData.mats) m.color.setScalar(lightBright(x, y + 1, z));
  }
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
  if (!UI.paused) {
    acc += dt * 1000;
    let n = 0; t0 = performance.now(); while (acc >= 50 && n < 5) { gameTick(); acc -= 50; n++; } pf('tick', t0);
    if (n >= 5) acc = 0;
  }
  const alpha = UI.paused ? 1 : acc / 50;
  const [px, py, pz] = updateCamera(alpha, dt);
  // selection & crack
  const t = !UI.paused && TARGET && TARGET.type === 'block' ? TARGET : null;
  if (t && view === 0 && !UI.hideHud) R.setSelection(t.x, t.y, t.z, selShape(t.id, t.m) || [[0, 0, 0, 16, 16, 16]]); else R.sel.visible = false;
  if (t && MINE.prog > 0 && MINE.id === t.id && !creative()) { R.crack.visible = true; R.crack.position.set(t.x + .5, t.y + .5, t.z + .5); R.crack.material.map = R.crackTexs[Math.min(9, Math.floor(MINE.prog * 10))]; } else R.crack.visible = false;
  // hand
  if (R.hand.swing > 0) R.hand.swing = Math.max(0, R.hand.swing - dt * 3.5);
  if (IN.attack && MINE.prog > 0 && R.hand.swing <= 0) R.hand.swing = 1;
  const h = PL.held();
  const hb = OPT.bob ? PL.bobAmt || 0 : 0, bob = PL.bobPrev + (PL.bob - PL.bobPrev) * alpha;
  R.updateHand(dt, PL.dead ? -1 : (h ? h.id : 0), lightBright(px, py + 1.6, pz), Math.sin(bob * Math.PI) * 0.03 * hb, -Math.abs(Math.cos(bob * Math.PI)) * 0.04 * hb);
  R.showHand = view === 0 && !UI.hideHud && !PL.sleeping && !spectator();
  t0 = performance.now(); entityRender(alpha, now); pf('ents', t0);
  // atlas animation (water/lava) ~8 fps
  R.stepAnimation(dt);
  updateSkyBox();
  R.updateRain(dt, px, py, pz, W.dim ? 0 : W.rain);
  ambientParticles(dt, px, py, pz);
  const eyeB = PL.eyeFluid === 1 ? 'water' : PL.eyeFluid === 2 ? 'lava' : PL.inSnow ? 'snow' : null;
  t0 = performance.now(); R.renderFrame(dt, camera.position, eyeB); pf('render', t0); t0 = performance.now();
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
  W.pano = true; W.id = ''; W.dim = 0; W.seed = PANO_SEED; W.time = 1500; W.rain = 0; W.rainTarget = 0;
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
      R.simpleParticle(x + ox, y + oy, z + oz, [1, 0.7, 0.25], { vx: 0, vz: 0, vy: 0.05, size: 0.06, life: 0.35, grav: 0 });
      if (Math.random() < 0.5) R.simpleParticle(x + ox, y + oy + 0.08, z + oz, [0.25, 0.25, 0.25], { vx: (Math.random() - .5) * 0.1, vz: (Math.random() - .5) * 0.1, vy: 0.5, size: 0.08, life: 0.9, grav: 0 });
    } else if (Math.random() < 0.3) {
      R.simpleParticle(x + 0.3 + Math.random() * 0.4, y + 0.2 + Math.random() * 0.3, z + 0.3 + Math.random() * 0.4, [1, 0.6, 0.15], { vx: 0, vz: 0, vy: 0.1, size: 0.05, life: 0.4, grav: 0 });
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

// ---------- boot ----------
(async function boot() {
  applyOpt();
  if (await loadPack()) {
    atlasTex.needsUpdate = true;
    for (const k in PACKPX.items) { const id = IID[k]; if (id != null && ITEMS[id].block) ITEMS[id].sprite = k; } // block items drawn flat in Java (doors, torches...)
  }
  buildIcons(); try { R.renderBlockIcons(); } catch (e) { console.warn('3D icons unavailable', e); }
  ICON_URL = iconCanvas.toDataURL();
  document.documentElement.style.setProperty('--dirt', `url(${tileCanvas(S.T.dirt, null, 4).toDataURL()})`);
  document.documentElement.style.setProperty('--stoneTex', `url(${tileCanvas(S.T.stone, null, 4).toDataURL()})`);
  await dbOpen();
  if (isTouch) document.body.classList.add('touch');
  buildHud();
  showMenu('title'); startPanorama();
  requestAnimationFrame(t => { last = t; frame(t); });
  window.__game = { W, PL, INV, R, S, ENT, startWorld, createWorld, runCommand, UI, PERF, PERFMAX };
})();

// Item frames and glow item frames (1.17): hang on any face, hold one item that turns in 45 degree steps
// (a comparator behind reads the turn), glow frames show their item at full brightness.
function frameCanvas(glow) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'), r = trng(glow ? 33 : 31);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x < 2 || y < 2 || x > 13 || y > 13;
    const col = edge ? (glow ? [0x5a, 0xc8, 0xb8] : [0x9c, 0x7b, 0x47]) : [0x8a, 0x5a, 0x2a];
    const f = 1 + (r() - .5) * 0.15; g.fillStyle = `rgb(${col[0] * f | 0},${col[1] * f | 0},${col[2] * f | 0})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
}
const FRAME_TEX = { 0: null, 1: null }, frameGeo = new THREE.BoxGeometry(12 / 16, 12 / 16, 1 / 16);
function frameMesh(e) {
  const k = e.glow ? 1 : 0; if (!FRAME_TEX[k]) FRAME_TEX[k] = frameCanvas(e.glow);
  const g = new THREE.Group(), plate = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ map: FRAME_TEX[k] }));
  g.add(plate); g.userData.plate = plate;
  if (e.item) {
    const im = R.itemMesh(e.item.id); im.scale.setScalar(im.userData.isBlock ? 0.3 : 0.5); im.position.z = im.userData.isBlock ? 0.12 : 0.05;
    im.rotation.z = -e.rot * Math.PI / 4; g.add(im); g.userData.item = im;
  }
  return g;
}
function frameRebuild(e) { const old = e.mesh; scene.remove(old); e.mesh = frameMesh(e); scene.add(e.mesh); old.traverse(o => { if (o.isMesh && o.material && o.material.dispose) o.material.dispose(); }); }
// (ax, ay, az): the air block the frame hangs in; f: DIR6 index pointing away from the wall
function spawnFrame(ax, ay, az, f, opts = {}) {
  const n = S.DIR6[f], off = 0.5 - 1 / 32;
  const e = Ent('frame', ax + .5 - n[0] * off, ay + .5 - n[1] * off, az + .5 - n[2] * off); e.kind = 'frame'; e.hittable = true;
  Object.assign(e, { ax, ay, az, f, glow: !!opts.glow, item: opts.item || null, rot: opts.rot || 0 });
  // a thin box against the wall for aiming at it
  const h = 6 / 16, t = 1 / 32;
  e.box = [e.x - (n[0] ? t : h), e.y - (n[1] ? t : h), e.z - (n[2] ? t : h), e.x + (n[0] ? t : h), e.y + (n[1] ? t : h), e.z + (n[2] ? t : h)];
  e.w = h; e.h = 0; e.mesh = frameMesh(e);
  e.tick = frameTick; e.render = frameRender; e.onHit = frameHit;
  return addEnt(e);
}
function frameDropAll(e, keepFrame) {
  if (e.item) dropStack(e.x, e.y, e.z, e.item);
  if (!keepFrame) dropItem(e.x, e.y, e.z, e.glow ? IID.glow_item_frame : IID.item_frame, 1);
}
function frameTick(e) {
  if (e.age % 20) return;
  const n = S.DIR6[e.f], wall = getBlock(e.ax - n[0], e.ay - n[1], e.az - n[2]);
  if (!SOLID[wall] || (getBlock(e.ax, e.ay, e.az) && !REPL[getBlock(e.ax, e.ay, e.az)])) { removeEnt(e); frameDropAll(e, false); rsNotify(e.ax, e.ay, e.az); } // lost its wall
}
function frameRender(e, x, y, z, br) {
  const n = S.DIR6[e.f]; e.mesh.position.set(x, y, z); e.mesh.lookAt(x + n[0], y + n[1], z + n[2]);
  e.mesh.traverse(o => { if (o.isMesh) R.setMeshLight(o, e.glow && o !== e.mesh.userData.plate ? 1 : br); });
}
function frameHit(e) { // attack: knock the item out, then the frame itself
  if (e.item) { if (!creative()) frameDropAll(e, true); e.item = null; e.rot = 0; frameRebuild(e); play('pop'); }
  else { removeEnt(e); if (!creative()) frameDropAll(e, false); play('break', { mat: 'wood' }); }
  rsNotify(e.ax, e.ay, e.az); vibrate(e.x, e.y, e.z);
}
function frameUse(e, h) { // use: put the held item in, or turn the item
  if (!e.item) { if (!h) return; e.item = { id: h.id, n: 1 }; if (h.d != null) e.item.d = h.d; if (h.e) e.item.e = h.e; consume(); play('place', { mat: 'wood' }); }
  else { e.rot = (e.rot + 1) & 7; play('click', { pitch: 0.8 }); }
  frameRebuild(e); rsNotify(e.ax, e.ay, e.az); vibrate(e.x, e.y, e.z); swing();
}
function placeFrame(t, glow) {
  const f = S.DIR6.findIndex(v => v[0] === t.nx && v[1] === t.ny && v[2] === t.nz); if (f < 0 || !SOLID[getBlock(t.x, t.y, t.z)]) return false;
  const ax = t.x + t.nx, ay = t.y + t.ny, az = t.z + t.nz, cur = getBlock(ax, ay, az);
  if (cur && !REPL[cur]) return false;
  if (ENT.some(o => o.kind === 'frame' && !o.dead && o.ax === ax && o.ay === ay && o.az === az && o.f === f)) return false;
  spawnFrame(ax, ay, az, f, { glow }); consume(); play('place', { mat: 'wood' }); swing(); vibrate(ax + .5, ay + .5, az + .5);
  return true;
}
const frameAt = (x, y, z) => ENT.find(o => o.kind === 'frame' && !o.dead && o.ax === x && o.ay === y && o.az === z);

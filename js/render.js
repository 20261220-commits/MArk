// Rendering: renderer, chunk materials/meshes, sky, clouds, particles, rain, hand/held item.
const R = {};
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, depth: true, preserveDrawingBuffer: false });
renderer.sortObjects = true;
renderer.autoClear = false;
const scene = new THREE.Scene();
const fog = new THREE.Fog(0x8ec5ff, 60, 100); scene.fog = fog;
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000); camera.rotation.order = 'YXZ';
R.renderer = renderer; R.scene = scene; R.camera = camera;
R.pixelScale = 1; R.basePR = Math.min(window.devicePixelRatio || 1, 1);

const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.generateMipmaps = false; atlasTex.flipY = false;

const chunkUniforms = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
  map: { value: null }, uSky: { value: 1 }, uSkyCol: { value: new THREE.Color(1, 1, 1) }, uFlick: { value: 1 }, uGamma: { value: 0.5 }, uTime: { value: 0 }, uMin: { value: 0.035 } }]);
const CHUNK_VS = `
attribute vec4 lt; attribute vec4 col;
uniform float uSky; uniform vec3 uSkyCol; uniform float uFlick; uniform float uGamma; uniform float uMin;
varying vec2 vUv; varying vec3 vLight; varying vec3 vTint;
#include <fog_pars_vertex>
float curve(float l){ float b = l / (4.0 - 3.0 * l); return mix(b, 1.0 - pow(1.0 - b, 4.0), uGamma); }
void main(){
  vUv = uv / 512.0;
  float sky = curve(lt.x * uSky);
  float blk = curve(lt.y) * uFlick;
  vec3 c = sky * uSkyCol + blk * vec3(1.0, 0.86, 0.66);
  c = max(c, vec3(uMin));
  vLight = min(c, vec3(1.0)) * lt.z;
  vTint = col.rgb;
  vec4 mvPosition = modelViewMatrix * vec4(position / 16.0 - vec3(1.0, 0.0, 1.0), 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const CHUNK_FS = `
uniform sampler2D map;
varying vec2 vUv; varying vec3 vLight; varying vec3 vTint;
#include <fog_pars_fragment>
void main(){
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.5) discard;
  float tm = step(t.a, 0.97);
  gl_FragColor = vec4(t.rgb * mix(vec3(1.0), vTint, tm) * vLight, 1.0);
  #include <fog_fragment>
}`;
const TRANS_FS = `
uniform sampler2D map;
varying vec2 vUv; varying vec3 vLight; varying vec3 vTint;
#include <fog_pars_fragment>
void main(){
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.02) discard;
  gl_FragColor = vec4(t.rgb * vTint * vLight, t.a);
  #include <fog_fragment>
}`;
// opaque terrain never discards, so tile-based GPUs keep early depth rejection; cutout geometry has its own material
const matOpaque = new THREE.ShaderMaterial({ uniforms: chunkUniforms(), vertexShader: CHUNK_VS, fragmentShader: CHUNK_FS.replace('if (t.a < 0.5) discard;', ''), fog: true });
const matCutout = new THREE.ShaderMaterial({ uniforms: chunkUniforms(), vertexShader: CHUNK_VS, fragmentShader: CHUNK_FS, fog: true });
const matTrans = new THREE.ShaderMaterial({ uniforms: chunkUniforms(), vertexShader: CHUNK_VS, fragmentShader: TRANS_FS, fog: true, transparent: true, depthWrite: false, side: THREE.FrontSide });
matOpaque.uniforms.map.value = atlasTex; matCutout.uniforms.map.value = atlasTex; matTrans.uniforms.map.value = atlasTex;
R.matOpaque = matOpaque; R.matTrans = matTrans;

function makeChunkGeo(d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
  g.setAttribute('lt', new THREE.BufferAttribute(d.lt, 4, true));
  g.setAttribute('col', new THREE.BufferAttribute(d.col, 4, true));
  g.setIndex(new THREE.BufferAttribute(d.idx, 1));
  let lo = 1e9, hi = -1e9; for (let i = 1; i < d.pos.length; i += 3) { const y = d.pos[i]; if (y < lo) lo = y; if (y > hi) hi = y; }
  lo /= 16; hi /= 16;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, (lo + hi) / 2, 8), Math.sqrt(128 + ((hi - lo) / 2) ** 2) + 1);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(0, lo, 0), new THREE.Vector3(16, hi, 16));
  return g;
}
W.onMesh = (c, m) => {
  if (!c.mesh) c.mesh = { o: null, c: null, t: null };
  for (const [k, d, mat] of [['o', m.o, matOpaque], ['c', m.c, matCutout], ['t', m.t, matTrans]]) {
    const old = c.mesh[k];
    if (old) { scene.remove(old); old.geometry.dispose(); c.mesh[k] = null; }
    if (!d.count) continue;
    const mesh = new THREE.Mesh(makeChunkGeo(d), mat);
    mesh.position.set(c.cx * 16, 0, c.cz * 16); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    if (k === 't') mesh.renderOrder = 2; else if (k === 'c') mesh.renderOrder = 1;
    scene.add(mesh); c.mesh[k] = mesh;
  }
};
W.onChunkUnloaded = c => { if (c.mesh) for (const k of ['o', 'c', 't']) if (c.mesh[k]) { scene.remove(c.mesh[k]); c.mesh[k].geometry.dispose(); } c.mesh = null; if (R.onChunkUnloaded) R.onChunkUnloaded(c); };
R.clearChunks = () => { for (const c of W.chunks.values()) W.onChunkUnloaded(c); };

// ---------- sky ----------
const skyGeo = new THREE.SphereGeometry(500, 16, 8);
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, glowDir: { value: new THREE.Vector3(1, 0, 0) }, glowAmt: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; uniform vec3 glowDir; uniform float glowAmt; varying vec3 vP;
    void main(){ float h = clamp(vP.y * 2.2 + 0.05, 0.0, 1.0); vec3 c = mix(bottom, top, h);
      float g = max(0.0, dot(normalize(vec3(vP.x, 0.0, vP.z)), glowDir)) * (1.0 - clamp(abs(vP.y) * 3.0, 0.0, 1.0)); c = mix(c, glow, g * g * glowAmt);
      gl_FragColor = vec4(c, 1.0); }`,
  side: THREE.BackSide, depthWrite: false, fog: false });
const sky = new THREE.Mesh(skyGeo, skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
function pixelTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; }
const sunTex = pixelTex(32, 32, g => { g.fillStyle = '#fff9d6'; g.fillRect(8, 8, 16, 16); g.fillStyle = '#ffe86a'; g.fillRect(10, 10, 12, 12); g.fillStyle = 'rgba(255,240,150,.35)'; g.fillRect(4, 4, 24, 24); });
const moonTex = pixelTex(32, 32, g => { g.fillStyle = '#e6ecf5'; g.fillRect(10, 10, 12, 12); g.fillStyle = '#b8c0cc'; g.fillRect(12, 13, 3, 3); g.fillRect(17, 17, 3, 2); g.fillRect(16, 11, 2, 2); });
const celMat = t => new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
const sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), celMat(sunTex)); sun.renderOrder = -9;
const moon = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), celMat(moonTex)); moon.renderOrder = -9;
scene.add(sun, moon);
const starGeo = new THREE.BufferGeometry(); { const a = []; const r = trng(99); for (let i = 0; i < 900; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); a.push(Math.cos(th) * s * 400, u * 400, Math.sin(th) * s * 400); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -9; stars.frustumCulled = false; scene.add(stars);
// clouds: one textured plane following the player
const cloudTex = pixelTex(64, 64, g => { const r = trng(5); const n = tnoise(r, 8); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const v = (n(x / 4, y / 4) + n(x / 2 + 3, y / 2 + 7) * 0.5) / 1.5; if (v > 0.56) { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); } } });
cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.repeat.set(6, 6);
const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false, color: 0xffffff });
const clouds = new THREE.Mesh(new THREE.PlaneGeometry(768, 768), cloudMat); clouds.rotation.x = -Math.PI / 2; clouds.renderOrder = 1; scene.add(clouds);
R.cloudsOn = true;

// ---------- selection & crack ----------
const selGeo = new THREE.BufferGeometry(); selGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24 * 3 * 6), 3));
const sel = new THREE.LineSegments(selGeo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, fog: false })); sel.visible = false; sel.frustumCulled = false; scene.add(sel);
function setSelection(x, y, z, boxes) {
  const a = selGeo.attributes.position.array; let n = 0; const e = 0.002;
  for (const b of boxes) {
    const x0 = x + b[0] / 16 - e, y0 = y + b[1] / 16 - e, z0 = z + b[2] / 16 - e, x1 = x + b[3] / 16 + e, y1 = y + b[4] / 16 + e, z1 = z + b[5] / 16 + e;
    const L = [[x0, y0, z0, x1, y0, z0], [x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1], [x0, y1, z1, x1, y1, z1], [x0, y0, z0, x0, y1, z0], [x1, y0, z0, x1, y1, z0], [x0, y0, z1, x0, y1, z1], [x1, y0, z1, x1, y1, z1], [x0, y0, z0, x0, y0, z1], [x1, y0, z0, x1, y0, z1], [x0, y1, z0, x0, y1, z1], [x1, y1, z0, x1, y1, z1]];
    for (const l of L) { if (n + 6 > a.length) break; a.set(l, n); n += 6; }
  }
  selGeo.setDrawRange(0, n / 3); selGeo.attributes.position.needsUpdate = true; sel.visible = true;
}
const crackTexs = crackCanvases.map(c => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; });
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: crackTexs[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, fog: false }));
crack.visible = false; scene.add(crack);
R.setSelection = setSelection; R.sel = sel; R.crack = crack; R.crackTexs = crackTexs;

// ---------- particles ----------
const PMAX = 600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pUV = new Float32Array(PMAX * 2), pSize = new Float32Array(PMAX), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('puv', new THREE.BufferAttribute(pUV, 2)); pGeo.setAttribute('psize', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('pcol', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: atlasTex }, scale: { value: 400 } }]),
  vertexShader: `attribute vec2 puv; attribute float psize; attribute vec3 pcol; uniform float scale; varying vec2 vUv; varying vec3 vCol;
    #include <fog_pars_vertex>
    void main(){ vUv = puv; vCol = pcol; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * scale / -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec3 vCol;
    #include <fog_pars_fragment>
    void main(){ vec2 uv = vUv + gl_PointCoord * (4.0 / 512.0); vec4 t = texture2D(map, uv); if (t.a < 0.5) discard; float tm = step(t.a, 0.97); gl_FragColor = vec4(t.rgb * vCol, 1.0);
    #include <fog_fragment>
    }`, fog: true });
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
const parts = []; // {x,y,z,vx,vy,vz,life,size,u,v,r,g,b,grav}
R.particles = parts;
function spawnParticle(p) { if (parts.length >= PMAX) parts.shift(); parts.push(p); }
function blockParticles(x, y, z, id, n = 24, light = 1, meta = 0) {
  const t = S.tileFor(id, meta, 0); const tu = (t % S.TPR) * 16, tv = ((t / S.TPR) | 0) * 16;
  const tint = S.TINT[id] ? (DEFAULT_TINT[S.TINT[id]] || [255, 255, 255]) : [255, 255, 255];
  for (let i = 0; i < n; i++) {
    const px = x + 0.1 + Math.random() * 0.8, py = y + 0.1 + Math.random() * 0.8, pz = z + 0.1 + Math.random() * 0.8;
    spawnParticle({ x: px, y: py, z: pz, vx: (px - x - .5) * 3, vy: Math.random() * 3 + 1, vz: (pz - z - .5) * 3, life: 0.6 + Math.random() * 0.6, size: 0.12 + Math.random() * 0.08,
      u: (tu + Math.floor(Math.random() * 12)) / S.ATL, v: (tv + Math.floor(Math.random() * 12)) / S.ATL, r: tint[0] / 255 * light, g: tint[1] / 255 * light, b: tint[2] / 255 * light, grav: 1 });
  }
}
function simpleParticle(x, y, z, col, opts = {}) {
  const t = S.T.white_wool; // flat white tile, tinted by color
  spawnParticle({ x, y, z, vx: opts.vx || (Math.random() - .5), vy: opts.vy != null ? opts.vy : Math.random() * 1.5, vz: opts.vz || (Math.random() - .5), life: opts.life || 0.8, size: opts.size || 0.15,
    u: ((t % S.TPR) * 16 + 4) / S.ATL, v: (((t / S.TPR) | 0) * 16 + 4) / S.ATL, r: col[0], g: col[1], b: col[2], grav: opts.grav != null ? opts.grav : 0.3 });
}
R.blockParticles = blockParticles; R.simpleParticle = simpleParticle;
function updateParticles(dt) {
  let n = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy -= 18 * p.grav * dt; p.vx *= 0.96; p.vz *= 0.96;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    if (p.grav && SOLID[getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; } else { p.x = nx; p.y = ny; p.z = nz; }
  }
  for (const p of parts) { pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z; pUV[n * 2] = p.u; pUV[n * 2 + 1] = p.v; pSize[n] = p.size; pCol[n * 3] = p.r; pCol[n * 3 + 1] = p.g; pCol[n * 3 + 2] = p.b; n++; }
  pGeo.setDrawRange(0, n);
  for (const k of ['position', 'puv', 'psize', 'pcol']) pGeo.attributes[k].needsUpdate = true;
}

// ---------- rain / snow ----------
const RAIN_N = 500;
const rainGeo = new THREE.BufferGeometry(); const rainPos = new Float32Array(RAIN_N * 6);
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0x9ab4e8, transparent: true, opacity: 0.55, fog: true });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
const drops = []; for (let i = 0; i < RAIN_N; i++) drops.push({ x: 0, y: -999, z: 0, s: 0 });
const colTop = new Map(); let colTopT = 0;
function updateRain(dt, px, py, pz, amt) {
  rain.visible = amt > 0.05; if (!rain.visible) return;
  rainMat.opacity = 0.55 * amt;
  colTopT -= dt; if (colTopT < 0) { colTop.clear(); colTopT = 1; }
  const top = (x, z) => { const k = x * 4096 + z; let v = colTop.get(k); if (v === undefined) { v = topY(x, z); colTop.set(k, v); } return v; };
  const cold = S.BIOMES[biomeAt(Math.floor(px), Math.floor(pz))][4] <= 0.15, dry = biomeAt(Math.floor(px), Math.floor(pz)) === S.BIO.DESERT;
  rainMat.color.setHex(cold ? 0xffffff : 0x9ab4e8);
  const active = Math.floor(RAIN_N * amt * (dry ? 0 : 1));
  for (let i = 0; i < RAIN_N; i++) {
    const d = drops[i];
    if (i >= active) { rainPos.fill(0, i * 6, i * 6 + 6); continue; }
    const t = top(Math.floor(d.x), Math.floor(d.z));
    if (d.y < t + 1 || d.y < py - 12 || Math.abs(d.x - px) > 14 || Math.abs(d.z - pz) > 14) {
      d.x = px + (Math.random() * 2 - 1) * 14; d.z = pz + (Math.random() * 2 - 1) * 14; d.y = py + 10 + Math.random() * 10; d.s = cold ? 3 + Math.random() : 18 + Math.random() * 6;
    }
    d.y -= d.s * dt;
    const len = cold ? 0.12 : 0.7, sw = cold ? Math.sin(d.y * 2 + i) * 0.05 : 0;
    rainPos[i * 6] = d.x + sw; rainPos[i * 6 + 1] = d.y; rainPos[i * 6 + 2] = d.z; rainPos[i * 6 + 3] = d.x + sw; rainPos[i * 6 + 4] = d.y + len; rainPos[i * 6 + 5] = d.z;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// ---------- extruded item meshes (held + dropped) ----------
const itemGeoCache = {}, blockGeoCache = {};
function itemGeometry(id) {
  if (itemGeoCache[id]) return itemGeoCache[id];
  const N = 16, img = spritePix[id] || new Uint8ClampedArray(N * N * 4);
  const pos = [], col = [], s = 1 / N;
  const A = (x, y) => x >= 0 && y >= 0 && x < N && y < N && img[(y * N + x) * 4 + 3] > 128;
  const push = (verts, r, gg, b, f) => { for (const v of [verts[0], verts[1], verts[2], verts[0], verts[2], verts[3]]) { pos.push(...v); col.push(r * f, gg * f, b * f); } };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!A(x, y)) continue;
    const i = (y * N + x) * 4, r = img[i] / 255, gg = img[i + 1] / 255, b = img[i + 2] / 255;
    const x0 = x * s - .5, x1 = (x + 1) * s - .5, y0 = .5 - (y + 1) * s, y1 = .5 - y * s, z0 = -1 / 32, z1 = 1 / 32;
    push([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], r, gg, b, 1);
    push([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], r, gg, b, 0.8);
    if (!A(x - 1, y)) push([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], r, gg, b, 0.7);
    if (!A(x + 1, y)) push([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], r, gg, b, 0.7);
    if (!A(x, y - 1)) push([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], r, gg, b, 0.9);
    if (!A(x, y + 1)) push([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], r, gg, b, 0.6);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return itemGeoCache[id] = geo;
}
// a cube (or shaped block) with atlas UVs, centered at origin, unit size
const DEFAULT_META = { 116: 5, 117: 10, 99: 0, 252: 5, 254: 10, 253: 5, 165: 5, 173: 10, 215: 1 }; // fence/pane icons show their connected arms
function blockGeometry(iid) { // iid: an item id (variant items resolve to their block and meta)
  if (blockGeoCache[iid]) return blockGeoCache[iid];
  const it = ITEMS[iid], id = it && it.place != null && it.block ? it.place : iid, vmeta = it && it.vi ? it.vi << S.VSH[id] : 0;
  const pos = [], uv = [], shade = [], tintA = [];
  const boxes = S.shapes(id, (DEFAULT_META[id] || 0) | vmeta) || [[0, 0, 0, 16, 16, 16]];
  const tint = DEFAULT_TINT[S.TINT[id]] || [255, 255, 255];
  for (const bx of boxes) for (let f = 0; f < 6; f++) {
    const C = [[[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]][f];
    let t = S.tileFor(id, vmeta, f === 2 ? 1 : f === 3 ? 2 : 0);
    if ((S.FACING[id] || id === S.BID.crafting_table) && f === 4) t = S.FT[id * 4 + 3];
    if (id === S.BID.oak_door) t = f === 2 || f === 3 ? S.T.oak_planks : S.T.oak_door_bottom;
    const tu = (t % S.TPR) * 16, tv = ((t / S.TPR) | 0) * 16, sh = [0.6, 0.6, 1, 0.5, 0.8, 0.8][f];
    const P = C.map(c => [(c[0] ? bx[3] : bx[0]) / 16 - .5, (c[1] ? bx[4] : bx[1]) / 16 - .5, (c[2] ? bx[5] : bx[2]) / 16 - .5]);
    // texture coordinates follow the box like the terrain mesher (pixel-exact on partial blocks)
    let u0, u1, v0, v1;
    if (f === 0) { u0 = 16 - bx[5]; u1 = 16 - bx[2]; } else if (f === 1) { u0 = bx[2]; u1 = bx[5]; } else if (f === 4) { u0 = bx[0]; u1 = bx[3]; } else { u0 = 16 - bx[3]; u1 = 16 - bx[0]; }
    if (f === 2) { u0 = bx[0]; u1 = bx[3]; v0 = bx[2]; v1 = bx[5]; } else if (f === 3) { u0 = bx[0]; u1 = bx[3]; v0 = 16 - bx[5]; v1 = 16 - bx[2]; } else { v0 = 16 - bx[4]; v1 = 16 - bx[1]; }
    const U = [[tu + u0, tv + v1], [tu + u1, tv + v1], [tu + u1, tv + v0], [tu + u0, tv + v0]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...P[k]); uv.push(U[k][0] / S.ATL, U[k][1] / S.ATL); shade.push(sh); tintA.push(tint[0] / 255, tint[1] / 255, tint[2] / 255); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1)); geo.setAttribute('tint', new THREE.Float32BufferAttribute(tintA, 3));
  return blockGeoCache[iid] = geo;
}
// block items use the same biome-tint mask as terrain (only tint-marked pixels take the colour)
const itemBlockMatBase = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: atlasTex }, light: { value: 1 } }]),
  vertexShader: `attribute float shade; attribute vec3 tint; varying vec2 vUv; varying float vShade; varying vec3 vTint;
    #include <fog_pars_vertex>
    void main(){ vUv = uv; vShade = shade; vTint = tint; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform sampler2D map; uniform float light; varying vec2 vUv; varying float vShade; varying vec3 vTint;
    #include <fog_pars_fragment>
    void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard; float tm = step(t.a, 0.97); gl_FragColor = vec4(t.rgb * mix(vec3(1.0), vTint, tm) * vShade * light, 1.0);
    #include <fog_fragment>
    }`, fog: true });
itemBlockMatBase.uniforms.map.value = atlasTex;
const itemSpriteMatBase = new THREE.MeshBasicMaterial({ vertexColors: true });
function blockMaterial() { const m = itemBlockMatBase.clone(); m.uniforms.map.value = atlasTex; return m; }
function itemMesh(id) {
  const d = ITEMS[id];
  const isBlock = d && d.block && !d.sprite;
  const m = new THREE.Mesh(isBlock ? blockGeometry(id) : itemGeometry(id), isBlock ? blockMaterial() : itemSpriteMatBase.clone());
  m.userData.isBlock = isBlock;
  return m;
}
// brightness for item/block meshes regardless of material kind
function setMeshLight(mesh, v) { const m = mesh.material; if (m.uniforms) m.uniforms.light.value = v; else m.color.setScalar(v); }
// render true 3D inventory icons for block items once at startup (Java GUI angle)
function renderBlockIcons() {
  const ids = ITEMS.map((d, i) => d && d.block && !d.sprite ? i : -1).filter(i => i >= 0); // pack sprites already set d.sprite
  if (!ids.length) return;
  const cols = 32, rows = Math.ceil(ids.length / cols), Wd = cols * ICON, Hd = rows * ICON;
  const rt = new THREE.WebGLRenderTarget(Wd, Hd, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-0.86, 0.86, 0.86, -0.86, 0.1, 10);
  cam.position.set(1.6, 1.3, 1.6); cam.lookAt(0, -0.02, 0);
  const mat = blockMaterial(), mesh = new THREE.Mesh(blockGeometry(ids[0]), mat); sc.add(mesh);
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  rt.scissorTest = true;
  ids.forEach((id, i) => {
    const x = (i % cols) * ICON, y = Hd - (Math.floor(i / cols) + 1) * ICON;
    rt.viewport.set(x, y, ICON, ICON); rt.scissor.set(x, y, ICON, ICON);
    mesh.geometry = blockGeometry(id);
    const s = id === S.BID.oak_door ? 0.55 : 1; mesh.scale.set(s, s, s);
    renderer.setRenderTarget(rt); renderer.render(sc, cam);
  });
  const buf = new Uint8Array(Wd * Hd * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, Wd, Hd, buf);
  renderer.setRenderTarget(null); renderer.setClearColor(prevClear, prevAlpha); rt.dispose(); mat.dispose();
  const g = iconCanvas.getContext('2d');
  ids.forEach((id, i) => {
    const cx = (i % cols) * ICON, cy = Math.floor(i / cols) * ICON, img = new ImageData(ICON, ICON);
    for (let y = 0; y < ICON; y++) { const sy = Hd - 1 - (cy + y); img.data.set(buf.subarray((sy * Wd + cx) * 4, (sy * Wd + cx + ICON) * 4), y * ICON * 4); }
    let any = false; for (let k = 3; k < img.data.length; k += 4) if (img.data[k]) { any = true; break; }
    if (!any) return; // keep the 2D fallback if WebGL produced nothing
    const cell = iconIndex[id]; g.clearRect((cell % ICON_COLS) * ICON, Math.floor(cell / ICON_COLS) * ICON, ICON, ICON); g.putImageData(img, (cell % ICON_COLS) * ICON, Math.floor(cell / ICON_COLS) * ICON);
  });
}
// ---------- animated tiles: only the changed 16x16 tiles are copied into the atlas texture ----------
const animTiles = []; let animIdx = 0;
function stepAnimation(dt) {
  R.animT = (R.animT || 0) + dt; if (R.animT < 0.1) return; R.animT = 0;
  if (!PACKPX.data) { animateAtlas(0.1); atlasTex.needsUpdate = true; return; } // procedural fallback
  if (!animTiles.length) for (const k in PACKPX.anim) { const t = S.T[k], data = new Uint8Array(1024), tex = new THREE.DataTexture(data, 16, 16, THREE.RGBAFormat); animTiles.push({ k, data, tex, pos: new THREE.Vector2((t % S.TPR) * 16, ((t / S.TPR) | 0) * 16), slow: k === 'magma' ? 6 : k === 'lava' ? 2 : 1 }); }
  animIdx++;
  for (const a of animTiles) { if (animIdx % a.slow) continue; a.data.set(animFrame(a.k, (animIdx / a.slow) | 0)); a.tex.needsUpdate = true; renderer.copyTextureToTexture(a.pos, a.tex, atlasTex); }
}
R.stepAnimation = stepAnimation;
R.itemMesh = itemMesh; R.blockGeometry = blockGeometry; R.blockMaterial = blockMaterial; R.setMeshLight = setMeshLight; R.renderBlockIcons = renderBlockIcons;

// ---------- first person hand ----------
const handScene = new THREE.Scene();
const handCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
const skinTex = pixelTex(16, 16, g => { const r = trng(3); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = y < 4 ? ['#3aa8c8', '#2a98b8', '#4ab8d8'][r.int(3)] : ['#c98e6a', '#bd8460', '#d29a76'][r.int(3)]; g.fillRect(x, y, 1, 1); } });
const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.16); armGeo.translate(0, -0.3, 0);
const armMat = new THREE.MeshBasicMaterial({ map: skinTex });
const arm = new THREE.Mesh(armGeo, armMat);
const handGroup = new THREE.Group(); handScene.add(handGroup);
let heldId = -1, heldMesh = null;
R.hand = { swing: 0, equip: 1, eat: 0, bow: 0, spy: false };
function updateHand(dt, id, light, bobX, bobY) {
  if (id !== heldId) {
    if (heldMesh) { handGroup.remove(heldMesh); heldMesh.material.dispose(); heldMesh = null; }
    handGroup.remove(arm);
    heldId = id; R.hand.equip = 0;
    if (id > 0) { heldMesh = itemMesh(id); handGroup.add(heldMesh); } else handGroup.add(arm);
  }
  const h = R.hand; h.equip = Math.min(1, h.equip + dt * 6);
  const sw = h.swing > 0 ? Math.sin((1 - h.swing) * Math.PI) : 0, sw2 = h.swing > 0 ? Math.sin(Math.sqrt(1 - h.swing) * Math.PI) : 0;
  const c = new THREE.Color(light, light, light);
  if (heldMesh) setMeshLight(heldMesh, light); else armMat.color.copy(c);
  handGroup.position.set(0.5 + bobX - sw2 * 0.22, -0.44 + bobY - (1 - h.equip) * 0.6 + sw * 0.1 - h.eat * 0.05 * Math.abs(Math.sin(performance.now() / 60)), -0.85 + sw2 * -0.1);
  handGroup.rotation.set(0, 0, 0);
  if (heldMesh) {
    if (heldMesh.userData.isBlock) { heldMesh.scale.setScalar(0.26); heldMesh.rotation.set(0.12, Math.PI / 4 + 0.15, 0); heldMesh.position.set(-0.04, 0.02, 0); }
    else { heldMesh.scale.setScalar(0.42); heldMesh.rotation.set(-0.1, -Math.PI / 2 + 0.35, 0.4); heldMesh.position.set(0.02, 0.06, 0); }
    if (h.eat > 0) { handGroup.position.x -= 0.35; handGroup.position.y += 0.15; handGroup.rotation.y = 0.6; }
    if (h.bow > 0) { handGroup.position.x -= 0.25; heldMesh.rotation.set(0, -Math.PI / 2 + 0.1, 0.1); }
  } else { arm.rotation.set(-1.35 - sw2 * 0.5, 0.35, 0.6 + sw * 0.4); arm.position.set(0.12, -0.12, 0.25); }
  handGroup.rotation.x += -sw2 * 0.6; handGroup.rotation.y += sw * 0.3;
  handGroup.visible = !h.spy;
}
R.updateHand = updateHand;

// ---------- frame ----------
const SKY_DAY = new THREE.Color(0x78a7ff), FOG_DAY = new THREE.Color(0xc0d8ff), SKY_NIGHT = new THREE.Color(0x000000), FOG_NIGHT = new THREE.Color(0x0a0c14);
const DUSK = new THREE.Color(0xff8a3a), WATER_FOG = new THREE.Color(0x0b2a6a), LAVA_FOG = new THREE.Color(0xc04a10), RAIN_SKY = new THREE.Color(0x5a6470);
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), fogCol = new THREE.Color(), sunDir = new THREE.Vector3(), lookV = new THREE.Vector3(); // reused every frame (no GC churn)
R.rd = 6; R.fov = 70; R.fovMul = 1;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(R.basePR * R.pixelScale); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix(); handCam.aspect = w / h; handCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
R.resize = resize;
const NETHER_FOG = { 13: new THREE.Color(0x330808), 14: new THREE.Color(0x330303), 15: new THREE.Color(0x1a051a), 16: new THREE.Color(0x1b4745), 17: new THREE.Color(0x685f70) };
const END_SKY = new THREE.Color(0x0b0811), netherFog = new THREE.Color(0x330808);
function renderFrame(dt, eye, under) {
  if (W.dim) return renderOtherDim(dt, eye, under);
  sun.visible = moon.visible = stars.visible = true;
  const day = dayFactor();
  const cel = celestial(), ang = cel * Math.PI * 2;
  sunDir.set(-Math.sin(ang), Math.cos(ang), 0.1).normalize();
  // sky colors
  tmpC.copy(SKY_NIGHT).lerp(SKY_DAY, day); tmpC2.copy(FOG_NIGHT).lerp(FOG_DAY, day);
  if (W.rain > 0) { tmpC.lerp(RAIN_SKY, W.rain * 0.6 * day); tmpC2.lerp(RAIN_SKY, W.rain * 0.6 * day); }
  const duskAmt = Math.max(0, 1 - Math.abs(sunDir.y) * 3.2) * (1 - W.rain);
  skyMat.uniforms.top.value.copy(tmpC); skyMat.uniforms.bottom.value.copy(tmpC2);
  skyMat.uniforms.glow.value.copy(DUSK); skyMat.uniforms.glowAmt.value = duskAmt * 0.85; skyMat.uniforms.glowDir.value.set(sunDir.x > 0 ? 1 : -1, 0, 0);
  fogCol.copy(tmpC2); if (duskAmt > 0) { lookV.set(0, 0, -1).applyEuler(camera.rotation); const f = Math.max(0, lookV.x * (sunDir.x > 0 ? 1 : -1)); fogCol.lerp(DUSK, duskAmt * f * 0.5); }
  const rd = R.rd * 16;
  if (under === 'water') { fog.color.copy(WATER_FOG).multiplyScalar(0.3 + day * 0.7); fog.near = 1; fog.far = 32; }
  else if (under === 'lava') { fog.color.copy(LAVA_FOG); fog.near = 0.1; fog.far = 2; }
  else if (under === 'snow') { fog.color.setRGB(0.85, 0.9, 0.95); fog.near = 0; fog.far = 2; }
  else { fog.color.copy(fogCol); fog.near = rd * (W.rain > 0.5 ? 0.35 : 0.6); fog.far = rd * (W.rain > 0.5 ? 0.85 : 1.0); }
  renderer.setClearColor(fog.color);
  sky.visible = !under; sky.position.copy(camera.position);
  sun.position.copy(camera.position).addScaledVector(sunDir, 300); sun.lookAt(camera.position);
  moon.position.copy(camera.position).addScaledVector(sunDir, -300); moon.lookAt(camera.position);
  sun.material.opacity = moon.material.opacity = 1 - W.rain;
  stars.position.copy(camera.position); starMat.opacity = Math.max(0, 1 - day * 1.6) * (1 - W.rain); stars.rotation.z = ang;
  clouds.visible = R.cloudsOn && !under; clouds.position.set(camera.position.x, 128.33, camera.position.z); // 1.17 cloud height
  cloudTex.offset.set((camera.position.x / 768) * 6 + performance.now() / 1e6, (-camera.position.z / 768) * 6);
  cloudMat.color.setScalar(0.2 + 0.8 * day); cloudMat.opacity = 0.8 * (1 - W.rain * 0.3);
  // lighting uniforms
  const skyF = 0.18 + 0.82 * day;
  for (const m of [matOpaque, matCutout, matTrans]) { m.uniforms.uMin.value = 0.035; m.uniforms.uSky.value = skyF; m.uniforms.uSkyCol.value.setRGB(0.92 + 0.08 * day, 0.92 + 0.08 * day, 1); m.uniforms.uFlick.value = 0.95 + 0.04 * Math.sin(performance.now() * 0.01) * Math.sin(performance.now() * 0.0237); m.uniforms.uGamma.value = R.gamma; }
  updateParticles(dt);
  pMat.uniforms.scale.value = innerHeight * R.basePR * R.pixelScale / (2 * Math.tan(camera.fov * Math.PI / 360));
  renderer.clear();
  renderer.render(scene, camera);
  if (R.showHand) { renderer.clearDepth(); handCam.fov = 70; handCam.updateProjectionMatrix(); renderer.render(handScene, handCam); }
}
// the Nether: no sky, biome-coloured fog close in, a little ambient light; the End: dark purple void, fixed light
function renderOtherDim(dt, eye, under) {
  const nether = W.dim === -1, rd = R.rd * 16;
  sky.visible = false; sun.visible = moon.visible = false; clouds.visible = false; stars.visible = !nether;
  if (nether) { const b = biomeAt(Math.floor(camera.position.x), Math.floor(camera.position.z)); netherFog.lerp(NETHER_FOG[b] || NETHER_FOG[13], Math.min(1, dt * 2)); }
  if (under === 'water') { fog.color.copy(WATER_FOG).multiplyScalar(0.4); fog.near = 1; fog.far = 24; }
  else if (under === 'lava') { fog.color.copy(LAVA_FOG); fog.near = 0.1; fog.far = 2; }
  else if (nether) { fog.color.copy(netherFog); fog.near = Math.min(rd, 96) * 0.05; fog.far = Math.min(rd, 96) * 0.9; }
  else { fog.color.copy(END_SKY); fog.near = rd * 0.5; fog.far = rd; stars.position.copy(camera.position); starMat.opacity = 0.35; }
  renderer.setClearColor(fog.color);
  for (const m of [matOpaque, matCutout, matTrans]) {
    m.uniforms.uSky.value = nether ? 0 : 0.92; m.uniforms.uSkyCol.value.setRGB(0.9, 0.86, 1); m.uniforms.uMin.value = nether ? 0.24 : 0.08;
    m.uniforms.uFlick.value = 0.95 + 0.04 * Math.sin(performance.now() * 0.01) * Math.sin(performance.now() * 0.0237); m.uniforms.uGamma.value = R.gamma;
  }
  updateParticles(dt);
  pMat.uniforms.scale.value = innerHeight * R.basePR * R.pixelScale / (2 * Math.tan(camera.fov * Math.PI / 360));
  renderer.clear(); renderer.render(scene, camera);
  if (R.showHand) { renderer.clearDepth(); handCam.fov = 70; handCam.updateProjectionMatrix(); renderer.render(handScene, handCam); }
}
R.renderFrame = renderFrame; R.updateRain = updateRain;
R.gamma = 0.5; R.showHand = true;

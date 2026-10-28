// Rendering: renderer, chunk materials/meshes, sky, clouds, particles, rain, hand/held item.
const R = {};
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, depth: true, preserveDrawingBuffer: false });
renderer.sortObjects = true;
renderer.autoClear = false;
const scene = new THREE.Scene();
const fog = new THREE.Fog(0x8ec5ff, 60, 100); scene.fog = fog;
// fog by true distance from the eye (like Java), not view depth: with depth fog the loaded area's edge showed,
// cut off, at the sides of the screen and when looking down from high up
// (cylindrical: horizontal distance, or height difference, measured in world axes from the eye)
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tvec3 fogRel = vec3( dot( viewMatrix[0].xyz, mvPosition.xyz ), dot( viewMatrix[1].xyz, mvPosition.xyz ), dot( viewMatrix[2].xyz, mvPosition.xyz ) );\n\tfogDepth = max( length( fogRel.xz ), abs( fogRel.y ) );\n#endif';
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000); camera.rotation.order = 'YXZ';
R.renderer = renderer; R.scene = scene; R.camera = camera;
R.pixelScale = 1; R.basePR = Math.min(window.devicePixelRatio || 1, 1);

const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.generateMipmaps = false; atlasTex.flipY = false;

const chunkUniforms = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
  map: { value: null }, uSky: { value: 1 }, uSkyCol: { value: new THREE.Color(1, 1, 1) }, uFlick: { value: 1 }, uGamma: { value: 0.5 }, uTime: { value: 0 }, uMin: { value: 0.035 }, uDyn: { value: [] } }]);
const CHUNK_VS = `
attribute vec4 lt; attribute vec4 col;
uniform float uSky; uniform vec3 uSkyCol; uniform float uFlick; uniform float uGamma; uniform float uMin; uniform vec4 uDyn[6];
varying vec2 vUv; varying vec3 vLight; varying vec3 vTint;
#include <fog_pars_vertex>
float curve(float l){ float b = l / (4.0 - 3.0 * l); return mix(b, 1.0 - pow(1.0 - b, 4.0), uGamma); }
void main(){
  vUv = uv / 8192.0; // 1/16 pixel units in a 512 px atlas
  float sky = curve(lt.x * uSky);
  vec3 wp = (modelMatrix * vec4(position / 16.0 - vec3(1.0, 0.0, 1.0), 1.0)).xyz;
  float dl = 0.0; // light carried by players (a torch in either hand) and lying on the ground: level minus the distance in blocks
  for (int i = 0; i < 6; i++) { vec4 d = uDyn[i]; if (d.w > 0.0) { vec3 q = abs(wp - d.xyz); dl = max(dl, (d.w - (q.x + q.y + q.z)) / 15.0); } }
  float blk = curve(max(lt.y, clamp(dl, 0.0, 1.0))) * uFlick;
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
// ---------- dynamic light: torches, lanterns and the like held in either hand (yours and other players') or dropped ----------
const DYN = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0));
function itemLum(id) {
  const d = id && ITEMS[id]; if (!d) return 0;
  if (id === IID.lava_bucket) return 15;
  if (d.place == null) return 0;
  if (d.place === BID.campfire) return 15; if (d.place === BID.soul_campfire) return 10; // lit when placed
  return S.emitOf(d.place, d.pmeta || 0) || 0;
}
R.itemLum = itemLum; R.dyn = DYN;
// the lights to use this frame: [x, y, z, level], brightest and nearest first
R.setDynLights = list => { for (let i = 0; i < DYN.length; i++) { const l = list[i]; if (l) DYN[i].set(l[0], l[1], l[2], l[3]); else DYN[i].set(0, 0, 0, 0); } };
// how bright a spot is from those lights (0..15), for entities and the held item
R.dynAt = (x, y, z) => { let b = 0; for (const d of DYN) if (d.w > 0) b = Math.max(b, d.w - (Math.abs(x - d.x) + Math.abs(y - d.y) + Math.abs(z - d.z))); return b; };
// opaque terrain never discards, so tile-based GPUs keep early depth rejection; cutout geometry has its own material
const matOpaque = new THREE.ShaderMaterial({ uniforms: chunkUniforms(), vertexShader: CHUNK_VS, fragmentShader: CHUNK_FS.replace('if (t.a < 0.5) discard;', ''), fog: true });
const matCutout = new THREE.ShaderMaterial({ uniforms: chunkUniforms(), vertexShader: CHUNK_VS, fragmentShader: CHUNK_FS, fog: true });
const matTrans = new THREE.ShaderMaterial({ uniforms: chunkUniforms(), vertexShader: CHUNK_VS, fragmentShader: TRANS_FS, fog: true, transparent: true, depthWrite: false, side: THREE.FrontSide });
for (const m of [matOpaque, matCutout, matTrans]) m.uniforms.uDyn.value = DYN;
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
    mesh.position.set(c.cx * 16, S.MINY, c.cz * 16); /* meshes are built in array rows: row 0 is y -64 */ mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    if (k === 't') mesh.renderOrder = 2; else if (k === 'c') mesh.renderOrder = 1;
    scene.add(mesh); c.mesh[k] = mesh;
  }
  c.mesh.ver = c.ver;
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
// a loaded jar/pack replaces the drawn sky with its environment textures (sun, the 8 moon phases, clouds)
function entCanvas(key) { const e = PACKPX.ent[key]; if (!e) return null; const c = document.createElement('canvas'); c.width = e.w; c.height = e.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(e.px), e.w, e.h), 0, 0); return c; }
R.moonPhases = false;
function applyPackSky() {
  const sc = entCanvas('env_sun'); if (sc) { sunTex.image = sc; sunTex.needsUpdate = true; sun.geometry = new THREE.PlaneGeometry(90, 90); }
  const mc = entCanvas('env_moon'); if (mc) { moonTex.image = mc; moonTex.repeat.set(1 / 4, 1 / 2); moonTex.needsUpdate = true; moon.geometry = new THREE.PlaneGeometry(60, 60); R.moonPhases = true; }
  const cc = entCanvas('env_clouds'); if (cc) { cloudTex.image = cc; cloudTex.repeat.set(768 / (cc.width * 12), 768 / (cc.height * 12)); cloudTex.needsUpdate = true; } // a cloud pixel is 12 blocks
}
R.applyPackSky = applyPackSky;
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
// the breaking overlay covers the block's own model (a slab, a torch, a lectern), not a whole cube, and blends like
// Java's crumbling layer: colour = 2 x texture x what is behind (grey keeps it, dark lines darken), clear pixels skipped
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: crackTexs[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, fog: false, alphaTest: 0.1,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor }));
crack.visible = false; scene.add(crack);
const crackGeos = new Map();
function crackGeometry(id, meta) {
  const key = id * 256 + (meta & 255); let g = crackGeos.get(key); if (g) return g;
  let src = !BOX_ICON(id) ? meshedBlockGeometry(id, meta, true) : null, pos;
  if (src) pos = src.attributes.position.array;
  else { const a = []; for (const b of S.shapes(id, meta) || [[0, 0, 0, 16, 16, 16]]) { const bg = new THREE.BoxGeometry((b[3] - b[0]) / 16, (b[4] - b[1]) / 16, (b[5] - b[2]) / 16).toNonIndexed(); bg.translate((b[0] + b[3]) / 32 - .5, (b[1] + b[4]) / 32 - .5, (b[2] + b[5]) / 32 - .5); a.push(...bg.attributes.position.array); } pos = new Float32Array(a); }
  const uv = new Float32Array(pos.length / 3 * 2), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let t = 0; t < pos.length; t += 9) { // texture coordinates from the position on the face, as Java's sheeted decal does
    A.fromArray(pos, t); B.fromArray(pos, t + 3); C.fromArray(pos, t + 6); const n = B.clone().sub(A).cross(C.clone().sub(A));
    const ax = Math.abs(n.x) > Math.abs(n.y) && Math.abs(n.x) > Math.abs(n.z) ? 0 : Math.abs(n.y) > Math.abs(n.z) ? 1 : 2;
    for (let k = 0; k < 3; k++) { const x = pos[t + k * 3] + .5, y = pos[t + k * 3 + 1] + .5, z = pos[t + k * 3 + 2] + .5, o = (t / 3 + k) * 2;
      uv[o] = ax === 0 ? (n.x > 0 ? 1 - z : z) : x; uv[o + 1] = ax === 1 ? (n.y > 0 ? 1 - z : z) : y; } }
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  crackGeos.set(key, g); return g;
}
R.setCrack = (x, y, z, id, meta, stage) => { if (stage < 0) { crack.visible = false; return; }
  crack.geometry = crackGeometry(id, meta); crack.position.set(x + .5, y + .5, z + .5); crack.scale.setScalar(1.002); crack.material.map = crackTexs[Math.min(9, stage)]; crack.visible = true; };
function applyPackCracks() { crackTexs.forEach((t, i) => { const c = entCanvas('destroy_' + i); if (c) { t.image = c; t.needsUpdate = true; } }); }
R.applyPackCracks = applyPackCracks;
R.setSelection = setSelection; R.sel = sel; R.crack = crack; R.crackTexs = crackTexs;

// ---------- particles ----------
const PMAX = 1500;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pUV = new Float32Array(PMAX * 2), pSize = new Float32Array(PMAX), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('puv', new THREE.BufferAttribute(pUV, 2)); pGeo.setAttribute('psize', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('pcol', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: atlasTex }, sheet: { value: null }, scale: { value: 400 } }]),
  vertexShader: `attribute vec2 puv; attribute float psize; attribute vec3 pcol; uniform float scale; varying vec2 vUv; varying vec3 vCol;
    #include <fog_pars_vertex>
    void main(){ vUv = puv; vCol = pcol; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * scale / -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform sampler2D map; uniform sampler2D sheet; varying vec2 vUv; varying vec3 vCol;
    #include <fog_pars_fragment>
    void main(){ vec4 t = vUv.x >= 2.0 ? texture2D(sheet, vUv - vec2(2.0, 0.0) + gl_PointCoord / 16.0) : texture2D(map, vUv + gl_PointCoord * (4.0 / 512.0)); if (t.a < 0.5) discard; float tm = step(t.a, 0.97); gl_FragColor = vec4(t.rgb * vCol, 1.0);
    #include <fog_fragment>
    }`, fog: true });
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
const parts = []; // {x,y,z,vx,vy,vz,life,size,u,v,r,g,b,grav}
R.particles = parts;
function spawnParticle(p) { if (parts.length >= PMAX) parts.shift(); parts.push(p); }
// a loaded jar/pack's particle sprites (particle/*.png, 8x8 each) in a 16x16 sheet; each kind lists its frames as Java's particle json does
const seq = (n, a, b) => { const r = []; for (let i = a; a <= b ? i <= b : i >= b; i += a <= b ? 1 : -1) r.push(n + '_' + i); return r; };
const PKINDS = { smoke: seq('generic', 7, 0), portal: seq('generic', 0, 7), heart: ['heart'], angry: ['angry'], happy: ['glint'], note: ['note'], crit: ['critical_hit'], magic: ['enchanted_hit'],
  flame: ['flame'], soul_flame: ['soul_fire_flame'], bubble: ['bubble'], splash: seq('splash', 0, 3), effect: seq('effect', 7, 0), spell: seq('spell', 7, 0), explosion: seq('explosion', 0, 15),
  spark: seq('spark', 7, 0), big_smoke: seq('big_smoke', 0, 11), drip: ['drip_hang'], lava: ['lava'], glow: ['glow'], damage: ['damage'], sweep: seq('sweep', 0, 7), nautilus: ['nautilus'], snowflake: ['snowflake'], witch: ['witch'] };
const PSHEET = { uv: null };
function buildParticleSheet() {
  const names = [...new Set(Object.values(PKINDS).flat())].filter(n => PACKPX.ent['particle_' + n]); if (!names.length) return;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; PSHEET.uv = {};
  names.forEach((n, i) => { const e = PACKPX.ent['particle_' + n], src = document.createElement('canvas'); src.width = e.w; src.height = e.h; src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(e.px), e.w, e.h), 0, 0);
    const x = (i % 16) * 8, y = Math.floor(i / 16) * 8; g.drawImage(src, 0, 0, e.w, Math.min(e.h, e.w), x, y, 8, 8); PSHEET.uv[n] = [2 + x / 128, y / 128]; });
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; pMat.uniforms.sheet.value = t;
}
R.buildParticleSheet = buildParticleSheet;
// the "particle" texture of Java's block models, where it isn't the block's side
const PARTICLE_TILE = { grass_block: 'dirt', podzol: 'dirt', mycelium: 'dirt', dirt_path: 'dirt', farmland: 'dirt', crimson_nylium: 'netherrack', warped_nylium: 'netherrack',
  red_bed: 'oak_planks', chest: 'oak_planks', trapped_chest: 'oak_planks', ender_chest: 'obsidian', banner: 'oak_planks', wall_banner: 'oak_planks', lectern: 'lectern_sides', campfire: 'campfire_log', soul_campfire: 'campfire_log' };
function blockParticles(x, y, z, id, n = 24, light = 1, meta = 0) {
  const pk = BLOCKS[id] && PARTICLE_TILE[BLOCKS[id].key], t = pk && S.T[pk] != null ? S.T[pk] : S.tileFor(id, meta, 0); const tu = (t % S.TPR) * 16, tv = ((t / S.TPR) | 0) * 16;
  const tint = S.TINT[id] && !pk ? (DEFAULT_TINT[S.TINT[id]] || [255, 255, 255]) : [255, 255, 255];
  for (let i = 0; i < n; i++) {
    const px = x + 0.1 + Math.random() * 0.8, py = y + 0.1 + Math.random() * 0.8, pz = z + 0.1 + Math.random() * 0.8;
    spawnParticle({ x: px, y: py, z: pz, vx: (px - x - .5) * 3, vy: Math.random() * 3 + 1, vz: (pz - z - .5) * 3, life: 0.6 + Math.random() * 0.6, size: 0.12 + Math.random() * 0.08,
      u: (tu + Math.floor(Math.random() * 12)) / S.ATL, v: (tv + Math.floor(Math.random() * 12)) / S.ATL, r: tint[0] / 255 * light, g: tint[1] / 255 * light, b: tint[2] / 255 * light, grav: 1 });
  }
}
function simpleParticle(x, y, z, col, opts = {}) {
  const t = S.T.white_wool; // flat white tile, tinted by color
  spawnParticle({ x, y, z, vx: opts.vx || (Math.random() - .5), vy: opts.vy != null ? opts.vy : Math.random() * 1.5, vz: opts.vz || (Math.random() - .5), life: opts.life || 0.8, size: opts.size || 0.15,
    u: ((t % S.TPR) * 16 + 4) / S.ATL, v: (((t / S.TPR) | 0) * 16 + 4) / S.ATL, r: col[0], g: col[1], b: col[2], grav: opts.grav != null ? opts.grav : 0.3, c0: opts.fade ? col : null, fade: opts.fade || null, life0: opts.life || 0.8,
    frames: PSHEET.uv && opts.kind && PKINDS[opts.kind] ? PKINDS[opts.kind].map(n => PSHEET.uv[n]).filter(Boolean) : null });
  const p = parts[parts.length - 1]; if (p.frames && !p.frames.length) p.frames = null;
  if (p.frames) { p.size *= 1.3; if (opts.kind === 'splash' || opts.kind === 'portal') p.frames = [p.frames[(Math.random() * p.frames.length) | 0]]; // sprites have clear margins; random-sprite kinds pick one
    if (!['smoke', 'portal', 'effect', 'spell', 'explosion', 'big_smoke', 'spark'].includes(opts.kind)) { p.r = p.g = p.b = 1; if (opts.kind === 'note') { p.r = col[0]; p.g = col[1]; p.b = col[2]; } } } // most sprites carry their own colour
}
R.blockParticles = blockParticles; R.simpleParticle = simpleParticle;
function updateParticles(dt) {
  let n = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    if (p.fade) { const k = Math.min(1, Math.max(0, 1 - p.life / p.life0) * 1.6); p.r = p.c0[0] + (p.fade[0] - p.c0[0]) * k; p.g = p.c0[1] + (p.fade[1] - p.c0[1]) * k; p.b = p.c0[2] + (p.fade[2] - p.c0[2]) * k; } // firework fade: the colour shifts over its life
    p.vy -= 18 * p.grav * dt; p.vx *= 0.96; p.vz *= 0.96;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    if (p.grav && SOLID[getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; } else { p.x = nx; p.y = ny; p.z = nz; }
  }
  for (const p of parts) { if (p.frames) { const f = p.frames[Math.min(p.frames.length - 1, Math.floor((1 - p.life / p.life0) * p.frames.length))]; p.u = f[0]; p.v = f[1]; }
    pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z; pUV[n * 2] = p.u; pUV[n * 2 + 1] = p.v; pSize[n] = p.size; pCol[n * 3] = p.r; pCol[n * 3 + 1] = p.g; pCol[n * 3 + 2] = p.b; n++; }
  pGeo.setDrawRange(0, n);
  for (const k of ['position', 'puv', 'psize', 'pcol']) pGeo.attributes[k].needsUpdate = true;
}

// ---------- rain / snow (WorldRenderer.renderWeather: a textured quad per column around the camera, facing it) ----------
const WR = 10, WCOLS = (2 * WR + 1) ** 2;
function weatherCanvas(snow) { // drawn stand-ins until a jar/pack gives environment/rain.png and snow.png
  return pixelTex(64, 256, g => { const r = trng(snow ? 7 : 3); for (let i = 0; i < (snow ? 90 : 60); i++) { const x = r.int(64), y = r.int(256); g.fillStyle = snow ? 'rgba(255,255,255,.95)' : 'rgba(170,190,235,.8)'; if (snow) g.fillRect(x, y, 2, 2); else g.fillRect(x, y, 1, 10 + r.int(14)); } });
}
const rainTex = weatherCanvas(false), snowTex = weatherCanvas(true);
for (const t of [rainTex, snowTex]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
const wGeo = [false, true].map(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WCOLS * 12), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(WCOLS * 8), 2));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(WCOLS * 16), 4)); const idx = new Uint16Array(WCOLS * 6); for (let i = 0; i < WCOLS; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); g.setIndex(new THREE.BufferAttribute(idx, 1)); return g; });
const wMat = [rainTex, snowTex].map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: true, alphaTest: 0.01, fog: true }));
const wMesh = wGeo.map((g, i) => { const m = new THREE.Mesh(g, wMat[i]); m.frustumCulled = false; m.visible = false; m.renderOrder = 2; scene.add(m); return m; });
const rain = wMesh[0];
function applyPackWeather() {
  for (const [k, t] of [['env_rain', rainTex], ['env_snow', snowTex]]) { const c = entCanvas(k); if (c) { t.image = c; t.needsUpdate = true; } }
}
R.applyPackWeather = applyPackWeather;
const colTop = new Map(); let colTopT = 0;
function updateRain(dt, px, py, pz, amt) {
  wMesh[0].visible = wMesh[1].visible = false; if (amt <= 0.05) return;
  colTopT -= dt; if (colTopT < 0) { colTop.clear(); colTopT = 1; }
  const top = (x, z) => { const k = x * 4096 + z; let v = colTop.get(k); if (v === undefined) { v = topY(x, z); colTop.set(k, v); } return v; };
  const X = Math.floor(px), Z = Math.floor(pz), Y = Math.floor(py), ticks = W.time + (W.tickFrac || 0), n = [0, 0];
  for (let dz = -WR; dz <= WR; dz++) for (let dx = -WR; dx <= WR; dx++) {
    const x = X + dx, z = Z + dz, b = biomeAt(x, z), base = biomeBase(x, z);
    const temp = S.BIOMES[b][4]; if (temp > 0.95 || base === S.BIO.DESERT) continue; // no precipitation (deserts, savannas, badlands)
    const t = top(x, z) + 1, y0 = Math.max(t, Y - WR), y1 = Math.max(t, Y + WR); if (y0 >= y1) continue;
    const snow = temp - Math.max(0, t - 64) * 0.05 / 30 < 0.15, k = snow ? 1 : 0, i = n[k]++; // colder with height, as Biome.getTemperature
    const cx = x + 0.5 - px, cz = z + 0.5 - pz, d = Math.hypot(cx, cz) || 1, ox = cz / d * 0.5, oz = -cx / d * 0.5;
    const r = (x * x * 3121 + x * 45238971 ^ z * z * 418711 + z * 13761) & 31, P = wGeo[k].attributes.position.array, U = wGeo[k].attributes.uv.array, C = wGeo[k].attributes.color.array;
    let v0, du = 0;
    if (!snow) v0 = -((ticks + r) % 32 + (W.tickFrac || 0)) / 32 * (3 + (r & 7) / 8);
    else { v0 = -((ticks & 511) + (W.tickFrac || 0)) / 512; du = ((r * 7919) % 100) / 100 + ticks * 0.01 * ((r & 3) - 1.5) / 10; }
    const al = ((1 - (d * d) / (WR * WR)) * 0.5 + 0.5) * amt, wx = x + 0.5, wz = z + 0.5;
    P.set([wx - ox, y1, wz - oz, wx + ox, y1, wz + oz, wx + ox, y0, wz + oz, wx - ox, y0, wz - oz], i * 12);
    U.set([du, y1 * 0.25 + v0, du + 1, y1 * 0.25 + v0, du + 1, y0 * 0.25 + v0, du, y0 * 0.25 + v0], i * 8);
    for (let q = 0; q < 4; q++) C.set([1, 1, 1, al], i * 16 + q * 4);
    if (!snow && dx * dx + dz * dz < 25 && Math.random() < 0.004 * amt && t > Y - 6) simpleParticle(x + Math.random(), t + 0.05, z + Math.random(), [0.6, 0.7, 0.9], { kind: 'splash', size: 0.05, vy: 0.6, grav: 0.4, life: 0.35 }); // drops splashing on the ground
  }
  for (const k of [0, 1]) { const g = wGeo[k]; if (!n[k]) continue; wMesh[k].visible = true; g.setDrawRange(0, n[k] * 6); for (const a of ['position', 'uv', 'color']) g.attributes[a].needsUpdate = true; }
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
// block items as the world draws them: the block (both halves of a bed) meshed alone by the terrain mesher, so
// lecterns, beds, grindstones, end rods, beacons and every other shaped block look the same in the hand and the
// inventory as when placed. Fences, walls and panes keep their inventory shapes (arms out) from the boxes below.
let iconVol = null;
const BOX_ICON = id => DEFAULT_META[id] != null || /(_wall|_fence|_pane|iron_bars)$/.test(ITEMS[id] ? ITEMS[id].key : '');
function meshedBlockGeometry(id, meta, single) {
  const PA = S.PA, PW = S.PW;
  if (!iconVol) iconVol = { B: new Uint16Array(PA * S.PH), M: new Uint8Array(PA * S.PH), L: new Uint8Array(PA * S.PH).fill(0xf0), bio: new Uint8Array(PA).fill(2) };
  const { B, M, L, bio } = iconVol, put = [[8, 1, 8, meta]];
  if (id === S.BID.red_bed && !single) { put[0][3] = (meta & 0xf0) | 0; put.push([8, 1, 7, (meta & 0xf0) | 4]); } // foot, and the head one block north (DIRS[0])
  for (const [x, y, z, m] of put) { const i = S.pidx(x, y, z); B[i] = id; M[i] = m; }
  let r; try { r = S.meshChunk(B, M, L, bio, { fancy: true, smooth: false, h: 4 }); } catch (e) { r = null; }
  for (const [x, y, z] of put) { const i = S.pidx(x, y, z); B[i] = 0; M[i] = 0; }
  if (!r) return null;
  const pos = [], uv = [], shade = [], tintA = [], def = DEFAULT_TINT[S.TINT[id]];
  for (const d of [r.o, r.c, r.t]) for (let k = 0; k < d.idx.length; k++) {
    const v = d.idx[k];
    pos.push(d.pos[v * 3] / 16 - 1 - 8.5, d.pos[v * 3 + 1] / 16 - 1.5, d.pos[v * 3 + 2] / 16 - 1 - (put.length > 1 ? 8 : 8.5));
    uv.push(d.uv[v * 2] / 8192, d.uv[v * 2 + 1] / 8192); shade.push(d.lt[v * 4 + 2] / 255);
    const c = [d.col[v * 4], d.col[v * 4 + 1], d.col[v * 4 + 2]], tinted = c[0] < 250 || c[1] < 250 || c[2] < 250;
    tintA.push(...(tinted && def ? def : c).map(q => q / 255));
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1)); geo.setAttribute('tint', new THREE.Float32BufferAttribute(tintA, 3));
  if (put.length > 1) geo.userData.long = true;
  return geo;
}
function blockGeometry(iid) { // iid: an item id (variant items resolve to their block and meta)
  if (blockGeoCache[iid]) return blockGeoCache[iid];
  const it = ITEMS[iid], id = it && it.place != null && it.block ? it.place : iid, vmeta = it && it.vi ? it.vi << S.VSH[id] : 0;
  if (!BOX_ICON(id) && id !== S.BID.oak_door) { const g = meshedBlockGeometry(id, vmeta); if (g) return blockGeoCache[iid] = g; }
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
// the shield is a 3D model in Java (ShieldEntityModel: a 12x22x1 plate and a handle, drawn by the builtin item renderer
// with scale(1,-1,-1) from the item's corner), wearing entity/shield_base_nopattern
let shieldGeo = null, shieldTex = null;
function shieldMesh() {
  if (!shieldGeo) { const g = mergeGeos([boxGeo(12, 22, 1, 0, 0, -6, -11, -2, 0, 64, 64), boxGeo(2, 6, 6, 26, 0, -1, -3, -1, 0, 64, 64)]);
    g.applyMatrix4(new THREE.Matrix4().makeScale(1, -1, -1)); g.applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, -0.5, -0.5)); g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight'); shieldGeo = g; }
  if (!shieldTex) shieldTex = packTexture('shield_nopattern') || pixelTex(64, 64, g => { g.fillStyle = '#9c7b47'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 14, 1); });
  const m = new THREE.Mesh(shieldGeo, new THREE.MeshBasicMaterial({ map: shieldTex, alphaTest: 0.1, vertexColors: !!shieldGeo.attributes.color }));
  m.userData.isBlock = false; m.userData.shield = true; return m;
}
R.shieldMesh = shieldMesh;
function itemMesh(id) {
  if (id === IID.shield && typeof boxGeo === 'function') return shieldMesh();
  const d = ITEMS[id];
  const isBlock = d && d.block && !d.sprite;
  const m = new THREE.Mesh(isBlock ? blockGeometry(id) : itemGeometry(id), isBlock ? blockMaterial() : itemSpriteMatBase.clone());
  m.userData.isBlock = isBlock;
  return m;
}
// enchantment glint: an additive, scrolling layer over enchanted items and armour (misc/enchanted_item_glint.png once a jar/pack has it)
const glintTex = pixelTex(64, 64, g => { const r = trng(77); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const v = (Math.sin((x + y) * 0.2) * 0.5 + 0.5) * 0.6 + r() * 0.4; g.fillStyle = `rgba(${130 * v | 0},${60 * v | 0},${210 * v | 0},1)`; g.fillRect(x, y, 1, 1); } });
glintTex.wrapS = glintTex.wrapT = THREE.RepeatWrapping; glintTex.repeat.set(0.5, 0.5); glintTex.rotation = 0.17;
function glintMaterial(skinning) { return new THREE.MeshBasicMaterial({ map: glintTex, color: 0x8a64b4, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, depthFunc: THREE.LessEqualDepth, skinning: !!skinning, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
function addGlint(mesh) { const g = new THREE.Mesh(mesh.geometry, glintMaterial()); g.userData.glint = true; g.renderOrder = 3; mesh.add(g); return mesh; }
function applyPackGlint() { const c = entCanvas('glint'); if (c) { glintTex.image = c; glintTex.repeat.set(0.125, 0.125); glintTex.needsUpdate = true; const u = c.toDataURL(); document.documentElement.style.setProperty('--g-glint', `url(${u})`); document.body.classList.add('vglint'); } }
R.addGlint = addGlint; R.glintMaterial = glintMaterial; R.applyPackGlint = applyPackGlint;
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
    const head = /_(skull|head)$/.test(ITEMS[id].key), s = id === S.BID.oak_door ? 0.55 : mesh.geometry.userData.long ? 0.66 : head ? 1.6 : /_button$/.test(ITEMS[id].key) ? 2.2 : 1; /* buttons: Java's button_inventory model is drawn larger */ mesh.scale.set(s, s, s); mesh.position.y = head ? 0.25 * s : 0; // beds: template_bed's gui scale against a block's; heads: template_skull draws the head at full size
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

// ---------- first person hands (HeldItemRenderer: the skin's arm or the held item in each hand, with the vanilla matrices) ----------
const handScene = new THREE.Scene();
const handCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
// two hands: 0 the main hand, 1 the off hand; each keeps its own item, equip progress and transform
const HANDS = [0, 1].map(() => { const g = new THREE.Group(); g.matrixAutoUpdate = false; handScene.add(g); return { g, id: -1, mesh: null, equip: 1, arm: null }; });
let armMat = null;
R.hand = { swing: 0, equip: 1, eat: 0, bow: 0, spy: false, offSwing: 0 };
function setHandSkin() { // both arms and sleeves of the current skin, in vanilla model space
  for (const H of HANDS) if (H.arm) { H.g.remove(H.arm); H.arm = null; }
  if (armMat) armMat.dispose();
  const sk = skinChoice(), tex = packTexture(sk.tex) || packTexture('steve'), aw = sk.slim ? 3 : 4, py = (sk.slim ? 2.5 : 2) / 16;
  armMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.1 });
  const make = right => { // right arm: cuboid x -3 (slim -2) at pivot -5; left arm: x -1 at pivot 5
    const rx = right ? (sk.slim ? -2 : -3) : -1, [u, v, su, sv] = right ? [40, 16, 40, 32] : [32, 48, 48, 48];
    const flip = new THREE.Group(); flip.scale.set(-1, -1, 1); flip.position.set((right ? -5 : 5) / 16, py, 0);
    flip.add(new THREE.Mesh(boxGeo(aw, 12, 4, u, v, -(rx + aw), -10, -2, 0, 64, 64), armMat), new THREE.Mesh(boxGeo(aw, 12, 4, su, sv, -(rx + aw), -10, -2, 0.25, 64, 64), armMat));
    const g = new THREE.Group(); g.add(flip); return g;
  };
  HANDS.forEach((H, k) => { H.arm = make(k === 0 ? OPT.mainHand !== 'left' : OPT.mainHand === 'left'); H.arm.visible = false; H.g.add(H.arm); });
}
R.setHandSkin = setHandSkin;
const HM = new THREE.Matrix4(), HT = new THREE.Matrix4();
const hmul = m => HM.multiply(m);
const hT = (x, y, z) => hmul(HT.makeTranslation(x, y, z)), hX = d => hmul(HT.makeRotationX(d * Math.PI / 180)), hY = d => hmul(HT.makeRotationY(d * Math.PI / 180)), hZ = d => hmul(HT.makeRotationZ(d * Math.PI / 180));
// mainId / offId: what each hand holds (0 nothing, -1 hidden); active: the hand that is using or swinging (0 / 1)
function updateHand(dt, mainId, light, bobX, bobY, offId = 0, active = 0) {
  if (!armMat) setHandSkin();
  const h = R.hand, PI = Math.PI, right = OPT.mainHand !== 'left';
  [mainId, offId].forEach((id, k) => {
    const H = HANDS[k], gl = !!(h.glint && h.glint[k]);
    if (id !== H.id || gl !== !!H.gl) {
      if (H.mesh) { H.g.remove(H.mesh); H.mesh.material.dispose(); H.mesh = null; }
      if (id !== H.id) { H.equip = 0; if (k === 0) h.equip = 0; }
      H.id = id; H.gl = gl;
      if (id > 0) { H.mesh = itemMesh(id); if (gl) addGlint(H.mesh); H.mesh.matrixAutoUpdate = false; H.g.add(H.mesh); }
    }
    H.equip = Math.min(1, H.equip + dt * 6);
    const f = (k === 0) === right ? 1 : -1, act = k === active;
    const p = act && h.swing > 0 ? 1 - h.swing : 0, eq = 1 - H.equip, sp = Math.sqrt(p);
    // the main hand shows the arm when empty; the off hand shows nothing when empty (vanilla)
    H.arm.visible = k === 0 && id === 0 && !H.mesh; H.g.visible = !h.spy && (H.mesh || H.arm.visible);
    if (!H.g.visible) return;
    HM.identity(); hT(bobX, bobY, 0); // view bobbing
    if (!H.mesh) {
      armMat.color.setScalar(light);
      hT(f * (-0.3 * Math.sin(sp * PI) + 0.64000005), 0.4 * Math.sin(sp * PI * 2) - 0.6 - eq * 0.6, -0.4 * Math.sin(p * PI) - 0.71999997);
      hY(f * 45); hY(f * Math.sin(sp * PI) * 70); hZ(f * Math.sin(p * p * PI) * -20);
      hT(f * -1, 3.6, 3.5); hZ(f * 120); hX(200); hY(f * -135); hT(f * 5.6, 0, 0);
    } else {
      setMeshLight(H.mesh, light);
      if (act && h.eat > 0 && USE.kind === 'eat') { // applyEatOrDrinkTransformation
        const t = Math.max(0, 32 - USE.t), g = t / 32;
        if (g < 0.8) hT(0, Math.abs(Math.cos(t / 4 * PI) * 0.1), 0);
        const q = 1 - Math.pow(g, 27); hT(q * 0.6 * f, q * -0.5, 0); hY(f * q * 90); hX(q * 10); hZ(f * q * 30);
        hT(f * 0.56, -0.52 - eq * 0.6, -0.72);
      } else if (act && h.bow > 0 && USE.kind === 'bow') { // drawing a bow
        hT(f * 0.56, -0.52 - eq * 0.6, -0.72);
        hT(f * -0.2785682, 0.18344387, 0.15731531); hX(-13.935); hY(f * 35.3); hZ(f * -9.785);
        let m = USE.t / 20; m = Math.min(1, (m * m + m * 2) / 3);
        if (m > 0.1) hT(0, Math.sin((USE.t - 0.1) * 1.3) * (m - 0.1) * 0.004, 0);
        hT(0, 0, m * 0.04); hmul(HT.makeScale(1, 1, 1 + m * 0.2)); hY(f * -45);
      } else {
        hT(f * -0.4 * Math.sin(sp * PI), 0.2 * Math.sin(sp * PI * 2), -0.2 * Math.sin(p * PI));
        hT(f * 0.56, -0.52 - eq * 0.6, -0.72);
        hY(f * (45 + Math.sin(p * p * PI) * -20)); const g = Math.sin(sp * PI); hZ(f * g * -20); hX(g * -80); hY(f * -45);
      }
      // the item model's first-person display transform, mirrored for the left hand like Transformation.apply(leftHanded)
      if (H.mesh.userData.shield) { const L = f < 0; hT(f * (L ? 10 : -10) / 16, (L ? 0 : 2) / 16, -10 / 16); hY(f * 180); hZ(f * 5); hmul(HT.makeScale(1.25, 1.25, 1.25)); } // shield.json firstperson_*hand
      else if (H.mesh.userData.isBlock) { hY(f > 0 ? 45 : -225); hmul(HT.makeScale(0.4, 0.4, 0.4)); }
      else { hT(f * 1.13 / 16, 3.2 / 16, 1.13 / 16); hY(f * -90); hZ(f * 25); hmul(HT.makeScale(0.68, 0.68, 0.68)); }
      H.mesh.matrix.identity();
    }
    H.g.matrix.copy(HM);
  });
}
R.updateHand = updateHand;

// ---------- frame ----------
const SKY_DAY = new THREE.Color(0x78a7ff), FOG_DAY = new THREE.Color(0xc0d8ff), SKY_NIGHT = new THREE.Color(0x000000), FOG_NIGHT = new THREE.Color(0x0a0c14);
const DUSK = new THREE.Color(0xff8a3a), WATER_FOG = new THREE.Color(0x0b2a6a), LAVA_FOG = new THREE.Color(0xc04a10), RAIN_SKY = new THREE.Color(0x5a6470);
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), fogCol = new THREE.Color(), sunDir = new THREE.Vector3(), lookV = new THREE.Vector3(); // reused every frame (no GC churn)
R.rd = 6; R.fov = 70; R.fovMul = 1;
// chunks wholly past the fog end are drawn as plain fog colour anyway: skip their draw calls and triangles
function fogCull() {
  const cx = camera.position.x, cz = camera.position.z, lim = (fog.far + 1) ** 2;
  for (const c of W.chunks.values()) { if (!c.mesh) continue; const x0 = c.cx * 16, z0 = c.cz * 16, dx = cx < x0 ? x0 - cx : cx > x0 + 16 ? cx - x0 - 16 : 0, dz = cz < z0 ? z0 - cz : cz > z0 + 16 ? cz - z0 - 16 : 0, v = dx * dx + dz * dz <= lim;
    for (const k of ['o', 'c', 't']) if (c.mesh[k]) c.mesh[k].visible = v; }
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(R.basePR * R.pixelScale); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix(); handCam.aspect = w / h; handCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
R.resize = resize;
const NETHER_FOG = { 13: new THREE.Color(0x330808), 14: new THREE.Color(0x330303), 15: new THREE.Color(0x1a051a), 16: new THREE.Color(0x1b4745), 17: new THREE.Color(0x685f70) };
const FLASH_SKY = new THREE.Color(0xdde4ff);
// night vision lifts the darkness (and flickers in its last 10 seconds, like Java)
const nightVision = () => { const e = PL.eff && (PL.eff.night_vision || (PL.eff.conduit_power && PL.eyeFluid === 1 && PL.eff.conduit_power)); if (!e) return 0.035; return e.t > 200 || Math.sin(e.t * 0.3) > 0 ? 0.8 : 0.035; };
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
  if (W.thunder > 0) { tmpC.multiplyScalar(1 - W.thunder * 0.35); tmpC2.multiplyScalar(1 - W.thunder * 0.35); }
  if (W.flash > 0) { tmpC.lerp(FLASH_SKY, W.flash * 0.7); tmpC2.lerp(FLASH_SKY, W.flash * 0.7); }
  const duskAmt = Math.max(0, 1 - Math.abs(sunDir.y) * 3.2) * (1 - W.rain);
  skyMat.uniforms.top.value.copy(tmpC); skyMat.uniforms.bottom.value.copy(tmpC2);
  skyMat.uniforms.glow.value.copy(DUSK); skyMat.uniforms.glowAmt.value = duskAmt * 0.85; skyMat.uniforms.glowDir.value.set(sunDir.x > 0 ? 1 : -1, 0, 0);
  fogCol.copy(tmpC2); if (duskAmt > 0) { lookV.set(0, 0, -1).applyEuler(camera.rotation); const f = Math.max(0, lookV.x * (sunDir.x > 0 ? 1 : -1)); fogCol.lerp(DUSK, duskAmt * f * 0.5); }
  const rd = R.rd * 16;
  if (under === 'water') { fog.color.copy(WATER_FOG).multiplyScalar(0.3 + day * 0.7); fog.near = 1; fog.far = 32; }
  else if (under === 'lava') { fog.color.copy(LAVA_FOG); fog.near = 0.1; fog.far = 2; }
  else if (under === 'snow') { fog.color.setRGB(0.85, 0.9, 0.95); fog.near = 0; fog.far = 2; }
  else { const end = rd - 12; fog.color.copy(fogCol); fog.near = end * (W.rain > 0.5 ? 0.35 : 0.75); fog.far = end * (W.rain > 0.5 ? 0.85 : 1.0); } // ends inside the loaded chunks, wherever the eye stands in its own chunk
  if (effLv(PL, 'blindness')) { fog.color.setRGB(0, 0, 0); fog.near = 1; fog.far = 6; } // blindness: thick black fog
  renderer.setClearColor(fog.color); fogCull();
  sky.visible = !under; sky.position.copy(camera.position);
  sun.position.copy(camera.position).addScaledVector(sunDir, 300); sun.lookAt(camera.position);
  moon.position.copy(camera.position).addScaledVector(sunDir, -300); moon.lookAt(camera.position);
  sun.material.opacity = moon.material.opacity = 1 - W.rain;
  stars.position.copy(camera.position); starMat.opacity = Math.max(0, 1 - day * 1.6) * (1 - W.rain); stars.rotation.z = ang;
  clouds.visible = R.cloudsOn && !under; clouds.position.set(camera.position.x, 192.33, camera.position.z); // 1.18 cloud height
  cloudTex.offset.set((camera.position.x / 768) * cloudTex.repeat.x + (W.time + (W.tickFrac || 0)) * 0.03 / 768 * cloudTex.repeat.x, (-camera.position.z / 768) * cloudTex.repeat.y); // clouds drift 0.03 blocks a tick, like Java
  { const tg = performance.now() / 1000; glintTex.offset.set((tg * 0.125) % 1, (tg * 0.0625) % 1); } // ~8 s per pass like Java
  if (R.moonPhases) { const ph = Math.floor(W.time / 24000) % 8; moonTex.offset.set((ph % 4) / 4, ph < 4 ? 0.5 : 0); }
  cloudMat.color.setScalar(0.2 + 0.8 * day); cloudMat.opacity = 0.8 * (1 - W.rain * 0.3);
  // lighting uniforms
  const skyF = Math.max(0.18 + 0.82 * day, (W.flash || 0) * 0.9); // a lightning flash lights up the world for a moment
  for (const m of [matOpaque, matCutout, matTrans]) { m.uniforms.uMin.value = nightVision(); m.uniforms.uSky.value = skyF; m.uniforms.uSkyCol.value.setRGB(0.92 + 0.08 * day, 0.92 + 0.08 * day, 1); m.uniforms.uFlick.value = 0.95 + 0.04 * Math.sin(performance.now() * 0.01) * Math.sin(performance.now() * 0.0237); m.uniforms.uGamma.value = R.gamma; }
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
  else if (nether) { fog.color.copy(netherFog); fog.near = Math.min(rd - 12, 96) * 0.05; fog.far = Math.min(rd - 12, 96) * 0.9; }
  else { fog.color.copy(END_SKY); fog.near = (rd - 12) * 0.5; fog.far = rd - 12; stars.position.copy(camera.position); starMat.opacity = 0.35; }
  renderer.setClearColor(fog.color); fogCull();
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

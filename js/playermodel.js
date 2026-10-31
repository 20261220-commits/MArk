// The player as Java Edition draws it: the player model (classic 4-pixel or slim 3-pixel arms) with the skin's
// outer layer, armour from the armour textures, the elytra, items in both hands, the vanilla poses
// (walking, sneaking, swinging, aiming, blocking, riding, swimming, gliding, sleeping, dying), the
// first-person arm made from the skin, and the little figure in the inventory that follows the mouse.
const FLIP3 = new THREE.Matrix4().makeScale(-1, -1, 1); // vanilla model space <-> this engine's flipped model space
const DEG = Math.PI / 180;
const PLAYER_PARTS = slim => { const aw = slim ? 3 : 4, ay = slim ? 2.5 : 2, rx = slim ? -2 : -3; return [
  { n: 'head', o: [0, 0, 0], b: [[0, 0, -4, -8, -4, 8, 8, 8], [32, 0, -4, -8, -4, 8, 8, 8, 0.5]] },
  { n: 'body', o: [0, 0, 0], b: [[16, 16, -4, 0, -2, 8, 12, 4], [16, 32, -4, 0, -2, 8, 12, 4, 0.25]] },
  { n: 'rarm', o: [-5, ay, 0], b: [[40, 16, rx, -2, -2, aw, 12, 4], [40, 32, rx, -2, -2, aw, 12, 4, 0.25]] },
  { n: 'larm', o: [5, ay, 0], b: [[32, 48, -1, -2, -2, aw, 12, 4], [48, 48, -1, -2, -2, aw, 12, 4, 0.25]] },
  { n: 'rleg', o: [-1.9, 12, 0], b: [[0, 16, -2, 0, -2, 4, 12, 4], [0, 32, -2, 0, -2, 4, 12, 4, 0.25]] },
  { n: 'lleg', o: [1.9, 12, 0], b: [[16, 48, -2, 0, -2, 4, 12, 4], [0, 48, -2, 0, -2, 4, 12, 4, 0.25]] },
  // elytra wings (second texture), children of the body like ElytraFeatureRenderer (0.125 behind the back)
  { n: 'lwing', p: 'body', o: [5, 0, 2], r: [0.2617994, 0, -0.2617994], t: 1, b: [[22, 0, -10, 0, 0, 10, 20, 2, 1]] },
  { n: 'rwing', p: 'body', o: [-5, 0, 2], r: [0.2617994, 0, 0.2617994], t: 1, b: [[22, 0, 0, 0, 0, 10, 20, 2, 1, 1]] },
  // the cape's bone (its box is drawn with the cape's own texture: capeGeo)
  { n: 'cape', p: 'body', o: [0, 0, 2], r: [0.1047198, Math.PI, 0], b: [] }]; };
MCMODELS.player = { tex: 'steve', tex2: 'elytra', tw: 64, th: 64, parts: PLAYER_PARTS(false) };
MCMODELS.player_slim = { tex: 'alex', tex2: 'elytra', tw: 64, th: 64, parts: PLAYER_PARTS(true) };
// armour pieces per slot (head, chest, legs, feet): [texture layer, dilation, visible parts] as the vanilla biped armour models
const PARMOR_SLOT = [[1, 1, ['head', 'hat']], [1, 1, ['body', 'rarm', 'larm']], [2, 0.5, ['body', 'rleg', 'lleg']], [1, 1, ['rleg', 'lleg']]];
const PARMOR_BOX = { head: [0, 0, -4, -8, -4, 8, 8, 8], hat: [32, 0, -4, -8, -4, 8, 8, 8], body: [16, 16, -4, 0, -2, 8, 12, 4], rarm: [40, 16, -3, -2, -2, 4, 12, 4], larm: [40, 16, -1, -2, -2, 4, 12, 4, 0, 1], rleg: [0, 16, -2, 0, -2, 4, 12, 4], lleg: [0, 16, -2, 0, -2, 4, 12, 4, 0, 1] };
const PARMOR_TEX = { leather: 'leather', chainmail: 'chainmail', iron: 'iron', golden: 'gold', diamond: 'diamond', netherite: 'netherite', turtle: 'turtle' };
function armorGeo(slim, slot) {
  const [layer, dil, vis] = PARMOR_SLOT[slot], key = 'parmor' + (slim ? 's' : 'c') + slot;
  const base = PLAYER_PARTS(slim), parts = base.map(p => {
    const boxes = [];
    for (const v of vis) { const bone = v === 'hat' ? 'head' : v; if (bone !== p.n) continue; const b = PARMOR_BOX[v].slice(); b[8] = dil + (v === 'hat' ? 0.5 : 0); boxes.push(b); }
    return { ...p, t: 0, b: boxes };
  });
  return mcModelGeos(key, { tw: 64, th: 32, parts }).m;
}
// CapeModel: one 10x16x1 box from the top of the back, on a 64x32 cape texture
function capeGeo(slim) { return mcModelGeos('pcape' + (slim ? 's' : 'c'), { tw: 64, th: 32, parts: PLAYER_PARTS(slim).map(p => ({ ...p, t: 0, b: p.n === 'cape' ? [[0, 0, -5, 0, -1, 10, 16, 1]] : [] })) }).m; }

// ---------- skins ----------
// Steve or Alex from the resource pack, or the player's own skins (kept in this browser only): several can be kept and
// switched between, each with its arm width (found from the picture, or set by hand), and Java's Skin Customization
// switches turn the outer layers (hat, jacket, sleeves, trouser legs) on and off
const SKIN_KEY = 'nemo-mc-117-skin', SKIN_LIB_KEY = 'nemo-skins', SKIN_LIB_MAX = 9;
const PSKIN = { slim: false, ready: false };
// the outer layer's areas on a 64x64 skin: [x, y, w, h]
const SKIN_LAYERS = { hat: [[32, 0, 32, 16]], jacket: [[16, 32, 24, 16]], rsleeve: [[40, 32, 16, 16]], lsleeve: [[48, 48, 16, 16]], rpants: [[0, 32, 16, 16]], lpants: [[0, 48, 16, 16]] };
const SKIN_LAYER_NAME = { cape: '망토', hat: '모자', jacket: '상의', lsleeve: '왼쪽 소매', rsleeve: '오른쪽 소매', lpants: '왼쪽 바지', rpants: '오른쪽 바지' };
// the worn skin's cape (a Mojang cape from the account, or a cape picture), as the pack texture self_cape
function capeLoad(data, done) {
  delete PACKPX.ent.self_cape; delete entTex.self_cape; if (!data) { done(); return; }
  const img = new Image(); img.onload = () => { const w = img.width, h = img.height; if (!(w === 64 && h === 32) && !(w === 64 && h === 64) && !(w % 64 === 0 && h * 2 === w)) { done(); return; } // 64x32 (some sites: 64x64, or bigger)
    const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, w, h === w ? h / 2 : h, 0, 0, 64, 32);
    PACKPX.ent.self_cape = { px: new Uint8Array(g.getImageData(0, 0, 64, 32).data.buffer), w: 64, h: 32 }; done(); };
  img.onerror = () => done(); img.src = data;
}
const skinCapeKey = () => typeof OPT !== 'undefined' && OPT.skin === 'custom' && PACKPX.ent.self_cape && skinLayerOn('cape') ? 'self_cape' : null;
const skinLayerOn = k => !(typeof OPT !== 'undefined' && OPT.skinOff && OPT.skinOff[k]);
function skinPixels(img) { // 64x64, or an old 64x32 skin with its arm and leg copied over for the left side (as Java does)
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  if (img.height === 32) {
    const flip = (sx, sy, w, h, dx, dy) => { g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(c, sx, sy, w, h, 0, 0, w, h); g.restore(); };
    for (const [ox, oy, dx, dy] of [[0, 16, 16, 48], [40, 16, 32, 48]]) { // leg, arm -> left leg, left arm (faces mirrored)
      flip(ox + 4, oy, 4, 4, dx + 4, dy); flip(ox + 8, oy, 4, 4, dx + 8, dy); // top, bottom
      flip(ox + 8, oy + 4, 4, 12, dx, dy + 4); flip(ox + 4, oy + 4, 4, 12, dx + 4, dy + 4); flip(ox, oy + 4, 4, 12, dx + 8, dy + 4); flip(ox + 12, oy + 4, 4, 12, dx + 12, dy + 4);
    }
  }
  return g.getImageData(0, 0, 64, 64).data;
}
// PlayerSkinTexture's clean-up: the inner layer is never see-through; an old 64x32 skin whose hat layer is solid all over
// (the "Notch transparency hack") has no hat; then the outer layers switched off in the options are cleared
function skinFinish(px, legacy) {
  const solid = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px[(y * 64 + x) * 4 + 3] = 255; };
  const clear = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px[(y * 64 + x) * 4 + 3] = 0; };
  solid(0, 0, 32, 16); solid(0, 16, 64, 32); solid(16, 48, 48, 64);
  if (legacy) { let see = false; for (let y = 0; y < 32 && !see; y++) for (let x = 32; x < 64; x++) if (px[(y * 64 + x) * 4 + 3] < 128) { see = true; break; } if (!see) clear(32, 0, 32, 16); }
  for (const k in SKIN_LAYERS) if (!skinLayerOn(k)) for (const r of SKIN_LAYERS[k]) clear(...r);
  return px;
}
const skinIsSlim = px => px[(20 * 64 + 54) * 4 + 3] === 0; // slim skins leave the 4th arm column empty
// the saved skins: [{ name, data, slim, auto }] and which one is worn (the worn one is also kept under SKIN_KEY)
function skinLib() { let l = null; try { l = JSON.parse(localStorage.getItem(SKIN_LIB_KEY) || 'null'); } catch (e) {}
  if (!Array.isArray(l)) { l = []; try { const r = JSON.parse(localStorage.getItem(SKIN_KEY) || 'null'); if (r && r.data) l.push({ name: '내 스킨', data: r.data, slim: !!r.slim, auto: true }); } catch (e) {} } // (from before there was a list)
  return l.filter(e => e && typeof e.data === 'string'); }
function skinLibSave(l) { try { localStorage.setItem(SKIN_LIB_KEY, JSON.stringify(l.slice(0, SKIN_LIB_MAX))); return true; } catch (e) { UI.flash('저장 공간이 부족해 스킨을 저장하지 못했어요 (안 쓰는 스킨을 지워 보세요)'); return false; } }
function skinWear(i) { const l = skinLib(), e = l[i]; if (!e) return false;
  try { localStorage.setItem(SKIN_KEY, JSON.stringify({ data: e.data, slim: !!e.slim, cape: e.cape || null })); } catch (er) { UI.flash('스킨을 저장하지 못했어요'); return false; }
  OPT.skin = 'custom'; OPT.skinIdx = i; saveOpt(); loadCustomSkin(() => { rebuildPlayer(); if (UI.menu === 'skins' || UI.menu === 'options') showMenu(UI.menu); if (typeof mpSkinChanged === 'function') mpSkinChanged(); }); return true; }
function loadCustomSkin(done) {
  let rec = null; try { rec = JSON.parse(localStorage.getItem(SKIN_KEY) || 'null'); } catch (e) {}
  if (!rec || !rec.data) { done(false); return; }
  const img = new Image(); img.onload = () => { if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) { done(false); return; } PACKPX.ent.custom_skin = { px: new Uint8Array(skinFinish(skinPixels(img), img.height === 32).buffer.slice(0)), w: 64, h: 64 }; delete entTex.custom_skin; PSKIN.customSlim = !!rec.slim; capeLoad(rec.cape, () => done(true)); }; img.onerror = () => done(false); img.src = rec.data;
}
// a new skin picture (a file, a dropped file, a pasted picture, an account's skin, a site's picture): any image the browser
// reads (PNG, JPEG, WebP, GIF, BMP), made into a 64x64 or 64x32 PNG; bigger "HD" skins are scaled down; a picture with no
// transparency at all (a JPEG, or a PNG saved over a background) has its background colour cleared from the unused parts
// and the outer layer, where it would otherwise cover the face and body. opts: { slim (from the account), cape (data) }
function skinNormalize(img) {
  const w = img.width, h = img.height, tall = w === h, ok = w >= 64 && w % 64 === 0 && (tall || h * 2 === w); if (!ok) return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = tall ? 64 : 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, w, h, 0, 0, 64, c.height);
  const d = g.getImageData(0, 0, 64, c.height), px = d.data; let opaque = true; for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { opaque = false; break; }
  if (opaque) { const bg = [px[0], px[1], px[2]], near = i => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) < 24;
    const areas = [[0, 0, 8, 8], [24, 0, 16, 8], [56, 0, 8, 8], [0, 16, 4, 4], [12, 16, 8, 4], [36, 16, 8, 4], [52, 16, 4, 4], ...Object.values(SKIN_LAYERS).flat()].filter(r => r[1] + r[3] <= c.height);
    for (const [x0, y0, aw, ah] of areas) for (let y = y0; y < y0 + ah; y++) for (let x = x0; x < x0 + aw; x++) { const i = (y * 64 + x) * 4; if (near(i)) px[i + 3] = 0; }
    g.putImageData(d, 0, 0); }
  return c;
}
function skinAdd(img, data, name, opts = {}) {
  const c = skinNormalize(img); if (!c) { UI.flash('스킨 그림이 아니에요 (가로 64×세로 64 또는 64×32, 그 배수 크기의 그림이 필요해요)'); return; }
  data = c.toDataURL('image/png'); const auto = opts.slim == null, slim = auto ? c.height === 64 && skinIsSlim(c.getContext('2d').getImageData(0, 0, 64, 64).data) : !!opts.slim;
  const l = skinLib().filter(e => e.data !== data);
  l.unshift({ name: String(name || '내 스킨').slice(0, 20), data, slim, auto, cape: opts.cape || null }); if (l.length > SKIN_LIB_MAX) l.length = SKIN_LIB_MAX;
  if (!skinLibSave(l)) return;
  if (skinWear(0)) UI.flash(`${name || '내 스킨'} — ${slim ? '얇은 팔' : '기본 팔'}${opts.cape ? ' · 망토' : ''}${auto ? ' (팔 모양은 스킨 화면에서 바꿀 수 있어요)' : ''}`);
}
function skinFromDataUrl(data, name, opts) { const img = new Image(); img.onload = () => skinAdd(img, data, name, opts); img.onerror = () => UI.flash('그림을 읽지 못했어요'); img.src = data; }
// the game server's address for /skin and /profile (the multiplayer server this game offers)
function skinServer(path, q) { try { const a = typeof mpDefaultAddr === 'function' && mpDefaultAddr(); if (!a) return null; const u = new URL(mpRoomsUrl(a)); u.pathname = path; u.search = q; return u.href; } catch (e) { return null; } }
// any picture address -> a data: URL, straight from the site when it allows that, else through the game server
async function imageData(url) {
  const sniff = b => b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x47 && b[1] === 0x49 ? 'image/gif' : b[0] === 0x42 && b[1] === 0x4d ? 'image/bmp' : b[0] === 0x52 && b[8] === 0x57 ? 'image/webp' : null;
  for (const t of [url, skinServer('/skin', '?u=' + encodeURIComponent(url))].filter(Boolean)) {
    try { const r = await fetch(t, { cache: 'no-store' }); if (!r.ok) continue; const blob = await r.blob(), type = sniff(new Uint8Array(await blob.slice(0, 12).arrayBuffer())); if (!type) continue;
      return await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).replace(/^data:[^;,]*/, 'data:' + type)); rd.onerror = rej; rd.readAsDataURL(blob); }); } catch (e) {}
  }
  return null;
}
// a Java Edition account by its name, as the game itself gets a player's look: Mojang's profile gives the skin, its arm
// model and the cape (through the game server, which asks Mojang); without the server, mc-heads.net's copy of the skin
async function skinFromName(name) {
  UI.flash(name + '의 스킨을 찾는 중...');
  const pu = skinServer('/profile', '?name=' + encodeURIComponent(name));
  if (pu) { try { const r = await fetch(pu, { cache: 'no-store' });
    if (r.status === 404) { UI.flash('그런 자바 에디션 계정이 없어요: ' + name); return; }
    if (r.ok) { const p = await r.json(), skin = p.skin && await imageData(p.skin), cape = p.cape && await imageData(p.cape);
      if (skin) { skinFromDataUrl(skin, p.name || name, { slim: !!p.slim, cape: cape || null }); return; }
      if (!p.skin) { skinFromDataUrl(await steveAlexData(p.slim), p.name || name, { slim: !!p.slim, cape: cape || null }); return; } } } catch (e) {} } // (an account with no skin of its own: the default one)
  const d = await imageData('https://mc-heads.net/skin/' + encodeURIComponent(name));
  if (d) skinFromDataUrl(d, name); else UI.flash('스킨을 찾지 못했어요 (닉네임·인터넷 연결 확인)');
}
const steveAlexData = slim => { const c = typeof entCanvas === 'function' && entCanvas(slim ? 'alex' : 'steve'); return c ? c.toDataURL('image/png') : null; };
function skinFromUrl(url, label) { imageData(url).then(d => d ? skinFromDataUrl(d, label) : UI.flash('스킨을 찾지 못했어요 (닉네임·인터넷 연결 확인)')); }
// a skin from elsewhere: a Java player's name, a skin page on NameMC or The Skindex, Mojang's texture address, any picture
// address (the game server looks through any other skin site's page for its skin picture), or a data: picture
const SKIN_PAGES = [
  [/^https?:\/\/(?:[a-z]+\.)?namemc\.com\/skin\/([0-9a-f]{16})/i, m => 'https://s.namemc.com/i/' + m[1] + '.png'],
  [/^https?:\/\/(?:[a-z]+\.)?namemc\.com\/profile\/([A-Za-z0-9_]{3,16})/i, m => 'https://mc-heads.net/skin/' + m[1], m => m[1], m => m[1]],
  [/^https?:\/\/(?:www\.)?minecraftskins\.com\/skin\/(\d+)\/([^/?#]*)/i, m => 'https://www.minecraftskins.com/skin/download/' + m[1], m => decodeURIComponent(m[2] || '').replace(/-/g, ' ')],
  [/^https?:\/\/textures\.minecraft\.net\/texture\/([0-9a-f]+)/i, m => 'https://textures.minecraft.net/texture/' + m[1]],
];
function skinFromAny(text) {
  text = String(text || '').trim(); if (!text) { UI.flash('닉네임이나 스킨 주소를 넣어 주세요'); return; }
  if (/^data:image\//.test(text)) { skinFromDataUrl(text, '붙여 넣은 스킨'); return; }
  if (/^[A-Za-z0-9_]{1,16}$/.test(text)) { skinFromName(text); return; }
  if (!/^https?:\/\//i.test(text)) { UI.flash('자바 닉네임(영문·숫자·_ 16자까지)이나 http로 시작하는 주소를 넣어 주세요'); return; }
  let url = text, name = null;
  for (const [re, to, nm, acct] of SKIN_PAGES) { const m = text.match(re); if (m) { if (acct) { skinFromName(acct(m)); return; } url = to(m); name = nm ? nm(m) : null; break; } }
  if (!name) { try { name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '').replace(/\.(png|jpe?g|webp|gif|bmp)$/i, '').slice(0, 20) || null; } catch (e) {} }
  UI.flash('스킨을 가져오는 중...');
  imageData(url).then(d => d ? skinFromDataUrl(d, name || '가져온 스킨') : UI.flash('스킨을 가져오지 못했어요 — 그림을 내려받아 파일로 고르거나 끌어다 놓아 주세요'));
}
// a cape picture by hand for the worn skin (64x32, as Mojang's capes)
function capeFromFile(f) { if (!f || !/^image\//.test(f.type || 'image/')) return; const rd = new FileReader(); rd.onload = () => capeSet(rd.result); rd.readAsDataURL(f); }
function capeSet(data) { const l = skinLib(), i = Math.max(0, Math.min(l.length - 1, OPT.skinIdx || 0)); if (!l[i]) { UI.flash('먼저 내 스킨을 입어 주세요'); return; }
  if (!data) { l[i].cape = null; if (skinLibSave(l)) skinWear(i); return; }
  const img = new Image(); img.onload = () => { if (!(img.width % 64 === 0 && (img.height * 2 === img.width || img.height === img.width))) { UI.flash('망토 그림은 64×32 크기여야 해요'); return; } l[i].cape = data; if (skinLibSave(l)) { skinWear(i); UI.flash('망토를 달았어요'); } }; img.src = data; }
function pickCapeFile() { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => capeFromFile(inp.files[0]); inp.click(); }
function skinFromFile(f) { if (!f || !/^image\//.test(f.type || (/\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name) ? 'image/' : ''))) { UI.flash('스킨 그림 파일이 필요해요 (PNG·JPG·WEBP 등)'); return; } const rd = new FileReader(); rd.onload = () => skinFromDataUrl(rd.result, (f.name || '붙여 넣은 스킨').replace(/\.(png|jpe?g|webp|gif|bmp)$/i, '') || '붙여 넣은 스킨'); rd.readAsDataURL(f); }
function pickSkinFile() { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => skinFromFile(inp.files[0]); inp.click(); }
// a skin file dropped anywhere on the skins screen
addEventListener('dragover', e => { if (typeof UI !== 'undefined' && UI.menu === 'skins') e.preventDefault(); });
// pasting on the skins screen: a copied picture, or a copied address or name
addEventListener('paste', e => {
  if (typeof UI === 'undefined' || UI.menu !== 'skins') return;
  const items = [...((e.clipboardData && e.clipboardData.items) || [])], img = items.find(i => i.kind === 'file' && /^image\//.test(i.type));
  if (img) { e.preventDefault(); skinFromFile(img.getAsFile()); return; }
  const inp = document.getElementById('skinNick'); if (document.activeElement === inp) return; // typed into the box: the button takes it
  const t = e.clipboardData && e.clipboardData.getData('text'); if (t && t.trim()) { e.preventDefault(); skinFromAny(t); }
});
addEventListener('drop', e => { if (typeof UI === 'undefined' || UI.menu !== 'skins') return; e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) skinFromFile(f); });
// the worn skin's arm width by hand (null: as found in the picture)
function skinSetArms(slim) { const l = skinLib(), i = Math.max(0, Math.min(l.length - 1, OPT.skinIdx || 0)), e = l[i]; if (!e) return;
  e.auto = slim == null; if (slim == null) { const img = new Image(); img.onload = () => { e.slim = img.height === 64 && skinIsSlim(skinPixels(img)); if (skinLibSave(l)) skinWear(i); }; img.src = e.data; return; }
  e.slim = slim; if (skinLibSave(l)) skinWear(i); }
function skinDelete(i) { const l = skinLib(); if (!l[i]) return; l.splice(i, 1); skinLibSave(l);
  if ((OPT.skinIdx || 0) === i || !l.length) { if (l.length) skinWear(0); else { try { localStorage.removeItem(SKIN_KEY); } catch (e) {} OPT.skin = 'steve'; OPT.skinIdx = 0; saveOpt(); rebuildPlayer(); if (typeof mpSkinChanged === 'function') mpSkinChanged(); showMenu('skins'); } }
  else { if ((OPT.skinIdx || 0) > i) { OPT.skinIdx--; saveOpt(); } showMenu('skins'); } }
function skinToggleLayer(k) { OPT.skinOff = { ...(OPT.skinOff || {}) }; if (OPT.skinOff[k]) delete OPT.skinOff[k]; else OPT.skinOff[k] = 1; saveOpt();
  const go = () => { rebuildPlayer(); showMenu('skins'); if (typeof mpSkinChanged === 'function') mpSkinChanged(); };
  skinPackLayers(); if (OPT.skin === 'custom') loadCustomSkin(go); else go(); }
// Steve and Alex follow the layer switches too: a copy of their pack texture for this player alone (self_steve, self_alex),
// with the switched-off layers cleared (other players and mobs keep the pack's own)
function skinPackLayers() { for (const k of ['steve', 'alex']) { const src = PACKPX.ent[k]; if (!src || !src.px) continue;
  const px = new Uint8Array(src.px); for (const l in SKIN_LAYERS) if (!skinLayerOn(l)) for (const [x0, y0, w, h] of SKIN_LAYERS[l]) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px[(y * 64 + x) * 4 + 3] = 0;
  PACKPX.ent['self_' + k] = { ...src, px }; delete entTex['self_' + k]; } }
const skinLayersOff = () => typeof OPT !== 'undefined' && OPT.skinOff && Object.keys(OPT.skinOff).length > 0;
const skinChoice = () => { const s = (typeof OPT !== 'undefined' && OPT.skin) || 'steve'; if (s === 'custom' && PACKPX.ent.custom_skin) return { tex: 'custom_skin', slim: !!PSKIN.customSlim }; const base = s === 'alex' && PACKPX.ent.alex ? 'alex' : 'steve'; if (skinLayersOff()) { if (!PACKPX.ent['self_' + base]) skinPackLayers(); if (PACKPX.ent['self_' + base]) return { tex: 'self_' + base, slim: base === 'alex' }; } return { tex: base, slim: base === 'alex' }; };

// ---------- the model ----------
const PLM = { model: null, doll: null };
function makePlayerModel() {
  if (skinLayersOff()) skinPackLayers(); // (fresh from the pack, in case it changed)
  const sk = skinChoice(), m = buildModel(sk.slim ? 'player_slim' : 'player', { skin: sk.tex }); m.userData.capeTex = skinCapeKey();
  m.userData.slim = sk.slim; m.userData.armorKey = ''; m.userData.armor = []; m.userData.heldKey = ['', '']; m.userData.held = [null, null];
  if (m.userData.mat2) m.userData.mat2.visible = false;
  m.userData.st = { bodyYaw: NaN, limb: 0, limbD: 0, wingP: 0.2617994, wingR: -0.2617994, wingY: 0, wingPy: 0, lean: 0, deathT: 0 };
  return m;
}
function rebuildPlayer() {
  const old = PLM.model, vis = old ? old.visible : false;
  if (old) { scene.remove(old); for (const a of old.userData.armor) a.material.dispose(); }
  PLM.model = makePlayerModel(); PLM.model.visible = vis; scene.add(PLM.model);
  if (old) PLM.model.userData.st = old.userData.st;
  if (PLM.doll) { PLM.doll.scene.remove(PLM.doll.model); PLM.doll.model = makePlayerModel(); PLM.doll.scene.add(PLM.doll.model); }
  R.setHandSkin && R.setHandSkin();
}
// armour as skinned meshes bound to the player's own bones, so they follow every pose
function updateArmor(m, light, list = INV.armor) { // list: another player's armour in multiplayer
  const ud = m.userData, key = list.map(s => s ? s.id + (s.e ? 'e' : '') + (s.col != null ? '#' + s.col : '') : 0).join(',') + '|' + (ud.capeTex || '');
  if (key !== ud.armorKey) {
    ud.armorKey = key;
    for (const a of ud.armor) { a.parent.remove(a); a.material.dispose(); } ud.armor = [];
    let elytra = false;
    list.forEach((st, slot) => {
      if (!st) return;
      const a = ITEMS[st.id].armor;
      if (a && a.mat === 'elytra') { elytra = true; return; }
      if (!a) { // pumpkins and mob heads sit on the head
        if (slot !== 0) return;
        const im = R.itemMesh(st.id), g = new THREE.Group(); g.add(im);
        im.scale.setScalar(0.625 * 1.0); g.position.set(0, 0.25, 0); im.rotation.y = Math.PI;
        ud.parts.head.add(g); g.userData.item = im; ud.armor.push(Object.assign(g, { material: { dispose() {} } })); return;
      }
      const tk = PARMOR_TEX[a.mat]; if (!tk) return;
      const layer = PARMOR_SLOT[slot][0], tex = packTexture('armor_' + tk + '_' + layer); if (!tex) return;
      const geo = armorGeo(ud.slim, slot), add = (t, col) => {
        const mat = new THREE.MeshBasicMaterial({ map: t, vertexColors: true, alphaTest: 0.1, skinning: true, polygonOffset: true, polygonOffsetFactor: -1 }); mat.userData.col = col;
        const mesh = new THREE.SkinnedMesh(geo, mat); mesh.bind(ud.skel, ud.main.bindMatrix); mesh.frustumCulled = false; m.add(mesh); ud.armor.push(mesh);
      };
      add(tex, a.mat === 'leather' ? new THREE.Color(st.col != null ? st.col : 0xa06540) : null);
      if (st.e) { const gm = new THREE.SkinnedMesh(geo, R.glintMaterial(true)); gm.bind(ud.skel, ud.main.bindMatrix); gm.frustumCulled = false; gm.userData.glint = true; m.add(gm); ud.armor.push(gm); } // enchanted armour shimmers
      if (a.mat === 'leather') { const o = packTexture('armor_leather_' + layer + 'o'); if (o) add(o, null); }
    });
    if (ud.mat2) ud.mat2.visible = elytra;
    const ct = !elytra && ud.capeTex && packTexture(ud.capeTex); // a cape (not with an elytra on)
    if (ct) { const mat = new THREE.MeshBasicMaterial({ map: ct, vertexColors: true, alphaTest: 0.1, skinning: true, side: THREE.DoubleSide }), mesh = new THREE.SkinnedMesh(capeGeo(ud.slim), mat); mesh.bind(ud.skel, ud.main.bindMatrix); mesh.frustumCulled = false; mesh.userData.cape = true; m.add(mesh); ud.armor.push(mesh); }
    ud.chestOn = !!list[1];
  }
  for (const a of ud.armor) { if (a.userData.glint) continue; if (a.userData.item) R.setMeshLight(a.userData.item, light); else if (a.material.color) { a.material.color.setScalar(light); if (a.material.userData.col) a.material.color.multiply(a.material.userData.col); } }
}
// items in the hands (HeldItemFeatureRenderer + the item models' third-person display transforms)
const HANDHELD = id => { const d = ITEMS[id]; if (!d) return false; if (d.tool) return true; return /^(stick|bone|blaze_rod|bamboo|fishing_rod|carrot_on_a_stick|warped_fungus_on_a_stick|debug_stick)$/.test(d.key); };
function heldTransform(id, left, isBlock) {
  const s = left ? -1 : 1, M = new THREE.Matrix4(), t = new THREE.Matrix4();
  M.copy(FLIP3).multiply(t.makeRotationX(-90 * DEG)).multiply(t.makeRotationY(180 * DEG)).multiply(t.makeTranslation(s / 16, 0.125, -0.625));
  // display: block [75,45,0] [0,2.5,0] 0.375 · handheld [0,-90,55] [0,4,0.5] 0.85 · generated [0,0,0] [0,3,1] 0.55
  const [rot, tr, sc] = id === IID.shield ? [[0, 90, 0], left ? [10, 6, 12] : [10, 6, -4], 1] : isBlock ? [[75, 45, 0], [0, 2.5, 0], 0.375] : HANDHELD(id) ? [[0, -90, 55], [0, 4, 0.5], 0.85] : [[0, 0, 0], [0, 3, 1], 0.55]; // shield.json thirdperson_*hand
  M.multiply(t.makeTranslation(s * tr[0] / 16, tr[1] / 16, tr[2] / 16));
  M.multiply(t.makeRotationFromEuler(new THREE.Euler(rot[0] * DEG, s * rot[1] * DEG, s * rot[2] * DEG, 'XYZ')));
  M.multiply(t.makeScale(sc, sc, sc));
  return M;
}
// what each hand really holds (the off-hand use swaps items for a moment): [main hand, off hand]
const handItems = () => { const off = typeof offItem === 'function' ? offItem() : INV.off; return [typeof OFF !== 'undefined' && OFF.swapped ? INV.off : PL.held(), off]; };
const mainRight = () => typeof OPT === 'undefined' || OPT.mainHand !== 'left';
function updateHeld(m, items, light, mr = mainRight()) { // mr: the main hand is the right one (another player's own setting)
  const ud = m.userData;
  items.forEach((st, k) => {
    const rightArm = (k === 0) === mr, id = st ? st.id : 0, gl = st && (st.e || ITEMS[id].glint), key = id + (rightArm ? 'r' : 'l') + (gl ? 'g' : '');
    if (ud.heldKey[k] !== key) {
      ud.heldKey[k] = key; const old = ud.held[k]; if (old) { old.parent.remove(old); old.userData.item.material.dispose(); } ud.held[k] = null;
      if (id > 0) {
        const im = R.itemMesh(id), g = new THREE.Group(); if (gl) R.addGlint(im); g.matrixAutoUpdate = false; g.matrix.copy(heldTransform(id, !rightArm, im.userData.isBlock)); g.add(im); g.userData.item = im;
        (rightArm ? ud.parts.rarm : ud.parts.larm).add(g); ud.held[k] = g;
      }
    }
    if (ud.held[k]) R.setMeshLight(ud.held[k].userData.item, light);
  });
}

// ---------- poses (BipedEntityModel / PlayerEntityModel setAngles) ----------
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const lerpA = (t, a, b) => a + wrapA(b - a) * t;
const swimQ = f => -65 * f + f * f;
// set a part from vanilla angles (pitch, yaw, roll) and pivot (model pixels)
function setPart(b, pivot, pitch, yaw, roll, root) {
  if (!b) return;
  if (pivot) b.position.set(-pivot[0] / 16, (root ? 24 - pivot[1] : -pivot[1]) / 16, pivot[2] / 16);
  b.rotation.set(-pitch, -yaw, roll, 'ZYX');
}
// s: the pose inputs; returns nothing, poses m in place
function posePlayer(m, s) {
  const P = m.userData.parts, slim = m.userData.slim, ay = slim ? 2.5 : 2, st = m.userData.st;
  const headYaw = s.headYaw, headPitch = s.headPitch, la = st.limb, ld = st.limbD, age = s.age; // flying players swing their legs too, as in Java
  let A = { head: [headPitch, headYaw, 0], body: [0, 0, 0], rarm: [0, 0, 0], larm: [0, 0, 0], rleg: [0, 0, 0], lleg: [0, 0, 0] };
  const piv = { head: [0, 0, 0], body: [0, 0, 0], rarm: [-5, ay, 0], larm: [5, ay, 0], rleg: [-1.9, 12, 0], lleg: [1.9, 12, 0] };
  if (s.gliding || s.swim) A.head[0] = lerpA(s.gliding ? 1 : st.lean, headPitch, -Math.PI / 4);
  let k = 1; if (s.gliding) { k = s.vel2 / 0.2; k = k * k * k; if (k < 1) k = 1; }
  A.rarm[0] = Math.cos(la * 0.6662 + Math.PI) * 2 * ld * 0.5 / k; A.larm[0] = Math.cos(la * 0.6662) * 2 * ld * 0.5 / k;
  A.rleg[0] = Math.cos(la * 0.6662) * 1.4 * ld / k; A.lleg[0] = Math.cos(la * 0.6662 + Math.PI) * 1.4 * ld / k;
  if (s.riding) { A.rarm[0] -= Math.PI / 5; A.larm[0] -= Math.PI / 5; A.rleg = [-1.4137167, 0.31415927, 0.07853982]; A.lleg = [-1.4137167, -0.31415927, -0.07853982]; }
  // arm poses: what each hand holds or does
  const pose = (arm, kind) => { const a = A[arm], r = arm === 'rarm';
    if (kind === 'item') { a[0] = a[0] * 0.5 - Math.PI / 10; a[1] = 0; }
    else if (kind === 'block') { a[0] = a[0] * 0.5 - 0.9424779; a[1] = r ? -0.5235988 : 0.5235988; }
    else if (kind === 'spear') { a[0] = a[0] * 0.5 - Math.PI; a[1] = 0; }
    else if (kind === 'spy') { a[0] = Math.max(-2.4, Math.min(3.3, headPitch - 1.9198622 - (s.sneak ? 0.2617994 : 0))); a[1] = headYaw + (r ? -0.2617994 : 0.2617994); } };
  if (s.right) pose('rarm', s.right); if (s.left) pose('larm', s.left);
  if (s.two === 'bow') { A.rarm = [-Math.PI / 2 + headPitch, -0.1 + headYaw, A.rarm[2]]; A.larm = [-Math.PI / 2 + headPitch, 0.1 + headYaw + 0.4, A.larm[2]]; }
  else if (s.two === 'xbow') { A.rarm = [-Math.PI / 2 + headPitch + 0.1, -0.3 + headYaw, A.rarm[2]]; A.larm = [-1.5 + headPitch, 0.6 + headYaw, A.larm[2]]; }
  else if (s.two === 'xcharge') { const f = Math.min(1, s.charge); A.rarm = [-0.97079635, -0.8, A.rarm[2]]; A.larm = [A.rarm[0] + (-0.97079635 - f * 0.4 - A.rarm[0]) * f, 0.4 + (0.85 - 0.4) * f, A.larm[2]]; }
  // attack swing
  const p = s.swing;
  if (p > 0) {
    A.body[1] = Math.sin(Math.sqrt(p) * Math.PI * 2) * 0.2 * (s.swingLeft ? -1 : 1);
    piv.rarm = [-Math.cos(A.body[1]) * 5, ay, Math.sin(A.body[1]) * 5]; piv.larm = [Math.cos(A.body[1]) * 5, ay, -Math.sin(A.body[1]) * 5];
    A.rarm[1] += A.body[1]; A.larm[1] += A.body[1]; A.larm[0] += A.body[1];
    let g = 1 - p; g *= g; g *= g; g = 1 - g;
    const h = Math.sin(g * Math.PI), i = Math.sin(p * Math.PI) * -(A.head[0] - 0.7) * 0.75;
    const sa = A[s.swingLeft ? 'larm' : 'rarm']; sa[0] -= h * 1.2 + i; sa[1] += A.body[1] * 2; sa[2] += Math.sin(p * Math.PI) * -0.4;
  }
  if (s.sneak) {
    A.body[0] = 0.5; A.rarm[0] += 0.4; A.larm[0] += 0.4;
    piv.rleg = [-1.9, 12.2, 4]; piv.lleg = [1.9, 12.2, 4]; piv.head = [0, 4.2, 0]; piv.body = [0, 3.2, 0]; piv.rarm[1] = ay + 3.2; piv.larm[1] = ay + 3.2;
  }
  if (s.two !== 'spy' && s.right !== 'spy') { A.rarm[2] += Math.cos(age * 0.09) * 0.05 + 0.05; A.rarm[0] += Math.sin(age * 0.067) * 0.05; }
  if (s.left !== 'spy') { A.larm[2] -= Math.cos(age * 0.09) * 0.05 + 0.05; A.larm[0] -= Math.sin(age * 0.067) * 0.05; }
  if (st.lean > 0 && s.swim) { // swimming strokes
    const l = la % 26, n = st.lean, mm = st.lean, ra = A.rarm, lq = A.larm;
    if (l < 14) { lq[0] = lerpA(n, lq[0], 0); ra[0] = ra[0] + (0 - ra[0]) * mm; lq[1] = lerpA(n, lq[1], Math.PI); ra[1] += (Math.PI - ra[1]) * mm; lq[2] = lerpA(n, lq[2], Math.PI + 1.8707964 * swimQ(l) / swimQ(14)); ra[2] += (Math.PI - 1.8707964 * swimQ(l) / swimQ(14) - ra[2]) * mm; }
    else if (l < 22) { const o = (l - 14) / 8; lq[0] = lerpA(n, lq[0], Math.PI / 2 * o); ra[0] += (Math.PI / 2 * o - ra[0]) * mm; lq[1] = lerpA(n, lq[1], Math.PI); ra[1] += (Math.PI - ra[1]) * mm; lq[2] = lerpA(n, lq[2], 5.012389 - 1.8707964 * o); ra[2] += (1.2707963 + 1.8707964 * o - ra[2]) * mm; }
    else { const o = (l - 22) / 4; lq[0] = lerpA(n, lq[0], Math.PI / 2 - Math.PI / 2 * o); ra[0] += (Math.PI / 2 - Math.PI / 2 * o - ra[0]) * mm; lq[1] = lerpA(n, lq[1], Math.PI); ra[1] += (Math.PI - ra[1]) * mm; lq[2] = lerpA(n, lq[2], Math.PI); ra[2] += (Math.PI - ra[2]) * mm; }
    A.lleg[0] += (0.3 * Math.cos(la * 0.33333334 + Math.PI) - A.lleg[0]) * st.lean; A.rleg[0] += (0.3 * Math.cos(la * 0.33333334) - A.rleg[0]) * st.lean;
  }
  if (s.sleep) { A = { head: [0, 0, 0], body: [0, 0, 0], rarm: [0, 0, 0], larm: [0, 0, 0], rleg: [0, 0, 0], lleg: [0, 0, 0] }; }
  for (const n in A) setPart(P[n], piv[n], A[n][0], A[n][1], A[n][2], true);
  // elytra wings
  let wp = 0.2617994, wr = -0.2617994, wpy = 0, wy = 0;
  if (s.gliding) { let o = 1; if (s.vy < 0) o = 1 - Math.pow(Math.min(1, -s.vy / Math.max(1e-4, Math.sqrt(s.vel2 + s.vy * s.vy))), 1.5); wp = o * 0.34906584 + (1 - o) * wp; wr = o * -Math.PI / 2 + (1 - o) * wr; }
  else if (s.sneak) { wp = 0.6981317; wr = -Math.PI / 4; wpy = 3; wy = 0.08726646; }
  st.wingPy += (wpy - st.wingPy) * 0.1; st.wingP += (wp - st.wingP) * 0.1; st.wingY += (wy - st.wingY) * 0.1; st.wingR += (wr - st.wingR) * 0.1;
  setPart(P.lwing, [5, st.wingPy, 2], st.wingP, st.wingY, st.wingR); setPart(P.rwing, [-5, st.wingPy, 2], st.wingP, -st.wingY, -st.wingR);
  // the cape (CapeFeatureRenderer): trails behind as the player moves, lifts when falling, bobs with the stride, and swings
  // out further when sneaking; a chestplate pushes it a little off the back
  if (P.cape) { const sp = Math.sqrt(s.vel2 || 0), f2 = Math.min(150, sp * 400), f1 = Math.max(-6, Math.min(32, -(s.vy || 0) * 100)) + Math.sin(la * 0.6662) * 8 * ld;
    const want = (6 + f2 / 2 + f1 + (s.sneak ? 25 : 0)) * DEG; st.capeP = st.capeP == null ? want : st.capeP + (want - st.capeP) * 0.25;
    setPart(P.cape, [0, m.userData.chestOn ? -0.85 : 0, m.userData.chestOn ? 3.1 : 2], -st.capeP, Math.PI, 0); }
}
// the world-space placement of the whole model (LivingEntityRenderer / PlayerEntityRenderer setupTransforms)
function placePlayer(m, s, x, y, z) {
  const st = m.userData.st;
  m.position.set(x, y - (s.sneak ? 0.125 : 0), z); m.rotation.set(0, 0, 0, 'YXZ'); m.rotation.y = st.bodyYaw;
  if (st.deathT > 0) { const f = Math.min(1, Math.sqrt(st.deathT / 20 * 1.6)); m.rotation.z = -f * Math.PI / 2; }
  if (s.sleep) { m.rotation.set(0, s.bedYaw, 0, 'YXZ'); m.rotation.x = -Math.PI / 2; m.position.y = y - 0.6 + 0.5625 + 0.05; }
  else if (s.gliding) { const t = Math.min(1, (s.glideT * s.glideT) / 100); m.rotation.x = t * (-Math.PI / 2 + s.headPitchW); m.rotation.y = s.yaw; }
  else if (st.lean > 0) { m.rotation.y = s.yaw; m.rotation.x = st.lean * (-Math.PI / 2 + s.headPitchW); const o = new THREE.Vector3(0, -1, 0.3).multiplyScalar(st.lean).applyEuler(m.rotation); m.position.add(o); } // swimming: lying along the look direction
}

// ---------- per frame: the third-person model ----------
const PSTATE = { glideT: 0, deadT: 0 };
function playerPoseInputs(dt) {
  const [h, off] = handItems(), swapped = typeof OFF !== 'undefined' && OFF.swapped;
  const use = USE.kind, using = !!use && use !== 'place';
  const kindOf = st => !st ? null : 'item';
  let mainK = kindOf(h), offK = kindOf(off), two = null;
  if (using) { // the item in use is in the off hand while the off-hand use swaps it in
    const k = use === 'shield' ? 'block' : use === 'trident' ? 'spear' : use === 'spy' ? 'spy' : null;
    if (use === 'bow') two = 'bow'; else if (use === 'crossbow') two = 'xcharge'; else if (k) { if (swapped) offK = k; else mainK = k; }
  } else if (h && h.id === IID.crossbow && h.loaded) two = 'xbow';
  let right = mainRight() ? mainK : offK, left = mainRight() ? offK : mainK;
  if (two === 'xbow' || two === 'bow') { right = left = null; }
  const vx = PL.x - PL.px, vz = PL.z - PL.pz;
  return { headYaw: 0, headPitch: -PL.pitch, headPitchW: -PL.pitch, yaw: PL.yaw, right, left, two, charge: R.hand.bow || 0, swing: R.hand.swing > 0 ? 1 - R.hand.swing : 0, swingLeft: swapped === mainRight(),
    sneak: (PL.sneaking || PL.pose === 'crouch') && !PL.flying && !PL.gliding, riding: !!PL.riding, flying: PL.flying, gliding: !!PL.gliding, glideT: PSTATE.glideT, vel2: vx * vx + vz * vz, vy: PL.vy || 0,
    swim: PL.pose === 'swim' && !PL.gliding, sleep: !!PL.sleeping, bedYaw: PSTATE.bedYaw || 0, age: performance.now() / 50 };
}
function tickBodyYaw(st, s, moveX, moveZ, dtT) {
  const d2 = moveX * moveX + moveZ * moveZ;
  let target = st.bodyYaw;
  if (d2 > 0.0025 * 0.0025 * 4) { target = Math.atan2(-moveX, -moveZ); if (Math.abs(wrapA(target - s.yaw)) > 95 * DEG) target += Math.PI; }
  if (s.swing > 0 || s.riding || s.gliding || s.swim) target = s.yaw;
  st.bodyYaw += wrapA(target - st.bodyYaw) * Math.min(1, 0.3 * dtT);
  let hrel = wrapA(s.yaw - st.bodyYaw); const lim = 75 * DEG; if (hrel < -lim) hrel = -lim; if (hrel >= lim) hrel = lim;
  st.bodyYaw = s.yaw - hrel; if (hrel * hrel > (50 * DEG) ** 2) st.bodyYaw += hrel * 0.2 * Math.min(1, dtT);
}
function updatePlayerModel(dt, x, y, z, visible) {
  const m = PLM.model; if (!m || !m.userData.mc) return; m.visible = visible; if (!visible) return;
  const st = m.userData.st, dtT = dt * 20, s = playerPoseInputs(dt);
  PSTATE.glideT = s.gliding ? PSTATE.glideT + dtT : 0;
  if (s.sleep) { const bx = Math.floor(PL.x), by = Math.floor(PL.y - 0.3), bz = Math.floor(PL.z); const f = getMeta(bx, by, bz) & 3; PSTATE.bedYaw = -f * Math.PI / 2; s.bedYaw = PSTATE.bedYaw; }
  st.deathT = PL.dead ? Math.min(20, st.deathT + dtT) : 0;
  const mvx = PL.x - PL.px, mvz = PL.z - PL.pz;
  if (!(st.bodyYaw === st.bodyYaw)) st.bodyYaw = PL.yaw;
  tickBodyYaw(st, s, mvx, mvz, dtT);
  const spd = Math.min(1, Math.hypot(mvx, mvz) * 4);
  st.limbD += (spd - st.limbD) * Math.min(1, 0.4 * dtT); st.limb += st.limbD * dtT;
  st.lean += ((s.swim ? 1 : 0) - st.lean) * Math.min(1, 0.09 * dtT * 2);
  s.headYaw = -wrapA(s.yaw - st.bodyYaw); if (s.gliding || s.swim) s.headYaw = 0;
  posePlayer(m, s); placePlayer(m, s, x, y, z);
  const light = lightBright(x, y + 1, z), hurt = PL.hurtT > 0 || PL.dead;
  for (const mt of m.userData.mats) { mt.color.setScalar(light); if (hurt) mt.color.multiply(new THREE.Color(1, 0.6, 0.6)); }
  updateArmor(m, light); updateHeld(m, handItems(), light);
}

// ---------- the inventory figure ----------
function dollRender(el, mx, my) {
  if (!el) return;
  let D = PLM.doll;
  if (!D) {
    const cv = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false });
    r.setClearColor(0, 0); const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-0.62, 0.62, 1.0, -1.0, 0.1, 20);
    cam.position.set(0, 0.95, 5); cam.lookAt(0, 0.95, 0);
    D = PLM.doll = { cv, r, scene: sc, cam, model: makePlayerModel() }; sc.add(D.model);
  }
  if (D.cv.parentNode !== el) { el.innerHTML = ''; el.appendChild(D.cv); }
  const w = el.clientWidth || 104, h = el.clientHeight || 144;
  const title = el.classList.contains('titleDoll');
  if (D.cv.width !== w || D.cv.height !== h || D.title !== title) {
    D.r.setPixelRatio(1); D.r.setSize(w, h, false); D.cv.style.width = w + 'px'; D.cv.style.height = h + 'px'; D.title = title;
    // inventory: InventoryScreen draws the 32 px model (x0.9375) at 30 px a block into the 70 px box, feet 3 px above its bottom
    const hh = title ? 1 : 72 / 56.25, cy = title ? 0.95 : (68 / 72 - 0.5) * 2 * hh, a = w / h * hh;
    D.cam.left = -a; D.cam.right = a; D.cam.top = hh; D.cam.bottom = -hh; D.cam.zoom = title ? 0.92 : 1;
    D.cam.position.set(0, cy, 5); D.cam.lookAt(0, cy, 0); D.cam.updateProjectionMatrix();
  }
  // InventoryScreen.drawEntity: the body turns toward the mouse by atan(dx/40)*20 degrees, the head by 40, pitch by atan(dy/40)*20
  const rc = el.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height * 0.25;
  const fx = Math.atan((cx - mx) / 40 / (rc.width / 52)), fy = Math.atan((cy - my) / 40 / (rc.width / 52));
  const m = D.model, st = m.userData.st;
  st.limbD = 0; st.lean = 0; st.deathT = 0;
  const s = { headYaw: fx * 20 * DEG, headPitch: -fy * 20 * DEG, right: PL.held() ? 'item' : null, left: (typeof offItem === 'function' ? offItem() : INV.off) ? 'item' : null, swing: 0, sneak: false, age: performance.now() / 50 };
  posePlayer(m, s);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0, 'YXZ'); m.rotation.y = Math.PI + fx * 20 * DEG; m.rotation.x = 0; // facing the viewer
  for (const mt of m.userData.mats) mt.color.setScalar(1);
  updateArmor(m, 1); updateHeld(m, handItems(), 1);
  D.r.render(D.scene, D.cam);
}
const DOLL = { mx: innerWidth / 2, my: innerHeight / 2 };
addEventListener('pointermove', e => { DOLL.mx = e.clientX; DOLL.my = e.clientY; });
// the title screen shows your own skin on the right, turning to follow the mouse like the inventory figure
(function titleDoll() { requestAnimationFrame(titleDoll); if (typeof UI === 'undefined' || (UI.menu !== 'title' && UI.menu !== 'skins') || !PLM.model) return; const el = document.querySelector('.titleDoll'); if (el) dollRender(el, DOLL.mx, DOLL.my); })();
function dollTick() { const el = document.querySelector('.doll'); if (el && UI.screen) dollRender(el, DOLL.mx, DOLL.my); }

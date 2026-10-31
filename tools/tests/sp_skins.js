// skins: several kept and worn in turn, the arm width found or set by hand, Java's outer-layer switches, the inner layer
// made solid, an old 64x32 skin's all-solid hat dropped, and what multiplayer sends
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv);
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const make = (h, fn) => { const c = document.createElement('canvas'); c.width = 64; c.height = h; const g = c.getContext('2d'); fn(g); return c.toDataURL('image/png'); };
    // a slim skin: body blue, the 4th arm column left empty, a red hat, and one see-through pixel on the face
    const slim = make(64, g => { g.fillStyle = '#2040c0'; g.fillRect(0, 0, 64, 64); g.clearRect(54, 20, 2, 12); g.clearRect(46, 52, 2, 12); g.fillStyle = '#e02020'; g.fillRect(32, 0, 32, 16); g.clearRect(9, 9, 1, 1); });
    skinFromDataUrl(slim, '얇은 스킨'); await wait(800);
    const A = (x, y) => PACKPX.ent.custom_skin.px[(y * 64 + x) * 4 + 3];
    o.first = { n: skinLib().length, skin: OPT.skin, slim: PSKIN.customSlim, faceSolid: A(9, 9) === 255, hat: A(40, 8) };
    skinSetArms(false); await wait(600); o.wide = PSKIN.customSlim === false && skinLib()[0].auto === false;
    skinSetArms(null); await wait(600); o.auto = PSKIN.customSlim === true;
    skinToggleLayer('hat'); await wait(600); o.hatOff = A(40, 8); skinToggleLayer('hat'); await wait(600); o.hatOn = A(40, 8);
    // an old 64x32 skin whose hat area is all solid: Java drops that hat
    const old = make(32, g => { g.fillStyle = '#30a030'; g.fillRect(0, 0, 64, 32); }); skinFromDataUrl(old, '옛 스킨'); await wait(800);
    o.legacy = { n: skinLib().length, worn: OPT.skinIdx, hat: A(40, 8), leftArm: A(36, 52) };
    skinWear(1); await wait(600); o.wornBack = PSKIN.customSlim === true && OPT.skinIdx === 1;
    skinDelete(0); await wait(600); o.afterDel = { n: skinLib().length, skin: OPT.skin };
    // Steve with the jacket off: this player's own copy only, and multiplayer sends the picture
    OPT.skin = 'steve'; saveOpt(); skinToggleLayer('jacket'); await wait(600);
    const sc = skinChoice(), mp = mpSkin(); o.steve = { tex: sc.tex, sent: !!mp.data, packKept: PACKPX.ent.steve ? PACKPX.ent.steve.px[(40 * 64 + 20) * 4 + 3] : null, mine: PACKPX.ent.self_steve ? PACKPX.ent.self_steve.px[(40 * 64 + 20) * 4 + 3] : null };
    skinToggleLayer('jacket'); await wait(300);
    // a JPEG on a white background: the white cleared from the outer layer, the face kept; an HD 128x128 skin scaled down
    const jpg = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c08040'; g.fillRect(8, 8, 8, 8); g.fillStyle = '#3050d0'; g.fillRect(16, 16, 24, 16); return c.toDataURL('image/jpeg', 0.95); })();
    skinFromDataUrl(jpg, 'jpg 스킨'); await wait(800); o.jpg = { hat: A(40, 10), face: A(10, 10), jacket: A(20, 36), body: A(20, 20), name: skinLib()[0].name };
    const hd = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#20a020'; g.fillRect(0, 0, 128, 128); return c.toDataURL('image/png'); })();
    skinFromDataUrl(hd, 'HD'); await wait(800); o.hd = PACKPX.ent.custom_skin && PACKPX.ent.custom_skin.px[(20 * 64 + 20) * 4 + 1] > 150 && PACKPX.ent.custom_skin.w === 64;
    // a cape on the worn skin: drawn on the model, gone with an elytra on, and taken off again
    const cape = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#b02020'; g.fillRect(0, 0, 22, 17); return c.toDataURL('image/png'); })();
    capeSet(cape); await wait(800);
    const capeMesh = () => (PLM.model.userData.armor || []).some(a => a.userData && a.userData.cape);
    updateArmor(PLM.model, 1); o.cape = { tex: PLM.model.userData.capeTex, mesh: capeMesh(), saved: !!skinLib()[0].cape, sent: !!mpSkin().cape };
    INV.armor[1] = { id: IID.elytra, n: 1 }; updateArmor(PLM.model, 1); o.capeElytra = capeMesh(); INV.armor[1] = null; updateArmor(PLM.model, 1);
    capeSet(null); await wait(800); updateArmor(PLM.model, 1); o.capeOff = { tex: PLM.model.userData.capeTex, mesh: capeMesh() };
    showMenu('skins'); o.menu = { items: document.querySelectorAll('.skitem').length, layers: document.querySelectorAll('.sklayers button').length };
    return o; });
  ok(r.first.n === 1 && r.first.skin === 'custom' && r.first.slim && r.first.faceSolid && r.first.hat === 255, 'a new skin is kept, worn, found slim, its inner layer made solid', r.first);
  ok(r.wide && r.auto, 'the arm width can be set by hand and back to automatic', r);
  ok(r.hatOff === 0 && r.hatOn === 255, 'the hat layer switches off and on', [r.hatOff, r.hatOn]);
  ok(r.legacy.n === 2 && r.legacy.worn === 0 && r.legacy.hat === 0 && r.legacy.leftArm === 255, 'an old 64x32 skin: left arm copied, the all-solid hat dropped', r.legacy);
  ok(r.wornBack && r.afterDel.n === 1, 'skins are worn in turn and deleted', [r.wornBack, r.afterDel]);
  ok(r.steve.tex === 'self_steve' && r.steve.sent && r.steve.mine === 0, 'Steve with the jacket off is this player\'s own copy, sent to others as a picture', r.steve);
  ok(r.menu.items === 3 && r.menu.layers === 7, 'the skins screen lists the kept skins and the seven switches (cape and six layers)', r.menu);
  ok(r.jpg.hat === 0 && r.jpg.jacket === 0 && r.jpg.face === 255 && r.jpg.body === 255, 'a JPEG skin: its background cleared from the outer layer, the face and body kept', r.jpg);
  ok(r.hd, 'an HD (128x128) skin is scaled down to 64x64', r.hd);
  ok(r.cape.tex === 'self_cape' && r.cape.mesh && r.cape.saved && r.cape.sent, 'a cape is drawn on the player, kept with the skin and sent to others', r.cape);
  ok(!r.capeElytra && !r.capeOff.tex && !r.capeOff.mesh, 'an elytra hides the cape, and it can be taken off', [r.capeElytra, r.capeOff]);
  ok(!p.errs.length, 'no page errors', p.errs);
};

// a hit animal runs away from whoever hit it; taming one wolf doesn't change the others' health; H no longer hides the HUD
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    for (let a = -16; a <= 16; a++) for (let c = -16; c <= 16; c++) { setBlock(X + a, Y - 1, Z + c, BID.grass_block); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, 0); }
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0; await wait(500);
    const pig = spawnMob('pig', X + 2.5, Y, Z + .5); pig.persistent = true; o.hp = pig.hp;
    PL.yaw = -Math.PI / 2; attackEntity(pig); const x0 = pig.x;
    for (let i = 0; i < 80; i++) { UI.paused = false; for (let k = 0; k < 2; k++) gameTick(); await wait(10); } // (ticks hurried: the headless page draws slowly)
    o.away = +(pig.x - x0).toFixed(2); o.panic = pig.panic;
    const w1 = spawnMob('wolf', X - 3, Y, Z), w2 = spawnMob('wolf', X - 4, Y, Z + 2); INV.slots[INV.sel] = { id: IID.bone, n: 64 };
    for (let i = 0; i < 40 && w1.owner !== 'player'; i++) { PL.x = w1.x + 1; PL.z = w1.z; mobInteract(w1, INV.slots[INV.sel], ITEMS[IID.bone]); INV.slots[INV.sel] = { id: IID.bone, n: 64 }; await wait(20); }
    o.wolves = { tame: w1.owner === 'player', tameMax: w1.def.hp, wildMax: w2.def.hp, shared: MOBDEF.wolf.hp };
    o.hidden = (() => { const ev = new KeyboardEvent('keydown', { code: 'KeyH', key: 'h', bubbles: true }); document.dispatchEvent(ev); window.dispatchEvent(ev); return UI.hideHud; })();
    return o; });
  ok(r.hp === 10 && r.away > 2, 'a hit pig (10 health) runs away from the player', r);
  ok(r.wolves.tame && r.wolves.tameMax === 20 && r.wolves.wildMax === 8 && r.wolves.shared === 8, 'a tamed wolf has 20 health, the others keep 8', r.wolves);
  ok(r.hidden === false, 'H does not hide the HUD', r.hidden);
  ok(!p.errs.length, 'no page errors', p.errs);
};

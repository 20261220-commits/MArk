// saving and loading a world; damaged saves
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const id = await p.evaluate(async () => {
    PL.mode = 'survival'; INV.slots.fill(null); INV.slots[0] = { id: IID.diamond_sword, n: 1, d: 17, e: { sharpness: 3 }, name: '칼' }; INV.slots[5] = { id: IID.cobblestone, n: 33 }; INV.armor[1] = { id: IID.iron_chestplate, n: 1, d: 4 }; INV.off = { id: IID.shield, n: 1 }; INV.sel = 5;
    PL.health = 13; PL.food = 9; PL.level = 7; PL.xpP = 0.25; addEffect(PL, 'speed', 2400, 1); PL.x += 3.3; PL.z -= 2.7; PL.yaw = 1.2; window.__want = [+PL.x.toFixed(2), +PL.z.toFixed(2)];
    UI.openScreen('inv'); INV.cursor = { id: IID.gold_ingot, n: 9 }; INV.craft2[0] = { id: IID.emerald, n: 4 };
    saveAll(true); await new Promise(r => setTimeout(r, 1500)); return [W.id, window.__want]; });
  await p.reload(); await p.waitForFunction(() => window.__game, null, { timeout: 60000 }); await p.waitForTimeout(1000);
  const r = await p.evaluate(async id => { await startWorld(id); await new Promise(r => setTimeout(r, 6000)); UI.paused = false;
    const tot = k => [...INV.slots, INV.cursor, ...INV.craft2].reduce((a, s) => a + (s && s.id === IID[k] ? s.n : 0), 0) + ENT.filter(e => e.kind === 'item' && !e.dead && e.stack.id === IID[k]).reduce((a, e) => a + e.stack.n, 0);
    return { sword: INV.slots[0], cobble: INV.slots[5] && INV.slots[5].n, chest: INV.armor[1], off: INV.off && ITEMS[INV.off.id].key, sel: INV.sel, health: PL.health, food: PL.food, level: PL.level, xpP: PL.xpP, speed: !!(PL.eff && PL.eff.speed), x: +PL.x.toFixed(2), z: +PL.z.toFixed(2), yaw: PL.yaw, gold: tot('gold_ingot'), emerald: tot('emerald') }; }, id[0]);
  ok(r.sword && r.sword.d === 17 && r.sword.e && r.sword.e.sharpness === 3 && r.sword.name === '칼', 'an enchanted, named, worn sword survives a reload', r.sword);
  ok(r.cobble === 33 && r.chest && r.chest.d === 4 && r.off === 'shield' && r.sel === 5, 'inventory, armour, off hand and selection survive', r);
  ok(r.health === 13 && r.food === 9 && r.level === 7 && r.xpP === 0.25 && r.speed, 'health, food, experience and effects survive', r);
  ok(r.x === id[1][0] && r.z === id[1][1] && r.yaw === 1.2, 'position and facing survive', r);
  ok(r.gold === 9 && r.emerald === 4, 'what was on the cursor and in the crafting grid comes back', [r.gold, r.emerald]);
  // damaged storage: unreadable chunks, bad numbers, a bad advancement record
  const d = await p.evaluate(async () => { saveAll(true); await new Promise(r => setTimeout(r, 1200)); const cx = Math.floor(PL.x) >> 4, cz = Math.floor(PL.z) >> 4;
    await dbReq('chunks', 'readwrite', st => st.put({ v: 3, b: [1, 2, 3], m: 'x', l: null, bio: null, ch: 384 }, W.id + ':' + dkey(cx + 1, cz)));
    await dbReq('chunks', 'readwrite', st => st.put(12345, W.id + ':' + dkey(cx - 1, cz)));
    const m = JSON.parse(JSON.stringify(W.meta)); m.player.s.health = 'NaN'; m.player.s.x = null; m.adv2 = 'bad'; m.player.inv[3] = { id: 999999, n: 5 }; quitToTitle(); await new Promise(r => setTimeout(r, 1000)); await putWorld(m); return [m.id, cx, cz]; });
  const e = await p.evaluate(async ([id, cx, cz]) => { await startWorld(id); await new Promise(r => setTimeout(r, 9000)); return { menu: UI.menu, left: !!chunkAt(cx - 1, cz), right: !!chunkAt(cx + 1, cz), health: PL.health, x: isFinite(PL.x), inv3: INV.slots[3], adv: typeof W.meta.adv2 === 'object' }; }, d);
  ok(e.menu === null && e.left && e.right, 'a world with unreadable chunks still loads (they are generated again)', e);
  ok(e.health === 20 && e.x && e.inv3 === null && e.adv, 'bad numbers, unknown items and a bad record get safe values', e);
};

// inventory, crafting, dropping, durability, death and respawn
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => {
    const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const all = () => [...INV.slots, ...INV.armor, INV.off, INV.cursor, ...INV.craft2, ...INV.craft3];
    const tot = () => { const m = {}; for (const s of all()) if (s) m[s.id] = (m[s.id] || 0) + s.n; return JSON.stringify(Object.keys(m).sort().map(k => [k, m[k]])); };
    const bad = () => all().filter(s => s && (!(s.n > 0) || s.n > maxStack(s.id) || !ITEMS[s.id])).length;
    const ground = id => ENT.filter(e => e.kind === 'item' && !e.dead && e.stack.id === id).reduce((a, e) => a + e.stack.n, 0);
    const clr = () => { INV.slots.fill(null); INV.armor.fill(null); INV.off = null; INV.cursor = null; INV.craft2.fill(null); INV.craft3.fill(null); for (const e of [...ENT]) if (e.kind === 'item') removeEnt(e); };
    PL.mode = 'survival'; PL.flying = false;
    clr(); const pool = ['stone', 'oak_planks', 'stick', 'diamond_sword', 'iron_helmet', 'iron_boots', 'apple', 'torch', 'ender_pearl', 'diamond'];
    for (let i = 0; i < 20; i++) { const id = IID[pool[i % pool.length]]; INV.slots[i] = { id, n: ITEMS[id].dur ? 1 : 1 + (i * 7) % maxStack(id) }; }
    const t0 = tot(); UI.openScreen('inv'); let seed = 5; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let k = 0; k < 3000; k++) { const i = rnd(GUI.slots.length); if (GUI.slots[i].output) continue; clickSlot(i, rnd(3) === 0 ? 2 : 0, rnd(6) === 0); if (k % 97 === 0) collectToCursor(); }
    out.clicks = { same: tot() === t0, bad: bad() }; UI.closeScreen(); out.close = { same: tot() === t0, cursor: INV.cursor, grid: INV.craft2.filter(Boolean).length };
    clr(); INV.slots[0] = { id: IID.oak_planks, n: 2 }; UI.openScreen('craft');
    { const g = GUI.slots.findIndex(s => s.group === 'grid'), hot = GUI.slots.findIndex(s => s.group === 'hot'), res = GUI.slots.findIndex(s => s.output);
      clickSlot(hot, 0, false); clickSlot(g, 2, false); clickSlot(g + 3, 2, false); clickSlot(res, 0, false); out.craft = { cursor: INV.cursor && ITEMS[INV.cursor.id].key + 'x' + INV.cursor.n, grid: INV.craft3.filter(Boolean).length }; }
    UI.closeScreen();
    clr(); for (let i = 0; i < 36; i++) INV.slots[i] = { id: IID.dirt, n: 64 }; INV.craft3[0] = { id: IID.oak_planks, n: 4 }; INV.craft3[3] = { id: IID.oak_planks, n: 4 };
    UI.openScreen('craft'); clickSlot(GUI.slots.findIndex(s => s.output), 0, true); out.fullShift = (INV.craft3[0] ? INV.craft3[0].n : 0) + (INV.craft3[3] ? INV.craft3[3].n : 0); INV.craft3.fill(null); UI.closeScreen();
    clr(); for (let i = 0; i < 36; i++) INV.slots[i] = { id: IID.dirt, n: 63 }; out.addLeft = INV.add({ id: IID.dirt, n: 100 }); INV.giveOrDrop({ id: IID.cobblestone, n: 5 }); out.dropped = ground(IID.cobblestone);
    clr(); INV.sel = 0; INV.slots[0] = { id: IID.apple, n: 5 }; dropHeld(false); dropHeld(true); out.q = [INV.count(IID.apple), ground(IID.apple)];
    clr(); const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) setBlock(X + a, Y - 1, Z + c, BID.stone); PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vy = 0;
    INV.slots[0] = { id: IID.iron_pickaxe, n: 1 }; setBlock(X + 1, Y, Z, BID.stone); breakBlock(X + 1, Y, Z); out.pickDur = INV.slots[0].d || 0;
    INV.slots[0] = { id: IID.iron_sword, n: 1 }; const cow = spawnMob('cow', X + 1.5, Y, Z + .5); PL.attackT = 100; attackEntity(cow); out.swordDur = INV.slots[0].d || 0; out.cowHp = cow.hp;
    clr(); INV.slots[0] = { id: IID.diamond, n: 7 }; INV.armor[0] = { id: IID.iron_helmet, n: 1 }; PL.level = 5; PL.health = 20; PL.inv = 0;
    UI.openScreen('inv'); INV.cursor = { id: IID.emerald, n: 3 }; hurtPlayer(100, 'generic'); await wait(300);
    out.death = { dead: PL.dead, screen: UI.screen, inv: all().filter(Boolean).length, diamonds: ground(IID.diamond), helmet: ground(IID.iron_helmet), emerald: ground(IID.emerald), level: PL.level };
    respawn(); showMenu(null); UI.paused = false; await wait(200); out.respawn = { dead: PL.dead, hp: PL.health, food: PL.food, fire: PL.fire, air: PL.air };
    W.meta.gamerules = { ...(W.meta.gamerules || {}), keepInventory: true }; clr(); INV.slots[0] = { id: IID.emerald, n: 3 }; PL.inv = 0; hurtPlayer(100, 'generic'); await wait(200); out.keep = INV.count(IID.emerald); respawn(); showMenu(null); UI.paused = false; W.meta.gamerules.keepInventory = false;
    clr(); INV.sel = 0; INV.slots[0] = { id: IID.bread, n: 2 }; PL.food = 10; PL.sat = 0; finishEat(); out.eat = [PL.food, PL.sat, INV.count(IID.bread)];
    return out; });
  ok(r.clicks.same && !r.clicks.bad, '3000 random inventory clicks keep every item', r.clicks);
  ok(r.close.same && !r.close.cursor && !r.close.grid, 'closing the inventory puts back the cursor and the crafting grid', r.close);
  ok(r.craft.cursor === 'stickx4' && !r.craft.grid, 'two planks craft four sticks', r.craft);
  ok(r.fullShift === 8, 'shift-crafting into a full inventory keeps the ingredients', r.fullShift);
  ok(r.addLeft === 64 && r.dropped === 5, 'a full inventory hands back the rest / drops it', [r.addLeft, r.dropped]);
  ok(r.q[0] === 0 && r.q[1] === 5, 'Q drops one, ctrl+Q the stack', r.q);
  ok(r.pickDur === 1 && r.swordDur === 1 && r.cowHp === 4, 'a block costs a pickaxe 1, a hit costs a sword 1 and deals 6', [r.pickDur, r.swordDur, r.cowHp]);
  ok(r.death.dead && !r.death.screen && r.death.inv === 0 && r.death.diamonds === 7 && r.death.helmet === 1 && r.death.emerald === 3 && r.death.level === 0, 'death closes the screen and drops everything (cursor too)', r.death);
  ok(!r.respawn.dead && r.respawn.hp === 20 && r.respawn.food === 20 && r.respawn.air === 300, 'respawn restores the player', r.respawn);
  ok(r.keep === 3, 'keepInventory keeps the items', r.keep);
  ok(r.eat[0] === 15 && r.eat[1] === 6 && r.eat[2] === 1, 'bread gives 5 food and 6 saturation', r.eat);
  ok(!p.errs.length, 'no page errors', p.errs);
};

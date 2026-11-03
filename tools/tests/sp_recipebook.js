// the recipe book beside the crafting grids (as Java's): known recipes listed, the makeable ones green; a click lays the
// ingredients out (shift: as many as there are), a missing one shows the recipe faintly; 3x3 recipes not in the 2x2 grid
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv, { w: 1100, h: 700 }); await lib.newWorld(p, 'survival');
  const click = (sel, shift) => p.evaluate(([sel, shift]) => { const el = document.querySelector(sel); if (!el) return false; el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, shiftKey: !!shift, button: 0 })); return true; }, [sel, shift]);
  const r = {};
  await p.evaluate(() => { INV.slots.fill(null); INV.slots[0] = { id: IID.oak_planks, n: 10 }; INV.slots[1] = { id: IID.cobblestone, n: 3 }; W.meta.rbKnown = []; OPT.rb = false; OPT.rbOnly = false; UI.openScreen('craft', { x: 0, y: 0, z: 0 }); });
  r.btn = await click('[data-rbtoggle]');
  r.list = await p.evaluate(() => [...document.querySelectorAll('.rbc')].map(e => [ITEMS[RECIPES[+e.dataset.rb].out].key, e.classList.contains('ok')]));
  await p.screenshot({ path: '/tmp/claude-0/-home-user-mark/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/rb.png' });
  const idx = k => p.evaluate(k => { const e = [...document.querySelectorAll('.rbc')].find(e => ITEMS[RECIPES[+e.dataset.rb].out].key === k); return e ? e.dataset.rb : null; }, k);
  const ct = await idx('crafting_table'); await click(`[data-rb="${ct}"]`);
  r.table = await p.evaluate(() => [INV.craft3.filter(s => s && s.id === IID.oak_planks).length, INV.count(IID.oak_planks), (GUI.slots[9].get() || {}).id === IID.crafting_table]);
  const st = await idx('stick'); await click(`[data-rb="${st}"]`, true);
  r.stick = await p.evaluate(() => [INV.craft3.filter(Boolean).map(s => s.n), INV.count(IID.oak_planks)]);
  const fu = await idx('furnace'); await click(`[data-rb="${fu}"]`);
  r.ghost = await p.evaluate(() => [!!GUI.ghost, document.querySelectorAll('.ghostI').length, INV.craft3.filter(Boolean).length]);
  await p.evaluate(() => UI.closeScreen()); r.back = await p.evaluate(() => INV.count(IID.oak_planks));
  await p.evaluate(() => UI.openScreen('inv')); r.inv = await p.evaluate(() => [...document.querySelectorAll('.rbc')].map(e => ITEMS[RECIPES[+e.dataset.rb].out].key));
  await click('[data-rbf]'); r.only = await p.evaluate(() => [...document.querySelectorAll('.rbc')].every(e => e.classList.contains('ok')));
  await p.evaluate(() => UI.closeScreen());
  ok(r.btn && r.list.some(([k, o]) => k === 'crafting_table' && o) && r.list.some(([k, o]) => k === 'furnace' && !o), 'the book lists known recipes: makeable green, the rest red', r.list.slice(0, 12));
  ok(r.table[0] === 4 && r.table[1] === 6 && r.table[2], 'a click lays the ingredients out and the result is ready', r.table);
  ok(r.stick[0].length === 2 && r.stick[0].every(n => n === 5) && r.stick[1] === 0, 'shift-click: as many as the inventory has (the grid\'s things put back first)', r.stick);
  ok(r.ghost[0] && r.ghost[1] === 8 && r.ghost[2] === 0, 'not enough: the recipe shows faintly in the grid', r.ghost);
  ok(r.back === 10 && !r.inv.includes('furnace') && r.inv.includes('crafting_table') && r.only, 'the inventory\'s 2x2 book has no 3x3 recipes; "makeable only" filter', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};

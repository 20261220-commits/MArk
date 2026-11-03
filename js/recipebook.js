// ---------- the recipe book (as Java's): beside the inventory's and the crafting table's grid ----------
// The green book button opens a list of the recipes this player knows (every recipe with an ingredient it has held, kept
// per world; all of them in creative), the ones it can make now in green, the rest red. A click lays the ingredients out
// in the grid from the inventory (shift: as many as there are), or shows the recipe faintly in the grid when something is
// missing. "제작 가능만" hides what can't be made; the search box finds by name; pages of 20.
const RB = { page: 0, q: '' };
const rbW = T => T === 'inv' ? 2 : 3;
function rbShape(r) { // [width, height, cells: item-option lists or null]
  if (r.s) { const n = r.s.length, w = n <= 4 ? 2 : 3; return [w, Math.ceil(n / w), r.s.slice()]; }
  const ph = r.p.length, pw = Math.max(...r.p.map(s => s.length)), cells = [];
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const ch = r.p[y][x] || ' '; cells.push(ch === ' ' ? null : r.k[ch]); }
  return [pw, ph, cells];
}
const rbFits = (r, w) => { const [pw, ph] = rbShape(r); return pw <= w && ph <= w; };
function rbKnown() { const m = W.meta || {}; return m.rbKnown || (m.rbKnown = []); }
function rbLearn() { // what the player has held unlocks the recipes that use it
  const have = new Set(); for (const s of [...INV.slots, ...INV.craft2, ...INV.craft3, INV.cursor, INV.off]) if (s) have.add(s.id);
  const known = new Set(rbKnown()); let grew = false;
  for (let i = 0; i < RECIPES.length; i++) { if (known.has(i)) continue; const r = RECIPES[i], [, , cells] = rbShape(r); if (cells.some(o => o && o.some(id => have.has(id)))) { known.add(i); grew = true; } }
  if (grew) W.meta.rbKnown = [...known];
}
// the inventory (and what lies in the grid) as counts by item
function rbPool(grid) { const c = new Map(); for (const s of [...INV.slots, ...grid]) if (s && !s.e && !s.name) c.set(s.id, (c.get(s.id) || 0) + s.n); return c; }
// which item goes in each cell for `times` crafts, or null when there isn't enough
function rbPlan(r, grid, times) {
  const [, , cells] = rbShape(r), pool = rbPool(grid), pick = [];
  for (const o of cells) {
    if (!o) { pick.push(0); continue; }
    let best = 0, bn = 0; for (const id of o) { const n = pool.get(id) || 0; if (n >= times && n > bn) { best = id; bn = n; } }
    if (!best) return null; pool.set(best, bn - times); pick.push(best);
  }
  return pick;
}
function rbMaxTimes(r, grid) { let lo = 0; const cap = Math.min(64, ...rbShape(r)[2].filter(Boolean).map(o => maxStack(o[0]))); for (let t = 1; t <= cap; t++) { if (rbPlan(r, grid, t)) lo = t; else break; } return lo; }
function rbList(T) {
  const w = rbW(T), all = creative(), known = new Set(rbKnown()), seen = new Set(), out = [], q = RB.q.trim().toLowerCase();
  const grid = T === 'inv' ? INV.craft2 : INV.craft3;
  RECIPES.forEach((r, i) => {
    if (!ITEMS[r.out] || !rbFits(r, w) || (!all && !known.has(i))) return;
    const key = r.out + ':' + r.n; if (seen.has(key)) return;
    if (q && !itemName(r.out).toLowerCase().includes(q) && !ITEMS[r.out].key.includes(q)) return;
    const ok = !!rbPlan(r, grid, 1); if (OPT.rbOnly && !ok) return;
    seen.add(key); out.push({ i, r, ok });
  });
  out.sort((a, b) => (b.ok - a.ok)); // what can be made now first
  return out;
}
function rbHtml(T) {
  if (T !== 'inv' && T !== 'craft') return '';
  const book = `<button class="rbbtn ${OPT.rb ? 'on' : ''}" data-rbtoggle="1" title="제작법 책"></button>`;
  if (!OPT.rb) return book;
  rbLearn();
  const list = rbList(T), pages = Math.max(1, Math.ceil(list.length / 20)); RB.page = Math.min(RB.page, pages - 1);
  const cells = list.slice(RB.page * 20, RB.page * 20 + 20).map(x => `<div class="rbc ${x.ok ? 'ok' : 'no'}" data-rb="${x.i}" title="${esc(itemName(x.r.out))}${x.r.n > 1 ? ' ×' + x.r.n : ''}">${icon(x.r.out, x.r.n)}</div>`).join('');
  return book + `<div class="panel rbook"><div class="rbtop"><input id="rbsearch" placeholder="검색" value="${esc(RB.q)}" autocomplete="off"><button class="rbf ${OPT.rbOnly ? 'on' : ''}" data-rbf="1" title="제작 가능한 것만">${OPT.rbOnly ? '가능만' : '전체'}</button></div><div class="rbgrid">${cells || '<p class="tip">아는 제작법이 없습니다</p>'}</div><div class="rbpg"><button data-rbpg="-1" ${RB.page ? '' : 'disabled'}>◀</button><span>${RB.page + 1}/${pages}</span><button data-rbpg="1" ${RB.page < pages - 1 ? '' : 'disabled'}>▶</button></div></div>`;
}
// a recipe clicked: the grid's things go back to the inventory, then the ingredients are laid out
function rbUse(i, all) {
  const T = UI.screen, r = RECIPES[i]; if (!r) return;
  const w = rbW(T), grid = T === 'inv' ? INV.craft2 : INV.craft3;
  GUI.ghost = null;
  const cap = Math.min(64, ...rbShape(r)[2].filter(Boolean).map(o => maxStack(o[0])));
  const times = creative() ? (all ? cap : 1) : all ? rbMaxTimes(r, grid) : (rbPlan(r, grid, 1) ? 1 : 0);
  const [pw, , cells] = rbShape(r);
  const back = () => { for (let k = 0; k < grid.length; k++) if (grid[k]) { const st = grid[k]; grid[k] = null; const left = INV.add(st); if (left) INV.giveOrDrop({ ...st, n: left }); } };
  if (!times) { // not enough: the grid emptied, the recipe shown faintly in it
    back();
    GUI.ghost = { w, cells: cells.map(o => o ? o[0] : 0), pw }; UI.renderScreen(); return;
  }
  back();
  const pick = creative() ? cells.map(o => o ? o[0] : 0) : rbPlan(r, grid, times); if (!pick) { UI.renderScreen(); return; }
  pick.forEach((id, c) => { if (!id) return; const x = c % pw, y = Math.floor(c / pw); if (!creative()) INV.remove(id, times); grid[y * w + x] = { id, n: times }; });
  play('click', { vol: 0.3 }); UI.hudDirty = true; UI.renderScreen();
}
// clicks on the book (before the slots' own handler)
document.addEventListener('DOMContentLoaded', () => {
  const sc = $('screen'); if (!sc) return;
  sc.addEventListener('pointerdown', e => {
    const t = e.target.closest('[data-rbtoggle],[data-rb],[data-rbf],[data-rbpg],#rbsearch'); if (!t) return;
    if (t.id === 'rbsearch') { e.stopPropagation(); return; } // (typing, not clicking a slot)
    e.preventDefault(); e.stopPropagation();
    if (t.dataset.rbtoggle) { OPT.rb = !OPT.rb; saveOpt(); GUI.ghost = null; }
    else if (t.dataset.rbf) { OPT.rbOnly = !OPT.rbOnly; saveOpt(); RB.page = 0; }
    else if (t.dataset.rbpg) RB.page = Math.max(0, RB.page + +t.dataset.rbpg);
    else if (t.dataset.rb) { rbUse(+t.dataset.rb, e.shiftKey); return; }
    UI.renderScreen();
  }, true);
});

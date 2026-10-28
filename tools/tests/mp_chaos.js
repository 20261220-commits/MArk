// three players doing random things for a minute (placing, breaking, chests, furnaces, hitting, boats): afterwards
// all three worlds must hold the same blocks and the same chest contents
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C, pos } = await lib.threePlayers(b, srv);
  const [X, Y, Z] = pos;
  const P3 = [A, B, C];
  for (const [k, P] of P3.entries()) await P.evaluate(([X, Y, Z, k]) => { window.__chaos = { n: 0, err: [] }; let seed = 1000 + k * 77; const r = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const ids = [0, 0, 0, BID.stone, BID.oak_planks, BID.glass, BID.torch, BID.sand, BID.oak_door, BID.chest, BID.furnace, BID.red_bed, BID.lever, BID.water, BID.tnt, BID.oak_fence, BID.ladder];
    const items = ['stone', 'oak_planks', 'glass', 'torch', 'sand', 'oak_door', 'chest', 'furnace', 'red_bed', 'lever', 'oak_fence', 'ladder', 'oak_slab', 'oak_stairs', 'redstone', 'rail', 'cobblestone', 'white_wool'];
    window.__chaosT = setInterval(() => { if (!W.active || PL.dead) { if (PL.dead) { respawn(); showMenu(null); UI.paused = false; } return; } try {
      __chaos.n++; const x = X - 6 + r(13), z = Z - 6 + r(13), act = r(10);
      PL.x = Math.max(X - 7, Math.min(X + 7, PL.x)); PL.z = Math.max(Z - 7, Math.min(Z + 7, PL.z)); PL.mode = 'survival';
      if (act < 5) { const it = items[r(items.length)]; INV.slots[INV.sel] = { id: IID[it], n: 4 }; let y = Y; while (y < Y + 4 && getBlock(x, y, z)) y++; const by = y - 1, f = [0, 1, 0];
        TARGET = { type: 'block', x, y: by, z, id: getBlock(x, by, z), m: getMeta(x, by, z), nx: 0, ny: 1, nz: 0, t: 2 }; PL.x = x + 0.5 + (r(2) ? 2 : -2); PL.z = z + 0.5; PL.y = Y; USE.placeCd = 0; MP.local = true; try { useItem(true); } finally { MP.local = false; } if (UI.screen) UI.closeScreen(); }
      else if (act < 7) { let y = Y + 3; while (y >= Y && !getBlock(x, y, z)) y--; if (y >= Y) { MP.local = true; try { breakBlock(x, y, z); } finally { MP.local = false; } } }
      else if (act === 7) { let y = Y + 3; while (y >= Y && !getBlock(x, y, z)) y--; if (y >= Y) { INV.slots[INV.sel] = null; TARGET = { type: 'block', x, y, z, id: getBlock(x, y, z), m: getMeta(x, y, z), nx: 0, ny: 1, nz: 0, t: 2 }; USE.placeCd = 0; MP.local = true; try { useItem(true); } finally { MP.local = false; }
          if (UI.screen === 'chest' || UI.screen === 'furnace') { const cs = GUI.slots.map((s, i) => [s, i]).filter(([s]) => s.group === 'cont' || s.group === 'fin' || s.group === 'ffuel'); INV.slots[3] = { id: IID.coal, n: 8 }; const hot = GUI.slots.findIndex(s => s.group === 'hot'); for (let q = 0; q < 3; q++) { const [s, i] = cs[r(cs.length)] || []; if (s == null) break; clickSlot(r(2) ? i : hot + 3, r(3) === 0 ? 2 : 0, false); } if (INV.cursor) { INV.giveOrDrop(INV.cursor); INV.cursor = null; } UI.closeScreen(); } else if (UI.screen) UI.closeScreen(); } }
      else if (act === 8) { const p = [...MP.peers.values()].find(q => q.pos); if (p) { PL.x = p.pos[0] + 1.5; PL.z = p.pos[2]; PL.y = p.pos[1]; const dx = p.pos[0] - PL.x, dz = p.pos[2] - PL.z; PL.yaw = Math.atan2(-dx, -dz); PL.pitch = -0.2; PL.attackT = 100; INV.slots[INV.sel] = { id: IID.wooden_sword, n: 1 }; const t = raycast(4.5); if (t && t.type === 'ent') attackEntity(t.e); } }
      else { const b = ENT.find(q => q.kind === 'boat' && !q.dead); if (PL.riding) dismount(); else if (b && r(2)) mount(b); }
    } catch (e) { __chaos.err.push(String(e.stack || e).slice(0, 300)); } }, 120);
  }, [X, Y, Z, k]);
  await A.evaluate(([X, Y, Z]) => placeBoat(X + 0.5, Y, Z + 7.5, 0, 'oak'), pos);
  await A.waitForTimeout(60000);
  for (const P of P3) await P.evaluate(() => { clearInterval(__chaosT); if (PL.riding) dismount(); if (UI.screen) UI.closeScreen(); });
  await A.waitForTimeout(6000);
  const snap = P => P.evaluate(([X, Y, Z]) => { const o = []; for (let x = X - 8; x <= X + 8; x++) for (let z = Z - 8; z <= Z + 8; z++) for (let y = Y - 1; y < Y + 5; y++) { const b = getBlock(x, y, z); o.push(FLUID[b] ? 'F' : b + ':' + (S.DOOR[b] || b === BID.red_bed || b === BID.chest ? getMeta(x, y, z) : '')); }
    const tiles = []; for (let x = X - 8; x <= X + 8; x++) for (let z = Z - 8; z <= Z + 8; z++) for (let y = Y - 1; y < Y + 5; y++) { const t = getTile(x, y, z); if (t && t.items && t.type === 'chest') tiles.push(x + ',' + y + ',' + z + '=' + JSON.stringify(t.items.map(s => s ? s.id + 'x' + s.n : 0))); }
    return { o, tiles, n: __chaos.n, err: __chaos.err.slice(0, 3), dead: PL.dead }; }, pos);
  const [a, bb, c] = [await snap(A), await snap(B), await snap(C)];
  const diff = (p, q) => p.o.reduce((n, v, i) => n + (v !== q.o[i] ? 1 : 0), 0), td = (p, q) => { const s = new Set(q.tiles); return p.tiles.filter(t => !s.has(t)).length; };
  ok(a.n + bb.n + c.n > 100, 'the players did things', [a.n, bb.n, c.n]);
  ok(diff(a, bb) === 0 && diff(a, c) === 0, 'all three see the same blocks', [diff(a, bb), diff(a, c)]);
  ok(td(a, bb) === 0 && td(a, c) === 0, 'all three see the same chest contents', [td(a, bb), td(a, c), a.tiles.length]);
  ok(!a.err.length && !bb.err.length && !c.err.length, 'no errors in the random actions', [a.err, bb.err, c.err]);
  const errs = [...A.errs, ...B.errs, ...C.errs]; ok(!errs.length, 'no page errors', errs);
};

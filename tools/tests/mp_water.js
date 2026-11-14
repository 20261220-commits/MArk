// A guest's water bucket: the water flows for everyone, and taken back up (again and again, on the floor and on top of
// blocks) it drains away on every screen
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C, pos } = await lib.threePlayers(b, srv), [X, Y, Z] = pos, wait = ms => A.waitForTimeout(ms);
  const until = (P, f, arg, ms = 30000) => P.waitForFunction(f, arg, { timeout: ms, polling: 250 }).then(() => true, () => false);
  const LOG = []; const use = (P, item, x, y, z, ny = 1) => P.evaluate(([item, x, y, z, ny]) => { const before = [getBlock(x, y + (item === 'bucket' ? 0 : ny), z), getMeta(x, y + (item === 'bucket' ? 0 : ny), z)]; PL.mode = 'survival'; INV.slots[INV.sel] = { id: IID[item], n: 1 };
    TARGET = { type: 'block', x, y, z, id: getBlock(x, y, z), m: getMeta(x, y, z), nx: 0, ny, nz: 0, t: 2 }; const rc = raycast; raycast = () => TARGET; USE.placeCd = 0; MP.local = true; try { useItem(true); } finally { MP.local = false; raycast = rc; } return [item, x, y, z, before, INV.slots[INV.sel] && ITEMS[INV.slots[INV.sel].id].key]; }, [item, x, y, z, ny]).then(v => (LOG.push(v), v));
  const count = (P, [x0, z0]) => P.evaluate(([x0, y, z0]) => { let n = 0, src = 0; for (let a = -9; a <= 9; a++) for (let c = -9; c <= 9; c++) for (let k = 0; k < 3; k++) if (getBlock(x0 + a, y + k, z0 + c) === 27) { n++; if (!getMeta(x0 + a, y + k, z0 + c)) src++; } return [n, src]; }, [x0, Y, z0]);
  const cx = X + 20, cz = Z; // an empty floor away from the others
  await A.evaluate(([x0, y, z0]) => { MP.local = true; for (let a = -10; a <= 10; a++) for (let c = -10; c <= 10; c++) { setBlock(x0 + a, y - 1, z0 + c, BID.stone); for (let k = 0; k < 4; k++) setBlock(x0 + a, y + k, z0 + c, 0); } setBlock(x0 + 2, y, z0, BID.stone); MP.local = false; }, [cx, Y, cz]);
  await B.evaluate(([x, y, z]) => { PL.x = x + 0.5; PL.z = z + 5.5; PL.y = y; PL.flying = true; }, [cx, Y, cz]); await wait(2500);
  await A.evaluate(([x, y, z]) => { window.__H = []; const sb = setBlock; setBlock = function (X, Y, Z, id, m) { const r = sb.apply(this, arguments); if (X === x && Y === y && Z === z && r !== false) __H.push([W.tickN, 'set', id, m || 0, MP.applying ? 'guest' : 'own']); return r; }; }, [cx, Y, cz]);
  await B.evaluate(([x, y, z]) => { window.__G = []; const ap = mpApplySets; mpApplySets = function (m) { for (const e of m.l) if (e[0] === x && e[1] === y && e[2] === z) __G.push([Math.round(performance.now()), 'in', e[3], e[4], MP.pend && MP.pend.has(x + ',' + y + ',' + z) ? JSON.stringify(MP.pend.get(x + ',' + y + ',' + z)) : '-']); return ap.apply(this, arguments); }; const mb = mpBlockChanged; mpBlockChanged = function (X, Y, Z, id, m) { if (X === x && Y === y && Z === z) __G.push([Math.round(performance.now()), 'out', id, m]); return mb.apply(this, arguments); }; }, [cx, Y, cz]);
  // it flows
  await use(B, 'water_bucket', cx, Y - 1, cz);
  const flowed = await until(B, ([x, y, z]) => { let n = 0; for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) if (getBlock(x + a, y, z + c) === 27) n++; return n > 12; }, [cx, Y, cz], 20000);
  ok(flowed, 'a guest\'s water flows on the guest\'s screen', await count(B, [cx, cz]));
  ok(await until(A, ([x, y, z]) => { let n = 0; for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) if (getBlock(x + a, y, z + c) === 27) n++; return n > 12; }, [cx, Y, cz], 20000), 'and on the runner\'s', await count(A, [cx, cz]));
  // taken back, put on top of the block beside it, taken back again, quickly, a few times
  for (let i = 0; i < 4; i++) {
    await use(B, 'bucket', cx, Y, cz); await wait(150 + i * 200);
    await use(B, 'water_bucket', cx + 2, Y, cz); await wait(300 + i * 150);
    await use(B, 'bucket', cx + 2, Y + 1, cz); await wait(100 + i * 100);
    await use(B, 'water_bucket', cx, Y - 1, cz); await wait(200 + i * 250);
  }
  await use(B, 'bucket', cx, Y, cz);
  const gone = P => until(P, ([x0, y, z0]) => { for (let a = -9; a <= 9; a++) for (let c = -9; c <= 9; c++) for (let k = 0; k < 3; k++) if (getBlock(x0 + a, y + k, z0 + c) === 27) return false; return true; }, [cx, Y, cz], 40000);
  console.log(JSON.stringify(LOG));
  console.log('HOST', JSON.stringify(await A.evaluate(() => __H)));
  console.log('GUEST', JSON.stringify(await B.evaluate(() => __G)));
  const picks = LOG.filter(l => l[0] === 'bucket'), okPicks = picks.filter(l => l[5] === 'water_bucket').length;
  ok(okPicks === picks.length, 'each time the guest takes up the water it just put down, it is there to take (the runner\'s older news doesn\'t undo it)', [okPicks, picks.length]);
  const ga = await gone(A), gb = await gone(B), gc = await gone(C);
  if (!(ga && gb && gc)) console.log('src at', await A.evaluate(([x0, y, z0]) => { const o = []; for (let a = -9; a <= 9; a++) for (let c = -9; c <= 9; c++) for (let k = 0; k < 3; k++) if (getBlock(x0 + a, y + k, z0 + c) === 27 && !getMeta(x0 + a, y + k, z0 + c)) o.push([a, k, c]); return o; }, [cx, Y, cz]));
  ok(ga && gb && gc, 'taken back up, it drains away on every screen', [await count(A, [cx, cz]), await count(B, [cx, cz]), await count(C, [cx, cz])]);
};

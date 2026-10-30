// changing your skin while playing with others: they see the new one straight away
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B } = await lib.threePlayers(b, srv);
  const before = await B.evaluate(() => { const p = [...MP.peers.values()].find(q => q.name === '앨리스'); return p && { tex: p.skin && p.skin.tex, data: !!(p.skin && p.skin.data) }; });
  await A.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#c03080'; g.fillRect(0, 0, 64, 64); skinFromDataUrl(c.toDataURL('image/png'), '분홍'); await new Promise(r => setTimeout(r, 1000)); });
  await B.waitForTimeout(2500);
  const after = await B.evaluate(() => { const p = [...MP.peers.values()].find(q => q.name === '앨리스'); if (!p) return null; const e = p.skinKey && PACKPX.ent[p.skinKey]; return { data: !!(p.skin && p.skin.data), ready: !!p.skinReady, pink: e ? [e.px[(20 * 64 + 20) * 4], e.px[(20 * 64 + 20) * 4 + 2]] : null }; });
  ok(before && !before.data && after && after.data && after.ready && after.pink && after.pink[0] > 150, 'the other player sees the new skin', [before, after]);
  for (const P of [A, B]) ok(!P.errs.length, 'no page errors', P.errs);
};

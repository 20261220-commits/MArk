// A mistake in one part of the game no longer stops everything (some players got a black screen where nothing answered):
// an unknown item in the hand is dropped, and with one part failing every frame the world still ticks and is drawn
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await lib.newWorld(p, 'survival');
  await p.evaluate(() => { INV.slots[INV.sel] = { id: 99999, n: 1 }; INV.slots[1] = { id: IID.stone, n: 5 }; });
  const a = await p.evaluate(() => { for (let i = 0; i < 25; i++) gameTick(); return { held: INV.slots[INV.sel], stone: INV.slots[1] && INV.slots[1].n }; });
  ok(a.held === null && a.stone === 5 && errs.length === 0, 'an unknown item in the hand is dropped, nothing else, without an error', [a, errs]);
  const r = await p.evaluate(async () => { const oe = entityTick, orr = entityRender; window.entityTick = () => { throw new Error('test tick'); }; window.entityRender = () => { throw new Error('test render'); };
    const t0 = W.tickN, f0 = R.renderer.info.render.frame; let thrown = 0;
    for (let i = 0; i < 30; i++) { try { gameTick(); frame(performance.now() + i * 50); } catch (e) { thrown++; } }
    const out = { thrown, ticks: W.tickN - t0, frames: R.renderer.info.render.frame - f0, chat: (typeof CHAT !== 'undefined' ? JSON.stringify(CHAT).slice(-400) : document.body.innerText.slice(-2000)).includes('게임 오류') };
    window.entityTick = oe; window.entityRender = orr; return out; });
  console.log(JSON.stringify(r));
  ok(r.thrown === 0 && r.ticks >= 30 && r.frames >= 20 && r.chat, 'with a part of the tick and of the frame failing, the game goes on and says so in the chat', r);
  const j = await p.evaluate(async () => { const m = { ...W.meta, id: W.meta.id, remote: true, player: { s: { eff: null, x: 'a' }, inv: { 0: 1 }, armor: 5, ender: 'x', off: 7, sel: 99 } };
    let err = null; try { await startWorld(m.id, m); } catch (e) { err = String(e); }
    return { err, active: W.active, inv: INV.slots.length, armor: INV.armor.length, ender: PL.ender.length, sel: INV.sel, eff: typeof PL.eff, x: typeof PL.x }; });
  console.log(JSON.stringify(j));
  ok(!j.err && j.active && j.inv === 36 && j.armor === 4 && j.ender === 27 && j.sel === 0 && j.eff === 'object' && j.x === 'number', 'a damaged player record still lets the world open', j);
};

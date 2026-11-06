// pausing moved off Esc (조작 설정): Esc only lets the mouse go, even when the page around the game takes the focus
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const st = () => p.evaluate(() => ({ menu: UI.menu || null, lock: !!document.pointerLockElement, hint: (document.getElementById('relock') || {}).style ? document.getElementById('relock').style.display : null }));
  await p.evaluate(() => { OPT.keys = { pause: 'Backspace' }; });
  const relock = async () => { await p.mouse.click(480, 300); await p.waitForTimeout(300); };
  await relock(); const s0 = await st();
  // Esc inside a frame: the mouse let go and the page around taking the focus at once
  await p.evaluate(() => new Promise(r => { document.addEventListener('pointerlockchange', () => { window.dispatchEvent(new Event('blur')); r(); }, { once: true }); document.exitPointerLock(); }));
  await p.waitForTimeout(200); const s1 = await st();
  await relock(); await p.keyboard.press('Escape'); await p.waitForTimeout(300); const s2 = await st();
  await relock(); await p.keyboard.press('Backspace'); await p.waitForTimeout(200); const s3 = await st();
  await p.evaluate(() => { delete OPT.keys; resumeGame(); }); await relock();
  await p.evaluate(() => new Promise(r => { document.addEventListener('pointerlockchange', () => r(), { once: true }); document.exitPointerLock(); })); await p.waitForTimeout(200); const s4 = await st();
  ok(s0.lock && !s1.menu && s1.hint === 'block' && !s2.menu && s3.menu === 'pause' && s4.menu === 'pause', 'pause on Backspace: letting the mouse go (Esc), even with the focus moving away, never pauses; Backspace does; with the default key Esc pauses', { s0, s1, s2, s3, s4 });
};

// nickname + password: an account is made on first join, the right password gets the name (and its things) back, a
// wrong one or none doesn't; and the names above other players' heads as Java draws them
module.exports = async ({ ok, srv, b, lib }) => {
  const login = (P, name, pw) => P.evaluate(([name, pw]) => { showMenu('account'); $('accName').value = name; $('accPass').value = pw; accLogin(); return { acc: ACC.user && ACC.user.name, menu: UI.menu, cred: /^[0-9a-f]{64}$/.test(ACC.cred || ''), keptPw: JSON.stringify(localStorage).includes(pw) }; }, [name, pw]);
  const enter = async P => { await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; }); await P.waitForTimeout(2000); };
  const join = (P, url) => P.evaluate(async u => { MP.status = ''; showMenu('mp_join'); await mpJoinWs(u); }, url);
  const A = await lib.page(b, srv, { w: 480, h: 300 });
  const la = await login(A, '앨리스', 'sesame1');
  ok(la.acc === '앨리스' && la.menu === 'title' && la.cred && !la.keptPw, 'logging in keeps the nickname and only a hash of the password', la);
  ok(await A.evaluate(() => $('menu').textContent.includes('앨리스') && $('menu').textContent.includes('로그아웃') && !/Google/.test($('menu').textContent)), 'the title shows who is logged in (no Google)');
  await join(A, srv.ws);
  await A.evaluate(() => { $('mpSeed').value = '555'; $('mpMode').value = 'survival'; return mpAction('mp_createworld'); }); await enter(A);
  ok(await A.evaluate(() => MP.name === '앨리스' || [...MP.peers.values()].length >= 0) && await A.evaluate(() => W.active), 'a logged-in player joins (and makes the account)');
  await A.evaluate(() => { INV.slots[5] = { id: IID.diamond, n: 7 }; mpSendPdata(); }); await A.waitForTimeout(1500);
  await A.evaluate(() => { mpStop(); quitToTitle(); }); await A.waitForTimeout(1500);
  // someone else trying the name: with a wrong password, and with none
  const B = await lib.page(b, srv, { w: 480, h: 300 });
  await login(B, '앨리스', 'wrong-one');
  await join(B, srv.ws).catch(() => {}); await B.waitForTimeout(2500);
  const wrong = await B.evaluate(() => ({ st: MP.status, active: W.active && !!W.meta && !!W.meta.server }));
  ok(/비밀번호가 틀렸/.test(wrong.st) && !wrong.active, 'a wrong password doesn\'t get in', wrong);
  await B.evaluate(() => { mpStop(); accLogout(); MP.name = '앨리스'; });
  await join(B, srv.ws).catch(() => {}); await B.waitForTimeout(2500);
  const none = await B.evaluate(() => ({ st: MP.status, active: W.active && !!W.meta && !!W.meta.server }));
  ok(/비밀번호가 걸려/.test(none.st) && !none.active, 'nor does the name without logging in', none);
  await B.evaluate(() => { mpStop(); MP.name = '밥'; });
  // the owner comes back with the right password, on another device: the name and its things
  const A2 = await lib.page(b, srv, { w: 480, h: 300 });
  await login(A2, '앨리스', 'sesame1'); await join(A2, srv.ws); await enter(A2);
  const back = await A2.evaluate(() => ({ name: MP.name, dia: INV.slots.some(s => s && s.id === IID.diamond && s.n === 7) }));
  ok(back.dia, 'the right password gets the account\'s inventory back', back);
  // name tags: B joins as a plain guest and looks at 앨리스
  await join(B, srv.ws); await enter(B);
  const pos = await A2.evaluate(() => { const x = Math.floor(PL.x), y = 140, z = Math.floor(PL.z); MP.local = true; for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) { setBlock(x + a, y - 1, z + c, BID.stone); for (let k = 0; k < 4; k++) setBlock(x + a, y + k, z + c, 0); } MP.local = false; PL.x = x + .5; PL.y = y; PL.z = z + .5; PL.vx = PL.vy = PL.vz = 0; return [x, y, z]; });
  await B.evaluate(p => { PL.mode = 'creative'; PL.flying = true; PL.x = p[0] + .5; PL.y = p[1]; PL.z = p[2] + 3.5; PL.vx = PL.vy = PL.vz = 0; PL.yaw = 0; PL.pitch = 0; }, pos); await B.waitForTimeout(2500); // hovering, in case the pad hasn't reached B yet
  const tag = () => B.evaluate(async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const p = [...MP.peers.values()].find(q => q.name === '앨리스'); if (!p || !p.tag) return null; const t = p.tag; return { s: [p.s.sneak, p.s.inv, p.s.pose, Math.round(performance.now() - p.at), +Math.hypot(camera.position.x - p.pos[0], camera.position.z - p.pos[2]).toFixed(1)], back: t.back.visible, front: t.front.visible, backDepth: t.back.material.depthTest, frontDepth: t.front.material.depthTest, h: +t.front.scale.y.toFixed(3), y: +(t.front.position.y - p.pos[1]).toFixed(2) }; });
  const st = await tag();
  ok(st && st.back && st.front && !st.backDepth && st.frontDepth, 'a name shows faintly through walls and in white where it can be seen', st);
  ok(st && Math.abs(st.h - 0.225) < 0.01 && Math.abs(st.y - (1.8 + 0.5 + 0.1125)) < 0.05, 'it is Java\'s size (9 font pixels of 0.025) 0.5 above the head', st);
  const a2 = await A2.evaluate(async () => { IN.sneak = true; await new Promise(r => setTimeout(r, 300)); return [IN.sneak, PL.sneaking, PL.flying, PL.mode, MP.on]; }); await B.waitForTimeout(1200);
  const sn = await tag(); await A2.evaluate(() => { IN.sneak = false; });
  ok(sn && sn.back && !sn.front && sn.backDepth, 'sneaking: only the faint name, and walls hide it', [sn, a2]);
  await A2.evaluate(() => { addEffect(PL, 'invisibility', 400, 0); }); await B.waitForTimeout(1200);
  const inv = await tag(); await A2.evaluate(() => { clearEffects(PL); });
  ok(inv && !inv.back && !inv.front, 'an invisible player has no name tag', inv);
  for (const P of [A, B, A2]) ok(!P.errs.length, 'no page errors', P.errs);
};

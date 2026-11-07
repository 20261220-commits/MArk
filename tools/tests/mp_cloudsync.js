// the game's two sites kept alike through the server (js/cloudsync.js, cf/worker.js /sync): two browsers with their own
// storage, logged in with one account - a world made and built on in one turns up, blocks and all, in the other; a
// setting changed in one is taken by the other; a world deleted in one goes from the other; a wrong password is refused.
// Needs the Cloudflare server running locally: NEMO_TEST_SYNC=http://localhost:8787 (wrangler dev); skipped otherwise
module.exports = async ({ ok, srv, b, lib }) => {
  const SYNC = process.env.NEMO_TEST_SYNC; if (!SYNC) { ok(true, 'skipped: no NEMO_TEST_SYNC'); return; }
  const user = 'sync' + Date.now().toString(36).slice(-6);
  const login = (p, pw) => p.evaluate(([u, pw, s]) => { NEMO_CONFIG.sync = s; ACC.user = { name: u }; ACC.cred = accProof(u, pw); accSave(); }, [user, pw, SYNC]);
  const A = await lib.page(b, srv); await login(A, 'pw1234');
  await lib.newWorld(A, 'creative');
  const made = await A.evaluate(async () => { const X = Math.floor(PL.x), Z = Math.floor(PL.z), Y = 140; for (let i = 0; i < 5; i++) setBlock(X + i, Y, Z, BID.gold_block); saveAll(); await new Promise(r => setTimeout(r, 800)); const id = W.id; quitToTitle(); await new Promise(r => setTimeout(r, 300));
    OPT.fov = 93; saveOpt(); const r = await cloudSync('test'); return { id, X, Y, Z, r }; });
  const B = await lib.page(b, srv); await login(B, 'pw1234');
  const got = await B.evaluate(async id => { const r = await cloudSync('test'); const ws = await listWorlds(); return { r, has: ws.some(w => w.id === id), fov: OPT.fov }; }, made.id);
  ok(made.r && made.r.sent >= 1 && got.has && got.r.got >= 1, 'a world made in one site turns up in the other', [made.r, got]);
  ok(got.fov === 93, 'a setting changed in one site is taken by the other', got.fov);
  // the world opened in the other site: its blocks are there
  const blocks = await B.evaluate(async m => { const w = (await listWorlds()).find(x => x.id === m.id); await startWorld(w.id, w); for (let i = 0; i < 80 && !(W.active && getBlock(m.X, m.Y - 60, m.Z)); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 1500)); let n = 0; for (let i = 0; i < 5; i++) if (getBlock(m.X + i, m.Y, m.Z) === BID.gold_block) n++; quitToTitle(); return n; }, made).catch(e => 'err ' + e.message);
  ok(blocks === 5, 'its blocks are there in the other site', blocks);
  // deleted in B, gone from A
  const del = await B.evaluate(async id => { await deleteWorld(id); await new Promise(r => setTimeout(r, 300)); CS.busy = false; return cloudSync('test'); }, made.id);
  const goneA = await A.evaluate(async id => { CS.at = 0; await cloudSync('test'); return !(await listWorlds()).some(w => w.id === id); }, made.id);
  ok(goneA, 'a world deleted in one site goes from the other', [del, goneA]);
  // a wrong password for the account
  const C = await lib.page(b, srv); await login(C, 'other99');
  const bad = await C.evaluate(async () => { await cloudSync('test'); return CS.msg; });
  ok(/다른 비밀번호/.test(bad), 'another password for the same name is refused', bad);
};

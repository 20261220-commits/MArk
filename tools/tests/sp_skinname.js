// a Java Edition skin by name, with the outside sites faked: the game server's /profile turned away (as Mojang does some
// requests from Cloudflare) -> the browser asks playerdb.co itself and wears the skin (slim arms too); an unknown name
// says so; and with the server answering, its profile is used
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv);
  const png = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#c03030'; g.fillRect(0, 0, 64, 64); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  const tex = name => Buffer.from(JSON.stringify({ textures: { SKIN: { url: 'http://textures.minecraft.net/texture/' + name, metadata: { model: 'slim' } } } })).toString('base64');
  let mode = 'blocked';
  await p.route(/\/profile\?name=/, r => mode === 'blocked' ? r.fulfill({ status: 502, body: '{"error":"lookup failed"}', headers: { 'access-control-allow-origin': '*' } })
    : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ name: 'Srv', id: 'x', skin: 'https://textures.minecraft.net/texture/srv', slim: false }) }));
  await p.route(/playerdb\.co/, r => /Nobody/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"code":"minecraft.invalid_username","message":"Mojang API lookup failed.","success":false}' })
    : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'player.found', data: { player: { id: 'abc', username: 'Steve123', properties: [{ name: 'textures', value: tex('steve123') }] } } }) }));
  await p.route(/textures\.minecraft\.net|mc-heads\.net/, r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png }));
  const pick = () => p.evaluate(() => { const l = skinLib(); const w = l[OPT.skinIdx || 0]; return { n: l.length, name: w && w.name, slim: !!(w && w.slim), skin: OPT.skin }; });
  const flash = []; await p.exposeFunction('__fl', t => flash.push(t)); await p.evaluate(() => { const f = UI.flash; UI.flash = t => { window.__fl(String(t)); return f.call(UI, t); }; });
  await p.evaluate(() => skinFromName('Steve123')); await p.waitForTimeout(1500); const a = await pick();
  await p.evaluate(() => skinFromName('Nobody')); await p.waitForTimeout(1500); const nobody = flash.some(t => /그런 자바 에디션 계정이 없어요/.test(t));
  mode = 'ok'; await p.evaluate(() => skinFromName('Srv')); await p.waitForTimeout(1500); const c = await pick();
  ok(a.name === 'Steve123' && a.slim && a.skin === 'custom', 'with the server turned away, the skin comes through playerdb.co, slim arms and all', a);
  ok(nobody, 'an unknown name says there is no such account', flash);
  ok(c.name === 'Srv', 'with the server answering, its profile is used', c);
};

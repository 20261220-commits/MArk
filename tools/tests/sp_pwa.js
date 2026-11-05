// the served game is an installable app (PWA): Chrome finds no installability or manifest errors, the service worker
// keeps the files, and the title screen shows "앱으로 설치" once the browser offers it (which opens the prompt)
module.exports = async ({ ok, srv, b, lib }) => {
  const ctx = await b.newContext(), p = await ctx.newPage(); await p.goto(srv.url); await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()), null, { timeout: 20000 }); await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p), inst = await cdp.send('Page.getInstallabilityErrors'), man = await cdp.send('Page.getAppManifest');
  ok(!inst.installabilityErrors.length && !man.errors.length && /manifest\.webmanifest$/.test(man.url), 'Chrome can install it: no installability or manifest errors', [inst.installabilityErrors, man.errors]);
  const r = await p.evaluate(async () => { showMenu('title'); const before = !!document.querySelector('[data-act="pwainstall"]');
    let prompted = 0; const ev = new Event('beforeinstallprompt'); ev.prompt = () => { prompted++; }; ev.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(ev);
    const after = !!document.querySelector('[data-act="pwainstall"]'); document.querySelector('[data-act="pwainstall"]').click(); await new Promise(r => setTimeout(r, 200));
    return { before, after, prompted, gone: !document.querySelector('[data-act="pwainstall"]'), cache: (await caches.keys()).length }; });
  ok(!r.before && r.after && r.prompted === 1 && r.gone, 'the install button appears when the browser offers it, opens the prompt, and goes once installed', r);
  ok(r.cache > 0, 'the service worker keeps the game for offline play', r);
  await ctx.close();
};

// Runs the game's browser tests: node tools/tests/run.js [name-filter]
// Each test file exports async ({ ok, srv, b, lib }) and calls ok(condition, what, detail) for every check.
const fs = require('fs'), path = require('path'), lib = require('./lib');
(async () => {
  if (!lib.playwright()) { console.log('Playwright is needed for the tests: npm i -g playwright && npx playwright install chromium'); process.exit(2); }
  const filter = process.argv[2] || '', files = fs.readdirSync(__dirname).filter(f => /^(sp|mp)_.*\.js$/.test(f) && f.includes(filter)).sort();
  let pass = 0, fail = 0; const fails = [];
  for (const f of files) {
    const srv = await lib.startServer(), b = await lib.browser(), t0 = Date.now(); let n = 0;
    const ok = (c, what, detail) => { n++; if (c) pass++; else { fail++; fails.push(`${f}: ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); console.log('  FAIL ' + what + (detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : '')); } };
    try { await require(path.join(__dirname, f))({ ok, srv, b, lib }); } catch (e) { fail++; fails.push(`${f}: crashed ${String(e.stack || e).slice(0, 400)}`); console.log('  CRASH ' + String(e.stack || e).slice(0, 400)); }
    console.log(`${f}: ${n} checks, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    await b.close(); srv.stop();
  }
  console.log(`\n${pass} passed, ${fail} failed`); for (const x of fails) console.log(' - ' + x);
  process.exit(fail ? 1 : 0);
})();

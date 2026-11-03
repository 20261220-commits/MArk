// Builds dist/nemo-1.18.html: one self-contained file (scripts, three.js and the
// pixel font inlined) that runs offline, e.g. opened straight from a Chromebook's Downloads.
// Usage: node tools/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
// the version shown on the title screen (when this was built, Korean time): which game a browser really has open
{ const d = new Date(Date.now() + 9 * 3600e3), p2 = n => String(n).padStart(2, '0'), v = `${d.getUTCFullYear()}.${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  fs.writeFileSync(path.join(root, 'js', 'version.js'), `// written by tools/build.js: when this game was built (Korean time)\nconst NEMO_VERSION = '${v}';\n`); }
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${src} */\n${code}\n</script>`;
});
html = html.replace(/url\('(fonts\/[^']+\.woff2)'\)/g, (m, f) => `url('data:font/woff2;base64,${fs.readFileSync(path.join(root, f)).toString('base64')}')`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'nemo-1.18.html');
fs.writeFileSync(out, html);
console.log('wrote', path.relative(root, out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB');

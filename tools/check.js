// Checks every script before a build or merge:
//  1. syntax (node --check)
//  2. a trailing // comment that swallowed code: most lines here hold several statements, and a "// note" put in
//     the middle of one silently turns the rest of the line into comment (this has broken things more than once)
// Usage: node tools/check.js [file...]   (all scripts when no file is named; exit code 1 when something is wrong)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const files = process.argv.length > 2 ? process.argv.slice(2).map(f => path.relative(root, path.resolve(f))) : [...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f), ...fs.readdirSync(path.join(root, 'tools')).map(f => 'tools/' + f), ...fs.readdirSync(path.join(root, 'tools', 'tests')).map(f => 'tools/tests/' + f)].filter(f => f.endsWith('.js'));
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); } catch (e) { bad++; console.log('SYNTAX ' + f + '\n' + String(e.stderr || e).trim()); } }
// the comment part of a line: the first // outside strings, template literals and regular expressions
function commentOf(l) {
  let q = null;
  for (let j = 0; j < l.length; j++) {
    const c = l[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '/' && l[j + 1] === '/') return l.slice(j + 2);
    if (c === '/' && l[j + 1] === '*') { const e = l.indexOf('*/', j + 2); if (e < 0) return null; j = e + 1; continue; }
    if (c === '/' && /[=(,:!&|?;{}[\]+\-*%<>~^]\s*$|^\s*$|\breturn\s*$/.test(l.slice(0, j))) { // a regex literal
      for (j++; j < l.length && l[j] !== '/'; j++) { if (l[j] === '\\') j++; else if (l[j] === '[') { while (j < l.length && l[j] !== ']') { if (l[j] === '\\') j++; j++; } } }
      continue;
    }
  }
  return null;
}
// code-looking text after a statement end inside the comment (a call ended by a semicolon, an if / for, an assignment)
const CODE = /\b(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*\S|\b[A-Za-z_$][\w$.]*\([^)]*\);|[;}]\s*[a-z_$][\w$]*\s*=\s*[\w$(]|[;}]\s*(?:if\s*\(|for\s*\(|while\s*\(|const\s+\w|let\s+\w|return\s+[^a-z\s]|[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*\([^)]*\)\s*[;}]|[A-Za-z_$][\w$]*(?:\.[\w$]+)+\s*=[^=>])/;
for (const f of files) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
  const c = commentOf(l); if (c && CODE.test(c)) { bad++; console.log(`COMMENT SWALLOWS CODE ${f}:${i + 1}: //${c.slice(0, 140)}`); }
});
if (bad) { console.log(bad + ' problem(s)'); process.exit(1); } else console.log('check: ' + files.length + ' files ok');

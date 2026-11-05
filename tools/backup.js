// Keeps the saved server worlds in branches of a GitHub repository, for hosts that wipe their disk on every restart
// (Render's free plan: a redeploy, or waking up after sleeping). No dependencies: Node's own fetch and zlib.
// The worlds go in one gzip file. Restore points, so one bad backup can never take the worlds with it:
//   <branch>            the latest backup
//   <branch>-prev       the one before it
//   <branch>-day0..6    one a day, for the last week
//   <branch>-suspect    a backup the server didn't trust (a world missing, or far fewer chunks than before): kept
//                       aside, the good ones are left as they were
//   GITHUB_BACKUP_REPO=owner/repo  GITHUB_TOKEN=<token with "Contents: read and write" on that repository>
//   GITHUB_BACKUP_BRANCH=world-backup (default)
const zlib = require('zlib');
function githubBackup({ repo, token, branch = 'world-backup', api = 'https://api.github.com', file = 'world.json.gz' }) {
  const H = { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'user-agent': 'nemo-server', 'content-type': 'application/json' };
  // null for "not there" (a missing branch is 404 on reads and 422 on updates)
  const call = async (method, p, body, missing = [404]) => {
    const r = await fetch(api + '/repos/' + repo + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined });
    if (missing.includes(r.status) || (method === 'GET' && r.status === 409)) return null; // (409 on a read: the repository is still empty)
    if (!r.ok) { const e = new Error(`GitHub ${method} ${p}: ${r.status} ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
    return r.json();
  };
  const setRef = async (name, sha) => { if (!await call('PATCH', '/git/refs/heads/' + name, { sha, force: true }, [404, 422])) await call('POST', '/git/refs', { ref: 'refs/heads/' + name, sha }); };
  const dayOf = t => Math.floor(t / 86400000);
  let dailyDone = null; // the day whose daily restore point is made
  return {
    branch,
    // the restore points, newest first: the latest, the one before, then the days
    async candidates() {
      const out = [branch, branch + '-prev'], days = [];
      for (let d = 0; d < 7; d++) { const ref = await call('GET', '/git/ref/heads/' + branch + '-day' + d).catch(() => null); if (!ref) continue; const c = await call('GET', '/git/commits/' + ref.object.sha).catch(() => null); const t = c && Date.parse(((c.message || '').match(/\d{4}-\d\d-\d\dT[\d:.]+Z/) || [])[0]); days.push([branch + '-day' + d, isFinite(t) ? t : 0]); }
      days.sort((a, b) => b[1] - a[1]); return [...out, ...days.map(d => d[0])];
    },
    async loadGz(name = branch) { // a restore point as it is kept (gzipped), or null
      const ref = await call('GET', '/git/ref/heads/' + name); if (!ref) return null;
      const c = await call('GET', '/git/commits/' + ref.object.sha), t = await call('GET', '/git/trees/' + c.tree.sha), f = t && t.tree.find(x => x.path === file);
      if (!f) return null;
      const b = await call('GET', '/git/blobs/' + f.sha);
      return Buffer.from(b.content, 'base64');
    },
    async load() { const gz = await this.loadGz(); return gz && JSON.parse(zlib.gunzipSync(gz).toString('utf8')); },
    async save(obj, { suspect = false } = {}) { // an object, or the backup already gzipped (a Buffer: the server writes it piece by piece)
      const content = (Buffer.isBuffer(obj) ? obj : zlib.gzipSync(Buffer.from(JSON.stringify(obj)))).toString('base64');
      // a repository just made, with no commit yet, takes no git objects (409 "Git Repository is empty"): its first commit is
      // made with the contents API (a small note), then the backup goes in as usual
      let blob; try { blob = await call('POST', '/git/blobs', { content, encoding: 'base64' }); }
      catch (e) { if (e.status !== 409) throw e; await call('PUT', '/contents/README.md', { message: 'nemo backup', content: Buffer.from('네모 대륙 서버 세계 백업 — 세계는 ' + branch + ' 브랜치에 있습니다 (' + branch + '-prev: 그 전 것, ' + branch + '-day0~6: 하루 하나씩 일주일).\n').toString('base64') }); blob = await call('POST', '/git/blobs', { content, encoding: 'base64' }); }
      const tree = await call('POST', '/git/trees', { tree: [{ path: file, mode: '100644', type: 'blob', sha: blob.sha }] });
      const now = new Date(), commit = await call('POST', '/git/commits', { message: (suspect ? 'suspect world backup ' : 'world backup ') + now.toISOString(), tree: tree.sha, parents: [] });
      if (suspect) { await setRef(branch + '-suspect', commit.sha); return Math.round(content.length * 3 / 4); }
      // the latest becomes the one before; then the new one
      const head = await call('GET', '/git/ref/heads/' + branch); if (head && head.object.sha !== commit.sha) await setRef(branch + '-prev', head.object.sha);
      await setRef(branch, commit.sha);
      // the day's restore point, once a day (seven of them, a week, reused in turn)
      const day = dayOf(now.getTime()); if (dailyDone !== day) {
        const name = branch + '-day' + (day % 7), ref = await call('GET', '/git/ref/heads/' + name), c = ref && await call('GET', '/git/commits/' + ref.object.sha), t = c && Date.parse(((c.message || '').match(/\d{4}-\d\d-\d\dT[\d:.]+Z/) || [])[0]);
        if (!(isFinite(t) && dayOf(t) === day)) await setRef(name, commit.sha); dailyDone = day; }
      return Math.round(content.length * 3 / 4);
    },
  };
}
module.exports = { githubBackup };

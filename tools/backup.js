// Keeps the saved server world in a branch of a GitHub repository, for hosts that wipe their disk on every restart
// (Render's free plan: a redeploy, or waking up after sleeping). No dependencies: Node's own fetch and zlib.
// The whole world goes in one gzip file; each backup replaces the branch with a single new commit (no history piles up).
//   GITHUB_BACKUP_REPO=owner/repo  GITHUB_TOKEN=<token with "Contents: read and write" on that repository>
//   GITHUB_BACKUP_BRANCH=world-backup (default)
const zlib = require('zlib');
function githubBackup({ repo, token, branch = 'world-backup', api = 'https://api.github.com', file = 'world.json.gz' }) {
  const H = { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'user-agent': 'nemo-server', 'content-type': 'application/json' };
  // null for "not there" (a missing branch is 404 on reads and 422 on updates)
  const call = async (method, p, body, missing = [404]) => {
    const r = await fetch(api + '/repos/' + repo + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (missing.includes(r.status) || (method === 'GET' && r.status === 409)) return null; // (409 on a read: the repository is still empty)
    if (!r.ok) { const e = new Error(`GitHub ${method} ${p}: ${r.status} ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
    return r.json();
  };
  return {
    async loadGz() { // the backup as it is kept (gzipped), or null
      const ref = await call('GET', '/git/ref/heads/' + branch); if (!ref) return null;
      const c = await call('GET', '/git/commits/' + ref.object.sha), t = await call('GET', '/git/trees/' + c.tree.sha), f = t && t.tree.find(x => x.path === file);
      if (!f) return null;
      const b = await call('GET', '/git/blobs/' + f.sha);
      return Buffer.from(b.content, 'base64');
    },
    async load() { const gz = await this.loadGz(); return gz && JSON.parse(zlib.gunzipSync(gz).toString('utf8')); },
    async save(obj) { // an object, or the backup already gzipped (a Buffer: the server writes it piece by piece)
      const content = (Buffer.isBuffer(obj) ? obj : zlib.gzipSync(Buffer.from(JSON.stringify(obj)))).toString('base64');
      // a repository just made, with no commit yet, takes no git objects (409 "Git Repository is empty"): its first commit is
      // made with the contents API (a small note), then the backup goes in as usual
      let blob; try { blob = await call('POST', '/git/blobs', { content, encoding: 'base64' }); }
      catch (e) { if (e.status !== 409) throw e; await call('PUT', '/contents/README.md', { message: 'nemo backup', content: Buffer.from('네모 대륙 서버 세계 백업 — 세계는 ' + branch + ' 브랜치에 있습니다.\n').toString('base64') }); blob = await call('POST', '/git/blobs', { content, encoding: 'base64' }); }
      const tree = await call('POST', '/git/trees', { tree: [{ path: file, mode: '100644', type: 'blob', sha: blob.sha }] });
      const commit = await call('POST', '/git/commits', { message: 'world backup ' + new Date().toISOString(), tree: tree.sha, parents: [] });
      if (!await call('PATCH', '/git/refs/heads/' + branch, { sha: commit.sha, force: true }, [404, 422])) await call('POST', '/git/refs', { ref: 'refs/heads/' + branch, sha: commit.sha });
      return Math.round(content.length * 3 / 4);
    },
  };
}
module.exports = { githubBackup };

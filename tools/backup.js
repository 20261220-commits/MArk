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
    if (missing.includes(r.status)) return null;
    if (!r.ok) throw new Error(`GitHub ${method} ${p}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  return {
    async load() {
      const ref = await call('GET', '/git/ref/heads/' + branch); if (!ref) return null;
      const c = await call('GET', '/git/commits/' + ref.object.sha), t = await call('GET', '/git/trees/' + c.tree.sha), f = t && t.tree.find(x => x.path === file);
      if (!f) return null;
      const b = await call('GET', '/git/blobs/' + f.sha);
      return JSON.parse(zlib.gunzipSync(Buffer.from(b.content, 'base64')).toString('utf8'));
    },
    async save(obj) { // an object, or the backup already gzipped (a Buffer: the server writes it piece by piece)
      const content = (Buffer.isBuffer(obj) ? obj : zlib.gzipSync(Buffer.from(JSON.stringify(obj)))).toString('base64');
      const blob = await call('POST', '/git/blobs', { content, encoding: 'base64' });
      const tree = await call('POST', '/git/trees', { tree: [{ path: file, mode: '100644', type: 'blob', sha: blob.sha }] });
      const commit = await call('POST', '/git/commits', { message: 'world backup ' + new Date().toISOString(), tree: tree.sha, parents: [] });
      if (!await call('PATCH', '/git/refs/heads/' + branch, { sha: commit.sha, force: true }, [404, 422])) await call('POST', '/git/refs', { ref: 'refs/heads/' + branch, sha: commit.sha });
      return Math.round(content.length * 3 / 4);
    },
  };
}
module.exports = { githubBackup };

// Logging in with a nickname and a password (optional). Each world keeps its own accounts: the first time a nickname
// joins a world with a password the account is made there, after that the same password is needed for that name, and
// that player's inventory and place are kept by account. The password itself is never kept or sent: this device keeps
// a hash of it (the proof), and the world keeps a salted hash of that proof (js/mpcore.js).
const ACC = { user: null, cred: null }, ACC_KEY = 'nemo-account';
try { const a = JSON.parse(localStorage.getItem(ACC_KEY) || 'null'); if (a && a.user && typeof a.cred === 'string') Object.assign(ACC, { user: { name: String(a.user.name) }, cred: a.cred }); } catch (e) {} // (a Google sign-in from before is dropped)
function accSave() { try { localStorage.setItem(ACC_KEY, JSON.stringify(ACC.user ? ACC : null)); } catch (e) {} }
const accProof = (name, pw) => mpSha256('nemo-login\n' + name.toLowerCase() + '\n' + pw);
// what "join" carries: the nickname and its proof, or nothing
const accLoginMsg = () => ACC.user && ACC.cred ? { name: ACC.user.name, cred: ACC.cred } : null;
const accName = () => ACC.user ? ACC.user.name : MP.name;
function accLogin() {
  const st = $('accStatus'), name = ($('accName') ? $('accName').value : '').trim(), pw = $('accPass') ? $('accPass').value : '';
  const bad = !name ? '닉네임을 넣으세요' : name.length > 16 ? '닉네임은 16자까지입니다' : /\s/.test(name) ? '닉네임에는 띄어쓰기를 넣을 수 없습니다' : /[<>"'&\\]/.test(name) ? '닉네임에 < > " \' & \\ 는 쓸 수 없습니다' : pw.length < 4 ? '비밀번호는 4자 이상으로 하세요' : '';
  if (bad) { if (st) st.textContent = bad; return; }
  ACC.user = { name }; ACC.cred = accProof(name, pw); accSave();
  MP.name = name; try { localStorage.setItem(MP_NAME_KEY, MP.name); } catch (e) {}
  UI.flash(name + '(으)로 로그인했습니다'); showMenu('title');
}
function accLogout() { ACC.user = null; ACC.cred = null; accSave(); UI.flash('로그아웃했습니다'); showMenu('title'); }

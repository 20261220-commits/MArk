// Signing in with a Google account (optional). The player's name comes from the account, and a server that knows the
// same client ID checks the sign-in and keeps that player's inventory and place by account rather than by name, so no
// one else can play as them. Nothing but the sign-in token goes to the server; the game itself keeps no password.
const ACC = { user: null, token: null, exp: 0 }, ACC_KEY = 'nemo-account';
try { const a = JSON.parse(localStorage.getItem(ACC_KEY) || 'null'); if (a && a.user) Object.assign(ACC, a); } catch (e) {}
const accClientId = () => (NEMO_CONFIG && NEMO_CONFIG.googleClientId) || '';
const accToken = () => ACC.token && ACC.exp * 1000 > Date.now() + 60000 ? ACC.token : null; // a sign-in lasts an hour
function accSave() { try { localStorage.setItem(ACC_KEY, JSON.stringify(ACC)); } catch (e) {} }
let accGis = null;
function accLoadGis() {
  if (accGis) return accGis;
  return accGis = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(window.google); s.onerror = () => { accGis = null; rej(new Error('Google 로그인을 불러오지 못했습니다 (인터넷 연결 확인)')); }; document.head.appendChild(s); });
}
function accDecode(jwt) { const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(p + '==='.slice((p.length + 3) % 4))))); }
function accGot(resp) {
  let c; try { c = accDecode(resp.credential); } catch (e) { UI.flash('로그인 정보를 읽지 못했습니다'); return; }
  ACC.user = { sub: c.sub, name: c.name || c.given_name || (c.email || '').split('@')[0], email: c.email || '', picture: c.picture || '' }; ACC.token = resp.credential; ACC.exp = c.exp || 0; accSave();
  MP.name = ACC.user.name.replace(/\s+/g, '').slice(0, 16) || MP.name; try { localStorage.setItem(MP_NAME_KEY, MP.name); } catch (e) {}
  UI.flash(ACC.user.name + '(으)로 로그인했습니다'); if (UI.menu === 'account' || UI.menu === 'title') showMenu('title');
}
let accInit = false;
async function accStart() {
  const id = accClientId(); if (!id) return false;
  const g = await accLoadGis(); if (!accInit) { g.accounts.id.initialize({ client_id: id, callback: accGot, auto_select: true, cancel_on_tap_outside: true }); accInit = true; }
  return g;
}
// the account screen: Google draws its own button there
async function accShowButton() {
  const el = $('gsiBtn'), st = $('accStatus'); if (!el) return;
  if (!accClientId()) { if (st) st.innerHTML = 'Google 로그인을 쓰려면 이 게임을 올린 곳의 설정에 Google OAuth 클라이언트 ID가 있어야 합니다.<br>Render 서버라면 환경 변수 <b>GOOGLE_CLIENT_ID</b>, GitHub Pages라면 <b>js/config.js</b> (README 참고)'; return; }
  try { const g = await accStart(); g.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'ko' }); g.accounts.id.prompt(); }
  catch (e) { if (st) st.textContent = e.message; }
}
function accLogout() { if (window.google && google.accounts) try { google.accounts.id.disableAutoSelect(); } catch (e) {} ACC.user = null; ACC.token = null; ACC.exp = 0; accSave(); UI.flash('로그아웃했습니다'); showMenu('title'); }
// before joining a server: a fresh sign-in if the last one has run out (quietly, when Google allows it)
async function accFresh() {
  if (!ACC.user || accToken() || !accClientId()) return accToken();
  try { const g = await accStart(); await new Promise(r => { const t = setTimeout(r, 4000), cb = accGot; g.accounts.id.initialize({ client_id: accClientId(), auto_select: true, callback: resp => { clearTimeout(t); cb(resp); r(); } }); g.accounts.id.prompt(n => { if (n.isNotDisplayed() || n.isSkippedMoment()) { clearTimeout(t); r(); } }); }); } catch (e) {}
  return accToken();
}

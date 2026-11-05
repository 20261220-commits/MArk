// ---------- installing the game as an app (PWA) ----------
// The browser offers it once the page has its manifest and service worker (sw.js, registered in main.js); the title
// screen then shows "앱으로 설치". iPhone / iPad Safari never offers it: the button explains Share → 홈 화면에 추가.
const PWA = { evt: null, installed: false };
const pwaStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const pwaIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function pwaCanInstall() { return !pwaStandalone() && !PWA.installed && /^https?:$/.test(location.protocol) && !/\/dist\//.test(location.pathname) && (PWA.evt || pwaIOS()); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); PWA.evt = e; if (typeof UI !== 'undefined' && UI.menu === 'title' && typeof showMenu === 'function') showMenu('title'); });
addEventListener('appinstalled', () => { PWA.installed = true; PWA.evt = null; if (typeof UI !== 'undefined' && UI.menu === 'title' && typeof showMenu === 'function') showMenu('title'); if (typeof UI !== 'undefined' && UI.flash) UI.flash('앱으로 설치했습니다. 홈 화면이나 앱 목록에서 열 수 있습니다'); });
async function pwaInstall() {
  if (PWA.evt) { const e = PWA.evt; PWA.evt = null; try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === 'accepted') PWA.installed = true; } catch (er) {} if (typeof showMenu === 'function' && UI.menu === 'title') showMenu('title'); return; }
  if (pwaIOS()) alert('Safari 아래쪽의 공유 버튼(네모에 위쪽 화살표)을 누른 뒤 "홈 화면에 추가"를 고르면 앱처럼 설치됩니다.');
}

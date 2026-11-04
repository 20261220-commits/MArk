// ---------- key bindings (Java's 조작 설정): any action on any key ----------
// The game's handlers read the default keys (KeyW, Space, KeyE...). A chosen key is turned into its action's default key
// the moment it is pressed, before anything else sees it, so every part of the game follows the new keys; a default
// key whose action moved to another key does nothing any more (unless another action now uses it).
const KB_ACTIONS = [
  ['menu', '메뉴', [['pause', '일시 정지 (Esc)', 'Escape'], ['close', '창 닫기 (인벤토리·제작대·화로·상자 등, Esc)', 'Escape']]],
  ['move', '이동', [['forward', '앞으로', 'KeyW'], ['left', '왼쪽으로', 'KeyA'], ['back', '뒤로', 'KeyS'], ['right', '오른쪽으로', 'KeyD'], ['jump', '점프', 'Space'], ['sneak', '웅크리기', 'ShiftLeft'], ['sprint', '달리기', 'ControlLeft']]],
  ['play', '게임 플레이', [['pick', '블록 고르기', 'KeyG'], ['drop', '선택한 아이템 버리기', 'KeyQ'], ['swap', '보조 손과 아이템 바꾸기', 'KeyF']]],
  ['inv', '인벤토리', [['inventory', '인벤토리 열기/닫기', 'KeyE'], ['adv', '발전 과제', 'KeyL'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ['hot' + n, '단축바 ' + n + '번 칸', 'Digit' + n])]],
  ['multi', '멀티플레이', [['chat', '채팅 열기', 'KeyT'], ['command', '명령어 입력', 'Slash'], ['list', '플레이어 목록', 'Tab']]],
  ['misc', '기타', [['hud', 'HUD 숨기기', 'F1'], ['shot', '스크린샷', 'F2'], ['debug', '디버그 화면', 'F3'], ['view', '시점 전환', 'F5'], ['full', '전체 화면', 'F11']]],
];
const KB_DEF = {}; for (const [, , l] of KB_ACTIONS) for (const [id, , code] of l) KB_DEF[id] = code;
const KB = { wait: null }; // the action waiting for a key on the controls screen
const kbGet = id => (OPT.keys && OPT.keys[id]) || KB_DEF[id];
// pausing and closing a window both reach the game as Esc, each only where it belongs: the close key while a window (the
// inventory, a crafting table, a furnace, a chest...) or the chat is open, the pause key otherwise. A part with no key
// keeps Esc, so nobody is ever locked in a window or out of the menu.
const KB_ESC = new Set(['pause', 'close']);
function kbMap(code) { // the key the game should see for a key pressed
  const k = OPT.keys; if (!k) return code;
  const inWin = typeof UI !== 'undefined' && !!(UI.screen || UI.chatOpen), own = inWin ? 'close' : 'pause', want = kbGet(own);
  if (code === want || (code === 'Escape' && want === 'Unbound')) return 'Escape';
  if (code === kbGet(inWin ? 'pause' : 'close') && code !== 'Escape') return 'Unbound'; // (the other one's key does nothing here)
  for (const id in k) if (!KB_ESC.has(id) && k[id] === code) return KB_DEF[id]; // a chosen key: its action's own key
  if (code === 'Escape') return 'Unbound'; // Esc has gone to another key for this part
  for (const id in k) if (!KB_ESC.has(id) && KB_DEF[id] === code && k[id] !== code) return 'Unbound'; // a default key whose action has gone elsewhere
  return code;
}
// how a key is written on the screen
const KB_NAMES = { Escape: 'Esc', Space: 'Space', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps Lock', Slash: '/', Backslash: '\\', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'Page Up', PageDown: 'Page Down', MetaLeft: '검색/윈도우 키', Unbound: '없음' };
const kbName = c => !c ? '없음' : KB_NAMES[c] || (/^Key[A-Z]$/.test(c) ? c.slice(3) : /^Digit\d$/.test(c) ? c.slice(5) : /^Numpad/.test(c) ? '숫자패드 ' + c.slice(6) : c);
// pressed keys: a key being chosen on the controls screen is taken here; otherwise the chosen keys are turned into the
// game's own (not while typing in a box)
for (const type of ['keydown', 'keyup']) addEventListener(type, e => {
  if (KB.wait) { e.preventDefault(); e.stopImmediatePropagation(); if (type !== 'keydown') return; kbSet(KB.wait, e.code === 'Escape' ? (KB_ESC.has(KB.wait) ? 'Escape' : 'Unbound') : e.code); return; } // (Esc: no key - for pausing and closing, back to Esc)
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  const m = kbMap(e.code); if (m !== e.code) Object.defineProperty(e, 'code', { value: m });
}, true);
function kbSet(id, code) {
  KB.wait = null; OPT.keys = OPT.keys || {};
  if (code === KB_DEF[id]) delete OPT.keys[id]; else OPT.keys[id] = code;
  if (!Object.keys(OPT.keys).length) delete OPT.keys;
  saveOpt(); if (typeof keys !== 'undefined' && keys.clear) keys.clear(); showMenu('controls');
}
function kbReset(id) { if (id) { if (OPT.keys) delete OPT.keys[id]; if (OPT.keys && !Object.keys(OPT.keys).length) delete OPT.keys; } else delete OPT.keys; saveOpt(); showMenu('controls'); }
// the screen: every action with its key; a key used twice in red (as Java)
function kbHtml(more = '') { // more: help shown at the end of the list
  const used = {}; for (const id in KB_DEF) { const c = kbGet(id); if (c && c !== 'Unbound') (used[c] = used[c] || []).push(id); }
  const row = ([id, name]) => { const c = kbGet(id), dup = c !== 'Unbound' && used[c] && used[c].filter(o => o !== id && !(KB_ESC.has(o) && KB_ESC.has(id))).length > 0 /* (pausing and closing may share a key: they never meet) */, wait = KB.wait === id;
    return `<div class="kbrow"><span>${name}</span><button class="kbkey ${dup ? 'dup' : ''} ${wait ? 'wait' : ''}" data-act="kbset_${id}">${wait ? '&gt; 키를 누르세요 &lt;' : esc(kbName(c))}</button><button class="kbreset" data-act="kbreset_${id}" ${c === KB_DEF[id] ? 'disabled' : ''}>초기화</button></div>`; };
  return `<h2>조작 설정</h2><p class="muted">바꿀 동작의 키를 누른 다음 새 키를 누르세요 (Esc: 키 없음). 빨간 키는 두 동작에 함께 쓰이고 있습니다.</p>
<div class="kblist">${KB_ACTIONS.map(([, title, l]) => `<h3>${title}</h3>${l.map(row).join('')}`).join('')}
<h3>마우스 (바꿀 수 없음)</h3><div class="kbrow"><span>공격 · 캐기</span><b>좌클릭</b></div><div class="kbrow"><span>사용 · 놓기</span><b>우클릭</b></div><div class="kbrow"><span>블록 고르기</span><b>휠 클릭</b></div>
<p class="muted"><b>일시 정지</b>는 게임 중에, <b>창 닫기</b>는 인벤토리·제작대·화로·상자 같은 창이 열려 있을 때 쓰이는 키라 서로 다른 키로 정할 수 있습니다. 일시 정지 키를 바꿔도, 마우스가 화면에 잡혀 있을 때 Esc를 누르면 브라우저가 마우스를 풀어 게임이 멈춥니다 (브라우저 규칙). 설정의 <b>전체 화면 + 키 잠금</b>을 켜면 Esc도 다른 동작에 쓸 수 있습니다.</p>${more}</div>
<div class="btngrid">${btn('모두 초기화', 'kbresetall')}${btn('완료', UI.paused && W.active ? 'pause' : 'title')}</div>`;
}

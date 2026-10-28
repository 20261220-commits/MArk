# 작업 규칙

- 사용자와는 한국어로 이야기합니다.
- 변경할 때마다: 빌드(`node tools/build.js`) → 커밋 → 푸시 → PR → **PR 머지까지** 합니다. 사용자가 업데이트마다 머지를 맡겼습니다(따로 묻지 않음). 그다음 게임 아티팩트(dist/nemo-1.18.html)도 다시 올립니다.
- 머지 전에 `node tools/check.js` 로 모든 스크립트의 문법과 "코드를 삼킨 `//` 주석"을 검사합니다 (한 줄 코드 끝의 `//` 주석이 괄호를 삼켜 서버가 안 켜진 적이 있음).
- 게임을 바꾼 뒤에는 관련 시험을 돌립니다: `node tools/tests/run.js [이름]` (예: `sp_inventory`, `mp_basic`; 이름 없이 전부). Playwright가 필요합니다.
- Mojang 파일(client.jar 의 텍스처·구조물 등)은 저장소에 넣지 않습니다. jar 는 사용자의 브라우저 안에서만 변환합니다.
- 멀티플레이 서버는 Render(`mark-w65a.onrender.com`, `node tools/server.js`)에서 돌아갑니다.

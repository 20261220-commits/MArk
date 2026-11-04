# ⚠️ 최우선 할 일 (사용자가 직접 해야 함 — 새 대화를 시작하면 먼저 사용자에게 상기시킬 것)

**멀티 서버 세계 GitHub 백업 켜기** (아직 안 됨, 2026-11-04 기록)
- 문제: Render 무료 요금제는 재시작·재배포(머지할 때마다)마다 디스크를 지워서 서버 세계와 플레이어 기록이 사라짐. `GITHUB_BACKUP_REPO`·`GITHUB_TOKEN` 이 비어 있어 백업이 꺼진 상태로 보임(이 저장소에 `world-backup` 브랜치 없음).
- 사용자가 할 일:
  1. https://github.com/new 에서 **비공개** 백업 저장소 만들기 (예: `nemo-backup`)
  2. https://github.com/settings/personal-access-tokens/new 에서 Fine-grained 토큰 만들기 — 그 저장소 하나만, Permissions → Contents: **Read and write** (Developer settings 는 프로필 사진 → Settings 맨 아래, 휴대폰은 데스크톱 사이트로)
  3. Render → nemo-server → Environment 에 `GITHUB_BACKUP_REPO=20261220-commits/nemo-backup`, `GITHUB_TOKEN=<토큰>` 넣고 저장 (토큰은 채팅에 붙여 넣지 말 것)
- 끝난 뒤 확인: 백업 저장소에 `world-backup` 브랜치가 생겼는지 (저장소를 세션에 연결하면 `gh api` 로 확인 가능). 확인되면 이 항목을 지운다.
- 그전까지 세계가 사라지면: 멀티플레이 서버 목록 맨 위 🔄 "되살려 주세요" → 되살리기 (평소 쓰던 브라우저에 사본이 있을 때만).

# 작업 규칙

- 사용자와는 한국어로 이야기합니다.
- 변경할 때마다: 빌드(`node tools/build.js`) → 커밋 → 푸시 → PR → **PR 머지까지** 합니다. 사용자가 업데이트마다 머지를 맡겼습니다(따로 묻지 않음). 그다음 게임 아티팩트(dist/nemo-1.18.html)도 다시 올립니다.
- 머지 전에 `node tools/check.js` 로 모든 스크립트의 문법과 "코드를 삼킨 `//` 주석"을 검사합니다 (한 줄 코드 끝의 `//` 주석이 괄호를 삼켜 서버가 안 켜진 적이 있음).
- 게임을 바꾼 뒤에는 관련 시험을 돌립니다: `node tools/tests/run.js [이름]` (예: `sp_inventory`, `mp_basic`; 이름 없이 전부). Playwright가 필요합니다.
- Mojang 파일(client.jar 의 텍스처·구조물 등)은 저장소에 넣지 않습니다. jar 는 사용자의 브라우저 안에서만 변환합니다.
- 멀티플레이 서버는 Render(`mark-w65a.onrender.com`, `node tools/server.js`)에서 돌아갑니다.

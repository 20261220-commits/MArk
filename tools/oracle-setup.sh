#!/usr/bin/env bash
# 네모 대륙 서버를 Oracle Cloud (Always Free) 같은 리눅스 서버에 설치하거나 업데이트합니다.
#   curl -fsSL https://raw.githubusercontent.com/20261220-commits/MArk/main/tools/oracle-setup.sh | sudo bash
# 하는 일: Node.js 와 게임 서버(tools/server.js)를 설치해 늘 켜 두고(재부팅해도), 방화벽에서 80·443 을 열고,
# Caddy 로 https 주소(<공인 IP>.sslip.io, 인증서 자동)를 만들어 게임이 wss:// 로 접속할 수 있게 합니다.
# 다시 실행하면 게임을 최신으로 업데이트합니다 (세계는 /opt/nemo-worlds 에 그대로 남습니다).
set -euo pipefail
REPO=https://github.com/20261220-commits/MArk.git
APP=/opt/nemo; WORLDS=/opt/nemo-worlds; NODE_VER=22.11.0; CADDY_VER=2.8.4
say() { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "sudo 로 실행해 주세요: curl -fsSL ... | sudo bash"; exit 1; }
case "$(uname -m)" in x86_64) NA=x64; CA=amd64 ;; aarch64|arm64) NA=arm64; CA=arm64 ;; *) echo "지원하지 않는 CPU: $(uname -m)"; exit 1 ;; esac

say "필요한 도구 (git, curl)"
if command -v apt-get >/dev/null; then apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl tar xz-utils iptables-persistent >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl tar xz-utils >/dev/null
elif command -v dnf >/dev/null; then dnf install -y -q git curl tar xz >/dev/null
elif command -v yum >/dev/null; then yum install -y -q git curl tar xz >/dev/null; fi

say "Node.js $NODE_VER"
if [ ! -x /opt/node/bin/node ] || [ "$(/opt/node/bin/node -v)" != "v$NODE_VER" ]; then
  rm -rf /opt/node && mkdir -p /opt/node
  curl -fsSL "https://nodejs.org/dist/v$NODE_VER/node-v$NODE_VER-linux-$NA.tar.xz" | tar -xJ -C /opt/node --strip-components=1
fi
/opt/node/bin/node -v

say "게임 받기 / 업데이트 ($APP)"
if [ -d "$APP/.git" ]; then git -C "$APP" fetch -q origin main && git -C "$APP" reset -q --hard origin/main; else git clone -q --depth 1 "$REPO" "$APP"; fi
mkdir -p "$WORLDS"

say "공인 IP 와 https 주소"
IP=$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)
HOST="$(echo "$IP" | tr . -).sslip.io"
echo "IP: $IP  →  주소: $HOST"

# settings kept between runs; GitHub backup is asked only the first time (Enter skips it)
ENVF=/etc/nemo.env
if [ ! -f "$ENVF" ]; then
  BR=""; BT=""
  if [ -r /dev/tty ]; then
    echo; echo "Render 에서 쓰던 GitHub 백업을 이어 쓰면 기존 서버 세계가 그대로 돌아옵니다 (없으면 그냥 Enter)."
    read -r -p "GITHUB_BACKUP_REPO (예: 이름/저장소): " BR < /dev/tty || true
    if [ -n "$BR" ]; then read -r -s -p "GITHUB_TOKEN: " BT < /dev/tty || true; echo; fi
  fi
  printf 'PORT=8080\nWORLDS_DIR=%s\nKEEP_AWAKE=0\n' "$WORLDS" > "$ENVF"
  if [ -n "$BR" ]; then echo "GITHUB_BACKUP_REPO=$BR" >> "$ENVF"; fi
  if [ -n "$BT" ]; then echo "GITHUB_TOKEN=$BT" >> "$ENVF"; fi
  chmod 600 "$ENVF"
fi

say "게임 서버를 늘 켜 두기 (systemd: nemo)"
cat > /etc/systemd/system/nemo.service <<EOF
[Unit]
Description=Nemo game server
After=network-online.target
Wants=network-online.target
[Service]
EnvironmentFile=$ENVF
WorkingDirectory=$APP
ExecStart=/opt/node/bin/node $APP/tools/server.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

say "Caddy $CADDY_VER (https 인증서 자동)"
if [ ! -x /usr/local/bin/caddy ] || ! /usr/local/bin/caddy version | grep -q "v$CADDY_VER"; then
  curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v$CADDY_VER/caddy_${CADDY_VER}_linux_$CA.tar.gz" | tar -xz -C /usr/local/bin caddy
fi
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
$HOST {
	reverse_proxy localhost:8080
}
EOF
cat > /etc/systemd/system/caddy-nemo.service <<EOF
[Unit]
Description=Caddy for the Nemo server
After=network-online.target nemo.service
Wants=network-online.target
[Service]
Environment=HOME=/var/lib/caddy
ExecStartPre=/bin/mkdir -p /var/lib/caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

say "서버 안쪽 방화벽에서 80·443 열기"
if command -v firewall-cmd >/dev/null && systemctl is-active -q firewalld; then
  firewall-cmd -q --permanent --add-service=http --add-service=https && firewall-cmd -q --reload
else
  for p in 443 80; do iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport $p -j ACCEPT; done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true
fi

systemctl daemon-reload
systemctl enable -q nemo caddy-nemo
systemctl restart nemo caddy-nemo
sleep 4
if curl -fsS -o /dev/null http://localhost:8080/; then echo "게임 서버: 켜짐"; else echo "게임 서버가 아직 안 켜졌습니다: journalctl -u nemo -n 30"; fi

say "끝났습니다"
cat <<EOF
게임의 멀티플레이 화면에서 서버 주소에 아래를 넣으세요:
    $HOST
(이 주소로 브라우저에서 바로 게임도 열립니다: https://$HOST )

https 인증서는 처음 1~2분 안에 자동으로 받아집니다. 접속이 안 되면:
  1) Oracle 콘솔의 보안 목록(Security List)에 80, 443 포트 규칙을 넣었는지 확인
  2) 기록 보기: sudo journalctl -u caddy-nemo -n 40   /   sudo journalctl -u nemo -n 40
게임 업데이트: 이 명령을 다시 실행하면 됩니다.
EOF

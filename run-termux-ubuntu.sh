#!/usr/bin/env bash
set -e

PORT=${PORT:-3000}

if ! command -v apt >/dev/null 2>&1 || ! grep -qi ubuntu /etc/os-release 2>/dev/null; then
  echo "Run this script inside your Ubuntu environment in Termux"
  exit 1
fi

apt update
DEBIAN_FRONTEND=noninteractive apt install -y git openjdk-17-jre-headless tmux curl

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed 's/v//' | awk -F. '{print $1}')
else
  NODE_MAJOR=0
fi

if [ "$NODE_MAJOR" -lt 16 ]; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  DEBIAN_FRONTEND=noninteractive apt install -y nodejs
else
  DEBIAN_FRONTEND=noninteractive apt install -y nodejs npm
fi

if [ ! -d "$(pwd)/.git" ]; then
  if [ ! -d /root/SproutMC ]; then
    git clone https://github.com/jcfrancisco0103/SproutMC.git /root/SproutMC
  fi
  cd /root/SproutMC
fi

if [ ! -f config.json ]; then
  echo '{"instanceRoot":"instances/default","javaPath":"/usr/bin/java","serverJar":"instances/default/server.jar","jvmArgs":[],"autoRestart":true,"autoRestartMaxBackoffSeconds":300,"terminalElevate":false,"aikarFlags":true}' > config.json
  mkdir -p instances/default
fi

npm ci || npm install
PORT=${PORT} npm start

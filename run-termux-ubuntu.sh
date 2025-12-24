#!/usr/bin/env bash
set -e

PORT=${PORT:-3000}

if ! command -v apt >/dev/null 2>&1 || ! grep -qi ubuntu /etc/os-release 2>/dev/null; then
  echo "Run this script inside your Ubuntu environment in Termux"
  exit 1
fi

apt update
DEBIAN_FRONTEND=noninteractive apt install -y git openjdk-17-jre-headless tmux curl

if ! command -v gpg >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt install -y gnupg
fi
curl -SsL https://playit-cloud.github.io/ppa/key.gpg | gpg --dearmor | tee /etc/apt/trusted.gpg.d/playit.gpg >/dev/null
echo "deb [signed-by=/etc/apt/trusted.gpg.d/playit.gpg] https://playit-cloud.github.io/ppa/data ./" | tee /etc/apt/sources.list.d/playit-cloud.list
apt update
DEBIAN_FRONTEND=noninteractive apt install -y playit

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed 's/v//' | awk -F. '{print $1}')
else
  NODE_MAJOR=0
fi

if [ "$NODE_MAJOR" -lt 16 ]; then
  set +e
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  DEBIAN_FRONTEND=noninteractive apt purge -y libnode-dev nodejs npm
  DEBIAN_FRONTEND=noninteractive apt -y -o Dpkg::Options::=--force-overwrite install nodejs
  NODE_INSTALL_RC=$?
  set -e
  if [ "$NODE_INSTALL_RC" -ne 0 ]; then
    export NVM_DIR="$HOME/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    fi
    . "$NVM_DIR/nvm.sh"
    nvm install 18
    nvm use 18
  fi
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

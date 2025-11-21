#!/usr/bin/env bash
set -e

PORT=${PORT:-3000}

if command -v apt >/dev/null 2>&1 && grep -qi ubuntu /etc/os-release 2>/dev/null; then
  apt update
  DEBIAN_FRONTEND=noninteractive apt install -y git nodejs npm openjdk-17-jre-headless tmux curl
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
  exit 0
fi

if command -v proot-distro >/dev/null 2>&1; then
  proot-distro login ubuntu -- bash -lc "\
    set -e; \
    apt update; \
    DEBIAN_FRONTEND=noninteractive apt install -y git nodejs npm openjdk-17-jre-headless tmux curl; \
    if [ ! -d /root/SproutMC ]; then git clone https://github.com/jcfrancisco0103/SproutMC.git /root/SproutMC; fi; \
    cd /root/SproutMC; \
    if [ ! -f config.json ]; then echo '{\"instanceRoot\":\"instances/default\",\"javaPath\":\"/usr/bin/java\",\"serverJar\":\"instances/default/server.jar\",\"jvmArgs\":[],\"autoRestart\":true,\"autoRestartMaxBackoffSeconds\":300,\"terminalElevate\":false,\"aikarFlags\":true}' > config.json; mkdir -p instances/default; fi; \
    npm ci || npm install; \
    PORT=${PORT} npm start"
  exit 0
fi

echo "Ubuntu environment not detected. Run inside Ubuntu or install proot-distro."

#!/usr/bin/env bash
set -e

if ! command -v pkg >/dev/null 2>&1; then
  echo "Run this script inside Termux"
  exit 1
fi

pkg update -y
pkg upgrade -y
pkg install -y proot-distro

if ! proot-distro list | grep -qi "ubuntu.*installed"; then
  proot-distro install ubuntu
fi

PORT=${PORT:-3000}

proot-distro login ubuntu -- bash -lc "\
  set -e; \
  apt update; \
  DEBIAN_FRONTEND=noninteractive apt install -y git nodejs npm openjdk-17-jre-headless tmux curl; \
  if [ ! -d /root/SproutMC ]; then \
    git clone https://github.com/jcfrancisco0103/SproutMC.git /root/SproutMC; \
  fi; \
  cd /root/SproutMC; \
  if [ ! -f config.json ]; then \
    echo '{"instanceRoot":"instances/default","javaPath":"/usr/bin/java","serverJar":"instances/default/server.jar","jvmArgs":[],"autoRestart":true,"autoRestartMaxBackoffSeconds":300,"terminalElevate":false,"aikarFlags":true,"auth":{"username":"admin","passwordHash":"$2a$10$u2bqk0qC1k8x1jv7kH2V1u0vVYbXrYwQG9nR2sDk9cQ5ZCfmOqY1e","jwtSecret":"sproutmc-secret"}}' > config.json; \
    mkdir -p instances/default; \
  fi; \
  PORT=${PORT} npm start"


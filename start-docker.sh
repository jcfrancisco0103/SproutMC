#!/bin/bash
# Quick start script for Podman/Docker deployment (Podman-first on Termux)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect environment
IS_TERMUX=false
if [ -d "/data/data/com.termux" ]; then
  IS_TERMUX=true
  echo "🍅 Detected Termux environment"
fi

# Detect Podman or Docker
CONTAINER_CMD=""
COMPOSE_CMD=""

if command -v podman &> /dev/null; then
  CONTAINER_CMD="podman"
  COMPOSE_CMD="podman-compose"
  echo "🍅 Using Podman"
elif command -v docker &> /dev/null; then
  CONTAINER_CMD="docker"
  COMPOSE_CMD="docker-compose"
  echo "🐳 Using Docker"
else
  echo "❌ Error: Neither Podman nor Docker found."
  echo ""
  echo "For Termux Ubuntu, install Podman:"
  echo "  sudo apt-get install -y podman"
  echo "  pip install podman-compose"
  exit 1
fi

# Check if config.json exists
if [ ! -f "config.json" ]; then
  echo "⚙️  Creating default config.json..."
  cat > config.json << 'EOF'
{
  "port": 3000,
  "instanceRoot": "instances/default",
  "javaPath": "/usr/bin/java",
  "serverJar": "server.jar",
  "jvmArgs": "-Xmx2G -Xms2G",
  "auth": {
    "enabled": false,
    "users": {}
  }
}
EOF
  echo "✓ Created config.json - update settings in UI"
fi

# Create necessary directories
mkdir -p data logs backups instances

echo "🔨 Building image..."
$CONTAINER_CMD build -t sproutmc:latest .

echo ""
echo "🚀 Starting services with $COMPOSE_CMD..."

# Use Podman-specific compose file if available
if [ "$CONTAINER_CMD" = "podman" ] && [ -f "docker-compose.podman.yml" ]; then
  echo "(Using Podman-optimized configuration)"
  $COMPOSE_CMD -f docker-compose.podman.yml up -d
else
  $COMPOSE_CMD up -d
fi

echo ""
echo "⏳ Waiting for service to be ready (5 seconds)..."
sleep 5

# Check health
if $CONTAINER_CMD ps | grep -q sproutmc; then
  echo "✓ Container is running"
  PORT=$(grep -oP 'ports:\s*-\s*"\K[0-9]+' docker-compose.yml | head -1 || echo "3000")
  echo ""
  echo "╔════════════════════════════════════════╗"
  echo "║   SproutMC is running!                 ║"
  echo "╠════════════════════════════════════════╣"
  echo "║   http://localhost:$PORT"
  echo "╚════════════════════════════════════════╝"
  echo ""
  echo "📚 Useful commands:"
  echo "  View logs:     $COMPOSE_CMD logs -f sproutmc"
  echo "  Stop:          $COMPOSE_CMD stop"
  echo "  Start:         $COMPOSE_CMD start"
  echo "  Restart:       $COMPOSE_CMD restart"
  echo "  Remove:        $COMPOSE_CMD down"
  echo ""
  if [ "$IS_TERMUX" = true ]; then
    echo "🍅 Termux tip: Access from host phone at:"
    HOSTNAME=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "YOUR_TERMUX_IP")
    echo "  http://$HOSTNAME:$PORT"
  fi
  echo ""
else
  echo "❌ Failed to start container"
  $COMPOSE_CMD logs sproutmc
  exit 1
fi

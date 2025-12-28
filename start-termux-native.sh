#!/bin/bash
# SproutMC on Termux - Alternative: Run without container (Termux native)
# Use this if Docker/Podman issues persist in Termux environment

set -e

echo "╔════════════════════════════════════════════╗"
echo "║   SproutMC for Termux (Native Mode)       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Installing..."
  apt-get update
  apt-get install -y nodejs npm
fi

# Check if Java is installed
if ! command -v java &> /dev/null; then
  echo "❌ Java not found. Installing Java 17..."
  apt-get update
  apt-get install -y openjdk-17-jre-headless
fi

echo "✓ Node.js: $(node --version)"
echo "✓ NPM: $(npm --version)"
echo "✓ Java: $(java -version 2>&1 | head -1)"
echo ""

# Create config.json if missing
if [ ! -f "config.json" ]; then
  echo "⚙️  Creating default config.json..."
  cat > config.json << 'EOF'
{
  "port": 3000,
  "instanceRoot": "instances/default",
  "javaPath": "/usr/bin/java",
  "serverJar": "server.jar",
  "jvmArgs": "-Xmx1G -Xms1G",
  "auth": {
    "enabled": false,
    "users": {}
  }
}
EOF
  echo "✓ Created config.json"
fi

# Create directories
mkdir -p data logs backups instances

# Install dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
npm install

# Start the server
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   Starting SproutMC (Native Mode)        ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "🌐 Access at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm start

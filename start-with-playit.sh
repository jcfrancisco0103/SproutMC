#!/usr/bin/env bash
set -euo pipefail

# Get script directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting SproutMC Services ===${NC}\n"

# Start playit in the background
echo -e "${BLUE}Starting playit...${NC}"

# Kill any existing playit processes
pkill -f playit || true

# Start playit in background and redirect output to log file
mkdir -p logs
nohup playit > logs/playit.log 2>&1 &
PLAYIT_PID=$!

echo -e "${GREEN}✓ Playit started (PID: ${PLAYIT_PID})${NC}"
echo $PLAYIT_PID > logs/playit.pid

# Wait a moment for playit to start
sleep 2

# Check if playit is still running
if ps -p $PLAYIT_PID > /dev/null; then
  echo -e "${GREEN}✓ Playit is running successfully${NC}"
else
  echo -e "${RED}✗ Playit failed to start. Check logs/playit.log for details${NC}"
fi

# Set port for SproutMC
PORT="${PORT:-3000}"
export PORT

echo -e "\n${BLUE}Starting SproutMC website on port ${PORT}...${NC}"
echo -e "${GREEN}=== Services Ready ===${NC}\n"

# Start the Node.js server
npm start

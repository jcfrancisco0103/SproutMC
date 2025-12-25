#!/usr/bin/env bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== SproutMC Service Status ===${NC}\n"

# Check Node.js server
echo -e "${YELLOW}Node.js Server:${NC}"
if pgrep -f "node src/server.js" > /dev/null; then
  PID=$(pgrep -f "node src/server.js")
  echo -e "${GREEN}✓ Running (PID: ${PID})${NC}"
else
  echo -e "${RED}✗ Not running${NC}"
fi

echo ""

# Check playit
echo -e "${YELLOW}Playit Service:${NC}"
if pgrep -f playit > /dev/null; then
  PID=$(pgrep -f playit)
  echo -e "${GREEN}✓ Running (PID: ${PID})${NC}"
  
  if [ -f logs/playit.pid ]; then
    STORED_PID=$(cat logs/playit.pid)
    echo -e "  Stored PID: ${STORED_PID}"
  fi
else
  echo -e "${RED}✗ Not running${NC}"
fi

echo ""

# Show recent playit logs if available
if [ -f logs/playit.log ]; then
  echo -e "${YELLOW}Recent Playit Logs (last 10 lines):${NC}"
  tail -n 10 logs/playit.log
fi

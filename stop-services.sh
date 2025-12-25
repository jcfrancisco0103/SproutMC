#!/usr/bin/env bash
set -euo pipefail

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Stopping SproutMC Services ===${NC}"

# Stop playit
if [ -f logs/playit.pid ]; then
  PLAYIT_PID=$(cat logs/playit.pid)
  if ps -p $PLAYIT_PID > /dev/null 2>&1; then
    echo -e "${YELLOW}Stopping playit (PID: ${PLAYIT_PID})...${NC}"
    kill $PLAYIT_PID || true
    echo -e "${GREEN}✓ Playit stopped${NC}"
  else
    echo -e "${YELLOW}Playit process not found${NC}"
  fi
  rm -f logs/playit.pid
else
  echo -e "${YELLOW}No playit PID file found${NC}"
fi

# Kill any remaining playit processes
if pkill -f playit 2>/dev/null; then
  echo -e "${GREEN}✓ Cleaned up remaining playit processes${NC}"
fi

# Kill any remaining Node.js server processes for this project
if pkill -f "node src/server.js" 2>/dev/null; then
  echo -e "${GREEN}✓ Stopped Node.js server${NC}"
fi

echo -e "${GREEN}=== All services stopped ===${NC}"

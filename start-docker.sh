#!/bin/bash
# Start SproutMC (Native Mode on Termux) with optional playit tunneling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SproutMC for Termux (Native Mode)       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check for playit flag
USE_PLAYIT=false
if [ "$1" = "--playit" ] || [ "$1" = "-playit" ]; then
  USE_PLAYIT=true
fi

# Start playit if requested
if [ "$USE_PLAYIT" = true ]; then
  echo -e "${BLUE}Starting playit tunneling...${NC}"
  
  if command -v playit &> /dev/null; then
    mkdir -p logs
    
    # Kill any existing playit processes
    pkill -f playit || true
    
    # Start playit in background
    nohup playit > logs/playit.log 2>&1 &
    PLAYIT_PID=$!
    echo -e "${GREEN}✓ Playit started (PID: $PLAYIT_PID)${NC}"
    echo $PLAYIT_PID > logs/playit.pid
    
    sleep 2
    
    if ps -p $PLAYIT_PID > /dev/null; then
      echo -e "${GREEN}✓ Playit is running${NC}"
      echo -e "${YELLOW}Check logs/playit.log for tunnel URL${NC}"
    else
      echo -e "${RED}✗ Playit failed to start${NC}"
    fi
    echo ""
  else
    echo -e "${RED}✗ Playit not found. Install with: curl -SsL https://playit.cloud/install.sh | bash${NC}"
  fi
fi

# Run native startup
exec ./start-termux-native.sh


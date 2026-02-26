#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[info]${NC} $*"; }
success() { echo -e "${GREEN}[ok]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
fatal()   { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── Verify location ──────────────────────────────
if [ ! -f "docker-compose.yml" ]; then
  fatal "Not in an OpenLoom directory. Run: cd ~/openloom && ./update.sh"
fi

if [ ! -f ".env" ]; then
  fatal "No .env file found. Run install.sh first."
fi

# ── Read config ──────────────────────────────────
DOMAIN=$(sed -n 's/^DOMAIN=//p' .env | head -1)
if [ -z "$DOMAIN" ]; then
  fatal "DOMAIN not set in .env. Add: DOMAIN=your-domain.com"
fi

echo ""
echo -e "${BOLD}  Updating OpenLoom (${DOMAIN})...${NC}"
echo ""

# ── Ensure swap ──────────────────────────────────
if [ -f /proc/meminfo ]; then
  TOTAL_RAM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  SWAP_TOTAL=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
  AVAILABLE=$((TOTAL_RAM + SWAP_TOTAL))

  if [ "$AVAILABLE" -lt 2048 ] && [ "$(id -u)" = "0" ]; then
    if [ ! -f /swapfile ]; then
      info "Creating swap for build..."
      fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
      chmod 600 /swapfile
      mkswap /swapfile >/dev/null
    fi
    swapon /swapfile 2>/dev/null || true
    success "Swap active"
  fi
fi

# ── Pull latest ──────────────────────────────────
if [ -d ".git" ]; then
  info "Pulling latest changes..."
  git pull origin main || fatal "git pull failed. Check your network and try again."
else
  fatal "Not a git repository. Re-install:
  curl -fsSL https://raw.githubusercontent.com/DukeDeSouth/OpenLoom/main/install.sh | bash"
fi

# ── Remove dev override if present ───────────────
if [ -f "docker-compose.override.yml" ]; then
  mv docker-compose.override.yml docker-compose.override.yml.dev
  info "Dev override moved aside"
fi

# ── Build ────────────────────────────────────────
info "Rebuilding containers..."

IS_TTY=false
if [ -t 0 ] && [ -t 1 ]; then
  IS_TTY=true
fi

if [ "$IS_TTY" = true ]; then
  docker compose build --pull 2>&1 | while IFS= read -r line; do
    case "$line" in
      *"DONE"*|*"FINISHED"*|*"exporting"*|*"Built"*|*"ERROR"*)
        echo -e "  ${BLUE}>${NC} $line"
        ;;
    esac
  done
else
  docker compose build --pull --quiet
fi

success "Build complete"

# ── Restart ──────────────────────────────────────
info "Restarting services..."
docker compose up -d

# ── Wait for healthy ─────────────────────────────
APP_URL="https://${DOMAIN}"
info "Waiting for ${APP_URL}..."

SPINNER='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
TIMEOUT=240
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${APP_URL}/api/ping" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    if [ "$IS_TTY" = true ]; then
      echo -ne "\r\033[K"
    fi
    echo ""
    success "OpenLoom updated!"
    echo -e "  ${BOLD}${APP_URL}${NC}"
    echo ""
    exit 0
  fi

  if [ "$IS_TTY" = true ]; then
    i=$(( ELAPSED % ${#SPINNER} ))
    echo -ne "\r  ${SPINNER:$i:1} Waiting... (${ELAPSED}s)"
  elif [ $(( ELAPSED % 15 )) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
    info "Still starting... (${ELAPSED}s)"
  fi

  sleep 3
  ELAPSED=$(( ELAPSED + 3 ))
done

echo ""
warn "Still starting after ${TIMEOUT}s. Check logs:"
echo "  docker compose logs -f"
echo "  docker compose logs caddy --tail 20"
echo "  docker compose logs app --tail 20"

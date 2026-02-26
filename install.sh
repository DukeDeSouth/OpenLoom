#!/usr/bin/env bash
set -euo pipefail

# ── Colors & helpers ─────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[info]${NC} $*"; }
success() { echo -e "${GREEN}[ok]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
error()   { echo -e "${RED}[error]${NC} $*" >&2; }
fatal()   { error "$*"; exit 1; }

command_exists() { command -v "$1" &>/dev/null; }

REPO_URL="https://github.com/openloom/OpenLoom.git"
INSTALL_DIR="${OPENLOOM_DIR:-$HOME/openloom}"

# ── Banner ───────────────────────────────────────
echo ""
echo -e "${BOLD}  ┌──────────────────────────────┐${NC}"
echo -e "${BOLD}  │        ${BLUE}OpenLoom${NC}${BOLD}              │${NC}"
echo -e "${BOLD}  │  Self-hosted video platform   │${NC}"
echo -e "${BOLD}  └──────────────────────────────┘${NC}"
echo ""

# ── Preflight: required tools ────────────────────
info "Checking prerequisites..."

if ! command_exists docker; then
  fatal "Docker is not installed.
  Install it: https://docs.docker.com/get-docker/
  Then run this script again."
fi

if ! docker compose version &>/dev/null; then
  fatal "Docker Compose v2 is not available.
  Update Docker or install the compose plugin:
  https://docs.docker.com/compose/install/"
fi

if ! command_exists git; then
  fatal "git is not installed.
  Ubuntu/Debian: sudo apt install git
  Alpine:        apk add git
  macOS:         xcode-select --install"
fi

if ! command_exists openssl; then
  if ! command_exists head || [ ! -e /dev/urandom ]; then
    fatal "Cannot generate secret key: openssl or /dev/urandom required."
  fi
fi

success "Docker $(docker --version 2>/dev/null | head -1)"
success "Docker Compose $(docker compose version --short 2>/dev/null || echo 'ok')"
success "git $(git --version 2>/dev/null | head -1)"

# ── Preflight: RAM & swap ────────────────────────
TOTAL_RAM=0
if [ -f /proc/meminfo ]; then
  TOTAL_RAM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  SWAP_TOTAL=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
  AVAILABLE=$((TOTAL_RAM + SWAP_TOTAL))

  if [ "$AVAILABLE" -lt 2048 ]; then
    warn "RAM: ${TOTAL_RAM}MB + ${SWAP_TOTAL}MB swap = ${AVAILABLE}MB (need 2048MB for build)"

    if [ "$(id -u)" = "0" ]; then
      info "Creating 2GB swap file..."
      if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
      fi
      swapon /swapfile 2>/dev/null || true
      if ! grep -q '/swapfile' /etc/fstab 2>/dev/null; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
      fi
      SWAP_TOTAL=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
      success "Swap active: ${SWAP_TOTAL}MB"
    else
      fatal "Not enough memory (${AVAILABLE}MB). Need 2GB+ for Docker build.
  Run as root:  sudo bash install.sh
  Or create swap manually:
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile"
    fi
  else
    success "RAM: ${TOTAL_RAM}MB + ${SWAP_TOTAL}MB swap"
  fi
fi

# ── Preflight: ports 80/443 ─────────────────────
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "openloom.*caddy"; then
  info "OpenLoom Caddy already running — skipping port check"
else
  for PORT_CHECK in 80 443; do
    BLOCKER=""
    if command_exists ss; then
      BLOCKER=$(ss -tlnp 2>/dev/null | grep ":${PORT_CHECK} " | head -1 || true)
    elif command_exists lsof; then
      BLOCKER=$(lsof -i :"${PORT_CHECK}" -sTCP:LISTEN 2>/dev/null | tail -1 || true)
    fi

    if [ -n "$BLOCKER" ]; then
      fatal "Port ${PORT_CHECK} is already in use:
  ${BLOCKER}

  Caddy needs ports 80 and 443 for automatic HTTPS.
  Stop the conflicting service:
    sudo systemctl stop nginx && sudo systemctl disable nginx
    sudo systemctl stop apache2 && sudo systemctl disable apache2
  Then run this script again."
    fi
  done
  success "Ports 80/443 available"
fi

# ── DNS helpers ──────────────────────────────────
resolve_dns() {
  local domain="$1"
  if command_exists dig; then
    dig +short "$domain" @1.1.1.1 2>/dev/null | grep -E '^[0-9]+\.' | tail -1
  elif command_exists host; then
    host "$domain" 2>/dev/null | awk '/has address/ {print $4; exit}'
  elif command_exists nslookup; then
    nslookup "$domain" 1.1.1.1 2>/dev/null | awk '/^Address: / {a=$2} END{print a}'
  else
    echo ""
  fi
}

is_cloudflare_ip() {
  local ip="$1"
  case "$ip" in
    104.16.*|104.17.*|104.18.*|104.19.*|104.20.*|104.21.*|104.22.*|104.23.*|104.24.*|104.25.*|104.26.*|104.27.*) return 0 ;;
    172.64.*|172.65.*|172.66.*|172.67.*) return 0 ;;
    141.101.*|162.159.*) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Detect mode ──────────────────────────────────
if [ -f "Dockerfile" ] && [ -f "docker-compose.yml" ]; then
  MODE="local"
  INSTALL_DIR="$(pwd)"
  info "Local mode: using current directory"
else
  MODE="remote"
  info "Remote mode: will clone to $INSTALL_DIR"
fi

# ── Clone if remote ──────────────────────────────
if [ "$MODE" = "remote" ]; then
  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    info "Directory $INSTALL_DIR already exists, pulling latest..."
    cd "$INSTALL_DIR"
    git pull --quiet origin main 2>/dev/null || true
  else
    info "Cloning OpenLoom..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
else
  cd "$INSTALL_DIR"
fi

# ── Remove dev override for production install ───
if [ "$MODE" = "remote" ] && [ -f "docker-compose.override.yml" ]; then
  mv docker-compose.override.yml docker-compose.override.yml.dev
  info "Dev override moved aside (docker-compose.override.yml.dev)"
fi

# ── Interactive config ───────────────────────────
IS_TTY=false
if [ -t 0 ] && [ -t 1 ]; then
  IS_TTY=true
fi

DOMAIN=""
DISABLE_TRANSCRIPTION="false"
ENABLE_WHISPER="true"

if [ "$IS_TTY" = true ]; then
  echo ""
  # Domain (required)
  while [ -z "$DOMAIN" ]; do
    read -rp "  Domain (e.g. openloom.example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
      warn "Domain is required for HTTPS. Screen recording won't work without it."
    fi
  done

  S3_DOMAIN="s3.${DOMAIN}"

  # ── DNS verification ────────────────────────────
  SERVER_IP=$(curl -sf --max-time 5 https://api.ipify.org 2>/dev/null || curl -sf --max-time 5 https://ifconfig.me 2>/dev/null || echo "")

  if [ -n "$SERVER_IP" ]; then
    echo ""
    info "Verifying DNS records..."

    DOMAIN_IP=$(resolve_dns "$DOMAIN")
    if [ -z "$DOMAIN_IP" ]; then
      fatal "DNS: ${DOMAIN} does not resolve to any IP.
  Add an A record in your DNS provider:
    ${DOMAIN}  →  ${SERVER_IP}
  Then run this script again."
    elif is_cloudflare_ip "$DOMAIN_IP"; then
      fatal "DNS: ${DOMAIN} resolves to Cloudflare proxy (${DOMAIN_IP}).
  Caddy needs direct access for SSL certificates.
  In Cloudflare → DNS → click the orange cloud next to ${DOMAIN}
  Change it to 'DNS only' (grey cloud).
  Then run this script again."
    elif [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
      warn "DNS: ${DOMAIN} resolves to ${DOMAIN_IP}, this server is ${SERVER_IP}"
      read -rp "  Continue anyway? [y/N]: " DNS_CONTINUE
      if [[ ! "${DNS_CONTINUE,,}" =~ ^y ]]; then exit 1; fi
    else
      success "DNS: ${DOMAIN} → ${SERVER_IP}"
    fi

    S3_IP=$(resolve_dns "$S3_DOMAIN")
    if [ -z "$S3_IP" ]; then
      fatal "DNS: ${S3_DOMAIN} does not resolve.
  Add an A record:
    ${S3_DOMAIN}  →  ${SERVER_IP}
  This subdomain is required for video uploads/playback.
  Then run this script again."
    elif is_cloudflare_ip "$S3_IP"; then
      fatal "DNS: ${S3_DOMAIN} resolves to Cloudflare proxy.
  Change it to 'DNS only' (grey cloud) in Cloudflare.
  Then run this script again."
    elif [ "$S3_IP" != "$SERVER_IP" ]; then
      warn "DNS: ${S3_DOMAIN} resolves to ${S3_IP}, expected ${SERVER_IP}"
    else
      success "DNS: ${S3_DOMAIN} → ${SERVER_IP}"
    fi
  else
    warn "Could not detect server IP — skipping DNS verification"
    info "Make sure both DNS records point to this server:"
    echo -e "  ${BOLD}${DOMAIN}${NC}      → your-server-ip"
    echo -e "  ${BOLD}${S3_DOMAIN}${NC}  → same IP"
  fi

  echo ""

  # ── Whisper (RAM-aware) ─────────────────────────
  if [ "${TOTAL_RAM:-0}" -lt 2048 ]; then
    warn "Whisper auto-disabled (RAM ${TOTAL_RAM:-?}MB < 2GB)"
    info "Whisper compiles C++ code and needs 2GB+ RAM."
    info "You can enable it later: set ENABLE_WHISPER=true in .env and rebuild."
    DISABLE_TRANSCRIPTION="true"
    ENABLE_WHISPER="false"
  elif [ "${TOTAL_RAM:-0}" -lt 4096 ]; then
    read -rp "  Enable AI transcription (Whisper)? RAM is limited (${TOTAL_RAM}MB). [y/N]: " WHISPER_INPUT
    if [[ "${WHISPER_INPUT,,}" =~ ^y ]]; then
      ENABLE_WHISPER="true"
      DISABLE_TRANSCRIPTION="false"
    else
      ENABLE_WHISPER="false"
      DISABLE_TRANSCRIPTION="true"
      info "Whisper disabled — faster build"
    fi
  else
    read -rp "  Enable AI transcription (Whisper)? First build takes ~10 min. [Y/n]: " WHISPER_INPUT
    if [[ "${WHISPER_INPUT,,}" == "n" ]]; then
      ENABLE_WHISPER="false"
      DISABLE_TRANSCRIPTION="true"
      info "Whisper disabled — faster build"
    fi
  fi

  echo ""
else
  # Non-interactive mode
  if [ -z "${DOMAIN:-}" ]; then
    fatal "DOMAIN environment variable is required in non-interactive mode.
  Example: DOMAIN=openloom.example.com bash install.sh"
  fi
  S3_DOMAIN="s3.${DOMAIN}"

  # Auto-disable whisper on low RAM in non-interactive
  if [ "${TOTAL_RAM:-0}" -gt 0 ] && [ "${TOTAL_RAM:-0}" -lt 2048 ]; then
    ENABLE_WHISPER="false"
    DISABLE_TRANSCRIPTION="true"
    info "Whisper auto-disabled (RAM ${TOTAL_RAM}MB < 2GB)"
  fi
fi

# ── Generate .env ────────────────────────────────
if [ -f ".env" ]; then
  if [ "$IS_TTY" = true ]; then
    read -rp "  Existing .env found. Keep it? [Y/n]: " ENV_INPUT
    if [[ "${ENV_INPUT,,}" == "n" ]]; then
      info "Regenerating .env..."
    else
      success "Keeping existing .env"
      SKIP_ENV=true
    fi
  else
    info "Existing .env found, keeping it"
    SKIP_ENV=true
  fi
fi

if [ "${SKIP_ENV:-}" != "true" ]; then
  if command_exists openssl; then
    SECRET_KEY=$(openssl rand -hex 32)
  else
    SECRET_KEY=$(head -c 32 /dev/urandom | xxd -p | tr -d '\n')
  fi

  cat > .env << ENVEOF
DOMAIN=${DOMAIN}
S3_DOMAIN=${S3_DOMAIN}
SECRET_KEY=${SECRET_KEY}
BASE_URL=https://${DOMAIN}
DATABASE_URL=postgres://openloom:openloom@db:5432/openloom
S3_ENDPOINT=http://minio:9000
S3_BUCKET=openloom
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_PUBLIC_URL=https://${S3_DOMAIN}
REDIS_URL=redis://redis:6379
WHISPER_MODEL=base
ENABLE_WHISPER=${ENABLE_WHISPER}
DISABLE_TRANSCRIPTION=${DISABLE_TRANSCRIPTION}
ENVEOF

  success ".env generated (SECRET_KEY set)"
fi

# ── Build ────────────────────────────────────────
echo ""
info "Building containers (first run takes 3-10 minutes)..."

if [ "$IS_TTY" = true ]; then
  docker compose build 2>&1 | while IFS= read -r line; do
    case "$line" in
      *"Step"*|*"#"*"DONE"*|*"exporting"*|*"FINISHED"*|*"Built"*)
        echo -e "  ${BLUE}>${NC} $line"
        ;;
    esac
  done
else
  docker compose build --quiet
fi

success "Build complete"

# ── Start ────────────────────────────────────────
info "Starting services..."
docker compose up -d

# ── Wait for healthy ─────────────────────────────
info "Waiting for OpenLoom to start..."

SPINNER='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
TIMEOUT=240
ELAPSED=0
DOMAIN_FROM_ENV=$(sed -n 's/^DOMAIN=//p' .env | head -1)
APP_URL="https://${DOMAIN_FROM_ENV:-${DOMAIN}}"

while [ $ELAPSED -lt $TIMEOUT ]; do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${APP_URL}/api/ping" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    if [ "$IS_TTY" = true ]; then
      echo -ne "\r\033[K"
    fi
    break
  fi

  if [ "$IS_TTY" = true ]; then
    i=$(( ELAPSED % ${#SPINNER} ))
    echo -ne "\r  ${SPINNER:$i:1} Waiting for HTTPS + app... (${ELAPSED}s)"
  elif [ $(( ELAPSED % 15 )) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
    info "Still starting... (${ELAPSED}s)"
  fi

  sleep 3
  ELAPSED=$(( ELAPSED + 3 ))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo ""
  error "Timed out after ${TIMEOUT}s."
  echo ""

  CADDY_STATUS=$(docker compose ps caddy --format '{{.Status}}' 2>/dev/null | head -1 || echo "unknown")
  APP_STATUS=$(docker compose ps app --format '{{.Status}}' 2>/dev/null | head -1 || echo "unknown")

  if echo "$CADDY_STATUS" | grep -qi "exit\|error\|restarting"; then
    error "Caddy is not running: ${CADDY_STATUS}"
    echo -e "  ${BOLD}Caddy logs:${NC}"
    docker compose logs caddy --tail 5 2>/dev/null | sed 's/^/  /'
    echo ""
    warn "Common causes:"
    echo "  - DNS records not pointing to this server"
    echo "  - Cloudflare proxy mode (orange cloud) — switch to DNS only"
    echo "  - Another service on port 80/443"
  elif echo "$APP_STATUS" | grep -qi "exit\|error\|unhealthy"; then
    error "App is not healthy: ${APP_STATUS}"
    echo -e "  ${BOLD}App logs:${NC}"
    docker compose logs app --tail 10 2>/dev/null | sed 's/^/  /'
  else
    warn "Services appear running but HTTPS is not reachable."
    echo "  docker compose logs caddy --tail 20"
    echo "  docker compose logs app --tail 20"
  fi

  echo ""
  info "Full logs: docker compose logs -f"
  exit 1
fi

# ── Success ──────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ┌──────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}${BOLD}  │                                              │${NC}"
echo -e "${GREEN}${BOLD}  │   ✓ OpenLoom is running!                     │${NC}"
echo -e "${GREEN}${BOLD}  │                                              │${NC}"
echo -e "${GREEN}${BOLD}  │   Open:  ${NC}${BOLD}${APP_URL}${NC}"
echo -e "${GREEN}${BOLD}  │                                              │${NC}"
echo -e "${GREEN}${BOLD}  │   Register your account — first user = admin │${NC}"
echo -e "${GREEN}${BOLD}  │   No invite code needed for the first user.  │${NC}"
echo -e "${GREEN}${BOLD}  │                                              │${NC}"
echo -e "${GREEN}${BOLD}  │   Logs:   ${NC}docker compose logs -f${NC}"
echo -e "${GREEN}${BOLD}  │   Stop:   ${NC}docker compose down${NC}"
echo -e "${GREEN}${BOLD}  │   Update: ${NC}./update.sh${NC}"
echo -e "${GREEN}${BOLD}  │                                              │${NC}"
echo -e "${GREEN}${BOLD}  └──────────────────────────────────────────────┘${NC}"
echo ""

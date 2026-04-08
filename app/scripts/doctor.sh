#!/usr/bin/env bash
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass_count=0
warn_count=0
fail_count=0

pass() {
  echo -e "${GREEN}PASS${NC} $1"
  pass_count=$((pass_count + 1))
}

warn() {
  echo -e "${YELLOW}WARN${NC} $1"
  warn_count=$((warn_count + 1))
}

fail() {
  echo -e "${RED}FAIL${NC} $1"
  fail_count=$((fail_count + 1))
}

check_cmd() {
  local cmd="$1"
  local hint="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    local version
    version="$($cmd --version 2>/dev/null | head -n 1 || true)"
    if [[ -n "$version" ]]; then
      pass "$cmd is installed ($version)"
    else
      pass "$cmd is installed"
    fi
  else
    fail "$cmd is missing. $hint"
  fi
}

check_pkg_config_module() {
  local module="$1"
  local label="$2"
  local install_hint="$3"

  if ! command -v pkg-config >/dev/null 2>&1; then
    fail "pkg-config is missing. Install it first: sudo apt install -y pkg-config"
    return
  fi

  if pkg-config --exists "$module"; then
    local version
    version="$(pkg-config --modversion "$module" 2>/dev/null || true)"
    if [[ -n "$version" ]]; then
      pass "$label detected ($module $version)"
    else
      pass "$label detected ($module)"
    fi
  else
    fail "$label not found ($module). Install with: $install_hint"
  fi
}

echo -e "${BLUE}LibrisArk environment doctor${NC}"
echo "Running checks for Node, Rust, and Linux native dependencies..."
echo

check_cmd node "Install Node.js LTS from https://nodejs.org or your package manager."
check_cmd npm "Install npm via Node.js package."
check_cmd rustc "Install Rust: curl https://sh.rustup.rs -sSf | sh"
check_cmd cargo "Install Rust: curl https://sh.rustup.rs -sSf | sh"
check_cmd pkg-config "Install with: sudo apt install -y pkg-config"

if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [[ "$node_major" -ge 18 ]]; then
    pass "Node major version is >= 18"
  else
    warn "Node major version is $node_major. Recommended: >= 18."
  fi
fi

echo
if [[ "$(uname -s)" == "Linux" ]]; then
  check_pkg_config_module "gtk+-3.0" "GTK3" "sudo apt install -y libgtk-3-dev"

  if pkg-config --exists webkit2gtk-4.1; then
    pass "WebKitGTK detected (webkit2gtk-4.1)"
  elif pkg-config --exists webkit2gtk-4.0; then
    warn "Found webkit2gtk-4.0. Tauri v2 generally prefers 4.1 on recent distros."
  else
    fail "WebKitGTK not found. Install with: sudo apt install -y libwebkit2gtk-4.1-dev"
  fi

  if pkg-config --exists ayatana-appindicator3-0.1; then
    pass "Ayatana AppIndicator detected"
  elif pkg-config --exists appindicator3-0.1; then
    pass "AppIndicator detected"
  else
    fail "AppIndicator not found. Install with: sudo apt install -y libayatana-appindicator3-dev"
  fi

  check_pkg_config_module "librsvg-2.0" "librsvg" "sudo apt install -y librsvg2-dev"
else
  warn "Non-Linux OS detected. This script currently focuses on Linux dependencies."
fi

echo
check_cmd patchelf "Install with: sudo apt install -y patchelf"

if [[ -f "package.json" ]]; then
  pass "package.json found in current directory"
else
  warn "package.json not found in current directory. Run this script from app/"
fi

if [[ -d "src-tauri" ]]; then
  pass "src-tauri directory found"
else
  warn "src-tauri directory not found in current directory"
fi

echo
echo "Summary: PASS=$pass_count WARN=$warn_count FAIL=$fail_count"

if [[ "$fail_count" -gt 0 ]]; then
  echo
  echo -e "${RED}Some required dependencies are missing.${NC}"
  echo "Install missing packages, then run: npm run doctor"
  exit 1
fi

echo -e "${GREEN}Environment looks good.${NC}"
exit 0

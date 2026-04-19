#!/usr/bin/env bash
# ensure-gstack.sh — idempotent session-start installer for gstack.
#
# What it does:
#   1. Fast exit if gstack is already fully installed (repo cloned AND
#      first-class slash commands registered).
#   2. Clones garrytan/gstack into ~/.claude/skills/gstack if missing.
#   3. Runs setup with --host claude --no-prefix -q so every gstack skill
#      becomes a top-level slash command (/review, /ship, /plan-tune, ...).
#   4. Temporarily patches setup to skip the Playwright Chromium download,
#      because cdn.playwright.dev is often blocked in sandboxed sessions.
#      Browser-needing skills (qa, browse, canary, benchmark, ...) will be
#      unusable until Chromium is installed separately.
#   5. Restores the setup script after running.
#
# Flags:
#   --update       re-pull gstack and re-run setup even if already installed
#   --install-chromium   also try `bunx playwright install chromium`
#                         (will fail in sandboxes that block cdn.playwright.dev)
#   -q, --quiet    suppress informational output
#   -h, --help     show this help
#
# Exit codes:
#   0  already installed, or install succeeded
#   1  missing prerequisite (bun, git) — message tells the user what to do
#   2  setup ran but some skill symlinks failed to appear
#
# Wire it to run every session:
#   ~/.claude/settings.json -> hooks.SessionStart -> command:
#     bash ~/.claude/scripts/ensure-gstack.sh -q

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/garrytan/gstack.git"
INSTALL_DIR="$HOME/.claude/skills/gstack"
SKILLS_DIR="$HOME/.claude/skills"
# Three canonical skills that must exist as first-class slash commands
# after setup. If any of these is missing, setup did not complete.
CANONICAL_SKILLS=(review ship plan-tune)

# ─── Flags ─────────────────────────────────────────────────────────────────
UPDATE=0
INSTALL_CHROMIUM=0
QUIET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --update)            UPDATE=1; shift ;;
    --install-chromium)  INSTALL_CHROMIUM=1; shift ;;
    -q|--quiet)          QUIET=1; shift ;;
    -h|--help)
      sed -n '3,30p' "$0" | sed 's|^# \{0,1\}||'
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

log() { [ "$QUIET" -eq 0 ] && echo "$@" || true; }
warn() { echo "$@" >&2; }

# ─── Fast path: already installed? ─────────────────────────────────────────
all_canonical_present() {
  local s
  for s in "${CANONICAL_SKILLS[@]}"; do
    [ -L "$SKILLS_DIR/$s/SKILL.md" ] || [ -f "$SKILLS_DIR/$s/SKILL.md" ] || return 1
  done
  return 0
}

if [ "$UPDATE" -eq 0 ] && [ -d "$INSTALL_DIR" ] && all_canonical_present; then
  log "gstack: already installed (${INSTALL_DIR})"
  log "        canonical skills present: ${CANONICAL_SKILLS[*]}"
  exit 0
fi

# ─── Prerequisites ─────────────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
  warn "ensure-gstack: git is required but not installed."
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  warn "ensure-gstack: bun is required but not installed."
  warn "Install with checksum verification:"
  warn '  BUN_VERSION="1.3.10"'
  warn '  tmpfile=$(mktemp)'
  warn '  curl -fsSL "https://bun.sh/install" -o "$tmpfile"'
  warn '  echo "Verify checksum before running: shasum -a 256 $tmpfile"'
  warn '  BUN_VERSION="$BUN_VERSION" bash "$tmpfile" && rm "$tmpfile"'
  exit 1
fi

# ─── Clone (or update) ─────────────────────────────────────────────────────
mkdir -p "$SKILLS_DIR"

if [ -d "$INSTALL_DIR" ]; then
  if [ "$UPDATE" -eq 1 ]; then
    log "gstack: updating existing clone at $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --depth 1 origin HEAD
    git -C "$INSTALL_DIR" reset --hard FETCH_HEAD
  else
    log "gstack: clone exists, skipping clone step"
  fi
else
  log "gstack: cloning $REPO_URL into $INSTALL_DIR"
  git clone --single-branch --depth 1 "$REPO_URL" "$INSTALL_DIR" \
    >/dev/null 2>&1 || {
      warn "ensure-gstack: git clone failed. Check network / GitHub access."
      exit 1
    }
fi

# ─── Patch setup to skip the Chromium download (unless --install-chromium) ─
# cdn.playwright.dev is often blocked in sandboxed Claude Code sessions,
# and the failure is `set -e` fatal — it aborts before skill-linking.
SETUP="$INSTALL_DIR/setup"
BACKUP="$INSTALL_DIR/setup.ensure-gstack.bak"

cleanup() {
  if [ -f "$BACKUP" ]; then
    mv -f "$BACKUP" "$SETUP"
    log "gstack: restored original setup script"
  fi
}
trap cleanup EXIT INT TERM

if [ "$INSTALL_CHROMIUM" -eq 0 ]; then
  cp "$SETUP" "$BACKUP"
  # Make every `if ! ensure_playwright_browser; then ... fi` branch a no-op.
  # `false &&` short-circuits, so the gated install block never runs.
  sed -i.tmp 's|if ! ensure_playwright_browser; then|if false \&\& ! ensure_playwright_browser; then|g' "$SETUP"
  rm -f "$SETUP.tmp"
  log "gstack: patched setup to skip Chromium install (sandbox-safe)"
fi

# ─── Run setup ─────────────────────────────────────────────────────────────
log "gstack: running setup --host claude --no-prefix"
(
  cd "$INSTALL_DIR"
  if [ "$QUIET" -eq 1 ]; then
    ./setup --host claude --no-prefix -q >/dev/null 2>&1 || true
  else
    ./setup --host claude --no-prefix -q 2>&1 | tail -5
  fi
)

# trap cleanup will restore setup script

# ─── Verify skill registration ─────────────────────────────────────────────
missing=()
for s in "${CANONICAL_SKILLS[@]}"; do
  if [ ! -e "$SKILLS_DIR/$s/SKILL.md" ]; then
    missing+=("$s")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  warn "ensure-gstack: setup ran but these skills are NOT registered: ${missing[*]}"
  warn "Run './setup --host claude --no-prefix' manually in $INSTALL_DIR to investigate."
  exit 2
fi

# ─── Summary ───────────────────────────────────────────────────────────────
if [ "$QUIET" -eq 0 ]; then
  # Count registered gstack skills at top level
  count=$(find "$SKILLS_DIR" -maxdepth 2 -name SKILL.md -type l 2>/dev/null | \
    xargs -I{} readlink {} 2>/dev/null | grep -c "/gstack/" || true)
  log ""
  log "gstack: ready. $count skills registered as top-level slash commands."
  log "        canonical check: ${CANONICAL_SKILLS[*]} ✓"
  if [ "$INSTALL_CHROMIUM" -eq 0 ]; then
    log ""
    log "        Browser-needing skills (/qa, /browse, /canary, /benchmark,"
    log "        /open-gstack-browser, /setup-browser-cookies, /devex-review,"
    log "        /design-shotgun, /design-html, /pair-agent) require Chromium."
    log "        Install separately when network allows:"
    log "          cd $INSTALL_DIR && bunx playwright install chromium"
  fi
fi

exit 0

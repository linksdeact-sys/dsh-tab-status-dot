#!/usr/bin/env sh
# Install (or uninstall) the dsh-tab-status-dot plugin for DeepSeek Harness.
#
#   ./install.sh                 # install into profile "web"
#   ./install.sh --profile dev   # another profile
#   ./install.sh --uninstall     # remove package + registration
#   ./install.sh --help
#
# What it does (idempotent, safe to re-run):
#   1. copies this package into <DSH_HOME>/profiles/<profile>/node_modules/<pkg>
#   2. registers a loader row in profiles/<profile>/cordis.patch.yml (marked block)
#   3. tells you to refresh the Harness page
set -eu

PKG_NAME='@pxy/dsh-tab-status-dot'
PKG_LEAF='dsh-tab-status-dot'
SCOPE_LEAF='@pxy'
ROW_ID='tab-status-dot'
START_MARKER='# >>> dsh-tab-status-dot >>>'
END_MARKER='# <<< dsh-tab-status-dot <<<'

# Directory of this script, without depending on the external `dirname`.
# Backslashes are normalized so a Git-Bash invocation with a Windows-style
# path (C:\...\install.sh) still resolves correctly.
SELF_NORM="$(printf '%s' "$0" | tr '\\' '/')"
case "$SELF_NORM" in
  */*) SELF_DIR="${SELF_NORM%/*}" ;;
  *)   SELF_DIR='.' ;;
esac
SOURCE="$(CDPATH= cd -- "$SELF_DIR" && pwd)"

PROFILE='web'
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
UNINSTALL='no'

usage() {
  cat <<'EOF'
Install / uninstall the dsh-tab-status-dot plugin for DeepSeek Harness.

Usage: ./install.sh [options]

  --profile <name>     Harness profile to install into        (default: web)
  --dsh-home <path>    Harness home directory                 (default: $DSH_HOME, else ~/.dsh)
  --source <path>      Plugin folder holding package.json/lib (default: this script's folder)
  --uninstall          Remove the package and its registration
  -h, --help           Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --profile)  PROFILE="$2"; shift 2 ;;
    --dsh-home) DSH_HOME_DIR="$2"; shift 2 ;;
    --source)   SOURCE="$2"; shift 2 ;;
    --uninstall) UNINSTALL='yes'; shift ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

step() { printf '==> %s\n' "$1"; }
ok()   { printf '  ok  %s\n' "$1"; }
warn() { printf '  !   %s\n' "$1"; }

if [ ! -d "$DSH_HOME_DIR" ]; then
  echo "Harness home not found: $DSH_HOME_DIR (set DSH_HOME or pass --dsh-home)" >&2
  exit 1
fi
PROFILE_DIR="$DSH_HOME_DIR/profiles/$PROFILE"
if [ ! -d "$PROFILE_DIR" ]; then
  echo "Profile '$PROFILE' not found at $PROFILE_DIR (start it once, or pass --profile <name>)" >&2
  exit 1
fi
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
DEST_DIR="$PROFILE_DIR/node_modules/$SCOPE_LEAF/$PKG_LEAF"

# ── uninstall ────────────────────────────────────────────────────────────────
if [ "$UNINSTALL" = 'yes' ]; then
  step "Uninstalling $PKG_NAME from profile '$PROFILE'"
  if [ -d "$DEST_DIR" ]; then
    rm -rf "$DEST_DIR"
    ok "removed $DEST_DIR"
  else
    warn "package not installed at $DEST_DIR"
  fi
  if [ -f "$PATCH_FILE" ]; then
    if grep -q "$START_MARKER" "$PATCH_FILE" 2>/dev/null; then
      cp "$PATCH_FILE" "$PATCH_FILE.bak"
      # delete the marked block (inclusive of both markers)
      awk -v s="$START_MARKER" -v e="$END_MARKER" '
        index($0, s) { skip = 1 }
        skip == 0 { print }
        index($0, e) { skip = 0 }
      ' "$PATCH_FILE.bak" > "$PATCH_FILE"
      if [ -z "$(tr -d '[:space:]' < "$PATCH_FILE")" ]; then
        printf '[]\n' > "$PATCH_FILE"   # keep a valid empty patch list
      fi
      ok "registration removed from $PATCH_FILE (backup: cordis.patch.yml.bak)"
    else
      warn "no marked registration found in $PATCH_FILE (remove the insert row manually)"
    fi
  fi
  echo ''
  echo 'Uninstalled. Refresh the Harness page (restart `dsh web` if patches are not hot-reloaded).'
  exit 0
fi

# ── install: copy the package ────────────────────────────────────────────────
if [ ! -f "$SOURCE/package.json" ] || [ ! -d "$SOURCE/lib" ]; then
  echo "package.json / lib not found in $SOURCE (pass --source <plugin folder>)" >&2
  exit 1
fi

step "Installing $PKG_NAME into profile '$PROFILE'"
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR/lib"
cp "$SOURCE/package.json" "$DEST_DIR/package.json"
cp "$SOURCE/lib/index.js" "$DEST_DIR/lib/index.js"
cp "$SOURCE/lib/client.js" "$DEST_DIR/lib/client.js"
ok "package copied to $DEST_DIR"

# ── install: register the loader row ─────────────────────────────────────────
if [ ! -f "$PATCH_FILE" ]; then
  warn "cordis.patch.yml missing; creating $PATCH_FILE"
  : > "$PATCH_FILE"
fi
if grep -q "$ROW_ID" "$PATCH_FILE" 2>/dev/null; then
  ok "already registered in cordis.patch.yml (id: $ROW_ID)"
else
  cp "$PATCH_FILE" "$PATCH_FILE.bak"
  TRIM="$(tr -d '[:space:]' < "$PATCH_FILE")"
  if [ -z "$TRIM" ] || [ "$TRIM" = '[]' ]; then
    # The shipped profile template is a bare `[]`; appending after it would
    # produce two YAML root nodes (invalid), so replace it entirely.
    : > "$PATCH_FILE"
  else
    printf '\n' >> "$PATCH_FILE"
  fi
  {
    printf '%s\n' "$START_MARKER"
    printf '%s\n' '# Tab status dot plugin: light green = session finished while you were away,'
    printf '%s\n' '# light blue = a session is waiting for your choice.'
    printf '%s\n' '- insert:'
    printf '%s\n' "    - id: $ROW_ID"
    printf '%s\n' "      name: '$PKG_NAME'"
    printf '%s\n' "$END_MARKER"
  } >> "$PATCH_FILE"
  ok "registered row '$ROW_ID' in $PATCH_FILE (backup: cordis.patch.yml.bak)"
fi

echo ''
echo 'Done. Next steps:'
echo '  1. Open (or refresh: Ctrl+F5 / Cmd+Shift+R) the Harness web page.'
echo '  2. The tab favicon shows a neutral dot; it turns light green when a'
echo '     session finished while you were away, and light blue while a session'
echo '     waits for your choice.'
echo '  If your instance does not hot-reload user patches, restart `dsh web` once.'

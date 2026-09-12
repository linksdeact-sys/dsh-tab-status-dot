#!/bin/sh
# Exercise install.sh with BusyBox's `sh` (Alpine's /bin/sh) — a third POSIX
# shell implementation besides dash (Ubuntu) and bash --posix (macOS).
#
# Run from the repository root, e.g.:
#   docker run --rm -v "$PWD:/w" -w /w alpine:3.20 sh /w/.github/ci/alpine-installer-check.sh
set -eu

PROFILE='web'
PKG_PATH='node_modules/@pxy/dsh-tab-status-dot'
PATCH="$DSH_HOME/profiles/$PROFILE/cordis.patch.yml"

echo "== shell under test: $(readlink -f /bin/sh 2>/dev/null || echo /bin/sh)"
busybox 2>/dev/null | head -n 1 || true

# node (+js-yaml) for validating the patch file exactly like the loader does.
apk add --no-cache nodejs npm > /dev/null 2>&1
mkdir -p /tmp/validator
npm install --silent --no-save --no-package-lock --prefix /tmp/validator js-yaml > /dev/null 2>&1
export NODE_PATH=/tmp/validator/node_modules

# validate <expect-our-row: yes|no> <expected-entry-count>
validate() {
  EXPECT_OURS="$1" EXPECT_COUNT="$2" node -e "
    const fs=require('fs'), y=require('js-yaml');
    const doc=y.load(fs.readFileSync(process.env.PATCH_FILE,'utf8'));
    if(!Array.isArray(doc)) throw new Error('patch file is not a top-level array: '+JSON.stringify(doc));
    const hasOurs = JSON.stringify(doc).includes('tab-status-dot');
    console.log('   entries:', doc.length, '| has our row:', hasOurs);
    if(process.env.EXPECT_OURS==='yes' && !hasOurs) throw new Error('our row is missing');
    if(process.env.EXPECT_OURS==='no'  &&  hasOurs) throw new Error('our row was not removed');
    if(doc.length !== Number(process.env.EXPECT_COUNT)) throw new Error('expected '+process.env.EXPECT_COUNT+' entries, got '+doc.length);
  "
}

export DSH_HOME=/tmp/dsh-home
export PATCH_FILE="$PATCH"
rm -rf "$DSH_HOME"
mkdir -p "$DSH_HOME/profiles/$PROFILE"

echo '== 1. fresh profile: shipped template shape (comment header + bare [], no trailing newline) =='
printf '# Your patch layer for this dsh profile, applied after every bundle layer:\n# overrides, disables, and insert lists are allowed here.\n[]' > "$PATCH"
sh ./install.sh
test -f "$DSH_HOME/profiles/$PROFILE/$PKG_PATH/package.json"
test -f "$DSH_HOME/profiles/$PROFILE/$PKG_PATH/lib/client.js"
test -f "$DSH_HOME/profiles/$PROFILE/$PKG_PATH/lib/index.js"
validate yes 1

echo '== 2. re-running is idempotent =='
out="$(sh ./install.sh)"
case "$out" in
  *"already registered"*) echo '   ok: reported already registered' ;;
  *) echo '   FAIL: second run was not idempotent'; printf '%s\n' "$out"; exit 1 ;;
esac
validate yes 1

echo '== 3. appending to a list that already has entries stays valid =='
sh ./install.sh --uninstall > /dev/null
printf "# header comment\n- id: someone-else\n  name: 'other-pkg'\n" > "$PATCH"
sh ./install.sh > /dev/null
validate yes 2

echo '== 4. uninstall keeps other entries =='
sh ./install.sh --uninstall > /dev/null
test ! -d "$DSH_HOME/profiles/$PROFILE/$PKG_PATH"
validate no 1

echo '== 5. uninstall from the shipped template restores a valid empty list =='
printf '# Your patch layer for this dsh profile, applied after every bundle layer:\n# overrides, disables, and insert lists are allowed here.\n[]' > "$PATCH"
sh ./install.sh > /dev/null
sh ./install.sh --uninstall > /dev/null
grep -q 'Your patch layer for this dsh profile' "$PATCH" || { echo '   FAIL: comment header was not preserved'; exit 1; }
validate no 0

echo 'ALL ALPINE (busybox sh) INSTALLER CHECKS PASSED'

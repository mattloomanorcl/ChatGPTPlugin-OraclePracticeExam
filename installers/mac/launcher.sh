#!/bin/bash
set -euo pipefail
silent=0
for option in "$@"; do [ "$option" != "--silent" ] || silent=1; done
if [ "$(uname -s)" != "Darwin" ]; then
  echo "This installer runs on macOS only. Use the Windows .exe on Windows."
  exit 1
fi
installer_dir=$(cd "$(dirname "$0")" && pwd)
bootstrap_log="$installer_dir/Oracle-Exam-Practice-Installer-Transcript.log"
if ! (umask 077; : >> "$bootstrap_log") 2>/dev/null; then
  bootstrap_log=$(/usr/bin/mktemp -t oracle-exam-practice-setup)
fi
exec > >(/usr/bin/tee -a "$bootstrap_log") 2>&1
echo "Installer transcript: $bootstrap_log"
os_version=$(/usr/bin/sw_vers -productVersion)
IFS=. read -r major minor patch <<< "$os_version"
if [ "$major" -lt 13 ] || { [ "$major" -eq 13 ] && [ "${minor:-0}" -lt 5 ]; }; then
  echo "macOS 13.5 or newer is required by the bundled runtime."
  exit 1
fi
machine=$(uname -m)
if [ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || true)" = "1" ]; then machine=arm64; fi
case "$machine" in
  arm64) runtime_arch=darwin-arm64 ;;
  x86_64) runtime_arch=darwin-x64 ;;
  *) echo "Unsupported Mac architecture: $machine"; exit 1 ;;
esac
echo "Oracle Exam Practice 1.1.0 — Mac setup, installer revision 3"
echo "The runtime and dependencies are included. No setup download or sudo is needed."
echo "Setup preserves existing plug-in catalog entries and exam data."
if [ "$silent" -eq 0 ]; then
  read -r -p "Install for your Mac user account? [y/N] " answer
  case "$answer" in y|Y|yes|YES) ;; *) echo "Setup cancelled."; exit 2 ;; esac
fi
temp_parent=${TMPDIR:-/tmp}
temp_parent=${temp_parent%/}
stage=$(/usr/bin/mktemp -d "$temp_parent/oracle-exam-practice.XXXXXXXX")
# Use the physical path, including when TMPDIR is under macOS's /var alias.
stage=$(cd "$stage" && /bin/pwd -P)
temp_parent=$(cd "$temp_parent" && /bin/pwd -P)
cleanup() {
  # Remove only the unique extraction directory created above, in its known parent.
  case "$stage" in "$temp_parent"/oracle-exam-practice.*) [ ! -L "$stage" ] && /bin/rm -rf -- "$stage" ;; esac
}
trap cleanup EXIT
payload_line=$(/usr/bin/awk '/^__ORACLE_EXAM_PAYLOAD__$/ { print NR+1; exit }' "$0")
echo "Verifying bundled installer files..."
[ -n "$payload_line" ] || { echo "Embedded installer payload missing."; exit 1; }
/usr/bin/tail -n +"$payload_line" "$0" > "$stage/payload.tar.gz"
actual_hash=$(/usr/bin/shasum -a 256 "$stage/payload.tar.gz" | /usr/bin/awk '{print $1}')
[ "$actual_hash" = "PAYLOAD_HASH" ] || { echo "Installer payload integrity check failed."; exit 1; }
/usr/bin/tar -xzf "$stage/payload.tar.gz" -C "$stage"
echo "Starting file installation and plug-in checks..."
node="$stage/plugin/runtime/$runtime_arch/node"
/bin/chmod 755 "$node"
set +e
if [ "$silent" -eq 0 ]; then
  "$node" "$stage/install.mjs" --source "$stage/plugin" --runtime "$node" --receipt-dir "$installer_dir" --result-file "$stage/setup-result.json" --open-plugin "$@"
else
  "$node" "$stage/install.mjs" --source "$stage/plugin" --runtime "$node" --receipt-dir "$installer_dir" --result-file "$stage/setup-result.json" "$@"
fi
result=$?
set -e
if [ "$result" -eq 0 ] && [ ! -s "$stage/setup-result.json" ]; then
  echo "SETUP FAILED: The installer process exited without completing setup."
  echo "No completed installation was confirmed. See the transcript: $bootstrap_log"
  result=1
fi
if [ "$result" -ne 0 ]; then
  echo "Installation failed. See the transcript: $bootstrap_log"
fi
if [ "$silent" -eq 0 ]; then read -r -p "Press Return to close this installer. " ignored; fi
exit "$result"
__ORACLE_EXAM_PAYLOAD__

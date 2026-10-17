#!/usr/bin/env sh
# Pathwarden secret-shape scan of the git INDEX (staged + tracked files).
# Used by .githooks/pre-commit and by CI (repo-hygiene job). POSIX sh; run from Git Bash on Windows.
#
# Blocks:
#   1. a tracked/staged .env file (only .env.example is allowed)
#   2. strings shaped like real provider credentials (plan §4 rule 9)
#   3. any value from your local, gitignored .env (length >= 12) appearing in a tracked file
# Never prints a matched value, only file names / key names.
# Allowed fake secrets (PWDEMO-SECRET-xxxxxxxx-NOT-A-REAL-KEY) deliberately do not match.
set -eu

fail=0

# 1. .env files must not be tracked
bad_env=$(git ls-files --cached | grep -E '(^|/)\.env($|\.)' | grep -Ev '(^|/)\.env\.example$' || true)
if [ -n "$bad_env" ]; then
  echo "scan_secrets: refusing tracked env file(s):" >&2
  echo "$bad_env" >&2
  fail=1
fi

# 2. provider-shaped credentials
PATTERNS='sk_live_[A-Za-z0-9]{10,}|(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{32,}|(^|[^A-Za-z0-9])gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
hits=$(git grep --cached -lIE -e "$PATTERNS" -- . ':!scripts/scan_secrets.sh' || true)
if [ -n "$hits" ]; then
  echo "scan_secrets: credential-shaped string in:" >&2
  echo "$hits" >&2
  fail=1
fi

# 3. exact values from the local .env
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line=$(printf '%s' "$line" | tr -d '\r')
    case "$line" in ''|'#'*) continue ;; esac
    key=${line%%=*}
    case "$key" in *MODEL*|*HOST*|*PORT*|*DIR*|*AUTH*) continue ;; esac
    val=${line#*=}
    val=$(printf '%s' "$val" | sed -e 's/[[:space:]]*#.*$//' -e "s/^[\"']//" -e "s/[\"']\$//")
    [ "${#val}" -ge 12 ] || continue
    if git grep --cached -qIF -e "$val" -- . ':!scripts/scan_secrets.sh'; then
      echo "scan_secrets: value of .env key '$key' appears in a tracked file" >&2
      fail=1
    fi
  done < .env
fi

if [ "$fail" -ne 0 ]; then
  echo "scan_secrets: FAILED" >&2
  exit 1
fi
echo "scan_secrets: ok"

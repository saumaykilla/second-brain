#!/usr/bin/env bash
# Verify the Second Brain harness is healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

failures=0

pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; failures=$((failures + 1)); }
warn() { printf 'warn %s\n' "$1"; }

require_file() {
  if [[ -f "$1" ]]; then
    pass "found $1"
  else
    fail "missing $1"
  fi
}

require_dir() {
  if [[ -d "$1" ]]; then
    pass "found $1/"
  else
    fail "missing $1/"
  fi
}

echo "Second Brain init"
echo

require_file "AGENTS.md"
require_file "agent-progress.md"
require_file "feature_list.json"
require_file "clean-state-checklist.md"
require_dir "docs"

if [[ -f feature_list.json ]]; then
  if python3 - "$ROOT" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
data = json.loads((root / "feature_list.json").read_text())
features = data.get("features")
if not isinstance(features, list):
    print("feature_list.json must contain a features array", file=sys.stderr)
    sys.exit(1)

required = ("id", "title", "priority", "status", "user_visible_behavior", "verification", "evidence")
allowed_status = {"not_started", "in_progress", "passing"}
in_progress = []
errors = []

for index, feature in enumerate(features):
    if not isinstance(feature, dict):
        errors.append(f"features[{index}] is not an object")
        continue
    missing = [key for key in required if key not in feature]
    if missing:
        errors.append(f"features[{index}] missing {', '.join(missing)}")
        continue
    feature_id = feature["id"]
    if not isinstance(feature_id, str) or not feature_id:
        errors.append(f"features[{index}] has an empty id")
        continue
    if feature["status"] not in allowed_status:
        errors.append(f"{feature_id} has invalid status {feature['status']!r}")
    if feature["status"] == "in_progress":
        in_progress.append(feature_id)
    if feature["status"] == "passing" and not str(feature["evidence"]).strip():
        errors.append(f"{feature_id} is passing with empty evidence")
    spec = root / "docs" / f"{feature_id}.md"
    if not spec.is_file():
        errors.append(f"{feature_id} is missing docs/{feature_id}.md")

if len(in_progress) > 1:
    errors.append("more than one feature is in_progress: " + ", ".join(in_progress))

if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)

print(f"features={len(features)} in_progress={len(in_progress)}")
PY
  then
    pass "feature_list.json is consistent with docs/"
  else
    fail "feature_list.json failed validation"
  fi
fi

if command -v node >/dev/null 2>&1; then
  pass "node $(node -v)"
else
  warn "node is not installed; app checks are skipped"
fi

if command -v npm >/dev/null 2>&1; then
  pass "npm $(npm -v)"
else
  warn "npm is not installed; app checks are skipped"
fi

if [[ -f package.json ]]; then
  if command -v npm >/dev/null 2>&1; then
    if [[ -d node_modules ]]; then
      pass "node_modules present"
    else
      warn "package.json exists but node_modules is missing; run npm install"
    fi
  fi
else
  warn "package.json not found; Next.js app is not scaffolded yet"
fi

echo
if [[ "$failures" -gt 0 ]]; then
  echo "init failed ($failures)"
  exit 1
fi

echo "init ok"

#!/bin/bash
# Scora IA-Agent: Smart Triage (v3.0 — honest healer)
# ---------------------------------------------------
# Proposes fixes. Does NOT rewrite visual baselines unless the human
# explicitly passes --accept-snapshots (qa-architecture.md section 5.4).
#
# Usage:
#   scripts/qa-agent.sh                    # strict run + triage report
#   scripts/qa-agent.sh --accept-snapshots # explicit human baseline accept
#   scripts/qa-agent.sh --project UI-Visual

set -euo pipefail

ACCEPT_SNAPSHOTS=false
PROJECT=""
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --accept-snapshots) ACCEPT_SNAPSHOTS=true; shift ;;
    --project) PROJECT="$2"; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

echo "Scora | IA-Agent v3.0: strict triage (no silent baseline writes)"

mkdir -p test-results

# 1. Drift is ADVISORY only — never auto-enables --update-snapshots
DRIFT_DETECTED=false
if git diff --name-only HEAD 2>/dev/null | grep -qE "src/features/editor/|src/templates/|index.html|src/app.ts"; then
  echo "Design drift in src/ (advisory). If pixels changed intentionally, re-run with --accept-snapshots after review."
  DRIFT_DETECTED=true
fi

# 2. Snapshot lifecycle (report only)
if command -v npx >/dev/null 2>&1; then
  npx tsx scripts/snapshot-audit.ts --json > test-results/snapshot-audit.json 2>/dev/null || true
fi

# 3. Build command — never pass --update-snapshots unless explicit accept
SNAPSHOT_FLAG=""
if [ "$ACCEPT_SNAPSHOTS" = true ]; then
  echo "HUMAN ACCEPT: baselines will be rewritten. Review the image diffs before commit."
  SNAPSHOT_FLAG="--update-snapshots"
fi

PW_ARGS=(test)
if [ -n "$PROJECT" ]; then
  PW_ARGS+=(--project "$PROJECT")
fi
if [ -n "$SNAPSHOT_FLAG" ]; then
  PW_ARGS+=("$SNAPSHOT_FLAG")
fi
if [ ${#ARGS[@]} -gt 0 ]; then
  PW_ARGS+=("${ARGS[@]}")
fi

# 4. Prefer Docker linux goldens when available (industry parity)
RUN_CMD=(pnpm exec playwright "${PW_ARGS[@]}")
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Running via Docker (linux/amd64) for CI-parity goldens..."
  set +e
  DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose -f docker-compose.playwright.yml run --rm \
    playwright pnpm exec playwright "${PW_ARGS[@]}"
  TEST_EXIT_CODE=$?
  set -e
else
  echo "Docker unavailable — running locally (darwin goldens are NOT CI-canonical)."
  set +e
  "${RUN_CMD[@]}"
  TEST_EXIT_CODE=$?
  set -e
fi

# 5. Triage signal (propose, never hide)
cat > test-results/TRIAGE_SIGNAL.json <<EOF
{
  "drift_detected": $DRIFT_DETECTED,
  "accept_snapshots": $ACCEPT_SNAPSHOTS,
  "exit_code": $TEST_EXIT_CODE,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "policy": "propose-only",
  "next_actions": []
}
EOF

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "IA-Agent: all green."
else
  echo "IA-Agent: failures remain (this is information, not a bug in the healer)."
  if [ "$DRIFT_DETECTED" = true ]; then
    echo "  - src/ changed: if intentional visual change → review diffs → --accept-snapshots"
  fi
  echo "  - data mismatches → fix registry features / paintForm → pnpm run sync:stickers"
  echo "  - missing baselines → expected until human accept (test:e2e:visual:accept)"
  echo "  - lifecycle debt → pnpm run test:snapshot-audit"
  echo "Policy: never auto-update snapshots; never test.fixme without a reason."
fi

exit $TEST_EXIT_CODE

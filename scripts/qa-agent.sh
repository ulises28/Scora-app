#!/bin/bash

# 👁️ Scora IA-Agent: Triage Watchdog (v1.0)
# --------------------------------------
# Implements 'Agentic Optimization': Deterministic Triage & Surgical Payloads.
# Distinguishes between Infra Failures (Timeouts) and Intentional Design Drift.

set -e

echo "🚀 Scora | IA-Agent: Starting High-Fidelity Triage..."

# 1. Ensure Docker is ready
if ! docker info > /dev/null 2>&1; then
    echo "⚠️ Error: Docker is not running. IA-Agent requires Docker for Linux-baseline stability."
    exit 1
fi

# 2. Run Tests (Capture exit code)
set +e
docker compose -f docker-compose.playwright.yml up --build --exit-code-from playwright
TEST_EXIT_CODE=$?
set -e

# 3. Deterministic Triage (Filter 1: Infrastructure vs Design)
# Surgical payload: Use -U0 to minimize token wastage
git diff -U0 src/features/editor/CanvasPainter.ts > test-results/CODE_DRIFT.diff
DIFF_SIZE=$(wc -l < test-results/CODE_DRIFT.diff)

DIAGNOSIS="UNKNOWN"
CONFIDENCE="LOW"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ IA-Agent: All systems nominal. Your UI is 100% Studio Grade."
    exit 0
fi

# 4. Keyword Audit (Filter 2: Design Language Check)
KEYWORDS="fontSize|margin|fontFamily|normalizeSport|TRAIN|Ride|BIKE|SKI"
if [ $DIFF_SIZE -eq 0 ]; then
    DIAGNOSIS="INFRASTRUCTURE_FAILURE_OR_TIMEOUT"
    CONFIDENCE="HIGH"
elif grep -qE "$KEYWORDS" test-results/CODE_DRIFT.diff; then
    DIAGNOSIS="INTENTIONAL_DESIGN_DRIFT_LIKELY"
    CONFIDENCE="HIGH"
else
    DIAGNOSIS="POTENTIAL_FUNCTIONAL_REGRESSION"
    CONFIDENCE="MEDIUM"
fi

# 5. Output Payload
echo "{\"status\": \"DIAGNOSTIC_CANDIDATE\", \"diagnosis\": \"$DIAGNOSIS\", \"confidence\": \"$CONFIDENCE\", \"diff_lines\": $DIFF_SIZE, \"timestamp\": \"$(date)\"}" > test-results/AGENT_SIGNAL.json

echo ""
echo "⚠️  IA-Agent: Triage Complete | Diagnosis: $DIAGNOSIS ($CONFIDENCE)"
echo "------------------------------------------------"
if [ "$DIAGNOSIS" == "INFRASTRUCTURE_FAILURE_OR_TIMEOUT" ]; then
    echo "🚨 This looks like a timeout or environment crash (no code drift in Painter)."
    echo "   Recommendation: Restart Docker or check for network flakiness."
else
    echo "🎨 Design drift detected. Surgical payload (-U0) generated at test-results/CODE_DRIFT.diff."
    echo "   Action: Ask Antigravity (Me): 'Audit the drift.'"
fi
echo "------------------------------------------------"

exit $TEST_EXIT_CODE

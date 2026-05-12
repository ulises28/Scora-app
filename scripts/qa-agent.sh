#!/bin/bash

# 👁️ Scora IA-Agent: Smart Auto-Healer (v2.0)
# -----------------------------------------
# Logic: 
# 1. Check for changes in 'src/' (Intentional Design Drift).
# 2. If Drift exists -> Enable --update-snapshots (Auto-heal).
# 3. If NO Drift -> Strict validation (Catch regressions).

set -e

echo "🚀 Scora | IA-Agent: Initializing Smart Triage..."

# 1. Detect Drift
# We focus on the editor features and templates as they drive the UI
DRIFT_DETECTED=false
if git diff --name-only HEAD | grep -qE "src/features/editor/|src/templates/|index.html|src/app.ts"; then
    echo "🎨 Design Drift Detected: Source files have changed. Enabling Auto-heal..."
    DRIFT_DETECTED=true
else
    echo "🛡️ Strict Mode: No relevant code changes detected. Enforcing regression check..."
fi

# 2. Prepare Command
SNAPSHOT_FLAG=""
if [ "$DRIFT_DETECTED" = true ]; then
    SNAPSHOT_FLAG="--update-snapshots"
fi

# 3. Run Tests via Docker
# Note: We pass the flag into the container
echo "🧪 Running E2E Suite..."
set +e
docker compose -f docker-compose.playwright.yml run --rm playwright npx playwright test $SNAPSHOT_FLAG
TEST_EXIT_CODE=$?
set -e

# 4. Final Diagnosis Output
echo "{\"drift_detected\": $DRIFT_DETECTED, \"exit_code\": $TEST_EXIT_CODE, \"timestamp\": \"$(date)\"}" > test-results/TRIAGE_SIGNAL.json

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ IA-Agent: All systems nominal."
else
    if [ "$DRIFT_DETECTED" = true ]; then
        echo "🩹 IA-Agent: UI has been auto-healed. New snapshots generated."
    else
        echo "🚨 IA-Agent: REGRESSION DETECTED. No code drift found, but UI tests failed."
    fi
fi

exit $TEST_EXIT_CODE

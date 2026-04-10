#!/bin/bash

# 🍎 Scora | IA-Healer: Autonomous Sync (v0.2)
# -------------------------------------------
# This script finalizes the healing process once the AI Agent
# has approved the current design drift.

set -e

APPROVAL_FLAG="test-results/APPROVED_DRIFT.json"

echo "🎨 Scora | IA-Healer: Finalizing Design Sync..."

# 1. Check for AI Approval
if [ ! -f "$APPROVAL_FLAG" ]; then
    echo "⚠️  Healing Aborted: No 'APPROVED_DRIFT.json' found."
    echo "   Please ask the AI Agent to audit the drift first."
    exit 1
fi

# 2. Extract Data from Approval
REASON=$(grep -o '"reason": "[^"]*' "$APPROVAL_FLAG" | cut -d'"' -f4)
AUDITOR=$(grep -o '"audited_by": "[^"]*' "$APPROVAL_FLAG" | cut -d'"' -f4)
STATUS=$(grep -o '"status": "[^"]*' "$APPROVAL_FLAG" | cut -d'"' -f4)

echo "✨ IA-Healer: Authorization Received from [$AUDITOR]"
echo "📝 Reason: $REASON"
echo "🛠️  Action: Executing Full Pixel-Sync (Overwrite Mode)..."

# 3. Synchronize
echo "🚀 Synchronizing Linux Baselines (via Docker)..."
bash scripts/calibrate.sh

# 4. Cleanup
rm "$APPROVAL_FLAG"

echo "✅ Healing Complete. Your snapshots are now 100% Studio Grade."

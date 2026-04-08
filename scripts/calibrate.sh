#!/bin/bash

# Scora Studio: Rendering Matrix Calibration Suite
# -----------------------------------------------
# This script handles cross-platform visual regression calibration 
# using a high-fidelity Docker environment.

echo "🎨 Scora | Rendering Matrix Calibration"
echo "---------------------------------------"

# 1. Verification
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not running or installed."
    exit 1
fi

# 2. Build Environment
echo "🏗️  Building high-fidelity rendering environment..."
docker build -f Dockerfile.playwright -t scora-e2e .

# 3. Calibrate Snapshots
echo "📸 Calibrating Linux snapshots (Sticker Matrix)..."
docker run --rm \
    -v $(pwd)/tests:/app/tests \
    scora-e2e \
    npx playwright test --update-snapshots

echo "✅ Calibration Complete. Your local snapshots are now synchronized with the Linux baseline."
echo "🚀 You can now commit these changes and push for a Guaranteed Green CI."

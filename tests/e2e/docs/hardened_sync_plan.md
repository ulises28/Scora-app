# Implementation Plan: Hardening Scora E2E Canvas Sync

## Goal Description
Perfect a robust, state-consistent canvas synchronization strategy to eliminate flakiness in the E2E test suite.

## Proposed Changes

### [Component] src/features/editor
#### [MODIFY] [CanvasPainter.ts](file:///Users/ulises/Developer/Scora-app/src/features/editor/CanvasPainter.ts)
- Moved frame ID increment to the start of `drawTemplate`.
- Aligned `isMain` signals with frame boundaries.

### [Component] tests/e2e/pages
#### [MODIFY] [EditorPage.ts](file:///Users/ulises/Developer/Scora-app/tests/e2e/pages/EditorPage.ts)
- Locked forensic interceptor to `id="storyCanvas"`.
- Implemented `Surgical Frame Inspection` (filtering logs by ID).
- Added `Drift-Resilient Filter` for +/- 1 frame tolerance.

### [Component] tests/e2e/ui
#### [MODIFY] [editor.spec.ts](file:///Users/ulises/Developer/Scora-app/tests/e2e/ui/editor.spec.ts)
- Removed manual watermark management.
- Simplified canvas visibility assertions.

## Verification Plan
### Automated Tests
- Run `npx playwright test tests/e2e/ui/editor.spec.ts -g "SC-006"`
- Verify that "Expected SCORA to be absent" no longer finds hits from thumbnails.

### Manual Verification
- Inspect trace logs to ensure `_scoraCanvasTextLog` correctly tags draws with active `drawId`.

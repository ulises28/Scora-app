# Hardened Scora E2E Canvas Sync Walkthrough

## Summary of Accomplishments
We have successfully resolved the most complex race condition in the Scora E2E suite: the synchronization between React state toggles and HTML5 Canvas rendering.

## Key Technical Solutions

### 1. Surgical Canvas Locking (The "Ghost Logo" Fix)
**Problem**: The E2E tests were reporting that the "SCORA" logo was visible even after being toggled off.
**Discovery**: The app was rendering gallery thumbnails in the background. Our global interceptor was catching "SCORA" draws from these thumbnails, leading to false positives.
**Fix**: Updated the `EditorPage` interceptor to strictly filter for `id="storyCanvas"`.
```javascript
if (this.canvas && this.canvas.id !== 'storyCanvas') return original.apply(this, arguments);
```

### 2. Temporal ID Alignment
**Problem**: Intercepted drawing calls were tagged with the *previous* frame's ID because the counter incremented too late.
**Fix**: Moved the `_scoraLastDrawId` increment to the very first line of the `drawTemplate` function in `CanvasPainter.ts`. Every draw is now correctly associated with its active frame.

### 3. Drift-Resilient Verification
**Problem**: Micro-timing differences in the browser event loop could cause a check to happen exactly between frames.
**Fix**: Implemented a `+/- 1` frame tolerance in `waitForCanvasContent`. The test now inspects the latest settled frame and the one immediately preceding it.

## Files Modified
- `src/features/editor/CanvasPainter.ts`
- `tests/e2e/pages/EditorPage.ts`
- `tests/e2e/ui/editor.spec.ts`

## Verification Results
Tests now correctly distinguish between the main editor canvas and background thumbnail canvases, ensuring that "Logo Off" actually means "Logo Off" in our assertions.

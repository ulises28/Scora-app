# Cap-surge stress fixture

Materializes a **12-sticker merge** so the healer can be graded under real catalog pressure (not procedure-only).

## Layout

| File | Role |
|------|------|
| `scenario.json` | Expected reds + heal rules (source of truth for the case) |
| `surge-renderers.ts` | 12 minimal `drawSurge*` functions (paint something — no empty cards) |
| `surge-registry.txt` | One-line registry entries to insert |
| `apply-surge.ts` | Patch `StickerRegistry.ts` + `CanvasPainter.ts`, then `sync:stickers` |
| `revert-surge.ts` | Restore from `*.surge-backup` |

## Run stress eval

```sh
# 1. Apply 12-sticker surge (suite will go red on contract/unit until healed)
npx tsx evals/fixtures/cap-surge/apply-surge.ts

# 2. Gates — capture the red
pnpm run test:unit          # expect integrity failures until sync
pnpm run sync:stickers      # healer should do this first
pnpm run test:snapshot-audit

# 3. Live heal eval (honest healer — no mass --update-snapshots)
#    write evidence to evals/reports/live/healer-cap-surge-many-new-stickers/evidence.json

# 4. Revert product catalog to pre-surge
npx tsx evals/fixtures/cap-surge/revert-surge.ts
```

## Policy (must_not) under surge

- No mass `--update-snapshots`
- No `test.fixme` sink
- No hand-edit of `sticker-capabilities.json`
- Heroes only for critical families after human review

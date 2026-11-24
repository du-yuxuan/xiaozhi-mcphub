# Recovery notes — xiaozhi-mcphub

- Source: `/Volumes/Data-A/Projects/apps/xiaozhi-mcphub/xiaozhi-mcphub/xiaozhi-mcphub`
- Branch: `recovery-20261124`
- Backup date: 2026-11-24
- This branch is a source-only recovery snapshot from a volume with APFS corruption/zeroed files.

## Excluded all-NUL files
- None detected.

## Excluded large all-NUL candidates (>20MB, first 4KB zero)
- None detected.

## Excluded files over 100MB
- None detected.

## Removed unsafe symlinks
- None detected.

## Secret scan
- `.env.example:40` — openai_sk (placeholder)
- `tests/auth.logic.test.ts:57` — password_assign (placeholder)
- `tests/auth.logic.test.ts:102` — password_assign (placeholder)
- `tests/auth.logic.test.ts:124` — password_assign (placeholder)
- `tests/setup.ts:7` — secret_assign (placeholder)
- `tests/utils/mockSettings.ts:39` — password_assign (placeholder)
- `tests/utils/testHelpers.ts:72` — password_assign (placeholder)
- `tests/utils/testHelpers.ts:79` — password_assign (placeholder)
- `tests/utils/testHelpers.ts:29` — secret_assign (placeholder)
- `src/db/services/initializationService.ts:47` — password_assign (hashed)
- `src/db/services/initializationService.ts:128` — password_assign (placeholder)
- `src/db/services/initializationService.ts:13` — secret_assign (placeholder)
- `src/services/userService.ts:173` — password_assign (placeholder)

## Exclusions applied
- `.git`, dependency/build/cache dirs, model/weight dirs, datasets, media/model archives, secrets (`.env`, private keys), and files >100MB were excluded.
- Excluded paths are not recoverable from this branch; see the source volume/snapshot for the originals.

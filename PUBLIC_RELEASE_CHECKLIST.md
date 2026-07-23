# Public Release Checklist

## Review before publishing

- [x] Confirm the public name “练迹 · 本地健身记录”.
- [x] Confirm the generic four-day sample plan and self-selected loading.
- [x] Confirm that optional DashScope/Qwen support should remain in the public project.
- [x] Confirm the default AI “最少数据” boundary and the explicit “详细数据” opt-in.
- [x] Confirm the MIT license with the neutral copyright holder “Contributors”.
- [x] Publish as the public repository `lianji-fitness-pwa`.

## Required verification

- [x] Original project left unchanged.
- [x] No old `.git` history copied.
- [x] No real profile, body measurements, injury history, API Key, credential or private deployment address retained.
- [x] Local caches, rollback archives, generated build output and dependencies excluded.
- [x] Production dependency audit passed.
- [x] Unit tests passed.
- [x] Production build passed.
- [x] Mobile/PWA smoke passed.
- [x] AI coach smoke passed with a mock endpoint and fake fixture key.
- [x] Source and production build secret/privacy rescan passed.

## Publish sequence after approval

1. Create a fresh Git repository from this directory.
2. Re-run install, tests, build, dependency audit and secret scan.
3. Commit only the reviewed files.
4. Create the chosen GitHub repository with the selected visibility.
5. Push the clean initial commit.
6. Verify the GitHub file list and Actions run.
7. Create a source archive from the exact pushed commit and attach it only if requested.

# Pulse Gym 0.1.3 verification

Android versionCode: 4. Scope: in-app update download progress only.

## Changes

- Setup → APP UPDATES shows a live progress bar while an update downloads, with megabytes received and total (for example "Downloading… 12.3 / 32.7 MB · 38%"), then a "Verifying download…" bar while the SHA-256 is checked, then "Opening installer…".
- If the server sends no length, GitHub's asset size is used for the total; without either, only megabytes received are shown.
- A download that returns an HTTP error status is now rejected and deleted instead of being hashed.
- Update checks and downloads no longer run inside the database queue, so a long download cannot hold up saving workouts or sets.
- Update state lives outside the screen: leaving Setup mid-download and coming back shows the current progress instead of a blank button.

## Completed checks

| Check | Result and scope |
| --- | --- |
| TypeScript | Passed. |
| Tests | 26 passed. New: progress phases and ordering, MB formatting, size fallback, server length precedence, and HTTP-error rejection (mocked file-system and installer). |
| Translation coverage | Passed; the new strings have Afrikaans entries. |
| Browser UI | The progress states (downloading, unknown total, verifying, installing, error) were rendered in headless Chromium by injecting state through a temporary hook, which was removed before committing. Layout and text were checked in screenshots. |
| ESLint | Zero errors; advisory warnings only. |

## Not verified

- No real download was run: the browser build cannot install an APK, and no Android device was used. Progress callbacks from `expo-file-system/legacy` `createDownloadResumable` follow the SDK 58 documentation but have not been observed on a phone. Per that documentation, callbacks pause while the app is in the background.
- To see the bar on a phone you need two published versions: install 0.1.3, then update to a newer release.

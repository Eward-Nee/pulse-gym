# Pulse Gym 0.1.2 verification

Android versionCode: 3.

## Changes

- **Cancel active workouts**: a "Cancel workout" button on the Home resume card and inside the session screen, both behind a confirmation. Cancelling clears the saved session only; history is untouched.
- **Workout builder layout**: weight, rest, reps, sets and notes now sit in a two-column grid without wrapping or percentage widths, so fields cannot overlap.
- **Page transitions**: switching between Home, Challenge and Setup slides and fades in from the direction of the tab. Respects reduced motion (system setting and the in-app switch).
- **Storage and sync fixes** (`src/services/db.ts`, `peers.ts`):
  - All reads and writes go through one queue. Expo documents that `withTransactionAsync` pulls in any query running on the same connection while it is open, so UI refreshes and peer flushes could observe, or join, a half-finished transaction.
  - The UI loads data and the active session in one queued read instead of two unrelated reads.
  - The database connection is opened once even if several callers ask at start-up.
  - First-run set-up (profile plus starter workouts) is atomic and safe to repeat; `user_version` is read before it is written, with a place for future migrations.
  - Unreadable stored JSON no longer crashes start-up: settings fall back to defaults and a damaged workout loads without exercises.
  - Workout positions stay unique: new workouts are appended in the database, and deleting closes the gap.
  - Concurrent saves are counted, so the busy indicator no longer switches off early.
  - HYROX settings save only the race fields, so they cannot overwrite other settings with a stale copy.
  - Outbox rows for a friend that no longer exists are dropped instead of retried.
- **Wallpapers**: the picker in Setup shows a live preview of each wallpaper. The image and tint now fill the whole hero card (previously the tint only covered part of it), and Iron, Steel and Calm are visibly different.
- **English and Afrikaans**: English is the default. Setup → LANGUAGE switches the whole app, including validation errors, notifications and generated HYROX plans. Existing installs have no saved language and therefore start in English; their saved workouts keep the language they were written in.
- **Scrollbars**: the right-hand scroll indicator is hidden on every list and sheet.
- **ID button**: "Show my ID" becomes "Hide ID" while the ID is visible.

## Completed checks

| Check                                       | Result and scope                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                                  | Passed.                                                                                                                                                                                                                                                                                                                                                 |
| Tests                                       | 25 passed: the 17 earlier tests plus language coverage, active-session cancel, position uniqueness, read/transaction isolation, atomic start-up with corrupt JSON, and language persistence.                                                                                                                                                            |
| Translation coverage                        | A test scans every `t()` / `tn()` string in the source and fails if one has no Afrikaans entry or its `{placeholders}` differ.                                                                                                                                                                                                                          |
| Browser UI (headless Chromium, 430 px wide) | `scripts/browser-smoke.mjs` passed: English default, tab slide detected, no visible scrollbars, three wallpapers, show/hide ID, language switch, builder fields not overlapping (measured), persistence over reload, HYROX import, session resume, cancel from the session and from Home, history untouched, no horizontal overflow, no runtime errors. |
| ESLint                                      | Zero errors; remaining warnings are advisory and mostly pre-existing.                                                                                                                                                                                                                                                                                   |

## Not verified

- No Android device or emulator was used. The overlap was not seen in the browser (web uses CSS flexbox, not Android's Yoga layout); the fix replaces the wrapping, percentage-width layout that is the likely cause with a plain two-column grid, and the browser check only confirms the new layout is clean. Confirm on a phone.
- The page-transition feel and the scroll-indicator removal were checked in the browser, not on Android (`showsVerticalScrollIndicator={false}` is the native equivalent).
- An APK for 0.1.2 has not been built or signed. Two-phone peer delivery is still untested on real devices.
- Afrikaans text was written by the assistant from the existing Afrikaans strings; have a native speaker skim the new strings (cancel flow, language labels, ID toggle).

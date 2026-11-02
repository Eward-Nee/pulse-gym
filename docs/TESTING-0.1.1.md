# Pulse Gym 0.1.1 verification

Date: 2026-11-02. Android versionCode: 2.

## Changes

- Invitation encoding uses standard base64 plus URL-safe character conversion, supported by React Native's Buffer polyfill. Existing PULSE1 codes remain compatible.
- Notification UI reads OS permission on mount, after requesting permission, and when returning to the foreground. Enabled permission replaces the activation button; blocked permission links to Settings.
- Updates always use Eward-Nee/pulse-gym. There is no repository input. Old saved values cannot redirect checks. Equal/older releases cannot be installed through the update action.
- Serialized partial settings updates preserve changes made in quick succession.

## Completed checks

| Check | Result and scope |
| --- | --- |
| TypeScript and tests | Passed: 17 tests, including the existing nine core tests. |
| Mobile invitation regression | Browser-platform bundle uses the actual buffer polyfill; round trips, Unicode, legacy codes and invalid encodings covered. |
| SQLite functionality | Workout/exercise CRUD and ordering, settings, sessions, history and reload persistence; real SQLite in isolated test databases. |
| Two-peer service integration | Actual peer/encryption/database code with mocked native transport: pairing, verification, one partner, challenge acknowledgement, retry, replay, expiry, sharing and friend removal. |
| Permission controller | Grant, denial, revocation, foreground refresh, blocked/error/unsupported states, stale reads and disposal; mocked OS permission boundary. |
| Notifications | Scheduling/cancellation and denied permission tested with mocked OS APIs. |
| Updates | Fixed API/release origin, semver, asset digest, successful mocked installation, corrupted digest and equal/older version rejection. |
| Browser UI | Boot, profile/theme persistence, workout creation, completion, session resume after reload, history, no-friend challenge guard, HYROX date and week import. No runtime errors in inspected logs. |
| ESLint | Zero errors; 29 advisory warnings remain. |
| Final web export | Passed. Final repository-input removal inspected in source and covered at service level; final browser revisit was blocked by browser security policy. |
| Android release | assembleRelease passed (370 tasks); ARM64, package app.pulsegym.local, minimum API 24, target API 36. Bundled JavaScript present. APK v2 signature verified with the same certificate as 0.1.0. |

## Device checks still required

No Android device was attached. Actual permission dialogs and foreground transitions, TCP delivery between two phones, notification display/deadline timing, Android installation over 0.1.0, and performance on real phones remain unverified. Mock integration tests do not establish real network or OS behavior. iOS was not built.

Update checks are manual. Background update polling/notifications and reliable closed-app remote challenge push are not implemented. See the README two-phone checklist before relying on peer delivery.

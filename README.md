# Pulse Gym

React Native / Expo app based on the **Pulse Social** concept. Afrikaans UI, a separate **Couples** theme, local SQLite storage, and at most **one partner selected from accepted, verified friends**.

## Run

```sh
npm ci
npm run check
npm run lint
npm start
```

For the complete native feature set, use a native development build (not Expo Go):

```sh
npx expo prebuild --platform android
npm run android:build
```

You need Android Studio/SDK and the JDK supported by the generated Gradle project. The source was generated with Expo SDK 58 / React Native 0.88.1. The local Android SDK is installed under `.local-build/sdk`. A signed standalone ARM64 APK was built successfully at `builds/pulse-gym-0.1.1-arm64.apk` (32.6 MiB; Android 7/API 24 or later). Its APK v2 signature and bundled JavaScript were verified. No physical-device test has been completed. iOS native compilation requires a Mac and has not been tested.

A functional browser version of the same React Native UI is available for local workouts, themes, history and HYROX planning:

```sh
npm run export:web -- --output-dir web-dist
python3 scripts/serve-preview.py
# http://127.0.0.1:8766
```

The supplied localhost server sets COOP/COEP headers needed by Expo SQLite's WASM worker. Opening `index.html` as a file will not work. Browser data is separate from phone data and stored in that browser's origin storage. Browser identity storage is not a native keystore; **do not use the browser version for peer connections** (the UI disables them).

## Install the Android test build

Transfer `builds/pulse-gym-0.1.1-arm64.apk` to an ARM64 Android phone and open it. Allow installation from that file app when Android asks. This is a standalone build: Metro and Expo Go are not needed. Keep the signing key backed up privately before distributing future updates. This build has not yet been run on a physical phone; use the two-phone checklist below before relying on peer delivery.

## Implemented

- Three tabs: Home, Challenge, Setup. Pulse Social is the default; Couples is optional.
- One nullable partner foreign key in a singleton profile, with a database trigger requiring an accepted, verified friend. Replacing a partner replaces the previous choice; deleting that friend clears the choice.
- Workout/exercise create, edit, delete and reorder; sets, reps, weight, bodyweight, time, distance, rest and notes. Inputs are validated.
- Active-session persistence, set completion, elapsed/rest timers, resume after restart, and completed/partial-session history.
- Challenges for distance, repetitions and workouts; the eight requested deadlines, acceptance, decline, self-reported completion and derived expiry. Outgoing challenges stay in an encrypted SQLite outbox until authenticated acknowledgement.
- Per-friend sharing consent, locally cached shared templates/history, template import, and a direct share update that clears the remote shared view when consent is disabled. Previously imported copies cannot be remotely revoked.
- HYROX Mixed Doubles race date and original 12-week programme, foundation/regular levels, 3–5 training days, all sessions importable as editable workouts, recovery and taper weeks, and partner changeover guidance. Race loads are shown separately from training loads, which must be chosen for the individual.
- Local notifications upon actual receipt, and deadline reminders after acceptance and notification permission.
- Public GitHub Releases check, semantic version comparison, APK download, SHA-256 verification against the GitHub release asset digest, then the user-approved Android system installer. No git pull/build on a phone and no silent installation.

## Direct peer connections — precise scope

There is **no central application database, signaling server, account server, analytics endpoint, FCM integration or APNs provider**. The only public API call is a user-triggered GitHub release check/download.

The native adapter uses direct TCP. Start with both phones on the same Wi-Fi, both apps open, and a network without client isolation. Setup generates `PULSE1:…`, containing a key-derived shareable ID, public key and current IPv4 endpoint. Paste the full invitation and compare the full fingerprint through a trusted channel. The receiver verifies and accepts the request. A short ID is not a global internet directory. Refresh/exchange invitations when a phone's network address changes.

Traffic is encrypted end to end with X25519 + HKDF-SHA256 + XChaCha20-Poly1305 using `@noble` primitives. Native private keys stay in Expo SecureStore. The envelope authenticates sender and recipient, uses random 192-bit nonces, validates bounded payloads and stores replay receipts transactionally. Delivery acknowledgements are themselves encrypted and authenticated. This is an application protocol, **not an independently audited messaging system**; static identity DH does not provide ratcheting/forward secrecy.

Direct reachability across arbitrary mobile networks is **not guaranteed**. There is no automatic NAT traversal or relay. A backgrounded/killed app cannot reliably receive a new network challenge or be remotely awakened. Received messages can produce local notifications, which are distinct from remote push. Reliable closed-app push over the internet requires additional infrastructure and an explicit architecture decision.

`react-native-tcp-socket` is flagged by Expo Doctor as **untested on the New Architecture**. Do not consider device-to-device networking release-ready until the two-phone checklist below passes. No real friend messages have been sent during development.

## APK builds and GitHub

For a local signed ARM64 APK after installing the Android SDK and `mise` Temurin 17, run `python3 scripts/build-local-android.py`. It uses a persistent private signing key in `.local-build/` and writes to `builds/pulse-gym-0.1.1-arm64.apk`. Back up `.local-build/pulse-release.jks` and `.local-build/signing.json` privately; both are excluded from Git. The script does not change the system default Java version.

Repository: https://github.com/Eward-Nee/pulse-gym

Android releases: https://github.com/Eward-Nee/pulse-gym/releases

In Setup → App-opdaterings, select **Soek opdatering**. The app always checks `Eward-Nee/pulse-gym`; no repository entry or configuration is required. Legacy saved repository values are ignored. Version 0.1.1 has no automatic update polling or update notifications. New code commits alone do not trigger an app update: publish a signed APK on a newer stable version tag. The Git repository root is the application directory.

The manual GitHub Actions workflow builds a signed standalone APK and uploads it as a workflow artifact. Configure these repository secrets first:

- `ANDROID_KEYSTORE_BASE64`: your persistent release keystore encoded as base64.
- `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Keep the key backed up privately; future updates must use the same signing identity and a higher `android.versionCode` / app version. The signing script fails rather than quietly using the template's debug key. No signing secrets belong in source control. The workflow does not automatically publish a public release. Attach the signed APK to a stable GitHub Release such as `v0.1.1`. The update repository is fixed in the app. GitHub's asset SHA-256 digest must be present for in-app Android installation. The OS still verifies package signatures. Distribution through app stores has separate requirements, including installation permissions.

## Validation completed

ESLint was added for source checks before publication. Existing compiler-readiness findings, unused imports and one verified Expo barrel-export diagnostic remain visible as warnings; this is not a warning-free lint baseline. Generated bundles and the downloaded Android SDK are excluded.

- TypeScript compilation and 17 tests (nine core tests plus eight service/functionality tests; see [v0.1.1 test report](docs/TESTING-0.1.1.md)). Core coverage includes: authenticated encryption/tampering/wrong-recipient rejection, invitation validation, database partner constraints, replay-receipt uniqueness, expiry boundaries, date validation, all 72 HYROX parameter combinations, workout input validation and oversized packet rejection.
- Browser smoke test: initial boot, Couples theme, profile change, workout create/save, persistence after reload, race date, week import, friend-required challenge guard, set completion, immediate/reload session resume, partial-session history, and no horizontal overflow at 430px. No runtime exceptions in that run.
- Android Hermes/JS export, native project generation and signed ARM64 release build completed (370 Gradle tasks; release lint passed). `apksigner verify` passed; the package is `app.pulsegym.local`, version 0.1.1/code 2, minimum API 24 and target API 36. The TCP native module compiled. **Physical-device behavior and two-phone networking remain untested.**
- Dependency audit reports 11 moderate transitive Expo tooling findings (`glob` / `minimatch`), no high/critical findings at inspection. A forced downgrade of Expo was not applied. Expo Doctor's remaining known warning is the TCP library's New Architecture status.

### Required two-phone release checks

1. Build with your signing key; install on two Android devices. Verify both native socket modules load.
2. Pair with full fingerprint comparison; reject a mismatched code. Try a pending friend as partner (must fail), switch one accepted partner to another, and remove the selected friend.
3. Send a challenge with both apps open. Verify notification permission accepted/denied behavior and sender delivery acknowledgement.
4. Disconnect Wi-Fi, create a challenge, reconnect and retry. Verify no duplicate challenge after repeated delivery. Expired unsent challenges must not be delivered.
5. Accept/complete before the deadline; retry completion after the deadline. Compare both histories and clocks.
6. Enable/disable sharing independently on each phone, verify remote cached views after sync, and import a template without changing its original.
7. Kill/relaunch mid-session; verify persisted set counts. Test quick repeated taps and a failed database write.
8. Check a signed GitHub APK update with the same key; reject a corrupt digest or wrong signing key. Test on a physical low/mid-range device before making performance claims.

## HYROX research

Rules checked against the **2026/27 Doubles rulebook** on 2026-11-02:
https://maintain.hyrox.com/rulebooks/HYROX_RulebookDoubles_EN.pdf

Preparation: https://hyrox.com/best-hyrox-preparation/
Periodization context: https://hyrox.com/training-partner/hybrid-program/

Both partners run every run segment together and split station work. The workout programme is an original illustrative template, not an official HYROX programme or individualized coaching. Regular level assumes a 30-minute comfortable running base and resistance-training experience. Short timelines never automatically compress missed volume. Choose individual training loads, equipment substitutions and workload with an appropriately qualified coach where needed; recheck event rules for the selected season.

The wallpaper and icon were generated for this project. The original ten design concepts, image masters and prompts are preserved in [`design/`](design/README.md). Pulse keeps the existing icon and cinematic gym photograph while introducing coral accents; Couples uses warm rose and cream.

# AI GYM design exploration

Ten visual concepts, each with Home, Challenge and Setup; 30 primary views. `gym-concepts.html` is the editable inline fragment. `preview.html` is the standalone inspection wrapper. These are the original design prototypes. The implemented React Native application is in the repository root; see [its README](../README.md).

## Included interactions

Workout and exercise creation/editing/deletion, workout ordering, exercise upward ordering, sets/reps/weights/duration/distance, session preview, challenge builder with eight expiry choices, accept/decline/complete previews, notification preview, friend-ID pairing preview and template import, wallpaper treatments, theme accent, reduced motion, shortlist, HYROX race date and 12-week training explorer. The selected week's easy run can be imported into Home.

All friend identities, history, challenge statuses and update checks are demonstrative. Workout edits stay in the current visualization session; only shortlist and selected page/race date are offered to the host's widget-state persistence. There is no SQLite, encryption, live peer connection, push delivery or installer in this prototype.

## HYROX research — checked 2026-11-02

Official current Doubles rules: https://maintain.hyrox.com/rulebooks/HYROX_RulebookDoubles_EN.pdf (26/27, sections 4.1, 7 and 8).
Preparation principles: https://hyrox.com/best-hyrox-preparation/
Periodization context: https://hyrox.com/training-partner/hybrid-program/

Mixed Doubles: both athletes run the full eight running segments together; station work is shared. Distances, loads and target heights in the explorer follow the current rulebook. These rules must be rechecked for the selected event/season. The 12-week programme is an original illustrative design, not an official programme or individualized coaching. The regular version assumes a 30-minute easy-running base and resistance-training experience. Beginner selection reduces running and partner-session intensity. Do not compress missed training into fewer weeks. Before production personalization, collect both partners' current training, available equipment, injury constraints, race date and weekly availability. Race loads must remain distinct from training loads.

## Decisions before native implementation

- Platform: Android first, or Android and iOS?
- SQLite on-device can satisfy no central training-data storage. Store identity private keys in platform secure storage, not plain SQLite.
- Direct internet connections cannot be guaranteed on every network. WebRTC commonly requires signaling and STUN/TURN; those services are distinct from a central training database. A strict zero-infrastructure option needs explicit limits, such as local-network pairing and both peers being reachable. A random ID alone cannot discover a peer on the internet.
- Reliable remote wake-up notifications normally use APNs/FCM infrastructure; local notifications are different. Do not embed push-provider credentials in clients. Outbox, delivery acknowledgement, replay protection, clock handling and explicit sharing permissions belong in the native design.
- GitHub source is not an installable application. Publish signed build artifacts; Android can offer a user-approved package installation. iOS needs an eligible platform distribution/update route. No silent source pull/build/install promise.
- Performance is a measurable native target, not demonstrated by this preview. Use immediate local state, indexed database queries, virtualized lists, cached assets and reduced-motion-aware animations. Benchmark on target phones.

References: https://webrtc.org/getting-started/peer-connections ; https://webrtc.org/getting-started/turn-server ; https://developer.apple.com/documentation/usernotifications/setting-up-a-remote-notification-server ; https://developer.android.com/reference/android/content/pm/PackageInstaller

## Generated visual assets

Built-in image generation was used. PNG masters are preserved; JPEG copies are format-compressed for embedding. The three wallpaper options are treatments of one original photograph, not three separately generated photographs. One original app icon is used across ten typographic brand directions.

Wallpaper prompt: “Use case: photorealistic-natural. Create a premium professional gym app wallpaper, portrait photograph of a beautiful dark modern weight room, close foreground dumbbells and weight plates, squat rack receding into background, brushed steel and black rubber textures, cinematic soft directional light, subdued neutral charcoal tones with warm highlights, plenty of dark negative space in upper half for app UI. No people, no text, no logos, no watermark. Editorial fitness photography, realistic premium commercial quality.”

Logo prompt: “Use case: logo-brand. Create one premium gym app icon for AI GYM. A crisp geometric monogram combining letter A with a barbell, bold simple silhouette legible at small size, balanced original athletic identity, electric lime mark on solid near-black rounded square, restrained professional flat design, centered, no mockup, no lettering outside the mark, no gradients, no 3D, no watermark. Square image.”

## Validation

Browser check passed: ten variants, thirty main-page renders, embedded images, workout save, plan/week selection, three-day schedule, easy-run import, challenge creation and friend pairing. No runtime exceptions in that check. Narrow viewport: 298px available inside the wrapper, 298px document scroll width (no horizontal overflow). Screenshot reviewed. Prototype uses transform/opacity transitions and respects OS reduced-motion preferences.

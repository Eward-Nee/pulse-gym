# Pulse Gym 0.1.4 verification

Android versionCode: 5.

## Changes

- **Wallpapers restored.** The generated gym photograph now shows clearly: the crop is centred on the equipment (rack, dumbbells, plates) instead of the empty dark wall, and the treatments are light colour tints rather than the heavy darkening added in 0.1.2. Options are Iron / warm, Steel / cool, Together / rose (the third treatment from the design prototype) and Calm / solid. Setup shows a 2×2 grid of live previews.
- **Floating tab bar.** The bar's container has no background at all, so screen content scrolls behind it; lists keep extra bottom padding so the last item is never hidden. The selected pill glides between tabs on a spring with a slight stretch, while icon and label cross-fade and pop. Respects reduced motion.
- **Time exercises use weight, not distance.** Time shows Time and Weight (kg); Run / distance shows Time and Distance; Weight shows Reps and Weight. Switching type clears fields that no longer apply. Summaries read e.g. "3 × 45 s · 10 kg". A Time exercise needs a duration; older Time exercises that only have a distance remain valid.

## Completed checks

| Check | Result and scope |
| --- | --- |
| TypeScript | Passed. |
| Tests | 28 passed. New: Time summaries, validation and duration formatting; run exercises unchanged; all four wallpaper values persist and unknown values fall back. Translation coverage still passes. |
| Browser UI (headless Chromium, 430 px) | Smoke test passed: tab-bar container is a transparent absolutely-positioned overlay; the pill was sampled mid-animation and moved smoothly (278 → 201 → 28 px); Time shows Weight and no Distance, Run shows Distance and no Weight; all four wallpapers selectable; plus every earlier check (persistence, cancel, language, scrollbars, no overflow). Screenshots of the wallpaper grid, hero and tab bar were reviewed. |
| ESLint | Zero errors; advisory warnings only. |

## Not verified

- No Android device or emulator was used. The spring animation, the photo crop and the overlay tab bar (including bottom insets on gesture-navigation phones) are verified in a browser only.
- The tab bar overlays the bottom 108 px of every screen. On phones with a large bottom inset the last list item may sit closer to the bar than in the browser; check on a device.
- An APK for 0.1.4 has not been built unless a release says otherwise.

// Run after expo prebuild, before a release build. Never print signing credentials.
const fs = require("node:fs");
for (const name of [
  "PULSE_KEYSTORE_PATH",
  "PULSE_STORE_PASSWORD",
  "PULSE_KEY_ALIAS",
  "PULSE_KEY_PASSWORD",
]) {
  if (!process.env[name])
    throw new Error(
      `Missing ${name}. Release signing must use your own persistent key.`,
    );
}
const file = "android/app/build.gradle";
let source = fs.readFileSync(file, "utf8");
if (!source.includes("PULSE_RELEASE_SIGNING")) {
  source = source.replace(
    "signingConfigs {",
    `signingConfigs {
        // PULSE_RELEASE_SIGNING
        release {
            storeFile file(System.getenv('PULSE_KEYSTORE_PATH'))
            storePassword System.getenv('PULSE_STORE_PASSWORD')
            keyAlias System.getenv('PULSE_KEY_ALIAS')
            keyPassword System.getenv('PULSE_KEY_PASSWORD')
        }`,
  );
  source = source.replace(
    /(release \{[\s\S]*?\/\/ Caution![\s\S]*?signingConfig signingConfigs\.)debug/,
    "$1release",
  );
}
if (!/signingConfig signingConfigs\.release/.test(source))
  throw new Error(
    "Unexpected Gradle template; refusing an unsigned or debug-key release.",
  );
fs.writeFileSync(file, source);

const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/**", "web-dist/**", "android-dist/**", ".local-build/**", "android/**", "ios/**", "builds/**"] },
  {
    // Adopt compiler-readiness checks as advisories for the existing test build.
    // React Compiler is not enabled; these findings remain visible in lint output.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  { files: ["scripts/**/*.mjs"], languageOptions: { globals: { Buffer: "readonly" } } },
  {
    files: ["src/services/notifications.ts"],
    // Expo re-exports AndroidImportance from a .types.js runtime module.
    // Its actual JS export and TypeScript declaration are both present.
    rules: { "import/namespace": "warn" },
  },
]);

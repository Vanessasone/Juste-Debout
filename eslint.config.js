// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Supabase Edge Functions tournent sous Deno (imports par URL esm.sh) — hors app RN.
    ignores: ["dist/*", "supabase/functions/**", ".expo/**"],
    // Dette technique existante : conserver la visibilité sans bloquer le build.
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
    },
  }
]);

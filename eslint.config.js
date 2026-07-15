// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Supabase Edge Functions tournent sous Deno (imports par URL esm.sh) — hors app RN.
    ignores: ["dist/*", "supabase/functions/**", ".expo/**"],
  }
]);

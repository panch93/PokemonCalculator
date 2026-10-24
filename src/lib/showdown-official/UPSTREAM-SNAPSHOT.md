# Browser TeamValidator upstream snapshot

This directory adapts the official Pokémon Showdown source files from the upstream source archive used for this migration. The upstream source is MIT-licensed; see `LICENSE`.

- Upstream project: https://github.com/smogon/pokemon-showdown
- Source snapshot date: 2026-10-22
- Adapted validator: `sim/team-validator.ts`
- Bundled rules and data: base Gen 9 data tables, official Gen 1–8 mod overrides, English display text, and `config/formats.ts`
- SHA-256 digest over the original upstream core validator, Dex, formats, base data, English text, and bundled Gen 1–8 mod source files (path + NUL + bytes + NUL for each listed file):
  `1287afc5409cdf114af8686d5a4490609adb6db301c39b8a9802c0734a95e04e`

## Browser adaptations and scope

- Replaced runtime filesystem discovery and dynamic data loading in `sim/dex.ts` / `sim/dex-text.ts` with static module imports in `browser-data.ts`.
- Kept upstream `TeamValidator` rule-table, set validation, source-generation and learnset checks. The worker runs it locally; no Node.js service or API route is required.
- The browser build supports formats whose upstream `mod` is exactly `gen1` through `gen9` and that use user-supplied teams. Custom mods outside those base-generation mods and generated-team formats return **unverified** rather than a legal verdict.
- Data is a bundled snapshot, not live-executable code fetched from the website. The format picker may fetch live metadata, but that metadata is never evaluated as code. When live ruleset metadata is available, the worker compares it with the bundled format and fails closed if they differ. Rebuild this snapshot from a reviewed upstream revision to update validator rules/data.

Do not broaden the supported-mod gate without bundling the corresponding mod data and adding differential tests against the same upstream revision.

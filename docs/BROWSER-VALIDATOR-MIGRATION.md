# Browser-compatible Pokémon Showdown validator migration

## This checkpoint

- Removed `@pkmn/sim` from package metadata and the lockfile.
- Removed the legacy `format-rule-compatibility.ts`, `pkmn-sim-format-catalog-source.ts`, and `pkmn-sim-validation-provider.ts` modules. They are obsolete and will fail the `check:no-pkmn-sim` guard if restored.
- Consolidated the live format catalogue parser into `src/lib/showdown-format-config.ts`; the format picker now calls this shared parser rather than maintaining a second parser.
- Kept `browserValidationProvider` fail-closed (`valid: null`). A current list of formats and bans is metadata, not a substitute for Showdown's executable legality checks.
- Kept the stable `TeamValidationProvider` boundary, existing UI, and `@smogon/calc` damage calculations unchanged.

## Official validator port plan

The next implementation stages should be performed in this order:

1. **Pin and inventory upstream code.** Record the exact Showdown commit and map dependencies of `sim/team-validator.ts`, `sim/dex.ts`, `sim/dex-formats.ts`, `sim/teams.ts`, `sim/prng.ts`, `lib/utils.ts`, `data/tags.ts`, and the required `data/mods/*` files. Classify imports as browser-safe, data loading to replace, or Node-only.
2. **Build a browser-safe data layer.** Do not execute fetched TypeScript source. Use explicit schemas for data and formats; track the upstream revision. Fetch live data only where browser CORS, file shape, and compatibility are verified. Some code-time data may need to be generated into static assets during GitHub Actions builds.
3. **Add a Web Worker protocol.** Each request carries an ID, selected format ID, and team. Each response carries the request ID, source revision, structured issues, and a status. Worker errors, stale data, and unsupported formats must remain unverified rather than return legal.
4. **Adapt official `TeamValidator` logic.** Preserve rule-table construction, inherited rules, learnset compatibility, and the official legality checks. Do not substitute a small custom banlist or a basic species/move lookup.
5. **Differential test against official Showdown.** Compare valid and invalid teams across representative formats and edge cases: learnset combinations, levels, formes, abilities, items, clauses, complex bans, and generation-specific mechanics.
6. **Enable formats only after passing tests.** Formats whose dependencies or rules are not ported remain explicitly unverified.

## Static hosting constraints

The deployed site remains a static export with no API routes and no runtime Node service. GitHub Actions may download upstream source, generate static assets, run tests, and open update issues. All in-browser legality validation must execute in the browser, preferably in a Web Worker.

## Prohibited shortcuts

- Do not import the official `pokemon-showdown` Node API directly into client code.
- Do not claim a team is legal solely because its format metadata was fetched.
- Do not automatically deploy an upstream validator change without regression and differential tests.
- Do not alter damage calculation behavior or unrelated UI as part of the validator port.

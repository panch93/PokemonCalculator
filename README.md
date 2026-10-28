# Pokémon Team Lab — v2.3.2

A browser-based Pokémon team matchup lab built with Next.js, React, TypeScript, `@smogon/calc`, live Pokémon Showdown discovery data, and the upstream TeamValidator adapted for browser execution.

## Features

- 6v6 matchup matrix with damage ranges, estimated KO tiers, type matchups, and uniform move-details popups. Multi-hit moves add a fine-bin probability histogram.
- Multi-hit-aware damage distributions for common moves such as Triple Axel and Population Bomb, including hit-count/accuracy probabilities and relevant accuracy/hit-count items and abilities.
- Draft Matchups matchup counts are precomputed for Hits, Walls, Hit by, and Walled by; hovering each count opens its own detailed list. Directed attack results are cached and reused across all four lists. Analysis uses configured offensive/defensive EVs or Champions Stat Points, natures, and stat stages on both sides. Each matchup saves its mechanics generation.
- Generation-aware damage calculations for generations 1–9 and Pokémon Champions using `@smogon/calc`’s native Champions mechanics generation (`gen.num === 0`), with official bundled Champions move metadata as a fallback only when a move is missing from the installed calc data. Script-driven effects that require a full battle engine may remain approximate.
- Team builder with Pokémon, moves, abilities, items, EVs/IVs, nature, Tera type, and field controls.
- Showdown paste import/export and browser-local persistence.
- Move coverage and support-category panels, sprites, speed/priority helpers, weather and terrain modifiers, and entry-hazard estimates.
- Live Pokémon Showdown format catalog metadata plus the official TeamValidator running in a browser Web Worker for supported base-generation formats in Gen 1–9. Unsupported mods remain explicitly unverified.
- A separate species-learnset lookup used for move discovery. This data is **not** treated as format legality.


## Live Pokémon Showdown data

Species, moves, learnsets, items, and abilities are loaded directly at runtime from the published Pokémon Showdown data service (`https://play.pokemonshowdown.com/data/`). The 25-nature table is fetched from the official upstream source at `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/natures.ts` and parsed through a small, validated adapter. Requests bypass browser caching on app startup, so changes published upstream are reflected without rebuilding this static site. The runtime lookup layer does not depend on `@pkmn/dex`; the separate official TeamValidator snapshot is described below.

The data adapter is intentionally split into ID/table normalization, resource lookup, learnset inheritance, nature parsing, and remote loading modules under `src/lib/showdown-data/`. Unit tests cover ID normalization, nested source wrappers, alternate-form learnset merging, unknown species, and nature parsing. Runtime data loading requires an internet connection to Pokémon Showdown and GitHub; if either source is unavailable, the app displays a retry state rather than silently switching to stale bundled data. The official legality validator is separate: it uses a reviewed, bundled Pokémon Showdown base-generation source/data snapshot for Gen 1–9 so the rule engine can run locally in a Web Worker without executing remote TypeScript. Its supported-format boundary is documented below.

## Validator update monitoring

The GitHub Actions workflow `.github/workflows/monitor-showdown-validator.yml` checks the official `smogon/pokemon-showdown` repository weekly for changes to validator and legality-data paths. Its first run creates a tracking issue as a baseline; later relevant source changes create an actionable GitHub issue with commit links and a regression-test checklist. It does not automatically transplant upstream code or deploy an untested validator. See [the update-monitoring guide](docs/SHOWDOWN-VALIDATOR-UPDATES.md) for setup and review steps. GitHub Actions must be enabled, and the repository token must be allowed to create issues.

## Development

Requirements: Node.js 20 or later.

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm test
npm run check:move-data
npm run check:field-effects
npm run build
```

Or run the complete release gate:

```bash
npm run check:release
```

The GitHub Actions workflow runs type-checking, automated tests, data/mechanics checks, and a production build before publishing the static `out/` directory to GitHub Pages.

## Format legality behavior

The selected format is resolved to a canonical Pokémon Showdown format ID. The browser Web Worker runs the upstream `TeamValidator` with bundled official base-generation data for Gen 1–9 and executable rule tables. A team can be marked valid only when that validator completes successfully for a supported format. Custom mods and generated-team formats remain **Not fully validated** rather than receiving a guessed legality result.

The format picker fetches current upstream `config/formats.ts` metadata directly in the browser, with a small fallback list when upstream is unavailable. That metadata is not executed or used as a substitute for rule logic; when live ruleset metadata is available, the worker compares it with the bundled format and fails closed if they differ. See [`MILESTONE_4_OFFICIAL_BROWSER_TEAMVALIDATOR.md`](./MILESTONE_4_OFFICIAL_BROWSER_TEAMVALIDATOR.md) for the exact support boundary and test status.

The separate learnset panel is still useful for discovering species moves, but it is not a substitute for the format legality report. Species learnsets are loaded from the live public Pokémon Showdown data file; if the network request fails, the app asks the user to retry instead of falling back to a bundled snapshot.

## Known limitations

- This is a team-planning and damage-estimation tool, not a turn-by-turn battle simulator. It does not fully model switching sequences, recovery loops, or every conditional battle interaction.
- Pokémon Champions uses the native `@smogon/calc` Champions damage formula; the app is not a complete turn-by-turn implementation of every Champions script-driven effect.
- Custom draft rules, custom bans, and National Dex legality require explicitly bundled ruleset/mod data before they can be validated accurately.
- Legality validation is currently limited to user-supplied teams in formats using the bundled base-generation mods for Gen 1–9. The small `Learnset?` marker beside a move is only a species-learnset hint and is not a format legality result.
- Some field effects are modeled as estimates and are documented in the relevant UI notes.
- Multi-hit probability curves use percentages of total HP and exclude critical-hit probability (the Critical toggle shows a distribution conditional on critical damage). Histograms trim approximately 3% cumulative probability from each tail where the discrete distribution permits it; some multi-hit and accuracy interactions remain approximate. Single-hit moves use the same popup layout without the curve. See [the damage distribution and draft matchup design notes](docs/DAMAGE-DISTRIBUTIONS-AND-DRAFT-MATCHUPS.md).
- Draft matchup hover results are potential-moveset estimates: top three eligible moves per type/category, configured EVs/Stat Points, natures and stages, no items or field effects, and no full set/turn-sequence simulation.

## Release checklist

1. Run `npm run check:release` on the target Node version.
2. Run differential tests against the same upstream Pokémon Showdown source revision before deployment; do not enable unsupported mods until their data dependencies are bundled.
3. Smoke-test team import/export, format changes, unsupported custom formats, and mobile layout.
4. Review the GitHub Pages base path and deployment environment before tagging `v2.3.2`.

## Data and licensing

Pokémon names, rules, and legality data in the browser validator are adapted from the MIT-licensed Pokémon Showdown source. Damage calculations use `@smogon/calc`. Consult each upstream project's license and terms when redistributing or deploying this application.

## Browser validator migration

Milestone 4 replaces the earlier diagnostic prototype with the upstream `TeamValidator` adapted for browser execution. See [`MILESTONE_4_OFFICIAL_BROWSER_TEAMVALIDATOR.md`](./MILESTONE_4_OFFICIAL_BROWSER_TEAMVALIDATOR.md) for supported formats, provenance, and verification limits. The complete project release gate still needs to be run in an environment with installed dependencies.

## Pokémon Showdown data source

The app uses a bundled, MIT-licensed snapshot of the official [`smogon/pokemon-showdown`](https://github.com/smogon/pokemon-showdown) repository for species, moves, items, abilities, natures, learnsets, format metadata, and team legality validation. Core battle data is loaded from the bundled snapshot. The format catalog first reads the current `master` branch config from `raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts`, then falls back to bundled format metadata if the request fails. The loading screen indexes bundled tables locally and reports intermediate progress.


## Sprite attribution

Pokémon portrait images are loaded directly from [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab), using each available Pokémon's `portrait/<National-Dex-number>/Normal.png` asset from the moving `master` branch. SpriteCollab requests attribution to contributors and is licensed under CC BY-NC 4.0; this project is non-commercial, and users should consult the repository's portrait credits for contributor-level attribution.


## v2.3.2 Champions and UI fixes

- The user-facing mechanics value `10` now maps to the native `@smogon/calc` Champions generation (`gen.num === 0`), so `calculate(...)` dispatches to `calculateChampions` instead of the Gen 9 mechanics. Official Showdown Champions move metadata is only used as a fallback for moves missing from the installed calc data.
- Draft Hits/Walls/Hit by/Walled by labels now use the Pokémon-name font size without bold styling. The selected ability state is neutral grey rather than green.
- Histogram tail trimming now chooses whole discrete outcomes based on the closest cumulative probability cutoff, avoiding visible sub-3% cumulative tails without discarding a large central probability mass solely to cross the threshold.

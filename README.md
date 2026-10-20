# Pokémon Team Lab — v1.0.0

A browser-based Pokémon team matchup lab built with Next.js, React, TypeScript, `@smogon/calc`, and Pokémon Showdown's data and validation logic from `@pkmn/sim`.

## Features

- 6v6 matchup matrix with damage ranges, estimated KO tiers, type matchups, and move details.
- Generation-aware damage calculations for generations 1–9. Pokémon Champions can be selected for exploration, but the installed damage calculator does **not** provide a dedicated Champions engine; this mode currently falls back to Gen 9 damage mechanics.
- Team builder with Pokémon, moves, abilities, items, EVs/IVs, nature, Tera type, and field controls.
- Showdown paste import/export and browser-local persistence.
- Move coverage and support-category panels, sprites, speed/priority helpers, weather and terrain modifiers, and entry-hazard estimates.
- Format legality report powered by the bundled Pokémon Showdown `TeamValidator` from `@pkmn/sim` for formats explicitly listed in `src/lib/format-validation.ts`.
- A separate species-learnset lookup used for move discovery. This data is **not** treated as format legality.

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

The selected format is resolved to a canonical Pokémon Showdown format ID, and the team's sets are passed to that format's bundled `TeamValidator`. The validator uses the format's rules and rule table, including learnset checks and applicable bans/clauses. An unsupported format is explicitly shown as **Not validated**; the app does not quietly substitute Gen 9 OU or treat the global learnset as a legal-move list.

The built-in list currently covers selected standard OU tiers and popular Gen 9 formats from the installed `@pkmn/sim` package. These bundled rules are not a live connection to the current Pokémon Showdown server, so tiering changes require a dependency update and test run. It is intentionally explicit because format data availability depends on the bundled Pokémon Showdown data. To add another format, add its canonical format ID to `SUPPORTED_FORMATS` and test that the installed `Dex` contains it. National Dex and custom draft formats require their corresponding format/ruleset data. **Champions NatDex Draft is not an official built-in Pokémon Showdown format and is not validated unless its custom rules are implemented.**

The separate learnset panel is still useful for discovering species moves, but it is not a substitute for the format legality report. Species learnsets are loaded from the public Pokémon Showdown data file, with bundled Pokédex data as a fallback if the network request fails.

## Known limitations

- This is a team-planning and damage-estimation tool, not a turn-by-turn battle simulator. It does not fully model switching sequences, recovery loops, or every conditional battle interaction.
- The damage calculator does not yet include a dedicated Pokémon Champions engine.
- Custom draft rules, custom bans, and National Dex legality require explicitly bundled ruleset/mod data before they can be validated accurately.
- The format validator validates the complete team and reports validator messages. The small `Learnset?` marker beside a move is only a species-learnset hint; consult the Format legality report for selected-format legality.
- Some field effects are modeled as estimates and are documented in the relevant UI notes.

## Release checklist

1. Run `npm run check:release` on the target Node version.
2. Confirm the format validation tests against the bundled Pokémon Showdown data.
3. Smoke-test team import/export, format changes, unsupported custom formats, and mobile layout.
4. Review the GitHub Pages base path and deployment environment before tagging `v1.0.0`.

## Data and licensing

Pokémon names and battle data are sourced from Pokémon Showdown / `@pkmn` projects. Damage calculations use `@smogon/calc`. Consult each upstream project's license and terms when redistributing or deploying this application.

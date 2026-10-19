# Pokemon Team Lab

A GitHub-ready Next.js static web app for 6v6 Pokémon matchup analysis using `@smogon/calc`.

## Features in v0.3.0

- Corrected all React client-component directives.
- Narrowed Tera types before passing them to `@smogon/calc`, avoiding GitHub's strict TypeScript error.
- Added type-safe handling around the current calculator API.
- Added a calculation cache so repeated matchup calculations are reused.
- Added deferred rendering for the 36-cell matchup matrix so field controls stay responsive.
- Stealth Rock and Spikes now affect the displayed KO percentage through entry-hazard HP loss.
- Raw move damage percentage is still shown separately.
- Heavy-Duty Boots and Magic Guard prevent the modeled entry-hazard damage.
- Spikes only apply to grounded targets.
- Move Explorer automatically recalculates when its selected move, field, attacker, or defender changes.
- KO tiers use a green-to-red scale, with separate styling for no-damage results.
- The matrix can swap attacking and defending teams.
- Pokémon types and move type/category are displayed; move hover tooltips include power, accuracy, PP, priority, and the bundled description when available.
- Each attacking row has one selected move from that Pokémon’s four imported move slots. Field changes preserve the selected move.
- Attack and Defence stat stages can be set from −6 to +6 and are passed to `@smogon/calc` through its Pokémon `boosts` option. These controls currently represent physical Attack and physical Defence (`atk` and `def`), not Special Attack or Special Defence.
- Imported teams, selected moves, stat stages, and matrix orientation are persisted in browser local storage.
- Multi-hit damage ranges aggregate per-hit damage rolls instead of treating each hit as the full move’s damage.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

For a production/static build:

```bash
npm run build
```

The static output is written to `out/`.

## GitHub Pages

This repository includes:

```text
.github/workflows/deploy.yml
```

Push the repository to GitHub, then in:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

The workflow installs dependencies, builds the static site, and deploys `out/`.

## Important calculator behavior

`@smogon/calc` calculates the damage of a move against the supplied field state. Entry hazards are represented as side state in the calculator, but their switch-in HP loss is not itself returned as the move's `damage` array. This app therefore calculates the Gen 9 singles entry-hazard HP loss separately and uses the remaining HP for its hazard-adjusted KO percentage.

The current model is intentionally a 6v6 singles analysis lab. It does not yet simulate an entire battle turn-by-turn, recovery across turns, or all switching sequences. The KO tiers are damage-range estimates, not a complete battle simulator.


## Version 0.4.1 updates

- Tera controls are restricted to the imported Tera type and None; Pokémon without an imported Tera type cannot change it.
- The matchup matrix uses separate sprite, Pokémon details, and move columns, with compact single-line damage cells.
- Move hover descriptions use a local move-summary catalog alongside the bundled calculator metadata.


## Version 0.4.5 — move descriptions and deployment checks

- Move hover descriptions now prefer the bundled `@pkmn/dex` move data maintained in the [pkmn/ps](https://github.com/pkmn/ps) project, using the canonical `desc` field and `shortDesc` fallback. The data is bundled at build time; the website does not make live requests to GitHub when a move is hovered.
- A compact metadata summary remains as a defensive fallback for moves absent from the bundled data.
- The GitHub Pages workflow now installs dependencies, runs `npm run typecheck`, smoke-tests canonical descriptions for Tackle, Earthquake, Leech Seed, and Salt Cure, and only then runs the static production build. Removed npm caching because this archive does not include a lockfile; this avoids setup-node cache failures caused by a missing lockfile.
- `@pkmn/dex` is pinned to version `0.10.11` for reproducible dependency resolution. Update that version deliberately to consume newer pkmn/ps data, then validate typecheck and production build before deploying.

### Learnset and format legality data

The app loads the live global Pokémon Showdown `learnsets.json` table and caches it per selected format for UI consistency. Pokémon Showdown does not expose a general public REST endpoint that resolves arbitrary custom draft formats (such as Champions NatDex Draft) into a complete, validated per-species move legality table. Until a format-specific validator/ruleset source is configured, move legality therefore means **species learnset membership**, not draft bans or format-specific restrictions. The status indicator intentionally labels this fallback. Changing the selected format selects/creates that format's cache entry; the manual refresh button refreshes the underlying live learnset data.

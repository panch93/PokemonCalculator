# Official Pokémon Showdown validator dependency inventory

## Upstream pin

- Repository: `https://github.com/smogon/pokemon-showdown`
- Source snapshot: `d601443456c795f77c6e4f2b5b459167f2b10a3c` (the supplied upstream archive)
- Primary entry point: `sim/team-validator.ts`
- Upstream license: MIT; preserve attribution and license notices in any port.

The source snapshot must be re-pinned and reviewed before each upstream refresh. Do not consume remote TypeScript source at runtime or evaluate it in the browser.

## Dependency map

| Module | Role in validation | Browser-port assessment |
| --- | --- | --- |
| `sim/team-validator.ts` | Official validation orchestration, rule application, legality checks, learnset/source compatibility | Core logic to adapt; preserve behavior rather than reimplementing a subset |
| `sim/dex.ts` | Format/mod lookup and access to species, move, item, ability and other game data | Not directly browser-safe: imports `fs` and `path`, resolves data directories and loads mod data |
| `sim/dex-formats.ts` | Format inheritance, rule tables, complex bans, numeric/tag rules and format metadata | Important core logic; depends on Dex/data abstractions that need a browser-safe replacement |
| `sim/dex-species.ts` | Species/form data and learnset/source-related species helpers | Contains Node-specific `node:util` import; isolate or replace that use and audit transitive imports |
| `sim/teams.ts` | Team/set normalization and parsing helpers used by validator | Depends on Dex and PRNG; port only required normalization paths with parity tests |
| `sim/prng.ts` | Randomness helpers | Imports `ts-chacha20` and utility helpers; establish whether validator paths actually need runtime PRNG before bundling |
| `sim/dex-data.ts` | Shared data structures and effect helpers | Depends on tags and utility code; likely reusable after transitive audit |
| `sim/dex-conditions.ts` | Conditions and shared effect lookups | Depends on data and move helpers |
| `sim/dex-moves.ts` | Move data and move effect access | Depends on condition/data helpers |
| `sim/dex-items.ts` | Item data and effect access | Depends on condition/data helpers |
| `sim/dex-abilities.ts` | Ability data and effect access | Depends on condition/data helpers |
| `sim/dex-text.ts` | Text/localization helpers | Imports `path` and Dex; avoid loading unless required by validation |
| `lib/utils.ts` | Shared helpers | No direct imports in the inspected file; still audit its globals and runtime assumptions |
| `data/tags.ts` | Tag definitions used by rules and validator | Data module; check transitive imports and include with attribution if bundled |
| `data/mods/**` | Generation-specific species, moves, abilities, learnsets, scripts and rules | Large data surface; do not assume Gen 9 data is sufficient for legacy formats |
| `data/learnsets.ts` and modded learnsets | Learnset/source history used to validate legal move combinations | Critical for legality; static generated assets or a carefully designed browser data loader are required |
| `config/formats.ts` and modded rulesets | Format declarations and rule inheritance | Existing app parser handles catalogue display only; it does not execute rules or validate teams |

## Key findings

1. `TeamValidator` is not an isolated pure function. Its transitive graph reaches the Dex data loader, filesystem/path logic, format rule machinery, team normalization, generation-specific data, and learnset history.
2. Directly importing `sim/team-validator.ts` into a client bundle is not a valid browser port. In particular, `sim/dex.ts` imports `fs` and `path`; `sim/dex-species.ts` imports `node:util`; the Dex implementation resolves local data directories.
3. `config/formats.ts` plus a banlist is not sufficient. Correct results require inherited rules, complex bans, format callbacks, generation-specific data and learnset/source checks.
4. A viable static-hosted implementation can run validation in a Web Worker, but it needs a browser-safe Dex/data adapter. Build-time generation of JSON data assets is a candidate for data modules that cannot be loaded in the browser. Live upstream format metadata must be treated separately from the pinned validator/data revision.
5. Until the port is behaviorally equivalent for a format, that format must return `unverified`/`valid: null`, never a false legal result.

## Next implementation sequence

1. Define a worker request/response contract with request IDs, format IDs, validator/data revision, structured issues, and `valid: true | false | null`.
2. Isolate pure official validator logic from Node-only data loading; record every adaptation and keep upstream source attribution.
3. Add a minimal browser-safe data adapter for a deliberately limited, explicitly supported format set. Do not enable any format until its dependencies are complete.
4. Differential-test valid and invalid teams against the same pinned upstream Showdown revision, covering learnset combinations, inherited rules, complex bans, levels, formes, items, abilities, and generation-specific rules.
5. Only then wire the worker into the UI. Keep the existing UI and damage calculation paths unchanged.

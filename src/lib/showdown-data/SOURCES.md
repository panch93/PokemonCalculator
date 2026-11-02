# Pokémon data sources

The app uses a locally bundled snapshot of the official Pokémon Showdown data from
[smogon/pokemon-showdown](https://github.com/smogon/pokemon-showdown/tree/master/data).
The relevant bundled files live under `src/lib/showdown-official/data/`, including
`pokedex.ts`, `moves.ts`, `learnsets.ts`, and the generation-specific files under
`mods/`. The browser-facing Showdown data directory is also published at
https://play.pokemonshowdown.com/data/.

The app does not fetch these tables from the Showdown website at runtime. This keeps
calculations deterministic and avoids making team editing depend on a remote request.
The bundled snapshot should be refreshed from the upstream repository when updating
the app's Showdown data.

## Learnset resolution

- Current-generation learnsets use Showdown's base (Gen 9) Dex.
- `Everything!` unions the resolved learnsets from the official generation/game mods
  bundled in this repository, plus the Pokémon Champions mod.
- Learnsets are resolved with Showdown's `Dex.species.getFullLearnset`, which follows
  Showdown's own inheritance rules for formes and pre-evolutions. Do not replace this
  with a union of raw species, `baseSpecies`, or `changesFrom` tables; that can leak
  moves across formes or stale snapshots.
- Format legality remains a separate operation from the `Everything!` species-wide
  learnset pool.

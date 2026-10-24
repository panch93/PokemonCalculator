# Everything! historical move pool

Everything! now uses a generated, species-level union of the learnsets shipped by the upstream Pokémon Showdown data repository. The generated table includes every `data/**/learnsets.ts` source available in the source snapshot, including the generation-specific variants (e.g. Gen 3 RS/FRLG, Gen 4 Platinum, Gen 5 BW1, Gen 6 XY, Gen 7 SM, Gen 8 DLC/BDSP/Legends, Gen 9 DLC/pre-DLC/Legends) and the `champions` / `championsregmb` mods.

The union is intentionally used for **move availability in Everything! only**. Other format selectors continue to use the current live species learnset and format validation remains a separate check. This does not make every move legal for every Pokémon: the union is based on upstream species learnset entries, not all moves in the global move dex.

The app's species adapter also adds Showdown's `baseSpecies` and `changesFrom` entries for forms when available. The cross-generation table contains move IDs only, so it is a pool/indicator and is not a full transfer, event, or format legality proof. For full legality, use the selected format validator.

## Regenerate from official Showdown source

With a local checkout of `smogon/pokemon-showdown` and the app's dependencies installed:

```bash
node scripts/build-historical-learnsets.cjs /path/to/pokemon-showdown
```

The script uses the project's TypeScript compiler to read official data object literals without evaluating upstream source code.

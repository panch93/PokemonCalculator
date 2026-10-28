# Damage distributions and draft matchup hover analysis

## Architecture

- `src/lib/damage-distribution.ts` is a pure probability aggregation layer. It consumes the damage rolls exposed by `@smogon/calc`; it does not duplicate the Pokémon damage formula.
- `src/lib/calc.ts` attaches the distribution to `DamageSummary`, uses successful outcomes to derive the displayed minimum/maximum, and avoids the extra critical-hit calculation when callers pass `includeCriticalRange: false`.
- `src/lib/damage-curve.ts` trims cumulative probability tails below 1% at either end and prepares a bounded curve for display. `src/components/DamageHistogramTooltip.tsx` uses the same popup for all matrix cells, drawing a filled probability curve only for multi-hit moves.
- `src/lib/draft-matchup-analysis.ts` lazily analyzes a hovered draft Pokémon against the opposing roster, with `src/lib/draft-matchup-rules.ts` holding independently testable eligibility thresholds.
- `src/components/DraftMatchups.tsx` renders the three hover sections: Pokémon it can threaten, Pokémon that wall/check it, and Pokémon it may wall.

## Probability aggregation

Single-hit damage rolls returned by the calculator are counted with their multiplicity. Equal damage values are merged and assigned their combined probability. Accuracy contributes a zero-damage outcome when a move can miss. Critical hits are not mixed into the histogram probability by default; when the matrix Critical toggle is enabled, the histogram is conditional on critical damage and still does not include the probability of a critical hit.

For multi-hit moves, per-hit damage distributions are combined using dynamic programming/convolution. Cumulative distributions are calculated once per hit count, so the implementation does not enumerate every possible sequence of random rolls. The histogram includes early-stop accuracy outcomes for Triple Axel, Triple Kick, and Population Bomb.

The initial multi-hit profile explicitly covers common fixed-hit moves, common 2–5-hit moves, Skill Link, Loaded Dice, and Water Shuriken's generation-dependent hit count. If the calculator does not expose a separate distribution for every hit, the last available per-hit distribution is reused and the tooltip marks the result approximate. Move-specific edge cases outside these profiles remain approximate and should be expanded with tests when encountered.

Accuracy currently accounts for Wide Lens, Zoom Lens (assuming its condition is met), Compound Eyes, Victory Star, Hustle, No Guard, Blizzard in Snow, and Thunder/Hurricane weather effects. Accuracy/evasion stat stages and critical-hit probability are not yet integrated into the histogram.

## Draft matchup assumptions

- Uses the historical learnset pool, not a selected four-move set.
- Excludes status moves, moves without positive fixed base power, negative-priority moves, and moves with known accuracy below 70%.
- To keep hover latency bounded, considers at most the top three eligible moves per type/category, ranked by base power × accuracy (moves without fixed power use a 60-power heuristic for candidate selection and are calculated under the baseline battle state).
- Computes neutral-nature, no-item, no-field-effect damage with 252 EVs in the relevant attacking stat and 252 HP / 252 relevant defensive stat EVs. The currently selected/default ability and selected Tera type are included.
- Shows the best overall move and best STAB move separately. A target is listed as threatened if an eligible move can reach 70% damage; a potential wall is screened using a 35% maximum-damage threshold.
- The analysis is a potential matchup screen, not a guarantee of a battle result. It does not yet model setup turns, speed-dependent move conditions, switching, recovery cycles, hazards, status plans, or four-move set constraints.

## Tests

- `tests/damage-distribution.test.ts` tests roll multiplicity, probability normalization, multi-hit convolution, per-hit accuracy, accuracy modifiers, hit-count modifiers, and histogram binning.
- `tests/draft-matchup-rules.test.ts` tests the move eligibility filters and starting thresholds.
- `tests/calc.test.ts` includes integration checks that normal moves expose a histogram and Triple Axel includes early-stop hit counts.

## v2.3.0 matrix and draft matchup updates

- Multi-hit matrix labels show the possible successful hit-count range and median count compactly (for example, `1–8 (6) × 23.5–33.5%`). The percentage range is the first hit's damage, not the complete multi-hit move. The bar fill and HKO label continue to use median total damage.
- Single-hit and multi-hit cells use one consistent popup. Single-hit popups show the summary and move/battle details without a chart; multi-hit popups add a filled probability curve.
- The curve's x-axis is defender maximum HP percentage, with intermediate tick labels and a dotted median marker. Cumulative tails below 1% probability are excluded at either end of the plotted range. KO chance and miss/no-damage probability remain explicit.
- Draft matchup hover lists all qualifying threats and walls/checks, annotates each opposing Pokémon as faster/slower/tied using the configured Speed EVs/Stat Points, nature and stage, and uses selected abilities in damage calculations. Species with one ability start with it enabled; every listed ability can be toggled.
- The stat editor can reset the edited stat's EVs/Stat Points, nature and stage. Defensive type matchups include configured immunity/resistance abilities and super-effective damage-reduction abilities.
- Mechanics Gen 10 now uses bundled official Champions move metadata and Champions learnsets through the shared calculator adapter. Champions Stat Points are mapped to the level-50 stat formula in draft analysis. This reuses the official mod data rather than silently treating all moves as standard Gen 9 moves; script-driven effects that cannot be represented by the calculator remain approximate.


## v2.3.1 draft hover and histogram updates

- Draft Matchups precomputes every team member's matchup summary when the roster or relevant settings change. Four independent count hovers—Hits, Walls, Hit by, and Walled by—display the relevant opponent list. Directed best-attack analyses are cached and reused across reverse matchup views.
- Speed labels use green for slower opponents and orange for faster opponents relative to the hovered Pokémon.
- The multi-hit damage popup uses a fine-bin bar histogram (up to 180 bins) rather than a smoothed curve. It trims approximately 3% cumulative probability from each tail when the discrete distribution allows it; damage/HKO cell coloring continues to use the median total damage.
- The Anchor Shot Gen 10 accuracy metadata fallback is explicitly set to 100% when the bundled Champions override omits inherited accuracy.


## v2.3.2 Champions and UI fixes

- The user-facing mechanics value 10 maps to `@smogon/calc`'s native Champions generation object with `num === 0`. The existing `calculate` import dispatches this generation to `calculateChampions` in the upstream calculator. The bundled Pokémon Showdown Champions move data remains a fallback for move entries missing from the calculator's own data, not a substitute for the Champions damage formula.
- Draft matchup count labels use the Pokémon-name font size with normal weight; selected abilities use a neutral grey treatment.
- Histogram trimming removes discrete outcomes from both tails until the cumulative probability is at or near the 3% target. It avoids retaining tiny edge tails when the next outcome is a small increment, and avoids removing a disproportionately large central outcome just to cross the cutoff.

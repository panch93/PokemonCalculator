# Damage distributions and draft matchup hover analysis

## Architecture

- `src/lib/damage-distribution.ts` is a pure probability aggregation layer. It consumes the damage rolls exposed by `@smogon/calc`; it does not duplicate the Pokémon damage formula.
- `src/lib/calc.ts` attaches the distribution to `DamageSummary`, uses successful outcomes to derive the displayed minimum/maximum, and avoids the extra critical-hit calculation when callers pass `includeCriticalRange: false`.
- `src/components/DamageHistogramTooltip.tsx` renders a compact binned histogram when a matrix damage cell is hovered. The underlying distribution remains unbinned for probability and KO calculations.
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

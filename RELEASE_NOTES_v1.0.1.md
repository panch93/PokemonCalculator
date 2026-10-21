# Pokémon Team Lab v1.0.1

- Format selection now discovers available team formats from the bundled Pokémon Showdown format data and adds explicit Gen 9, National Dex Gen 9, and Gen 8 Standard Draft templates.
- Format legality panel is hidden when both teams validate without issues. Unsupported formats remain clearly marked as not validated.
- Species learnset warnings remain available for blatantly incompatible moves; the selected Showdown validator remains authoritative for format-specific legality.
- Added an opt-in Doubles mechanics toggle, compact move-target indicators for ally-affecting and multi-target moves, and a Doubles Support category gated by that toggle.
- Support categories now include category-relevant abilities available to each species, not only the currently selected ability.
- Matrix damage ranges display percentages to one decimal place.

Draft templates use Pokémon Showdown's Standard Draft rules as a baseline. League-specific draft rules and custom bans must be configured explicitly; they cannot be inferred from a league name.

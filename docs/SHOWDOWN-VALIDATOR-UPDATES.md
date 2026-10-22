# Pokémon Showdown validator update monitoring

Pokémon Team Lab is a static Next.js export hosted on GitHub Pages. It must not rely on a running Node.js API server. This workflow therefore monitors upstream source changes and reminds maintainers to review the browser-compatible validator; it does not download and execute arbitrary upstream code in visitors' browsers or auto-deploy a new validator.

## What the workflow does

- Runs every Monday at 09:23 UTC, and can be run manually from **Actions → Monitor Pokémon Showdown validator updates → Run workflow**.
- Checks the latest commit affecting the validator, format/rules, learnset, species, move, ability, item, and mod data paths in `smogon/pokemon-showdown`.
- Creates a persistent `[Upstream watch] Pokémon Showdown validator` issue on its first run to record a baseline.
- On later changes to watched paths, creates a new `[Action required]` issue with links to the changed upstream commits and a test/review checklist. It advances the saved baseline in the tracking issue so the same changes are not reported every week.
- Does not alter application source, install upstream code, or publish a deployment automatically.

The issue notification is delivered through GitHub. Ensure repository issue notifications are enabled for the account that should receive reminders. The workflow needs GitHub Actions enabled and permission to create/update issues; the repository's default `GITHUB_TOKEN` is used, so no personal access token or secret is required.

## What happens after a reminder

1. Inspect the upstream commits listed in the issue.
2. Decide whether they affect the browser adaptation or only unrelated/server-side code.
3. If relevant, update the pinned upstream reference and the browser-compatible implementation in a reviewed branch or pull request.
4. Run `npm run typecheck`, `npm test`, and `npm run build`, plus parity tests against official Showdown for representative legal and illegal teams.
5. Merge only after review; the existing Pages deployment workflow then builds and deploys the static site.

## Scope and limitations

This is a **change detector and reminder**, not an automatic port of the official validator. Upstream commits can change server-only code, so every alert needs triage. The monitor checks the most recent commit per watched path; it is designed to detect that a watched path changed, not to provide a complete changelog of every intermediate commit. Format/rule data loaded by the application at runtime remains separate from the validator code bundled in the deployed site.

# Milestone 2 notes

## Included

- Upgraded `next` from `16.4.0` to `16.4.2` in `package.json` and the lockfile.
- Set `experimental.agentUpgrade` to `"security"` while preserving the existing static export, base path, trailing slash, and asset prefix configuration.
- Added a dependency inventory for the pinned official Pokémon Showdown source, including Node-only modules that prevent direct browser import and the data dependencies required for a faithful validator port.
- Kept team validation fail-closed. The actual browser `TeamValidator` port is not complete in this milestone, so the app must not claim teams are legal.

## Verification status

- Static source/config checks are performed as part of packaging.
- Full install, typecheck, tests, and production build require npm registry access and should be run in the project environment after installing the updated lockfile.

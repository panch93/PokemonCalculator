import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const failures = [];
const obsoleteFiles = [
  'src/lib/format-rule-compatibility.ts',
  'src/lib/pkmn-sim-format-catalog-source.ts',
  'src/lib/pkmn-sim-validation-provider.ts',
];
for (const relative of obsoleteFiles) {
  if (fs.existsSync(path.join(root, relative))) failures.push(`${relative} is obsolete and must be deleted after removing @pkmn/sim`);
}
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  if (pkg[section]?.['@pkmn/sim']) failures.push(`package.json still declares @pkmn/sim in ${section}`);
}
if (lock.packages?.['node_modules/@pkmn/sim']) failures.push('package-lock.json still contains node_modules/@pkmn/sim');
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(?:[cm]?js|jsx|ts|tsx|json)$/.test(entry.name)) { const text = fs.readFileSync(full, 'utf8'); if (/(?:from\s*['"]@pkmn\/sim['"]|import\s*\(['"]@pkmn\/sim['"]\)|require\s*\(['"]@pkmn\/sim['"]\))/.test(text)) failures.push(`${path.relative(root, full)} still imports @pkmn/sim`); } } }
for (const dir of ['src', 'scripts', 'tests']) if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; } else console.log('@pkmn/sim removal check passed.');

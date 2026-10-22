import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const failures = [];

for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  if (packageJson[section]?.['@pkmn/dex']) failures.push(`package.json still declares @pkmn/dex in ${section}`);
}
if (lock.packages?.['node_modules/@pkmn/dex']) failures.push('package-lock.json still contains node_modules/@pkmn/dex');

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/\.(?:[cm]?js|jsx|ts|tsx|json)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/(?:from\s*['"]@pkmn\/dex['"]|import\s*\(['"]@pkmn\/dex['"]\)|require\s*\(['"]@pkmn\/dex['"]\))/.test(content)) {
        failures.push(`${path.relative(root, fullPath)} still imports @pkmn/dex`);
      }
    }
  }
}
for (const directory of ['src', 'scripts', 'tests']) walk(path.join(root, directory));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('@pkmn/dex removal check passed: no dependency, lockfile package, or code imports remain.');
}

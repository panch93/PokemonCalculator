#!/usr/bin/env node
/*
 * Build the Everything! historical learnset union from a Pokémon Showdown checkout.
 * Usage: node scripts/build-historical-learnsets.cjs /path/to/pokemon-showdown
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const showdownRoot = process.argv[2];
if (!showdownRoot) {
  console.error('Usage: node scripts/build-historical-learnsets.cjs /path/to/pokemon-showdown');
  process.exit(1);
}
const dataRoot = path.join(showdownRoot, 'data');
if (!fs.existsSync(dataRoot)) throw new Error(`Showdown data directory not found: ${dataRoot}`);
const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name === 'learnsets.ts') sourceFiles.push(fullPath);
  }
}
walk(dataRoot);

function extractLearnsets(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === 'Learnsets') initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!initializer) return {};

  function convert(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const object = {};
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = property.name;
          const key = ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
            ? name.text : name.getText(sourceFile);
          object[key] = convert(property.initializer);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          object[property.name.text] = null;
        }
      }
      return object;
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(convert);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    return undefined;
  }
  return convert(initializer) || {};
}

const union = {};
for (const file of sourceFiles) {
  const table = extractLearnsets(file);
  for (const [species, entry] of Object.entries(table)) {
    const speciesId = species.toLowerCase().replace(/[^a-z0-9]/g, '');
    const moveIds = union[speciesId] || (union[speciesId] = new Set());
    for (const move of Object.keys(entry?.learnset || {})) {
      const moveId = move.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (moveId) moveIds.add(moveId);
    }
  }
}
const result = Object.fromEntries(Object.entries(union).map(([species, moves]) => [species, [...moves].sort()]));
const output = path.join(__dirname, '../src/lib/showdown-data/historical-learnsets.json');
fs.writeFileSync(output, `${JSON.stringify(result)}\n`);
console.log(`Wrote ${Object.keys(result).length} species from ${sourceFiles.length} official learnset tables to ${output}`);

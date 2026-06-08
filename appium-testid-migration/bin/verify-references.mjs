#!/usr/bin/env node
// Static verification: every testID the migration pointed Appium at must exist in source.
// Manifest-based (avoids DRIFT noise) and presence-checked (covers route-name + mapper-assigned ids).
// Single-pass: walks each source tree once, checking all still-missing ids per file.
import { readFileSync } from 'node:fs';
import { walk } from '../lib/testid-index.mjs';

const [, , manifestPath, ...srcRoots] = process.argv;
if (!manifestPath || srcRoots.length === 0) {
  console.error('usage: verify-references.mjs <master-manifest.json> <srcRoot...>');
  process.exit(2);
}

const master = JSON.parse(readFileSync(manifestPath, 'utf8'));
const missing = new Set();
for (const r of master.records) {
  if (r.verdict === 'MATCHED_EXISTING' || r.verdict === 'NEEDS_TESTID') {
    const id = r.testId || r.proposedName;
    if (id) missing.add(id);
  }
}
const total = missing.size;
const present = (text, id) => text.includes(`'${id}'`) || text.includes(`"${id}"`) || text.includes(`\`${id}\``);

outer: for (const root of srcRoots) {
  for (const file of walk(root)) {
    if (missing.size === 0) break outer;
    const text = readFileSync(file, 'utf8');
    for (const id of missing) if (present(text, id)) missing.delete(id);
  }
}

console.log(`actionable testIDs: ${total}; present-in-source: ${total - missing.size}; missing: ${missing.size}`);
[...missing].slice(0, 80).forEach((id) => console.log('MISSING', id));
process.exit(missing.size ? 1 : 0);

#!/usr/bin/env node
import { findDuplicateTestIds } from '../lib/scan-jsx.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node bin/check-duplicates.mjs <moduleDir>');
  process.exit(1);
}

const duplicates = findDuplicateTestIds(dir);
const staticDups = duplicates.filter(d => d.kind === 'static');
const templateDups = duplicates.filter(d => d.kind === 'template');
const sameFile = duplicates.filter(d => d.sameFile);

// Human-readable on stderr.
console.error(`Module: ${dir}`);
console.error(
  `Duplicate testID values: ${duplicates.length} ` +
  `(static ${staticDups.length}, template ${templateDups.length}, same-file ${sameFile.length})`,
);
for (const d of duplicates) {
  const flag = d.sameFile ? ' [SAME FILE]' : '';
  console.error(`\n[${d.count}x ${d.kind}]${flag} ${d.value}`);
  for (const l of d.locations) console.error(`    ${l.file}:${l.line}`);
}
if (duplicates.length === 0) console.error('\nNo duplicate testID values.');

// Machine-readable on stdout.
console.log(JSON.stringify({ module: dir, duplicates }, null, 2));

// Non-zero exit when there is a same-file collision (highest-risk: two nodes
// with the same testID guaranteed to render together).
process.exit(sameFile.length > 0 ? 2 : 0);

#!/usr/bin/env node
import { scanModule } from '../lib/scan-jsx.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node bin/scan-module.mjs <moduleDir>');
  process.exit(1);
}

const result = scanModule(dir);

// Human-readable summary on stderr.
console.error(`Module: ${result.module}`);
console.error(`Repo:   ${result.repo} (rule: ${result.rule})`);
console.error(
  `Files with candidates: ${result.totals.filesWithCandidates} | ` +
  `untagged target nodes: ${result.totals.candidates} | ` +
  `already tagged: ${result.totals.tagged}`,
);
for (const f of result.files) {
  console.error(`\n${f.file}`);
  for (const c of f.candidates) {
    console.error(`  L${c.line}  <${c.tag}>  -> ${c.elementType}`);
  }
}

// Machine-readable JSON on stdout.
console.log(JSON.stringify(result, null, 2));

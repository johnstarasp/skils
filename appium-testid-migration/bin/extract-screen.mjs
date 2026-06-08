#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { parseLocators } from '../lib/parse-locators.mjs';

const [, , javaPath, outDir = 'docs/superpowers/migration/manifests'] = process.argv;
if (!javaPath) { console.error('usage: extract-screen.mjs <java> [outDir]'); process.exit(2); }

const records = parseLocators(readFileSync(javaPath, 'utf8')).map((r) => ({
  ...r, verdict: 'PENDING', testId: null, placement: null,
  targetNode: null, bmbProof: null, proposedName: null, reason: null,
}));
mkdirSync(outDir, { recursive: true });
// Unique slug from the path under .../appium/ so corporatemb vs retaimb screens with the
// same basename (e.g. Login.java, Home.java) don't overwrite each other.
const norm = javaPath.replace(/\\/g, '/');
const after = norm.split('/automation/appium/')[1] || basename(norm);
const slug = after.replace(/\.java$/, '').replace(/\//g, '-');
const out = `${outDir}/${slug}.json`;
writeFileSync(out, JSON.stringify({ screenFile: javaPath, records }, null, 2));
console.log(`${out}: ${records.length} locators`);

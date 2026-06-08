#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { rewriteJava, actionableRecords } from '../lib/rewrite-locators.mjs';

const [, , fragmentPath] = process.argv;
if (!fragmentPath) { console.error('usage: rewrite-screen.mjs <fragment.json>'); process.exit(2); }

const fragment = JSON.parse(readFileSync(fragmentPath, 'utf8'));
const recs = actionableRecords(fragment);
if (recs.size === 0) { console.log(`${fragmentPath}: 0 actionable, skipped`); process.exit(0); }

const java = readFileSync(fragment.screenFile, 'utf8');
const out = rewriteJava(java, recs);
writeFileSync(fragment.screenFile, out);
console.log(`${fragment.screenFile.replace(/^.*appium./, '')}: rewrote ${recs.size} fields`);

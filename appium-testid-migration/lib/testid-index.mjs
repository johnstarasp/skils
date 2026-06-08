import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const DEFAULT_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'lib', 'ios', 'android', '__tests__', 'dist', 'build']);

export function* walk(dir, exts = DEFAULT_EXTS) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p, exts);
    else if (exts.has(extname(p))) yield p;
  }
}

// Regex matching a concrete testID literal carried by ANY testID-style prop:
//   testID="id" | testID={'id'} | testID={`id`}
//   and forwarded variants like inputTestID={'id'}, iconTestID="id", buttonFooterTestID={`id`}.
// The prop name is any (optional) prefix followed by test/Test + Id/ID.
export function literalRegex(id) {
  const e = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`[A-Za-z]*[Tt]est[Ii][Dd]\\s*=\\s*(?:["']${e}["']|\\{\\s*["'\\\`]${e}["'\\\`]\\s*\\})`);
}

export function findTestIdLiteral(id, roots) {
  const re = literalRegex(id);
  const hits = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      for (let n = 0; n < lines.length; n++) {
        if (re.test(lines[n])) hits.push(`${file}:${n + 1}`);
      }
    }
  }
  return hits;
}

// Presence check: the id appears as a quoted string token anywhere in source.
// Looser than findTestIdLiteral — also confirms route-name constants and mapper/data assignments
// (e.g. `testID: 'id'`, `route name 'id'`) that don't use a `testID=` prop. Used for verification.
export function quotedRegex(id) {
  const e = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`["'\\\`]${e}["'\\\`]`);
}

export function findQuotedLiteral(id, roots) {
  const re = quotedRegex(id);
  for (const root of roots) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      for (let n = 0; n < lines.length; n++) {
        if (re.test(lines[n])) return `${file}:${n + 1}`;
      }
    }
  }
  return null;
}

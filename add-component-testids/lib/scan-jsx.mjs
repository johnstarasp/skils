import { ELEMENT_TYPES, elementTypeFor } from '../../appium-testid-migration/lib/bem.mjs';
import { walk } from '../../appium-testid-migration/lib/testid-index.mjs';
import { readFileSync } from 'node:fs';

// Targetable element types per the spec: interactive + scrollable + text labels.
// Derived from the shared ELEMENT_TYPES map; excludes 'view' and 'image'.
const TARGETABLE_TYPES = new Set([
  'button', 'touchable', 'scrollView', 'flatList', 'textInput', 'text', 'switch',
]);

export const TARGET_NODES = new Set(
  Object.keys(ELEMENT_TYPES).filter(tag => TARGETABLE_TYPES.has(ELEMENT_TYPES[tag])),
);

// True if an opening tag's attribute text contains a testID / *TestID attribute.
// Matches plain `testID=` and forwarded variants (`labelTestID=`, `buttonTextTestID=`).
export function hasTestIdAttr(attrText) {
  return /[A-Za-z]*[Tt]est[Ii][Dd]\s*=/.test(attrText);
}

export function detectRepo(p) {
  const norm = String(p).replace(/\\/g, '/');
  if (norm.includes('nbg-ui-library')) return { repo: 'nbg-ui-library', rule: 'props' };
  if (norm.includes('bmb.core')) return { repo: 'bmb.core', rule: 'literal' };
  return { repo: 'unknown', rule: 'unknown' };
}

// Capture an opening tag's attribute text starting at index `start` (just after the
// tag name), stopping at the first top-level `>` that is not inside a string or `{}`.
function captureAttrs(source, start) {
  let i = start;
  let depth = 0;
  let str = null;
  while (i < source.length) {
    const c = source[i];
    if (str) {
      if (c === str) str = null;
    } else if (c === '"' || c === "'" || c === '`') {
      str = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
    } else if (c === '>' && depth === 0) {
      break;
    }
    i++;
  }
  return source.slice(start, i);
}

// Walk a module directory's .tsx files and collect untagged target nodes.
export function scanModule(moduleDir) {
  const { repo, rule } = detectRepo(moduleDir);
  const files = [];
  let totalCandidates = 0;
  let totalTagged = 0;
  for (const file of walk(moduleDir, new Set(['.tsx']))) {
    const src = readFileSync(file, 'utf8');
    const nodes = scanSource(src);
    const candidates = nodes.filter(n => !n.hasTestId);
    const tagged = nodes.length - candidates.length;
    totalCandidates += candidates.length;
    totalTagged += tagged;
    if (candidates.length) files.push({ file, candidates, taggedCount: tagged });
  }
  return {
    module: moduleDir,
    repo,
    rule,
    files,
    totals: {
      candidates: totalCandidates,
      tagged: totalTagged,
      filesWithCandidates: files.length,
    },
  };
}

// Capture a balanced `{...}` expression starting at `start` (the `{`).
// Returns the inner text (without the outer braces), respecting nested
// braces and string/template literals.
function readBraced(source, start) {
  let i = start + 1;
  let depth = 1;
  let str = null;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (str) {
      if (c === '\\') { i += 2; continue; }
      if (c === str) str = null;
    } else if (c === '"' || c === "'" || c === '`') {
      str = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  return source.slice(start + 1, i);
}

// Collect every testID / *TestID attribute value in a source file.
// Returns [{ line, name, value, kind }] where kind is:
//   'static'   — a fixed string literal ("x", 'x', or `x` with no interpolation)
//   'template' — a template literal containing `${...}` (resolves uniquely at runtime)
//   'dynamic'  — a bare expression we can't evaluate (e.g. {props.testID}, {item.testID})
export function collectTestIds(source) {
  const results = [];
  const re = /([A-Za-z]*[Tt]est[Ii][Dd])\s*=\s*/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const line = source.slice(0, m.index).split('\n').length;
    let i = re.lastIndex;
    const ch = source[i];
    let value = null;
    let kind = null;
    if (ch === '"' || ch === "'") {
      const end = source.indexOf(ch, i + 1);
      if (end === -1) continue;
      value = source.slice(i + 1, end);
      kind = 'static';
    } else if (ch === '{') {
      const inner = readBraced(source, i).trim();
      if (/^`[\s\S]*`$/.test(inner)) {
        value = inner.slice(1, -1);
        kind = inner.includes('${') ? 'template' : 'static';
      } else if (/^['"][\s\S]*['"]$/.test(inner)) {
        value = inner.slice(1, -1);
        kind = 'static';
      } else {
        value = inner;
        kind = 'dynamic';
      }
    }
    if (value !== null) results.push({ line, name, value, kind });
  }
  return results;
}

// Walk a module directory and find testID values that appear on more than one
// node. 'dynamic' values are ignored (can't be compared). Static literals are
// hard collisions; identical template sources are flagged too (they collide for
// any shared interpolation key). `sameFile` marks the highest-risk case.
export function findDuplicateTestIds(moduleDir) {
  const byValue = new Map();
  for (const file of walk(moduleDir, new Set(['.tsx']))) {
    const src = readFileSync(file, 'utf8');
    for (const t of collectTestIds(src)) {
      if (t.kind === 'dynamic') continue;
      if (!byValue.has(t.value)) byValue.set(t.value, []);
      byValue.get(t.value).push({ file, line: t.line, kind: t.kind });
    }
  }
  const duplicates = [];
  for (const [value, locations] of byValue) {
    if (locations.length < 2) continue;
    const files = new Set(locations.map(l => l.file));
    duplicates.push({
      value,
      kind: locations[0].kind,
      count: locations.length,
      sameFile: files.size < locations.length,
      locations,
    });
  }
  duplicates.sort(
    (a, b) =>
      Number(b.sameFile) - Number(a.sameFile) ||
      b.count - a.count ||
      a.value.localeCompare(b.value),
  );
  return duplicates;
}

// Parse JSX source; return one record per targetable opening tag found.
// { line, tag, elementType, hasTestId }
export function scanSource(source) {
  const results = [];
  let line = 1;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\n') { line++; continue; }
    if (ch === '<' && /[A-Z]/.test(source[i + 1] || '')) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9]/.test(source[j])) j++;
      const tag = source.slice(i + 1, j);
      if (TARGET_NODES.has(tag)) {
        const attrText = captureAttrs(source, j);
        results.push({
          line,
          tag,
          elementType: elementTypeFor(tag),
          hasTestId: hasTestIdAttr(attrText),
        });
      }
      i = j - 1; // resume after the tag name; main loop keeps counting newlines in attrs
    }
  }
  return results;
}

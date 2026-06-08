// Deterministically rewrites @AndroidFindBy/@iOSXCUITFindBy annotations for actionable records
// (MATCHED_EXISTING / NEEDS_TESTID) so both platforms point at the resolved testID.
// Non-actionable fields (UNRESOLVED / NO_COMPONENT / DRIFT) are left byte-for-byte unchanged.

const FIELD_RE = /^\s*private\s+(?:List<WebElement>|WebElement)\s+(\w+)\s*;/;
const isAnn = (t) => /^@(AndroidFindBy|iOSXCUITFindBy|iOSFindBy)\b/.test(t);

// A record needs contains() matching when the original locator used a prefix match,
// or when explicitly flagged (e.g. a parameterized testID reduced to its stable prefix).
export function usesContains(rec) {
  if (rec._forceContains) return true;
  const raw = `${rec.android ? rec.android.raw : ''} ${rec.ios ? rec.ios.raw : ''}`;
  return /contains\(@(?:resource-id|name)/.test(raw);
}

function rewriteAnnLine(line, id, contains) {
  const m = line.match(/^(\s*)@(AndroidFindBy|iOSXCUITFindBy)\b/);
  if (!m) return line; // @iOSFindBy or anything else: leave as-is
  const [indent, kind] = [m[1], m[2]];
  if (kind === 'AndroidFindBy') {
    const xp = contains ? `//*[contains(@resource-id,'${id}')]` : `//*[@resource-id='${id}']`;
    return `${indent}@AndroidFindBy(xpath = "${xp}")`;
  }
  const xp = contains ? `//*[contains(@name,'${id}')]` : `//*[@name='${id}']`;
  return `${indent}@iOSXCUITFindBy(xpath = "${xp}")`;
}

// recordsByField: Map<fieldName, record>. Only actionable records should be included.
export function rewriteJava(javaText, recordsByField) {
  const eol = javaText.includes('\r\n') ? '\r\n' : '\n';
  const lines = javaText.split(/\r?\n/);
  const out = [];
  let buf = [];
  const flush = () => { for (const b of buf) out.push(b); buf = []; };

  for (const line of lines) {
    const t = line.trim();
    if (isAnn(t)) { buf.push(line); continue; }
    const fm = line.match(FIELD_RE);
    if (fm) {
      const rec = recordsByField.get(fm[1]);
      if (rec) {
        const id = rec.testId || rec.proposedName;
        const contains = usesContains(rec);
        for (const b of buf) out.push(rewriteAnnLine(b, id, contains));
        buf = [];
      } else {
        flush();
      }
      out.push(line);
      continue;
    }
    if (t === '' || t.startsWith('//')) { buf.push(line); continue; } // keep attached to next field
    flush();
    out.push(line);
  }
  flush();
  return out.join(eol);
}

export function actionableRecords(fragment) {
  const map = new Map();
  for (const r of fragment.records || []) {
    if ((r.verdict === 'MATCHED_EXISTING' || r.verdict === 'NEEDS_TESTID') && (r.testId || r.proposedName)) {
      map.set(r.fieldName, r);
    }
  }
  return map;
}

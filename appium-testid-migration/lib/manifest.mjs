export function mergeFragments(fragments) {
  const records = [];
  for (const f of fragments) {
    for (const r of f.records || []) records.push({ screenFile: f.screenFile, ...r });
  }
  return { generatedAt: new Date().toISOString(), records };
}

// Normalizes a bmbProof/target so cosmetic path-spelling differences for the SAME source
// location collapse together (a shared component referenced by many screens is NOT a collision).
export function normalizeTarget(s) {
  let t = String(s).trim().toLowerCase().replace(/\\/g, '/');
  t = t.split(/\s/)[0]; // drop any prose suffix after the path:line
  const idx = t.indexOf('nbg-ui-library/');
  if (idx >= 0) t = t.slice(idx); // collapse all spellings of the shared library path
  t = t.replace(/^packages\//, '');
  return t;
}

// A real collision = the same testId/proposedName mapped to more than one DISTINCT source target.
export function collisionCheck(master) {
  const byId = new Map();
  for (const r of master.records) {
    const id = r.testId || r.proposedName;
    if (!id) continue;
    const target = normalizeTarget(r.bmbProof || `${r.screenFile}#${r.fieldName}`);
    if (!byId.has(id)) byId.set(id, new Set());
    byId.get(id).add(target);
  }
  const conflicts = [];
  for (const [testId, targets] of byId) {
    if (targets.size > 1) conflicts.push({ testId, targets: [...targets] });
  }
  return conflicts;
}

export function summarize(master) {
  const counts = {};
  for (const r of master.records) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  return counts;
}

export function toReviewMarkdown(master) {
  const counts = summarize(master);
  const lines = ['# testID Migration — Mapping Review', '',
    `Total locators: ${master.records.length}`, '', '## Verdict counts', ''];
  for (const [k, v] of Object.entries(counts)) lines.push(`- ${k}: ${v}`);

  lines.push('', '## NEEDS_TESTID (new testIDs to add)', '');
  for (const r of master.records.filter((x) => x.verdict === 'NEEDS_TESTID')) {
    lines.push(`- \`${r.proposedName}\` — ${r.placement} — ${r.screenFile}#${r.fieldName} → ${r.bmbProof || '?'}`);
  }
  lines.push('', '## UNRESOLVED (skipped — need human)', '');
  for (const r of master.records.filter((x) => x.verdict === 'UNRESOLVED')) {
    lines.push(`- ${r.screenFile}#${r.fieldName} — ${r.reason || ''}`);
  }
  return lines.join('\n');
}

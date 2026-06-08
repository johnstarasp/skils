import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFragments, collisionCheck, summarize, toReviewMarkdown, normalizeTarget } from './manifest.mjs';

test('normalizeTarget collapses path-spelling variants of the same shared component', () => {
  const a = normalizeTarget('packages/nbg-ui-library/src/features/dynamicTabBar/DynamicTabBar.tsx:245');
  const b = normalizeTarget('nbg-ui-library/src/features/dynamicTabBar/DynamicTabBar.tsx:245');
  const c = normalizeTarget('src/features/dynamicTabBar/DynamicTabBar.tsx:245 (nbg-ui-library)');
  assert.equal(a, b);
  // shared component referenced by many screens must NOT be flagged as a collision
  const master = mergeFragments([
    { screenFile: 'X.java', records: [{ fieldName: 'x', verdict: 'MATCHED_EXISTING', testId: 'investmentsTitle', bmbProof: 'packages/nbg-ui-library/src/features/dynamicTabBar/DynamicTabBar.tsx:245' }] },
    { screenFile: 'Y.java', records: [{ fieldName: 'y', verdict: 'MATCHED_EXISTING', testId: 'investmentsTitle', bmbProof: 'nbg-ui-library/src/features/dynamicTabBar/DynamicTabBar.tsx:245' }] },
  ]);
  assert.equal(collisionCheck(master).length, 0);
});

const fragA = {
  screenFile: 'appium/retaimb/screens/Login/Login.java',
  records: [
    { fieldName: 'usernameInputFill', verdict: 'MATCHED_EXISTING', testId: 'login__textInput--username' },
    { fieldName: 'loginBtn', verdict: 'NEEDS_TESTID', placement: 'LIBRARY',
      proposedName: 'login__button--submit', bmbProof: 'packages/login/LoginForm.tsx:42' },
  ],
};
const fragB = {
  screenFile: 'appium/retaimb/screens/Home.java',
  records: [
    { fieldName: 'okBtn', verdict: 'UNRESOLVED', reason: '"OK" maps to 3 packages' },
    // collision: same proposed id, different component than login__button--submit above
    { fieldName: 'dupBtn', verdict: 'NEEDS_TESTID', placement: 'CALLSITE',
      proposedName: 'login__button--submit', bmbProof: 'packages/home/Other.tsx:9' },
  ],
};

test('mergeFragments flattens records and stamps screenFile', () => {
  const m = mergeFragments([fragA, fragB]);
  assert.equal(m.records.length, 4);
  assert.equal(m.records[0].screenFile, 'appium/retaimb/screens/Login/Login.java');
});

test('collisionCheck flags one id mapped to two different components', () => {
  const conflicts = collisionCheck(mergeFragments([fragA, fragB]));
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].testId, 'login__button--submit');
  assert.equal(conflicts[0].targets.length, 2);
});

test('summarize counts verdicts', () => {
  const counts = summarize(mergeFragments([fragA, fragB]));
  assert.deepEqual(counts,
    { MATCHED_EXISTING: 1, NEEDS_TESTID: 2, UNRESOLVED: 1 });
});

test('review markdown lists NEEDS_TESTID and UNRESOLVED', () => {
  const md = toReviewMarkdown(mergeFragments([fragA, fragB]));
  assert.match(md, /login__button--submit/);
  assert.match(md, /maps to 3 packages/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findTestIdLiteral, findQuotedLiteral, walk } from './testid-index.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'tid-'));
  mkdirSync(join(root, 'node_modules')); // must be skipped
  writeFileSync(join(root, 'node_modules', 'junk.tsx'), `testID="login__button--next"`);
  writeFileSync(join(root, 'A.tsx'), `<Button testID="login__button--next" />`);
  writeFileSync(join(root, 'B.tsx'), "<View testID={'home__scrollView--main'} />");
  writeFileSync(join(root, 'C.tsx'), "<TextInput inputTestID={'login__textInput--username'} />");
  return root;
}

test('finds a testID literal and reports file:line', () => {
  const root = fixture();
  const hits = findTestIdLiteral('login__button--next', [root]);
  assert.equal(hits.length, 1); // node_modules excluded
  assert.match(hits[0], /A\.tsx:1$/);
});

test('matches brace-and-quote form', () => {
  const root = fixture();
  assert.equal(findTestIdLiteral('home__scrollView--main', [root]).length, 1);
});

test('matches forwarded testID props (inputTestID, iconTestID, ...)', () => {
  const root = fixture();
  const hits = findTestIdLiteral('login__textInput--username', [root]);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /C\.tsx:1$/);
});

test('returns empty for missing id', () => {
  const root = fixture();
  assert.deepEqual(findTestIdLiteral('does__not--exist', [root]), []);
});

test('findQuotedLiteral finds an id present only as a route-name/mapper string', () => {
  const root = mkdtempSync(join(tmpdir(), 'tidq-'));
  writeFileSync(join(root, 'routes.ts'), "export const R = { TAB: 'loansTitle' };");
  writeFileSync(join(root, 'map.ts'), "export const m = { testID: 'insuranceDetails__view--amount' };");
  assert.ok(findQuotedLiteral('loansTitle', [root]));
  assert.ok(findQuotedLiteral('insuranceDetails__view--amount', [root]));
  assert.equal(findQuotedLiteral('not__present--anywhere', [root]), null);
});

test('walk honors a custom extension set', () => {
  const root = fixture();
  const files = [...walk(root, new Set(['.tsx']))];
  assert.equal(files.length, 3); // A.tsx, B.tsx, C.tsx (node_modules skipped)
});

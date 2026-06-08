import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRepo } from './scan-jsx.mjs';

test('detectRepo: nbg-ui-library path → props rule', () => {
  const r = detectRepo('C:\\Users\\E84801\\Projects\\nbg-ui-library\\src\\features\\dropdown');
  assert.deepEqual(r, { repo: 'nbg-ui-library', rule: 'props' });
});

test('detectRepo: bmb.core path → literal rule', () => {
  const r = detectRepo('C:/Users/E84801/Projects/bmb.core/packages/moneybox');
  assert.deepEqual(r, { repo: 'bmb.core', rule: 'literal' });
});

test('detectRepo: unknown path', () => {
  const r = detectRepo('/tmp/some/other/repo');
  assert.deepEqual(r, { repo: 'unknown', rule: 'unknown' });
});

import { TARGET_NODES, hasTestIdAttr } from './scan-jsx.mjs';

test('TARGET_NODES includes interactive/scroll/text, excludes View/Image', () => {
  for (const t of ['Pressable', 'TouchableOpacity', 'Button', 'Switch', 'ScrollView', 'FlatList', 'TextInput', 'Text', 'CustomText']) {
    assert.ok(TARGET_NODES.has(t), `${t} should be targetable`);
  }
  assert.ok(!TARGET_NODES.has('View'), 'View not targetable');
  assert.ok(!TARGET_NODES.has('Image'), 'Image not targetable');
});

test('hasTestIdAttr: plain and granular props', () => {
  assert.equal(hasTestIdAttr(' testID={x} onPress={y}'), true);
  assert.equal(hasTestIdAttr(' buttonTextTestID={y}'), true);
  assert.equal(hasTestIdAttr(' labelTestID="a"'), true);
});

test('hasTestIdAttr: absent', () => {
  assert.equal(hasTestIdAttr(' style={s} onPress={p}'), false);
  assert.equal(hasTestIdAttr(''), false);
});

import { scanSource } from './scan-jsx.mjs';

const SAMPLE = `import {View, Pressable} from 'react-native';
export const C = () => (
  <View style={{flex: 1}}>
    <Pressable testID={id} onPress={p}>
      <CustomText
        numberOfLines={1}
        style={[a, b]}>
        {label}
      </CustomText>
    </Pressable>
  </View>
);`;

test('scanSource: finds targets, flags missing testID, ignores View', () => {
  const nodes = scanSource(SAMPLE);
  const tags = nodes.map(n => n.tag);
  assert.ok(!tags.includes('View'), 'View ignored');
  const pressable = nodes.find(n => n.tag === 'Pressable');
  const text = nodes.find(n => n.tag === 'CustomText');
  assert.equal(pressable.hasTestId, true);
  assert.equal(pressable.elementType, 'button');
  assert.equal(text.hasTestId, false);
  assert.equal(text.elementType, 'text');
});

test('scanSource: reports 1-based line numbers', () => {
  const nodes = scanSource(SAMPLE);
  assert.equal(nodes.find(n => n.tag === 'Pressable').line, 4);
  assert.equal(nodes.find(n => n.tag === 'CustomText').line, 5);
});

test('scanSource: brace/string nesting does not end tag early', () => {
  const src = `<Pressable style={{a: '>', b: [1]}} onPress={f}>x</Pressable>`;
  const nodes = scanSource(src);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].hasTestId, false);
});

import { scanModule } from './scan-jsx.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('scanModule: collects untagged candidates per file', () => {
  const root = mkdtempSync(join(tmpdir(), 'nbg-ui-library-'));
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, 'A.tsx'),
    `<Pressable testID={x}><CustomText style={s}>{t}</CustomText></Pressable>`);
  writeFileSync(join(root, 'sub', 'B.tsx'),
    `<View><Switch onValueChange={f} /></View>`);

  const res = scanModule(root);
  assert.equal(res.repo, 'nbg-ui-library');
  assert.equal(res.rule, 'props');
  assert.equal(res.totals.candidates, 2); // CustomText in A, Switch in B
  assert.equal(res.totals.tagged, 1);     // Pressable in A
  assert.equal(res.totals.filesWithCandidates, 2);
});

import { collectTestIds, findDuplicateTestIds } from './scan-jsx.mjs';

test('collectTestIds: classifies static / template / dynamic', () => {
  const src = [
    `<Pressable testID={'accounts__button--a'} />`,
    `<CustomText testID="accounts__text--b" />`,
    "<CustomText testID={`accounts__text--c-${id}`} />",
    `<CustomText testID={props.testID} />`,
    `<Button labelTestID={'accounts__label--d'} />`,
  ].join('\n');
  const got = collectTestIds(src);
  const byVal = Object.fromEntries(got.map(t => [t.value, t.kind]));
  assert.equal(byVal['accounts__button--a'], 'static');
  assert.equal(byVal['accounts__text--b'], 'static');
  assert.equal(byVal['accounts__text--c-${id}'], 'template');
  assert.equal(byVal['props.testID'], 'dynamic');
  assert.equal(byVal['accounts__label--d'], 'static');
});

test('collectTestIds: does not end value early on nested braces', () => {
  const src = "<X testID={cond ? `a-${x}` : `b-${y}`} />";
  const got = collectTestIds(src);
  assert.equal(got.length, 1);
  assert.equal(got[0].kind, 'dynamic'); // ternary, not a bare literal
});

test('findDuplicateTestIds: flags static and same-file collisions, ignores dynamic and unique templates', () => {
  const root = mkdtempSync(join(tmpdir(), 'bmb.core-'));
  writeFileSync(join(root, 'A.tsx'),
    `<Pressable testID={'app__button--dup'} /><CustomText testID={'app__text--uniqueA'} />`);
  writeFileSync(join(root, 'B.tsx'),
    `<Pressable testID={'app__button--dup'} />` +              // cross-file static dup
    "<CustomText testID={`app__text--row-${i}`} />" +
    `<CustomText testID={'app__text--same'} /><CustomText testID={'app__text--same'} />` + // same-file dup
    `<View testID={props.testID} />`);                          // dynamic, ignored

  const dups = findDuplicateTestIds(root);
  const byVal = Object.fromEntries(dups.map(d => [d.value, d]));

  assert.ok(byVal['app__button--dup'], 'cross-file static dup reported');
  assert.equal(byVal['app__button--dup'].count, 2);
  assert.equal(byVal['app__button--dup'].sameFile, false);

  assert.ok(byVal['app__text--same'], 'same-file dup reported');
  assert.equal(byVal['app__text--same'].sameFile, true);

  assert.ok(!byVal['app__text--uniqueA'], 'unique value not reported');
  assert.ok(!byVal['app__text--row-${i}'], 'single template occurrence not reported');
  assert.ok(!byVal['props.testID'], 'dynamic value not reported');

  // same-file collisions sort first.
  assert.equal(dups[0].value, 'app__text--same');
});

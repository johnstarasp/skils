import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteJava, usesContains, actionableRecords } from './rewrite-locators.mjs';

const JAVA = [
  'public class S {',
  "    @AndroidFindBy(xpath = \"//android.widget.TextView[@text='Login']\")",
  "    @iOSXCUITFindBy(xpath = \"//*[@name='login__button--connect']\")",
  '    private WebElement loginButton;',
  '',
  "    @AndroidFindBy(xpath = \"//*[contains(@resource-id,'list__item--')]\")",
  "    @iOSXCUITFindBy(xpath = \"//*[contains(@name,'list__item--')]\")",
  '    private WebElement listItem;',
  '',
  "    @AndroidFindBy(xpath = \"//*[@text='Allow']\")",
  "    @iOSXCUITFindBy(xpath = \"//*[@name='Allow']\")",
  '    private WebElement allowBtn;',
  '}',
].join('\n');

const fragment = {
  records: [
    { fieldName: 'loginButton', verdict: 'MATCHED_EXISTING', testId: 'login__button--connect',
      android: { raw: "//android.widget.TextView[@text='Login']" }, ios: { raw: "//*[@name='login__button--connect']" } },
    { fieldName: 'listItem', verdict: 'MATCHED_EXISTING', testId: 'list__item--',
      android: { raw: "//*[contains(@resource-id,'list__item--')]" }, ios: { raw: "//*[contains(@name,'list__item--')]" } },
    { fieldName: 'allowBtn', verdict: 'NO_COMPONENT',
      android: { raw: "//*[@text='Allow']" }, ios: { raw: "//*[@name='Allow']" } },
  ],
};

test('actionableRecords includes MATCHED/NEEDS with id, excludes NO_COMPONENT', () => {
  const m = actionableRecords(fragment);
  assert.equal(m.size, 2);
  assert.ok(m.has('loginButton'));
  assert.ok(!m.has('allowBtn'));
});

test('usesContains detects prefix matching', () => {
  assert.equal(usesContains(fragment.records[1]), true);
  assert.equal(usesContains(fragment.records[0]), false);
});

test('rewrites both platforms to exact testID for concrete ids', () => {
  const out = rewriteJava(JAVA, actionableRecords(fragment));
  assert.match(out, /@AndroidFindBy\(xpath = "\/\/\*\[@resource-id='login__button--connect'\]"\)/);
  assert.match(out, /@iOSXCUITFindBy\(xpath = "\/\/\*\[@name='login__button--connect'\]"\)/);
});

test('preserves contains() matching for parameterized ids', () => {
  const out = rewriteJava(JAVA, actionableRecords(fragment));
  assert.match(out, /@AndroidFindBy\(xpath = "\/\/\*\[contains\(@resource-id,'list__item--'\)\]"\)/);
  assert.match(out, /@iOSXCUITFindBy\(xpath = "\/\/\*\[contains\(@name,'list__item--'\)\]"\)/);
});

test('leaves non-actionable (NO_COMPONENT) fields byte-for-byte unchanged', () => {
  const out = rewriteJava(JAVA, actionableRecords(fragment));
  assert.match(out, /@AndroidFindBy\(xpath = "\/\/\*\[@text='Allow'\]"\)/);
  assert.match(out, /@iOSXCUITFindBy\(xpath = "\/\/\*\[@name='Allow'\]"\)/);
});

test('does not change field count or class structure', () => {
  const out = rewriteJava(JAVA, actionableRecords(fragment));
  assert.equal((out.match(/private WebElement/g) || []).length, 3);
  assert.ok(out.startsWith('public class S {'));
  assert.ok(out.trimEnd().endsWith('}'));
});

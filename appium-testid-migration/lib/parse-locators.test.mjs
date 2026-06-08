import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocators, looksLikeTestId } from './parse-locators.mjs';

const JAVA = `
public class Login {
    @AndroidFindBy(xpath = "//*[@resource-id='login__textInput--username']")
    @iOSXCUITFindBy(xpath = "//*[@name='login__textInput--username']")
    private WebElement usernameInputFill;

    @AndroidFindBy(xpath = "//android.widget.EditText")
    @iOSXCUITFindBy(xpath = "//android.widget.EditText")
    private WebElement fastPin;

    @AndroidFindBy(xpath = "//android.view.ViewGroup[contains(@content-desc,'I have fully read the above')]")
    @iOSXCUITFindBy(xpath = "//XCUIElementTypeOther[contains(@name,'I have fully read the above')]")
    private WebElement termsCheckBox;

    @AndroidFindBy(xpath = "//*[@text='OK']")
    @iOSXCUITFindBy(xpath = "(//*[@name='OK'])[4]")
    private WebElement somethingWentWrongOkButton;

    public void doStuff() { usernameInputFill.click(); }
}
`;

test('parses one record per field and ignores methods', () => {
  const recs = parseLocators(JAVA);
  assert.equal(recs.length, 4);
  assert.deepEqual(recs.map(r => r.fieldName),
    ['usernameInputFill', 'fastPin', 'termsCheckBox', 'somethingWentWrongOkButton']);
});

test('classifies testID-style resource-id and name', () => {
  const r = parseLocators(JAVA)[0];
  assert.equal(r.android.strategy, 'resource-id');
  assert.equal(r.ios.strategy, 'name');
  assert.deepEqual(r.evidence, {}); // value is a BEM testID, not visible text
});

test('classifies raw widget locators', () => {
  const r = parseLocators(JAVA)[1];
  assert.equal(r.android.strategy, 'widget');
  assert.equal(r.evidence.widgetType, 'android.widget.EditText');
});

test('extracts content-desc and visible text from ios name fallback', () => {
  const r = parseLocators(JAVA)[2];
  assert.equal(r.android.strategy, 'content-desc');
  assert.equal(r.evidence.contentDesc, 'I have fully read the above');
  assert.equal(r.evidence.visibleText, 'I have fully read the above');
});

test('flags positional index and extracts visible text', () => {
  const r = parseLocators(JAVA)[3];
  assert.equal(r.android.strategy, 'text');
  assert.equal(r.evidence.visibleText, 'OK');
  assert.equal(r.ios.hasIndex, true);
});

test('looksLikeTestId distinguishes BEM ids from prose', () => {
  assert.equal(looksLikeTestId('login__textInput--username'), true);
  assert.equal(looksLikeTestId('Accept & continue'), false);
});

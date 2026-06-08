import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBemTestId, isValidBemTestId, elementTypeFor } from './bem.mjs';

test('maps RN nodes to element types', () => {
  assert.equal(elementTypeFor('Pressable'), 'button');
  assert.equal(elementTypeFor('ScrollView'), 'scrollView');
  assert.equal(elementTypeFor('FlatList'), 'flatList');
  assert.equal(elementTypeFor('TextInput'), 'textInput');
  assert.equal(elementTypeFor('Unknown'), 'view'); // safe default
});

test('builds a valid BEM testID', () => {
  assert.equal(buildBemTestId('login', 'TextInput', 'username'), 'login__textInput--username');
});

test('accepts real existing ids, rejects prose and templates', () => {
  assert.equal(isValidBemTestId('newTransfer__button--next'), true);
  assert.equal(isValidBemTestId('sections-info__tile--header'), true);
  assert.equal(isValidBemTestId('Accept & continue'), false);
  assert.equal(isValidBemTestId('wizardsFactory__switch--${name}'), false); // must be concrete
});

test('throws when generated id would be invalid', () => {
  assert.throws(() => buildBemTestId('login', 'TextInput', 'bad name!'));
});

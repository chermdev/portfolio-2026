import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanNumber, groupNumber } from './number.ts';

test('number input keeps a plain value and groups only the display', () => {
  assert.equal(cleanNumber('$1,234.5.6'), '1234.56');
  assert.equal(cleanNumber('-1,000'), '-1000');
  assert.equal(cleanNumber(''), '');
  assert.equal(groupNumber('1234567.50'), '1,234,567.50');
  assert.equal(groupNumber('-1000'), '-1,000');
  assert.equal(groupNumber('999'), '999');
  assert.equal(groupNumber('12.'), '12.');
  assert.equal(groupNumber(''), '');
});

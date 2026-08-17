// Parity tests for bin/i18n.mjs: both languages must exist, expose the same
// keys, agree on the shape of the `tags` and `priority` tables, agree on
// the arity of every function-form string, and `t()` must fall back to 'en'
// for unknown languages.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STRINGS, SUPPORTED_LANGS, t } from '../bin/i18n.mjs';

test('SUPPORTED_LANGS is exactly ["en", "es"]', () => {
  assert.deepEqual(SUPPORTED_LANGS, ['en', 'es']);
});

test('STRINGS.en and STRINGS.es both exist', () => {
  assert.ok(STRINGS.en, 'STRINGS.en should exist');
  assert.ok(STRINGS.es, 'STRINGS.es should exist');
});

test('STRINGS.en and STRINGS.es share the same top-level keys', () => {
  const enKeys = Object.keys(STRINGS.en).sort();
  const esKeys = Object.keys(STRINGS.es).sort();
  assert.deepEqual(enKeys, esKeys);
});

test('every key in STRINGS.en.tags exists in STRINGS.es.tags', () => {
  for (const key of Object.keys(STRINGS.en.tags)) {
    assert.ok(key in STRINGS.es.tags, `missing tags key "${key}" in es`);
  }
});

test('every key in STRINGS.en.priority exists in STRINGS.es.priority', () => {
  for (const key of Object.keys(STRINGS.en.priority)) {
    assert.ok(key in STRINGS.es.priority, `missing priority key "${key}" in es`);
  }
});

test('function-form strings have the same arity in en and es', () => {
  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (typeof value !== 'function') continue;
    const esValue = STRINGS.es[key];
    assert.equal(typeof esValue, 'function', `${key} must be a function in es`);
    assert.equal(
      esValue.length,
      value.length,
      `arity mismatch for ${key}: en=${value.length}, es=${esValue.length}`,
    );
  }
});

test('t("en") returns STRINGS.en', () => {
  assert.equal(t('en'), STRINGS.en);
});

test('t("fr") falls back to STRINGS.en', () => {
  assert.equal(t('fr'), STRINGS.en);
});

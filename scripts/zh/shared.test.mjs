import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseFrontmatter } from './shared.mjs';
import { checkGlossary, sameMultiset } from './check.mjs';

test('parseFrontmatter reads simple top-level fields', () => {
  const data = parseFrontmatter('---\ntitle: 测试\nsourceHash: sha256:abc\n---\n正文');
  assert.equal(data.title, '测试');
  assert.equal(data.sourceHash, 'sha256:abc');
});

test('parseCsv handles quoted fields and commas', () => {
  const rows = parseCsv('en,zh,notes\nopen-drain,开漏,"首次出现，写开漏（open-drain）"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].zh, '开漏');
  assert.equal(rows[0].notes, '首次出现，写开漏（open-drain）');
});

test('sameMultiset compares counts', () => {
  assert.equal(sameMultiset(['a', 'b', 'a'], ['a', 'a', 'b']), true);
  assert.equal(sameMultiset(['a', 'b'], ['a', 'a']), false);
});

test('checkGlossary reports forbidden variants', () => {
  const result = checkGlossary('这里使用了拉起电阻。', [
    { en: 'pull-up resistor', zh: '上拉电阻', keep_en: 'true', forbidden_zh: '拉起电阻' },
  ]);
  assert.equal(result.errors.length, 1);
});

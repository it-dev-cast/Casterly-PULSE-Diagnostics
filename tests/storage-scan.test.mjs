import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_SCANNERS, isScanComplete, storageFallback, settleScanner } from '../src/app/utils/scanState.ts';

for (const state of ['pending', 'running']) {
  test(`cannot complete while storage is ${state}`, () => {
    assert.equal(isScanComplete(new Set(REQUIRED_SCANNERS), state), false);
  });
}
for (const state of ['completed', 'unavailable', 'failed']) {
  test(`all modules plus terminal ${state} completes`, () => {
    assert.equal(isScanComplete(new Set(REQUIRED_SCANNERS), state), true);
  });
}
test('audio completion alone does not complete scan', () => {
  assert.equal(isScanComplete(new Set(['audio']), 'completed'), false);
});
test('every required scanner must settle, even with storage complete', () => {
  for (const missing of REQUIRED_SCANNERS) {
    assert.equal(isScanComplete(new Set(REQUIRED_SCANNERS.filter(s => s !== missing)), 'completed'), false);
  }
});
test('duplicate settlement cannot fill another scanner slot', () => {
  assert.equal(isScanComplete(new Set([...REQUIRED_SCANNERS.filter(s => s !== 'storage'), 'audio']), 'completed'), false);
});
test('basic data appears while health is pending, but does not complete scan', () => {
  assert.equal(storageFallback('running', true), 'Unavailable');
  assert.equal(isScanComplete(new Set(REQUIRED_SCANNERS), 'running'), false);
});
test('no persistent Scanning placeholder in terminal storage states', () => {
  for (const state of ['completed', 'unavailable', 'failed']) {
    assert.equal(storageFallback(state, false), 'Unavailable');
    assert.equal(storageFallback(state, true), 'Unavailable');
  }
  assert.equal(storageFallback('running', false), 'Scanning...');
});
test('worker rejection always settles exactly once', async () => {
  let errors = 0, settled = 0;
  await settleScanner(() => Promise.reject(new Error('worker panic')), () => assert.fail(), () => errors++, () => settled++);
  assert.equal(errors, 1); assert.equal(settled, 1);
});
test('result-handler exception also settles once', async () => {
  let settled = 0;
  await settleScanner(async () => [], () => { throw new Error('handler'); }, () => {}, () => settled++);
  assert.equal(settled, 1);
});
test('optional health timeout retains basic data and completes after worker return', async () => {
  const settled = new Set(REQUIRED_SCANNERS.filter(s => s !== 'storage'));
  let release;
  const worker = new Promise(resolve => { release = resolve; });
  let state = 'running', data;
  const task = settleScanner(() => worker, result => { data = result; state = 'completed'; }, () => assert.fail(), () => settled.add('storage'));
  assert.equal(isScanComplete(settled, state), false);
  release([{ device: '/dev/nvme0n1', model: 'fixture', health_percent: null }]);
  await task;
  assert.equal(data[0].health_percent, null);
  assert.equal(isScanComplete(settled, state), true);
});

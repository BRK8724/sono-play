import test from 'node:test';
import assert from 'node:assert/strict';
import { localResult, scorePair } from '../src/rules.ts';

test('one point per completed pipe pair', () => {
  const pair = { x: 40, width: 80, scored: false };
  assert.equal(scorePair(pair, 100), false);
  pair.x = 19;
  assert.equal(scorePair(pair, 100), true);
  assert.equal(scorePair(pair, 100), false);
});

test('local result cannot be submitted as verified or reward eligible', () => {
  const result = localResult(9999, 'COLLISION');
  assert.equal(result.displayScore, 9999);
  assert.equal(result.verifiedScore, null);
  assert.equal(result.verificationStatus, 'LOCAL_DEMO_ONLY');
  assert.equal(result.rewardStatus, 'NOT_ELIGIBLE');
});

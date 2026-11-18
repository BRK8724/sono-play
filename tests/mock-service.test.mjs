import test from 'node:test';
import assert from 'node:assert/strict';
import { MockMiniappService } from '../src/mock/MockMiniappService.ts';

test('one active flight consumes one right and finishes exactly once', async () => {
  const service = new MockMiniappService();
  const results = await Promise.allSettled([service.startRun(), service.startRun()]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(service.snapshot().attempts, 2);
  const run = results.find((result) => result.status === 'fulfilled').value;
  service.finishRun(run, 4, 'APP_BACKGROUND');
  service.finishRun(run, 999, 'COLLISION');
  assert.equal(service.snapshot().total, 124);
  assert.equal(service.snapshot().best, 78);
});

test('duplicate purchase retries debit and grant only once', async () => {
  const service = new MockMiniappService();
  const order = { kind: 'attempts', quantity: 2 };
  await Promise.all([service.purchase('order-1', order), service.purchase('order-1', order)]);
  assert.equal(service.snapshot().points, 4960);
  assert.equal(service.snapshot().attempts, 5);
  await assert.rejects(service.purchase('order-1', { kind: 'attempts', quantity: 3 }));
  assert.equal(service.snapshot().points, 4960);
});

test('invalid, failed, and insufficient purchases preserve balances', async () => {
  const service = new MockMiniappService();
  const before = service.snapshot();
  for (const quantity of [0, -1, 1.5, 51, NaN, Infinity])
    await assert.rejects(service.purchase(`bad-${quantity}`, { kind: 'attempts', quantity }));
  await assert.rejects(service.purchase('unknown', { kind: 'item', itemId: 'missing' }));
  service.failNextPurchase = true;
  await assert.rejects(service.purchase('retry', { kind: 'attempts', quantity: 1 }));
  assert.deepEqual(service.snapshot(), before);
  await service.purchase('retry', { kind: 'attempts', quantity: 1 });
  service.setScenario('poor');
  const poor = service.snapshot();
  await assert.rejects(
    service.purchase('poor', { kind: 'attempts', quantity: 1 }),
    /INSUFFICIENT_POINTS/,
  );
  assert.deepEqual(service.snapshot(), poor);
});

test('empty rights, owned catalog selection, reset and ranking remain consistent', async () => {
  const service = new MockMiniappService();
  assert.equal(service.ownRank().rank, 58);
  assert.throws(() => service.selectItem('bird', 'gold'));
  await assert.rejects(service.purchase('gold', { kind: 'item', itemId: 'gold' }), /SKIN_LOCKED/);
  service.setPreviewState({ total: 3000 });
  service.selectItem('bird', 'gold');
  assert.equal(service.snapshot().selectedBird, 'gold');
  assert.throws(() => service.selectItem('background', 'gold'));
  const run = await service.startRun();
  service.finishRun(run, 2200, 'COLLISION');
  assert.equal(service.ownRank().rank, 1);
  assert.equal(service.leaderboard()[0].name, 'ROCKET');
  service.setScenario('empty');
  await assert.rejects(service.startRun());
  const snapshot = service.snapshot();
  snapshot.owned.length = 0;
  assert.ok(service.snapshot().owned.length > 0);
  service.setScenario('reset');
  assert.equal(service.snapshot().attempts, 3);
  assert.equal(service.snapshot().points, 5000);
  assert.equal(service.ownRank().rank, 58);
});

test('pending demo result leaves cumulative score unchanged', async () => {
  const service = new MockMiniappService();
  service.pendingNextResult = true;
  const run = await service.startRun();
  const result = service.finishRun(run, 300, 'COLLISION');
  assert.equal(result.verification, 'PENDING');
  assert.equal(service.snapshot().total, 120);
  assert.equal(service.snapshot().best, 78);
  assert.equal(service.snapshot().attempts, 2);
});

test('mock daily standings, score history and rights ledger follow completed operations once', async () => {
  let now = new Date('2026-11-17T10:00:00Z');
  const service = new MockMiniappService({ now: () => now });
  const before = service.history();
  const run = await service.startRun();
  service.finishRun(run, 5, 'COLLISION');
  service.finishRun(run, 500, 'COLLISION');
  assert.equal(service.standings('today').me.score, 83);
  assert.equal(service.history().scores[0].score, 83);
  assert.equal(service.history().free.length, before.free.length + 1);
  assert.equal(service.history().free[0].amount, -1);
  await service.purchase('buy', { kind: 'attempts', quantity: 2 });
  await service.purchase('buy', { kind: 'attempts', quantity: 2 });
  assert.equal(service.history().earned.length, before.earned.length + 1);
  assert.equal(service.history().earned[0].amount, 2);
  const mutable = service.history();
  mutable.scores[0].score = 99999;
  assert.equal(service.history().scores[0].score, 83);
  now = new Date('2026-11-17T16:00:00Z');
  assert.equal(service.standings('today').me.score, 0);
  assert.equal(service.standings('previous').me.score, 83);
  assert.equal(service.snapshot().freePlaysLeft, 3);
  assert.equal(service.snapshot().lives, 2);
  assert.equal(service.history().free[0].amount, 3);
});

test('nickname collisions cannot substitute another fixture player for the own rank', async () => {
  const service = new MockMiniappService({ requireNickname: true });
  await assert.rejects(service.setNickname('SUNNY'), /NICKNAME_TAKEN/);
  await service.setNickname('NEWPILOT');
  assert.equal(service.ownRank().name, 'NEWPILOT');
  assert.equal(service.ownRank().score, service.snapshot().total);
});

test('milestone preview totals stay consistent with daily history and ranks', () => {
  const service = new MockMiniappService({ now: () => new Date('2026-11-17T10:00:00Z') });
  for (const total of [1500, 3000, 100, 10, 0]) {
    service.setPreviewState({ total });
    const history = service.history();
    assert.equal(
      history.scores.reduce((sum, row) => sum + row.score, 0),
      total,
    );
    assert.ok(history.scores.every((row) => row.score >= 0));
    assert.equal(history.scores[0].score, service.standings('today').me.score);
    assert.equal(history.scores[0].rank, service.standings('today').me.rank);
    assert.equal(history.scores[1].rank, service.standings('previous').me.rank);
    assert.equal(service.snapshot().points, 5000);
  }
});

test('preview rights remain consistent with their ledger through repeats, play and daily expiry', async () => {
  let now = new Date('2026-11-17T10:00:00Z');
  const service = new MockMiniappService({ now: () => now });
  const balance = (group) => service.history()[group].reduce((sum, row) => sum + row.amount, 0);
  assert.equal(balance('free'), 3);
  assert.equal(balance('earned'), 0);
  const patch = { attempts: 2, freePlaysLeft: 0, lives: 2, points: 1710 };
  service.setPreviewState(patch);
  assert.equal(balance('free'), service.snapshot().freePlaysLeft);
  assert.equal(balance('earned'), service.snapshot().lives);
  const lengths = [service.history().free.length, service.history().earned.length];
  service.setPreviewState(patch);
  assert.deepEqual([service.history().free.length, service.history().earned.length], lengths);
  const run = await service.startRun();
  service.finishRun(run, 0, 'COLLISION');
  assert.equal(service.snapshot().lives, 1);
  assert.equal(balance('earned'), 1);
  now = new Date('2026-11-17T16:00:00Z');
  assert.equal(service.snapshot().freePlaysLeft, 3);
  assert.equal(balance('free'), 3);
  assert.equal(
    service.history().free.filter((row) => row.date === '2026.11.18' && row.amount === 3).length,
    1,
  );
  service.setPreviewState({ freePlaysLeft: 1 });
  assert.equal(balance('free'), 1);
  now = new Date('2026-11-18T16:00:00Z');
  assert.equal(service.snapshot().freePlaysLeft, 3);
  assert.equal(balance('free'), 3);
  assert.equal(service.history().free[1].amount, -1);
  assert.equal(service.history().free[1].reason, 'Хугацаа дууссан эрх');
  const finalLength = service.history().free.length;
  service.setPreviewState({ total: 1500 });
  service.snapshot();
  assert.equal(service.history().free.length, finalLength);
  assert.equal(balance('earned'), 1);
});

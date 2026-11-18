import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_RULES,
  ulaanbaatarDay,
  backgroundPeriod,
  unlockedBirds,
  previewSpeedFactor,
} from '../src/gameRules.ts';
import { MockMiniappService } from '../src/mock/MockMiniappService.ts';

test('V2.1 cumulative milestones unlock Santa at 1500 and Goldie at 3000', async () => {
  assert.deepEqual(unlockedBirds(1499), ['pilot']);
  assert.deepEqual(unlockedBirds(1500), ['pilot', 'santa']);
  assert.deepEqual(unlockedBirds(2999), ['pilot', 'santa']);
  assert.deepEqual(unlockedBirds(3000), ['pilot', 'santa', 'gold']);
  const service = new MockMiniappService();
  service.setPreviewState({ total: 1499 });
  assert.throws(() => service.selectItem('bird', 'santa'));
  const run = await service.startRun();
  service.finishRun(run, 1, 'COLLISION');
  service.selectItem('bird', 'santa');
  assert.equal(service.snapshot().selectedBird, 'santa');
  assert.equal(service.snapshot().points, 5000);
});

test('daily free rights reset at Ulaanbaatar midnight and earned rights survive', async () => {
  let now = new Date('2026-11-17T15:59:59Z');
  const service = new MockMiniappService({ now: () => now });
  await service.purchase('earned', { kind: 'attempts', quantity: 2 });
  for (let i = 0; i < 4; i++) {
    const run = await service.startRun();
    service.finishRun(run, 0, 'COLLISION');
  }
  assert.equal(service.snapshot().freePlaysLeft, 0);
  assert.equal(service.snapshot().lives, 1);
  now = new Date('2026-11-17T16:00:00Z');
  assert.equal(ulaanbaatarDay(now), '2026-11-18');
  assert.equal(service.snapshot().freePlaysLeft, 3);
  assert.equal(service.snapshot().lives, 1);
  assert.equal(service.snapshot().attempts, 4);
  now = new Date('2026-11-18T16:00:00Z');
  assert.equal(service.snapshot().attempts, 4);
});

test('background switches at 07:00 and 18:00 in Ulaanbaatar', () => {
  const period = (iso) => backgroundPeriod(new Date(iso));
  assert.equal(period('2026-11-16T22:59:59Z'), 'night');
  assert.equal(period('2026-11-16T23:00:00Z'), 'day');
  assert.equal(period('2026-11-17T09:59:59Z'), 'day');
  assert.equal(period('2026-11-17T10:00:00Z'), 'night');
});

test('V2.1 speed increments follow 10+15+20+25 cumulative thresholds', () => {
  for (const [score, expected] of [
    [0, 1],
    [9, 1],
    [10, 1.1],
    [24, 1.1],
    [25, 1.2],
    [45, 1.3],
    [70, 1.4],
    [100, 1.5],
    [384, 2],
    [385, 2.1],
  ])
    assert.ok(Math.abs(previewSpeedFactor(score) - expected) < 1e-10);
  assert.equal(GAME_RULES.pointsPerLife, 20);
});

test('nickname creation, duplicate response and first-play gate work in preview', async () => {
  const service = new MockMiniappService({ requireNickname: true });
  await assert.rejects(service.startRun(), /NICKNAME_REQUIRED/);
  await assert.rejects(service.setNickname('NOMAD'), /NICKNAME_TAKEN/);
  await assert.rejects(service.setNickname('12'), /VALIDATION_FAILED/);
  await service.setNickname('ТЭНГЭР');
  assert.equal(service.snapshot().nicknameRequired, false);
  assert.equal(service.snapshot().name, 'ТЭНГЭР');
  await assert.rejects(service.setNickname('ӨӨРНЭР'), /NICKNAME_ALREADY_SET/);
  const run = await service.startRun();
  service.finishRun(run, 0, 'COLLISION');
});

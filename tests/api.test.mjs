import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/services/ApiClient.ts';
import { ApiMiniappService } from '../src/services/ApiMiniappService.ts';
import { seededRandom, speedFactor } from '../src/gameplay.ts';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const config = {
  pipeIntervalMs: 1500,
  speed: { step: 0.1, max: 2, thresholds: [10, 25, 45] },
  gravity: 1800,
  jumpVelocity: -520,
  scrollSpeed: 160,
  pipeGap: 150,
};

const birdResponse = (totalScore, pick = 'sono') => {
  const birds = [
    { code: 'sono', name: 'Sono', unlockScore: 0 },
    { code: 'santa_sono', name: 'Santa Sono', unlockScore: 50 },
    { code: 'goldy_sono', name: 'Goldy Sono', unlockScore: 150 },
  ];
  const selected = birds.find((bird) => bird.code === pick && totalScore >= bird.unlockScore)
    ? pick
    : 'sono';
  return {
    totalScore,
    selected,
    birds: birds.map((bird) => ({
      ...bird,
      unlocked: totalScore >= bird.unlockScore,
      selected: bird.code === selected,
    })),
  };
};

test('concurrent 401 responses rotate a refresh token once and retain request keys', async () => {
  let refreshCount = 0;
  const keys = [];
  const client = new ApiClient({
    baseUrl: 'http://test',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/exchange'))
        return json({ accessToken: 'old', refreshAvailable: true, refreshToken: 'r1' });
      if (url.endsWith('/refresh')) {
        refreshCount++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return json({ accessToken: 'new', refreshAvailable: true, refreshToken: 'r2' });
      }
      keys.push(init.headers['Idempotency-Key']);
      return init.headers.Authorization === 'Bearer old'
        ? json({ code: 'UNAUTHORIZED' }, 401)
        : json({ ok: true });
    },
  });
  await client.login();
  await Promise.all([
    client.request('POST', '/start', undefined, 'same-action'),
    client.request('POST', '/start', undefined, 'other-action'),
  ]);
  assert.equal(refreshCount, 1);
  assert.deepEqual(keys, ['same-action', 'other-action', 'same-action', 'other-action']);
});

test('lost start response retries the same operation and never substitutes mock balances', async () => {
  let fail = true;
  const keys = [];
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (_url, init) => {
      keys.push(init.headers['Idempotency-Key']);
      if (fail) {
        fail = false;
        throw new TypeError('response lost');
      }
      return new Response(
        '{"sessionId":"session","seed":9223372036854775806,"freePlaysLeft":2,"livesLeft":0,"config":' +
          JSON.stringify(config) +
          '}',
        { status: 200 },
      );
    },
  });
  const service = new ApiMiniappService({ client });
  await assert.rejects(service.startRun(), /CONNECTION_LOST/);
  assert.equal(service.snapshot().attempts, 0);
  assert.equal(await service.startRun(), 'session');
  assert.equal(keys[0], keys[1]);
  assert.equal(service.gameSeed, '9223372036854775806');
  assert.equal(service.snapshot().attempts, 2);
  await assert.rejects(service.startRun(), /RESULT_PENDING/);
});

test('finish retries freeze score and elapsed time and keep rejected scores out of totals', async () => {
  let now = 1000,
    fail = true;
  const bodies = [];
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/start'))
        return json({ sessionId: 'session', seed: 5, freePlaysLeft: 2, livesLeft: 0, config });
      if (url.endsWith('/finish')) {
        bodies.push(JSON.parse(init.body));
        if (fail) {
          fail = false;
          throw new TypeError('response lost');
        }
        return json({
          status: 'REJECTED',
          score: 500,
          bestScore: 0,
          rejectReason: 'SCORE_TOO_HIGH',
        });
      }
      if (url.endsWith('/me'))
        return json({
          nickname: 'test',
          freePlaysLeft: 2,
          lives: 0,
          playsLeft: 2,
          bestScore: 0,
          totalScore: 0,
        });
      if (url.endsWith('/tournament')) return json({ current: { id: 1, rankingMode: 'TOTAL' } });
      return json({ pointsPerLife: 20, maxLivesPerOrder: 1000 });
    },
  });
  const service = new ApiMiniappService({ client, now: () => now });
  const session = await service.startRun();
  now = 3500;
  await assert.rejects(service.finishRun(session, 500, 'COLLISION'));
  now = 8000;
  const result = await service.finishRun(session, 900, 'EXIT');
  assert.deepEqual(bodies, [
    { score: 500, durationMs: 2500 },
    { score: 500, durationMs: 2500 },
  ]);
  assert.equal(result.verification, 'REJECTED');
  assert.equal(service.snapshot().total, 0);
  await service.finishRun(session, 999, 'EXIT');
  assert.equal(bodies.length, 2);
});

test('pending payment retries retain the order and grant rights only after PAID', async () => {
  let createCount = 0,
    paid = false;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/orders')) createCount++;
      if (url.includes('/orders'))
        return json({
          orderId: 'order',
          status: paid ? 'PAID' : 'PENDING',
          lives: 3,
          pointsCost: 60,
        });
      if (url.endsWith('/me'))
        return json({
          nickname: 'test',
          freePlaysLeft: 3,
          lives: 3,
          playsLeft: 6,
          bestScore: 0,
          totalScore: null,
        });
      if (url.endsWith('/tournament')) return json({ current: null });
      return json({ pointsPerLife: 20, maxLivesPerOrder: 1000 });
    },
  });
  const service = new ApiMiniappService({ client });
  const order = { kind: 'attempts', quantity: 3 };
  assert.equal(await service.purchase('key', order), 'PENDING');
  await service.purchase('key', order);
  assert.equal(createCount, 1);
  assert.equal(service.snapshot().attempts, 0);
  await assert.rejects(
    service.purchase('key', { kind: 'attempts', quantity: 4 }),
    /ORDER_STATE_CONFLICT/,
  );
  paid = true;
  await service.checkOrder();
  assert.equal(service.snapshot().attempts, 6);
  await assert.rejects(service.grantLives(5), /FORBIDDEN/);
  assert.equal(service.snapshot().points, null);
});

test('server speed thresholds and seeded placement remain reproducible', () => {
  assert.equal(speedFactor(config, 9), 1);
  assert.equal(speedFactor(config, 10), 1.1);
  assert.equal(speedFactor({ ...config, speed: { ...config.speed, max: 1.2 } }, 100), 1.2);
  const a = seededRandom('9223372036854775806'),
    b = seededRandom('9223372036854775806');
  const positions = Array.from({ length: 100 }, () => a());
  assert.deepEqual(
    positions,
    Array.from({ length: 100 }, () => b()),
  );
  assert.ok(positions.every((value) => value >= 0 && value < 1));
  assert.ok(new ApiError('UNAUTHORIZED') instanceof Error);
});

test('host approval awaits the server callback and concurrent retries open payment once', async () => {
  let created = 0,
    opened = 0,
    paid = false;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url) => {
      if (url.endsWith('/orders')) created++;
      if (url.includes('/orders'))
        return json({
          orderId: 'host-order',
          status: paid ? 'PAID' : 'PENDING',
          lives: 1,
          pointsCost: 20,
        });
      if (url.endsWith('/me'))
        return json({
          nickname: 'host',
          freePlaysLeft: 0,
          lives: 1,
          playsLeft: 1,
          bestScore: 0,
          totalScore: null,
        });
      if (url.endsWith('/tournament')) return json({ current: null });
      return json({ pointsPerLife: 20, maxLivesPerOrder: 1000 });
    },
  });
  const service = new ApiMiniappService({
    client,
    payWithPoints: async (request) => {
      assert.deepEqual(request, { orderId: 'host-order' });
      opened++;
      return { success: true };
    },
  });
  const order = { kind: 'attempts', quantity: 1 };
  assert.deepEqual(
    await Promise.all([service.purchase('key', order), service.purchase('key', order)]),
    ['PENDING', 'PENDING'],
  );
  await service.purchase('key', order);
  assert.equal(created, 1);
  assert.equal(opened, 1);
  assert.equal(service.snapshot().attempts, 0);
  paid = true;
  await service.checkOrder();
  assert.equal(service.snapshot().attempts, 1);
});

test('API skin selection reads server ownership before accepting a local bird id', async () => {
  const puts = [];
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/birds')) return json(birdResponse(0));
      puts.push(JSON.parse(init.body));
      return json({ selected: 'sono' });
    },
  });
  const service = new ApiMiniappService({ client });
  await service.selectItem('bird', 'pilot');
  assert.equal(service.snapshot().selectedBird, 'pilot');
  await assert.rejects(service.selectItem('bird', 'santa'), /BIRD_LOCKED/);
  await assert.rejects(service.selectItem('bird', 'gold'), /BIRD_LOCKED/);
  assert.deepEqual(puts, [{ code: 'sono' }]);
});

test('non-JSON gateway errors retain HTTP status and trigger serialized auth refresh', async () => {
  let refreshes = 0;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/exchange'))
        return json({ accessToken: 'old', refreshAvailable: true, refreshToken: 'r' });
      if (url.endsWith('/refresh')) {
        refreshes++;
        return json({ accessToken: 'new' });
      }
      if (init.headers.Authorization === 'Bearer old')
        return new Response('<html>Unauthorized</html>', { status: 401 });
      return json({ ok: true });
    },
  });
  await client.login();
  assert.deepEqual(await client.request('GET', '/me'), { ok: true });
  assert.equal(refreshes, 1);
  const malformed = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async () => new Response('<html>ok?</html>'),
  });
  await assert.rejects(malformed.request('GET', '/me'), /INVALID_RESPONSE/);
});

test('invalid server game config retains the start key and never opens a client run', async () => {
  const invalid = [
    null,
    { ...config, gravity: 0 },
    { ...config, jumpVelocity: 0 },
    { ...config, pipeGap: -1 },
    { ...config, speed: { step: 0.1, max: 2, thresholds: [25, 10] } },
  ];
  for (const bad of invalid) {
    const keys = [];
    let valid = false;
    const client = new ApiClient({
      baseUrl: '',
      getLaunchToken: async () => 'launch',
      fetch: async (_url, init) => {
        keys.push(init.headers['Idempotency-Key']);
        return json({
          sessionId: 's',
          seed: 1,
          config: valid ? config : bad,
          freePlaysLeft: 2,
          livesLeft: 0,
        });
      },
    });
    const service = new ApiMiniappService({ client });
    await assert.rejects(service.startRun(), /INVALID_RESPONSE/);
    assert.equal(service.gameConfig, undefined);
    assert.equal(service.snapshot().attempts, 0);
    valid = true;
    assert.equal(await service.startRun(), 's');
    assert.equal(keys[0], keys[1]);
  }
});

test('concurrent finish calls share one submission and keep the first captured payload', async () => {
  const bodies = [];
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/start'))
        return json({ sessionId: 's', seed: 1, config, freePlaysLeft: 2, livesLeft: 0 });
      if (url.endsWith('/finish')) {
        bodies.push(JSON.parse(init.body));
        await new Promise((resolve) => setTimeout(resolve, 5));
        return json({ status: 'FINISHED', score: 4, bestScore: 4 });
      }
      if (url.endsWith('/me'))
        return json({
          nickname: 'test',
          freePlaysLeft: 2,
          lives: 0,
          playsLeft: 2,
          totalScore: 4,
          bestScore: 4,
        });
      if (url.endsWith('/tournament')) return json({ current: null });
      return json({ pointsPerLife: 20, maxLivesPerOrder: 50 });
    },
  });
  const service = new ApiMiniappService({ client, now: () => 1000 });
  await service.startRun();
  const results = await Promise.all([
    service.finishRun('s', 4, 'COLLISION'),
    service.finishRun('s', 999, 'EXIT'),
  ]);
  assert.deepEqual(bodies, [{ score: 4, durationMs: 0 }]);
  assert.ok(results.every((result) => result.score === 4 && result.reason === 'COLLISION'));
});

test('lost order responses keep their original intent and block a second unpaid order', async () => {
  let lost = true,
    creates = 0;
  const keys = [];
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/orders')) {
        creates++;
        keys.push(init.headers['Idempotency-Key']);
        if (lost) {
          lost = false;
          throw new TypeError('response lost');
        }
      }
      return json({ orderId: 'o', status: 'PENDING', lives: 2, pointsCost: 40 });
    },
  });
  const service = new ApiMiniappService({ client });
  const order = { kind: 'attempts', quantity: 2 };
  await assert.rejects(service.purchase('first', order), /CONNECTION_LOST/);
  await assert.rejects(
    service.purchase('first', { kind: 'attempts', quantity: 3 }),
    /ORDER_STATE_CONFLICT/,
  );
  await assert.rejects(service.purchase('second', order), /ORDER_PENDING/);
  assert.equal(await service.purchase('first', order), 'PENDING');
  assert.deepEqual(keys, ['first', 'first']);
  assert.equal(creates, 2);
});

test('concurrent order checks and native payment openings share their work', async () => {
  let reads = 0,
    opened = 0,
    paid = false;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url) => {
      if (url.includes('/orders')) {
        if (!url.endsWith('/orders')) {
          reads++;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return json({ orderId: 'o', status: paid ? 'PAID' : 'PENDING', lives: 1, pointsCost: 20 });
      }
      if (url.endsWith('/me'))
        return json({
          nickname: 'test',
          freePlaysLeft: 0,
          lives: 1,
          playsLeft: 1,
          bestScore: 0,
          totalScore: null,
        });
      if (url.endsWith('/tournament')) return json({ current: null });
      return json({ pointsPerLife: 20, maxLivesPerOrder: 50 });
    },
  });
  const service = new ApiMiniappService({
    client,
    paymentAvailable: () => false,
    payWithPoints: async () => {
      opened++;
      await new Promise((resolve) => setTimeout(resolve, 5));
    },
  });
  await service.purchase('key', { kind: 'attempts', quantity: 1 });
  const before = reads;
  await Promise.all([service.checkOrder(), service.checkOrder()]);
  assert.equal(reads - before, 1);
  await Promise.all([service.payOrder(), service.payOrder()]);
  assert.equal(opened, 1);
  paid = true;
  await service.checkOrder();
  assert.equal(service.pendingOrder.status, 'PAID');
  paid = false;
  await service.checkOrder();
  assert.equal(service.pendingOrder.status, 'PAID');
});

test('restored order status comes from the server even when cached data says paid', async () => {
  const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const cached = new Map([
    [
      'sono.pending-order',
      JSON.stringify({
        owner: 7,
        order: { orderId: 'o', status: 'PAID', lives: 999, pointsCost: 0 },
      }),
    ],
  ]);
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key) => cached.get(key) ?? null,
      setItem: (key, value) => cached.set(key, value),
      removeItem: (key) => cached.delete(key),
    },
  });
  try {
    const client = new ApiClient({
      baseUrl: '',
      getLaunchToken: async () => 'launch',
      fetch: async (url) => {
        if (url.endsWith('/exchange')) return json({ accessToken: 'game-only' });
        if (url.endsWith('/me'))
          return json({
            playerId: 7,
            nickname: 'test',
            freePlaysLeft: 3,
            lives: 0,
            playsLeft: 3,
            bestScore: 0,
            totalScore: 0,
          });
        if (url.endsWith('/tournament')) return json({ current: null });
        if (url.includes('/orders/'))
          return json({ orderId: 'o', status: 'PENDING', lives: 1, pointsCost: 20 });
        return json({ pointsPerLife: 20, maxLivesPerOrder: 50 });
      },
    });
    const service = new ApiMiniappService({ client });
    await service.initialize();
    assert.equal(service.pendingOrder.status, 'PENDING');
    assert.equal(service.pendingOrder.lives, 1);
    assert.equal(service.snapshot().attempts, 3);
  } finally {
    if (savedStorage) Object.defineProperty(globalThis, 'sessionStorage', savedStorage);
    else delete globalThis.sessionStorage;
  }
});

test('lost one-time nickname response recovers the authoritative profile', async () => {
  let nickname = null,
    puts = 0;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/nickname')) {
        puts++;
        nickname = JSON.parse(init.body).nickname;
        throw new TypeError('response lost after commit');
      }
      if (url.endsWith('/me'))
        return json({
          nickname,
          freePlaysLeft: 3,
          lives: 0,
          playsLeft: 3,
          bestScore: 0,
          totalScore: null,
        });
      if (url.endsWith('/tournament')) return json({ current: null });
      return json({ pointsPerLife: 20, maxLivesPerOrder: 50 });
    },
  });
  const service = new ApiMiniappService({ client });
  await service.setNickname('RECOVERED');
  assert.equal(puts, 1);
  assert.equal(service.snapshot().name, 'RECOVERED');
  assert.equal(service.snapshot().nicknameRequired, false);
});

test('definitively missing orders clear their saved reference and allow a fresh purchase', async () => {
  let missing = false,
    creates = 0;
  const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  try {
    const client = new ApiClient({
      baseUrl: '',
      getLaunchToken: async () => 'launch',
      fetch: async (url) => {
        if (url.endsWith('/exchange')) return json({ accessToken: 'game-only' });
        if (url.endsWith('/me'))
          return json({
            playerId: 7,
            nickname: 'test',
            freePlaysLeft: 0,
            lives: 0,
            playsLeft: 0,
            bestScore: 0,
            totalScore: 0,
          });
        if (url.endsWith('/tournament')) return json({ current: null });
        if (url.endsWith('/price')) return json({ pointsPerLife: 20, maxLivesPerOrder: 50 });
        if (url.endsWith('/orders')) {
          creates++;
          return json({ orderId: `order-${creates}`, status: 'PENDING', lives: 1, pointsCost: 20 });
        }
        if (missing) return json({ code: 'ORDER_NOT_FOUND' }, 404);
        return json({
          orderId: url.split('/').at(-1),
          status: 'PENDING',
          lives: 1,
          pointsCost: 20,
        });
      },
    });
    const service = new ApiMiniappService({ client });
    await service.initialize();
    await service.purchase('first', { kind: 'attempts', quantity: 1 });
    assert.ok(values.has('sono.pending-order'));
    missing = true;
    await assert.rejects(service.checkOrder(), /ORDER_NOT_FOUND/);
    assert.equal(service.pendingOrder, undefined);
    assert.equal(values.has('sono.pending-order'), false);
    missing = false;
    assert.equal(await service.purchase('second', { kind: 'attempts', quantity: 1 }), 'PENDING');
    assert.equal(creates, 2);
    assert.equal(service.pendingOrder.orderId, 'order-2');
  } finally {
    if (savedStorage) Object.defineProperty(globalThis, 'sessionStorage', savedStorage);
    else delete globalThis.sessionStorage;
  }
});

test('temporary or unrelated order failures preserve the pending order and original create intent', async () => {
  let failure = '',
    creates = 0;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url) => {
      if (url.endsWith('/orders')) creates++;
      else if (failure === 'network') throw new TypeError('offline');
      else if (failure === 'server') return json({ code: 'TEMPORARILY_UNAVAILABLE' }, 503);
      else if (failure === 'unrelated404') return json({ code: 'HTTP_ERROR' }, 404);
      return json({ orderId: 'o', status: 'PENDING', lives: 1, pointsCost: 20 });
    },
  });
  const service = new ApiMiniappService({ client });
  const order = { kind: 'attempts', quantity: 1 };
  await service.purchase('first', order);
  for (const kind of ['network', 'server', 'unrelated404']) {
    failure = kind;
    await assert.rejects(service.checkOrder());
    assert.equal(service.pendingOrder.status, 'PENDING');
    await assert.rejects(service.purchase('second', order), /ORDER_PENDING/);
    failure = '';
    assert.equal(await service.purchase('first', order), 'PENDING');
  }
  assert.equal(creates, 1);
});

test('server bird unlocks, persisted selection and tournament relock follow the catalog', async () => {
  let total = 0,
    selected = 'sono',
    tournamentId = 1,
    free = 3,
    sessions = 0,
    birdReads = 0;
  const selections = [];
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/exchange')) return json({ accessToken: 'game-only' });
      if (url.endsWith('/me'))
        return json({
          playerId: 7,
          nickname: 'pilot',
          selectedBird: selected,
          freePlaysLeft: free,
          lives: 0,
          playsLeft: free,
          bestScore: total,
          totalScore: total,
        });
      if (url.endsWith('/tournament'))
        return json({ current: { id: tournamentId, name: 'Test', rankingMode: 'TOTAL' } });
      if (url.endsWith('/price')) return json({ pointsPerLife: 20, maxLivesPerOrder: 1000 });
      if (url.endsWith('/birds')) {
        birdReads++;
        return json(birdResponse(total, selected));
      }
      if (url.endsWith('/me/bird')) {
        selected = JSON.parse(init.body).code;
        selections.push(selected);
        return json({ selected });
      }
      if (url.endsWith('/start'))
        return json({
          sessionId: `s-${++sessions}`,
          seed: 1,
          config,
          freePlaysLeft: --free,
          livesLeft: 0,
        });
      if (url.endsWith('/finish')) {
        const score = JSON.parse(init.body).score;
        total += score;
        return json({
          status: 'FINISHED',
          score,
          bestScore: score,
          newlyUnlocked: total >= 150 ? ['goldy_sono'] : ['santa_sono'],
        });
      }
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const service = new ApiMiniappService({ client });
  await service.initialize();
  assert.deepEqual(
    service.birdCatalog.map((bird) => bird.unlockScore),
    [0, 50, 150],
  );
  assert.ok(service.snapshot().owned.includes('pilot'));
  assert.equal(service.snapshot().owned.includes('santa'), false);
  await service.refresh();
  await service.checkConnection();
  assert.equal(birdReads, 1);
  const first = await service.startRun();
  await service.finishRun(first, 50, 'COLLISION');
  assert.equal(birdReads, 2);
  assert.ok(service.snapshot().owned.includes('santa'));
  await service.selectItem('bird', 'santa');
  assert.equal(service.snapshot().selectedBird, 'santa');
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'santa').selected, true);
  const reloaded = new ApiMiniappService({ client });
  await reloaded.initialize();
  assert.equal(reloaded.snapshot().selectedBird, 'santa');
  const second = await reloaded.startRun();
  await reloaded.finishRun(second, 100, 'COLLISION');
  assert.ok(reloaded.snapshot().owned.includes('gold'));
  await reloaded.selectItem('bird', 'gold');
  assert.equal(reloaded.snapshot().selectedBird, 'gold');
  assert.deepEqual(selections, ['santa_sono', 'goldy_sono']);
  tournamentId = 2;
  total = 0;
  await reloaded.refresh();
  assert.equal(reloaded.snapshot().selectedBird, 'pilot');
  assert.equal(reloaded.snapshot().owned.includes('gold'), false);
  await assert.rejects(reloaded.selectItem('bird', 'gold'), /BIRD_LOCKED/);
  await reloaded.refresh();
  assert.equal(reloaded.snapshot().selectedBird, 'pilot');
  assert.equal(birdReads, 5);
});

test('failed bird selection keeps the server choice and lost responses recover it by reading the catalog', async () => {
  let total = 50,
    selected = 'sono',
    mode = 'failed';
  const puts = [];
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/birds')) return json(birdResponse(total, selected));
      const code = JSON.parse(init.body).code;
      puts.push(code);
      if (mode === 'failed') return json({ code: 'INTERNAL_ERROR' }, 500);
      if (mode === 'relocked') {
        total = 0;
        return json({ code: 'BIRD_LOCKED' }, 409);
      }
      selected = code;
      throw new TypeError('selection committed, response lost');
    },
  });
  const service = new ApiMiniappService({ client });
  await service.refreshBirds();
  await assert.rejects(service.selectItem('bird', 'santa'), /INTERNAL_ERROR/);
  assert.equal(service.snapshot().selectedBird, 'pilot');
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'santa').selected, false);
  mode = 'lost';
  await service.selectItem('bird', 'santa');
  assert.equal(service.snapshot().selectedBird, 'santa');
  selected = 'sono';
  await service.refreshBirds();
  mode = 'relocked';
  await assert.rejects(service.selectItem('bird', 'santa'), /BIRD_LOCKED/);
  assert.equal(service.snapshot().selectedBird, 'pilot');
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'santa').unlocked, false);
  assert.deepEqual(puts, ['santa_sono', 'santa_sono', 'santa_sono']);
});

test('catalog errors close Store ownership while core profile and gameplay remain usable', async () => {
  let available = false,
    reads = 0;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url) => {
      if (url.endsWith('/exchange')) return json({ accessToken: 'game-only' });
      if (url.endsWith('/me'))
        return json({
          playerId: 7,
          nickname: 'pilot',
          selectedBird: 'santa_sono',
          freePlaysLeft: 3,
          lives: 0,
          playsLeft: 3,
          bestScore: 50,
          totalScore: 50,
        });
      if (url.endsWith('/tournament')) return json({ current: { id: 1, rankingMode: 'TOTAL' } });
      if (url.endsWith('/price')) return json({ pointsPerLife: 20, maxLivesPerOrder: 1000 });
      if (url.endsWith('/birds')) {
        reads++;
        return available
          ? json(birdResponse(50, 'santa_sono'))
          : json({ code: 'INTERNAL_ERROR' }, 503);
      }
      if (url.endsWith('/start'))
        return json({ sessionId: 's', seed: 1, config, freePlaysLeft: 2, livesLeft: 0 });
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const service = new ApiMiniappService({ client });
  await service.initialize();
  assert.equal(service.birdCatalog, undefined);
  assert.equal(service.snapshot().selectedBird, 'santa');
  assert.equal(service.snapshot().owned.includes('santa'), false);
  await service.refresh();
  await service.checkConnection();
  assert.equal(reads, 1);
  assert.equal(await service.startRun(), 's');
  available = true;
  await service.refreshBirds();
  assert.equal(reads, 2);
  assert.ok(service.snapshot().owned.includes('santa'));
});

test('unknown bird codes preserve metadata and use a safe texture without fabricating ownership', async () => {
  let puts = 0;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url) => {
      if (!url.endsWith('/birds')) puts++;
      return json({
        totalScore: 100,
        selected: 'event_sono',
        birds: [
          {
            code: 'event_sono',
            name: 'Event Sono',
            unlockScore: 0,
            unlocked: true,
            selected: true,
          },
        ],
      });
    },
  });
  const service = new ApiMiniappService({ client });
  await service.refreshBirds();
  assert.equal(service.snapshot().selectedBird, 'pilot');
  assert.equal(service.snapshot().owned.includes('pilot'), false);
  assert.deepEqual(service.birdCatalog, [
    { id: 'server:event_sono', name: 'Event Sono', unlockScore: 0, unlocked: true, selected: true },
  ]);
  await assert.rejects(service.selectItem('bird', 'pilot'), /BIRD_NOT_FOUND/);
  assert.equal(puts, 0);
});

test('an older in-flight bird read cannot restore a previous tournament catalog', async () => {
  let total = 0,
    selected = 'sono',
    tournamentId = 1,
    reads = 0,
    holdNext = false,
    release;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url) => {
      if (url.endsWith('/exchange')) return json({ accessToken: 'game-only' });
      if (url.endsWith('/me'))
        return json({
          nickname: 'pilot',
          selectedBird: selected,
          freePlaysLeft: 3,
          lives: 0,
          playsLeft: 3,
          bestScore: total,
          totalScore: total,
        });
      if (url.endsWith('/tournament'))
        return json({ current: { id: tournamentId, rankingMode: 'TOTAL' } });
      if (url.endsWith('/price')) return json({ pointsPerLife: 20, maxLivesPerOrder: 1000 });
      if (url.endsWith('/birds')) {
        reads++;
        if (holdNext) {
          holdNext = false;
          const old = birdResponse(total, selected);
          return new Promise((resolve) => {
            release = () => resolve(json(old));
          });
        }
        return json(birdResponse(total, selected));
      }
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const service = new ApiMiniappService({ client });
  await service.initialize();
  holdNext = true;
  const stale = service.refreshBirds();
  tournamentId = 2;
  total = 150;
  selected = 'goldy_sono';
  const refresh = service.refresh();
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  await Promise.all([stale, refresh]);
  assert.equal(service.snapshot().total, 150);
  assert.equal(service.snapshot().selectedBird, 'gold');
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'gold').selected, true);
  assert.equal(reads, 3);
});

test('a stored locked bird normalizes both the rendered bird and selected catalog flags', async () => {
  const response = birdResponse(0);
  response.selected = 'goldy_sono';
  response.birds = response.birds.map((bird) => ({
    ...bird,
    selected: bird.code === response.selected,
  }));
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async () => json(response),
  });
  const service = new ApiMiniappService({ client });
  await service.refreshBirds();
  assert.equal(service.snapshot().selectedBird, 'pilot');
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'pilot').selected, true);
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'gold').selected, false);
});

test('a mismatched selection response cannot report the requested activation as successful', async () => {
  let total = 50,
    selected = 'sono';
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url) => {
      if (url.endsWith('/birds')) return json(birdResponse(total, selected));
      selected = 'goldy_sono';
      total = 0;
      return json({ selected });
    },
  });
  const service = new ApiMiniappService({ client });
  await service.refreshBirds();
  await assert.rejects(service.selectItem('bird', 'santa'), /INVALID_RESPONSE/);
  assert.equal(service.snapshot().selectedBird, 'pilot');
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'santa').selected, false);
});

test('an older catalog read cannot undo a confirmed selection', async () => {
  let selected = 'sono',
    holdNext = false,
    release;
  const client = new ApiClient({
    baseUrl: '',
    getLaunchToken: async () => 'launch',
    fetch: async (url, init) => {
      if (url.endsWith('/birds')) {
        const response = birdResponse(50, selected);
        if (holdNext) {
          holdNext = false;
          return new Promise((resolve) => {
            release = () => resolve(json(response));
          });
        }
        return json(response);
      }
      selected = JSON.parse(init.body).code;
      return json({ selected });
    },
  });
  const service = new ApiMiniappService({ client });
  await service.refreshBirds();
  holdNext = true;
  const stale = service.refreshBirds();
  await service.selectItem('bird', 'santa');
  release();
  await stale;
  assert.equal(service.snapshot().selectedBird, 'santa');
  assert.equal(service.birdCatalog.find((bird) => bird.id === 'santa').selected, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUND_HEIGHT_FRACTION,
  layoutFor,
  pipeCenterRange,
  reachableCenterRange,
  resizeOpening,
  responsiveGap,
} from '../src/layout.ts';
for (const [width, height, safe] of [
  [320, 568, { top: 24, bottom: 24 }],
  [390, 844, { top: 54, bottom: 34 }],
  [402, 874, { top: 62, bottom: 34 }],
  [844, 390, { top: 0, bottom: 0 }],
  [1024, 768, { top: 0, bottom: 0 }],
])
  test(`responsive geometry stays inside ${width}x${height}`, () => {
    const l = layoutFor(width, height, safe);
    assert.equal(l.width, width);
    assert.equal(l.height, height);
    assert.ok(l.birdX > 0 && l.birdX < width);
    assert.ok(l.ground > l.safe.top && l.ground < height);
    assert.ok(l.ground <= height * (1 - GROUND_HEIGHT_FRACTION) + 0.01);
    const gap = 185 * l.unit;
    const [min, max] = pipeCenterRange(l, gap);
    assert.ok(min <= max);
    assert.ok(min - gap / 2 >= l.safe.top);
    assert.ok(max + gap / 2 <= l.ground);
    const actualGap = responsiveGap(l, 185, 185);
    assert.ok(actualGap <= gap);
    assert.ok(actualGap <= 0.34 * (l.ground - l.safe.top) + 0.01);
    assert.ok(responsiveGap(l, 170, 185) < actualGap);
  });

test('successive pipe openings retain a reachable safe band on phone viewports', () => {
  for (const [width, height, safe] of [
    [320, 568, { top: 24, bottom: 24 }],
    [390, 844, { top: 54, bottom: 34 }],
    [402, 874, { top: 62, bottom: 34 }],
  ]) {
    const layout = layoutFor(width, height, safe);
    let previous;
    for (let score = 0; score <= 250; score++) {
      const nominalGap = Math.max(140, 185 - Math.floor(score / 25) * 5);
      const gap = responsiveGap(layout, nominalGap, 185);
      const [minimum, maximum] = reachableCenterRange(layout, gap, previous);
      assert.ok(minimum <= maximum);
      const [fullMinimum, fullMaximum] = pipeCenterRange(layout, gap);
      assert.ok(minimum >= fullMinimum && maximum <= fullMaximum);
      const center = score % 2 === 0 ? minimum : maximum;
      const current = { top: center - gap / 2, bottom: center + gap / 2 };
      if (previous) {
        const safeTop = Math.max(previous.top, current.top) + 17 * layout.unit;
        const safeBottom = Math.min(previous.bottom, current.bottom) - 17 * layout.unit;
        assert.ok(safeBottom - safeTop >= 8 * layout.unit - 0.01);
      }
      previous = current;
    }
  }
});

test('normal phone sizes have the same opening relative to the bird', () => {
  const phones = [
    layoutFor(320, 568, { top: 24, bottom: 24 }),
    layoutFor(390, 844, { top: 54, bottom: 34 }),
    layoutFor(402, 874, { top: 62, bottom: 34 }),
  ];
  for (const scoreGap of [185, 175, 140]) {
    const normalized = phones.map((layout) => responsiveGap(layout, scoreGap, 185) / layout.unit);
    assert.ok(Math.max(...normalized) - Math.min(...normalized) < 1);
  }
});

test('resizing a live pipe preserves its gap relative to the bird and ground bounds', () => {
  const portrait = layoutFor(390, 844, { top: 54, bottom: 34 });
  const landscape = layoutFor(480, 390, { top: 0, bottom: 0 });
  const opening = { top: 250, bottom: 400 };
  const resized = resizeOpening(portrait, landscape, opening);
  assert.ok(Math.abs((resized.bottom - resized.top) / landscape.unit - 150) < 0.01);
  assert.ok(resized.top >= landscape.safe.top);
  assert.ok(resized.bottom <= landscape.ground);
  const restored = resizeOpening(landscape, portrait, resized);
  assert.ok(Math.abs(restored.top - opening.top) < 0.01);
  assert.ok(Math.abs(restored.bottom - opening.bottom) < 0.01);
});

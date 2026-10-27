import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ballisticPoint,
  chargeRatio,
  classifyLanding,
  difficultyAt,
  jumpFromCharge,
  makeNextPlatform,
} from '../dist/game-core.js';

test('ballisticPoint uses constant horizontal speed and a parabolic arc', () => {
  const jump = { startX: 10, startY: 200, endX: 110, endY: 220, height: 80 };
  const start = ballisticPoint(jump, 0);
  const quarter = ballisticPoint(jump, 0.25);
  const middle = ballisticPoint(jump, 0.5);
  const threeQuarter = ballisticPoint(jump, 0.75);
  const end = ballisticPoint(jump, 1);

  assert.deepEqual(start, { x: 10, y: 200 });
  assert.deepEqual(end, { x: 110, y: 220 });
  assert.equal(quarter.x - start.x, middle.x - quarter.x);
  assert.equal(threeQuarter.x - middle.x, end.x - threeQuarter.x);
  assert.ok(middle.y < quarter.y && middle.y < threeQuarter.y);

  const ySecondDifference = quarter.y - 2 * middle.y + threeQuarter.y;
  assert.ok(ySecondDifference > 0, 'vertical acceleration should point downward');
});

test('chargeRatio clamps time into the playable range', () => {
  assert.equal(chargeRatio(-50), 0);
  assert.equal(chargeRatio(700), 0.5);
  assert.equal(chargeRatio(5000), 1);
});

test('jumpFromCharge increases distance and keeps a visible arc', () => {
  const shortJump = jumpFromCharge(0.2);
  const longJump = jumpFromCharge(0.9);
  assert.ok(longJump.distance > shortJump.distance);
  assert.ok(shortJump.height >= 34);
  assert.ok(longJump.duration > shortJump.duration);
});

test('classifyLanding distinguishes perfect, safe, edge, and miss', () => {
  const platform = { x: 100, width: 90 };
  assert.equal(classifyLanding(145, platform), 'perfect');
  assert.equal(classifyLanding(120, platform), 'safe');
  assert.equal(classifyLanding(103, platform), 'edge');
  assert.equal(classifyLanding(85, platform), 'miss');
});

test('difficultyAt ramps without exceeding its cap', () => {
  assert.equal(difficultyAt(0), 0);
  assert.ok(difficultyAt(20) > difficultyAt(5));
  assert.equal(difficultyAt(999), 1);
});

test('makeNextPlatform stays reachable and safe during the opening', () => {
  const current = { x: 80, y: 250, width: 96, height: 38 };
  const opening = makeNextPlatform(current, 1, () => 0.5);
  const late = makeNextPlatform(current, 35, () => 0.95);

  assert.ok(opening.x > current.x + current.width);
  assert.ok(opening.width >= 78);
  assert.ok(opening.x - (current.x + current.width) <= 82);
  assert.ok(late.width >= 50 && late.width <= 92);
  assert.ok(late.x - (current.x + current.width) <= 148);
});

test('every generated platform remains reachable from the previous left edge', () => {
  for (const width of [50, 72, 96, 108]) {
    for (const score of [0, 5, 20, 50, 999]) {
      for (const roll of [0, 0.5, 0.999]) {
        const current = { x: 100, y: 250, width, height: 40 };
        const next = makeNextPlatform(current, score, () => roll);
        assert.ok(next.x - current.x <= 178, `width=${width}, score=${score}, roll=${roll}`);
      }
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ballisticPoint,
  chargeRatio,
  classifyLanding,
  jumpFromCharge,
  makeNextPlatform,
} from '../assets/scripts/core/GameMath.ts';

test('chargeRatio clamps charge time', () => {
  assert.equal(chargeRatio(-20), 0);
  assert.equal(chargeRatio(700), 0.5);
  assert.equal(chargeRatio(2000), 1);
});

test('ballisticPoint has constant horizontal speed and parabolic height', () => {
  const jump = { startX: 0, startY: 0, endX: 100, endY: 20, height: 80 };
  const q1 = ballisticPoint(jump, 0.25);
  const mid = ballisticPoint(jump, 0.5);
  const q3 = ballisticPoint(jump, 0.75);
  assert.equal(q1.x, 25);
  assert.equal(mid.x, 50);
  assert.equal(q3.x, 75);
  assert.ok(mid.y > q1.y && mid.y > q3.y);
  assert.deepEqual(ballisticPoint(jump, 0), { x: 0, y: 0 });
  assert.deepEqual(ballisticPoint(jump, 1), { x: 100, y: 20 });
});

test('jump power grows without exceeding the cap', () => {
  const weak = jumpFromCharge(0);
  const strong = jumpFromCharge(1);
  assert.ok(strong.distance > weak.distance);
  assert.ok(strong.height > weak.height);
  assert.deepEqual(jumpFromCharge(2), strong);
});

test('landing detects perfect, safe, edge and miss', () => {
  const platform = { x: 100, y: 0, width: 100, height: 40, hue: 190 };
  assert.equal(classifyLanding(150, platform), 'perfect');
  assert.equal(classifyLanding(130, platform), 'safe');
  assert.equal(classifyLanding(105, platform), 'edge');
  assert.equal(classifyLanding(210, platform), 'miss');
});

test('opening platforms remain broad and reachable', () => {
  const random = () => 0.5;
  const next = makeNextPlatform({ x: 80, y: 0, width: 108, height: 54, hue: 186 }, 0, random);
  assert.ok(next.width >= 78);
  assert.ok(next.x - 188 <= 82);
  assert.ok(Math.abs(next.y) <= 18);
});

test('later platforms introduce platform types and hazards deterministically', () => {
  const values = [0.4, 0.5, 0.5, 0.3, 0.2, 0.92, 0.2];
  let index = 0;
  const next = makeNextPlatform(
    { x: 200, y: 0, width: 80, height: 40, hue: 190 },
    12,
    () => values[index++ % values.length],
  );
  assert.equal(next.kind, 'bounce');
  assert.equal(next.hasHazard, false);

  const hazardValues = [0.4, 0.5, 0.5, 0.3, 0.2, 0.2, 0.2, 0.5];
  index = 0;
  const hazard = makeNextPlatform(
    { x: 200, y: 0, width: 80, height: 40, hue: 190 },
    12,
    () => hazardValues[index++ % hazardValues.length],
  );
  assert.equal(hazard.kind, 'normal');
  assert.equal(hazard.hasHazard, true);
});

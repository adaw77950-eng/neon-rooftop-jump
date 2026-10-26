export const MAX_CHARGE_MS = 1400;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function chargeRatio(milliseconds, maximum = MAX_CHARGE_MS) {
  return clamp(milliseconds / maximum, 0, 1);
}

export function easeOutCubic(value) {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

export function jumpFromCharge(ratio) {
  const charged = easeOutCubic(ratio);
  return {
    distance: 34 + charged * 154,
    height: 34 + charged * 58,
    duration: 0.42 + charged * 0.32,
  };
}

export function ballisticPoint(jump, progress) {
  const t = clamp(progress, 0, 1);
  const x = jump.startX + (jump.endX - jump.startX) * t;
  const baselineY = jump.startY + (jump.endY - jump.startY) * t;
  const y = baselineY - 4 * jump.height * t * (1 - t);
  return { x, y };
}

export function classifyLanding(playerCenterX, platform) {
  const left = platform.x;
  const right = platform.x + platform.width;
  if (playerCenterX < left || playerCenterX > right) return 'miss';

  const center = left + platform.width / 2;
  const centerDistance = Math.abs(playerCenterX - center);
  if (centerDistance <= platform.width * 0.14) return 'perfect';

  const edgeBand = Math.max(7, platform.width * 0.11);
  if (playerCenterX - left <= edgeBand || right - playerCenterX <= edgeBand) {
    return 'edge';
  }
  return 'safe';
}

export function difficultyAt(score) {
  return clamp(score / 32, 0, 1);
}

export function makeNextPlatform(current, score, random = Math.random) {
  const opening = score < 3;
  const difficulty = difficultyAt(score);
  const width = opening
    ? 78 + random() * 18
    : 92 - difficulty * 34 - random() * 8;
  const gap = opening
    ? 54 + random() * 28
    : 66 + difficulty * 58 + random() * 24;
  const verticalRange = opening ? 18 : 24 + difficulty * 24;
  const yDelta = (random() * 2 - 1) * verticalRange;

  return {
    x: current.x + current.width + gap,
    y: clamp(current.y + yDelta, 148, 310),
    width: clamp(width, 50, 96),
    height: 34 + Math.round(random() * 18),
    hue: 176 + Math.round(random() * 130),
  };
}

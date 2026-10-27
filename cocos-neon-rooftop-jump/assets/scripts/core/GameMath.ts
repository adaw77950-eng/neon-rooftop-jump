export const MAX_CHARGE_MS = 1400;

export interface PlatformData {
  x: number;
  y: number;
  width: number;
  height: number;
  hue: number;
  kind?: 'normal' | 'moving' | 'fragile' | 'bounce';
  hasHazard?: boolean;
  baseY?: number;
  phase?: number;
}

export interface JumpPath {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  height: number;
}

export type LandingKind = 'perfect' | 'safe' | 'edge' | 'miss';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function chargeRatio(milliseconds: number, maximum = MAX_CHARGE_MS): number {
  return clamp(milliseconds / maximum, 0, 1);
}

export function easeOutCubic(value: number): number {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

export function jumpFromCharge(ratio: number): { distance: number; height: number; duration: number } {
  const charged = easeOutCubic(ratio);
  return {
    distance: 34 + charged * 154,
    height: 34 + charged * 58,
    duration: 0.42 + charged * 0.32,
  };
}

export function ballisticPoint(jump: JumpPath, progress: number): { x: number; y: number } {
  const t = clamp(progress, 0, 1);
  const x = jump.startX + (jump.endX - jump.startX) * t;
  const baselineY = jump.startY + (jump.endY - jump.startY) * t;
  const y = baselineY + 4 * jump.height * t * (1 - t);
  return { x, y };
}

export function classifyLanding(playerCenterX: number, platform: PlatformData): LandingKind {
  const left = platform.x;
  const right = platform.x + platform.width;
  if (playerCenterX < left || playerCenterX > right) return 'miss';

  const center = left + platform.width / 2;
  if (Math.abs(playerCenterX - center) <= platform.width * 0.14) return 'perfect';

  const edgeBand = Math.max(7, platform.width * 0.11);
  if (playerCenterX - left <= edgeBand || right - playerCenterX <= edgeBand) return 'edge';
  return 'safe';
}

export function difficultyAt(score: number): number {
  return clamp(score / 32, 0, 1);
}

export function makeNextPlatform(
  current: PlatformData,
  score: number,
  random: () => number = Math.random,
): PlatformData {
  const opening = score < 3;
  const difficulty = difficultyAt(score);
  const width = opening ? 78 + random() * 18 : 92 - difficulty * 34 - random() * 8;
  const gap = opening ? 54 + random() * 28 : 66 + difficulty * 58 + random() * 24;
  const verticalRange = opening ? 18 : 24 + difficulty * 24;
  const yDelta = (random() * 2 - 1) * verticalRange;

  const height = 34 + Math.round(random() * 18);
  const hue = 176 + Math.round(random() * 130);
  const kindRoll = opening ? 0 : random();
  const hazardRoll = opening ? 1 : random();
  const kind: PlatformData['kind'] = kindRoll > 0.82
    ? 'bounce'
    : kindRoll > 0.62
      ? 'fragile'
      : kindRoll > 0.38
        ? 'moving'
        : 'normal';
  const y = clamp(current.y + yDelta, -90, 100);

  return {
    x: current.x + current.width + gap,
    y,
    width: clamp(width, 50, 96),
    height,
    hue,
    kind,
    hasHazard: score >= 5 && hazardRoll < 0.32 && kind !== 'bounce',
    baseY: y,
    phase: random() * Math.PI * 2,
  };
}

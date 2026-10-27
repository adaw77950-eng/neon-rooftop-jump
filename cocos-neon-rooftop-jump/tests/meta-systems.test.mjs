import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_TARGET,
  SKINS,
  advanceTasks,
  createTaskState,
  dailyKey,
  dailySeed,
  purchaseSkin,
  normalizeSkinState,
  normalizeTaskState,
  resolveDailyCompletion,
  seededRandom,
} from '../assets/scripts/core/MetaSystems.ts';

test('daily challenge keeps the same seed for the same calendar day', () => {
  const key = dailyKey(new Date('2026-10-26T12:00:00+08:00'));
  assert.equal(key, '2026-10-26');
  assert.equal(dailySeed(key), dailySeed(key));
  assert.notEqual(dailySeed(key), dailySeed('2026-10-27'));
  const a = seededRandom(dailySeed(key));
  const b = seededRandom(dailySeed(key));
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.equal(DAILY_TARGET, 12);
});

test('daily challenge completes on replay without paying twice', () => {
  const first = resolveDailyCompletion(12, '', '2026-10-27');
  assert.equal(first.reward, 80);
  const replay = resolveDailyCompletion(12, first.completedKey, '2026-10-27');
  assert.equal(replay.complete, true);
  assert.equal(replay.reward, 0);
});

test('task progress pays each reward only once', () => {
  const initial = createTaskState();
  const first = advanceTasks(initial, { jumps: 10, perfects: 3, bestScore: 15 });
  assert.equal(first.coinsEarned, 180);
  const second = advanceTasks(first.state, { jumps: 1, perfects: 1, bestScore: 20 });
  assert.equal(second.coinsEarned, 0);
});

test('skins require coins and stay permanently unlocked', () => {
  const locked = purchaseSkin({ coins: 20, unlocked: ['courier'], equipped: 'courier' }, 'magenta');
  assert.equal(locked.ok, false);
  const bought = purchaseSkin({ coins: 200, unlocked: ['courier'], equipped: 'courier' }, 'magenta');
  assert.equal(bought.ok, true);
  assert.equal(bought.state.coins, 80);
  assert.ok(bought.state.unlocked.includes('magenta'));
  const equipped = purchaseSkin(bought.state, 'magenta');
  assert.equal(equipped.state.coins, 80);
  assert.equal(equipped.state.equipped, 'magenta');
  assert.equal(SKINS.length, 4);
  assert.notEqual(SKINS[0].shape, SKINS[1].shape);
  assert.notEqual(SKINS[0].accent, SKINS[1].accent);
});

test('legacy save corruption is normalized', () => {
  assert.deepEqual(normalizeTaskState({ jumps: '4', perfects: -9, claimed: null }), { jumps: 4, perfects: 0, bestScore: 0, claimed: [] });
  assert.deepEqual(normalizeSkinState({ coins: 'oops', unlocked: 'cyan', equipped: 'cyan' }), { coins: 0, unlocked: ['courier'], equipped: 'courier' });
});

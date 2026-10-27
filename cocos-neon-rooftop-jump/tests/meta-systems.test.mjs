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
});

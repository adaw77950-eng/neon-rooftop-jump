import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_TARGET, SKINS, advanceTasks, createTaskState, dailyKey, dailySeed, purchaseSkin, seededRandom } from '../dist/meta-systems.js';

test('daily challenge is deterministic for one day', () => {
  const key = dailyKey(new Date('2026-10-26T12:00:00+08:00'));
  const a = seededRandom(dailySeed(key));
  const b = seededRandom(dailySeed(key));
  assert.equal(key, '2026-10-26');
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.equal(DAILY_TARGET, 12);
});

test('tasks reward only once', () => {
  const first = advanceTasks(createTaskState(), { jumps: 10, perfects: 3, bestScore: 15 });
  assert.equal(first.coinsEarned, 180);
  assert.equal(advanceTasks(first.state, { jumps: 2, perfects: 1, bestScore: 20 }).coinsEarned, 0);
});

test('skins use coins, unlock permanently, and equip', () => {
  const bought = purchaseSkin({ coins: 200, unlocked: ['courier'], equipped: 'courier' }, 'magenta');
  assert.equal(bought.ok, true);
  assert.equal(bought.state.coins, 80);
  assert.ok(bought.state.unlocked.includes('magenta'));
  assert.equal(purchaseSkin(bought.state, 'magenta').state.coins, 80);
  assert.equal(SKINS.length, 4);
});

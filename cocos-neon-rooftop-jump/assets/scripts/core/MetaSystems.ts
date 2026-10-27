export const DAILY_TARGET = 12;
export const DAILY_REWARD = 80;

export interface TaskState {
  jumps: number;
  perfects: number;
  bestScore: number;
  claimed: string[];
}

export interface SkinState {
  coins: number;
  unlocked: string[];
  equipped: string;
}

export interface SkinDefinition {
  id: string;
  name: string;
  price: number;
  body: string;
  accent: string;
}

export const TASKS = [
  { id: 'jump10', label: '完成 10 次跳跃', field: 'jumps' as const, target: 10, reward: 50 },
  { id: 'perfect3', label: '累计 3 次完美落地', field: 'perfects' as const, target: 3, reward: 50 },
  { id: 'score15', label: '单局达到 15 分', field: 'bestScore' as const, target: 15, reward: 80 },
];

export const SKINS: SkinDefinition[] = [
  { id: 'courier', name: '夜班信使', price: 0, body: '#18203b', accent: '#ff4fa3' },
  { id: 'magenta', name: '故障玫红', price: 120, body: '#4b265e', accent: '#ff4fa3' },
  { id: 'gold', name: '黄金脉冲', price: 260, body: '#4a391b', accent: '#ffd05a' },
  { id: 'cyan', name: '量子青蓝', price: 420, body: '#153f46', accent: '#58f6e7' },
];

export function dailyKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailySeed(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveDailyCompletion(
  progress: number,
  completedKey: string,
  key = dailyKey(),
): { complete: boolean; reward: number; completedKey: string } {
  const complete = progress >= DAILY_TARGET;
  return {
    complete,
    reward: complete && completedKey !== key ? DAILY_REWARD : 0,
    completedKey: complete ? key : completedKey,
  };
}

export function createTaskState(): TaskState {
  return { jumps: 0, perfects: 0, bestScore: 0, claimed: [] };
}

export function advanceTasks(
  current: TaskState,
  progress: { jumps?: number; perfects?: number; bestScore?: number },
): { state: TaskState; coinsEarned: number; completed: string[] } {
  const state: TaskState = {
    jumps: current.jumps + (progress.jumps ?? 0),
    perfects: current.perfects + (progress.perfects ?? 0),
    bestScore: Math.max(current.bestScore, progress.bestScore ?? 0),
    claimed: [...current.claimed],
  };
  const completed: string[] = [];
  let coinsEarned = 0;
  for (const task of TASKS) {
    if (state[task.field] < task.target || state.claimed.includes(task.id)) continue;
    state.claimed.push(task.id);
    completed.push(task.id);
    coinsEarned += task.reward;
  }
  return { state, coinsEarned, completed };
}

export function purchaseSkin(state: SkinState, skinId: string): { ok: boolean; state: SkinState } {
  const skin = SKINS.find((item) => item.id === skinId);
  if (!skin) return { ok: false, state };
  if (state.unlocked.includes(skinId)) return { ok: true, state: { ...state, equipped: skinId } };
  if (state.coins < skin.price) return { ok: false, state };
  return {
    ok: true,
    state: {
      coins: state.coins - skin.price,
      unlocked: [...state.unlocked, skinId],
      equipped: skinId,
    },
  };
}

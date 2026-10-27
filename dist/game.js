import {
  MAX_CHARGE_MS,
  ballisticPoint,
  chargeRatio,
  classifyLanding,
  jumpFromCharge,
  makeNextPlatform,
} from './game-core.js';
import { DAILY_REWARD, DAILY_TARGET, SKINS, TASKS, advanceTasks, createTaskState, dailyKey, dailySeed, purchaseSkin, resolveDailyCompletion, seededRandom } from './meta-systems.js';

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const ui = {
  startPanel: document.querySelector('#startPanel'),
  gameOverPanel: document.querySelector('#gameOverPanel'),
  startButton: document.querySelector('#startButton'),
  dailyButton: document.querySelector('#dailyButton'),
  skinsButton: document.querySelector('#skinsButton'),
  skinsPanel: document.querySelector('#skinsPanel'),
  closeSkinsButton: document.querySelector('#closeSkinsButton'),
  skinGrid: document.querySelector('#skinGrid'),
  shopMessage: document.querySelector('#shopMessage'),
  coinCount: document.querySelector('#coinCount'),
  shopCoinCount: document.querySelector('#shopCoinCount'),
  dailyStatus: document.querySelector('#dailyStatus'),
  taskList: document.querySelector('#taskList'),
  restartButton: document.querySelector('#restartButton'),
  menuButton: document.querySelector('#menuButton'),
  muteButton: document.querySelector('#muteButton'),
  finalScore: document.querySelector('#finalScore'),
  bestScore: document.querySelector('#bestScore'),
  recordMessage: document.querySelector('#recordMessage'),
  gameOverEyebrow: document.querySelector('#gameOverEyebrow'),
  gameOverTitle: document.querySelector('#gameOverTitle'),
  tutorial: document.querySelector('#tutorial'),
  deviceHint: document.querySelector('#deviceHint'),
};

const W = canvas.width;
const H = canvas.height;
const PLAYER_HALF = 9;
const SAVE_KEY = 'neon-rooftop-jump:v1';
const colors = {
  skyTop: '#090a20', skyBottom: '#1a1640', cyan: '#58f6e7', pink: '#ff4fa3',
  amber: '#ffd05a', paper: '#e9fff7', ink: '#080915', blue: '#5573ff',
};

let mode = 'menu';
let action = 'idle';
let score = 0;
let combo = 0;
let best = loadSave().best;
let currentPlatform = 0;
let platforms = [];
let player = { x: 0, y: 0, vy: 0, squash: 0, trail: [] };
let cameraX = 0;
let cameraTarget = 0;
let chargeStartedAt = 0;
let charge = 0;
let activePointer = null;
let jump = null;
let lastTime = performance.now();
let elapsed = 0;
let muted = loadSave().muted;
let audio = null;
let particles = [];
let floaters = [];
let rain = makeRain();
let screenShake = 0;
let firstRun = !loadSave().played;
let uiBusy = false;
let dailyMode = false;
let dailyWon = false;
let dailyRewardEarned = 0;
let runRandom = Math.random;
let fragileTimer = 0;
let taskState = loadSave().taskState;
let skinState = loadSave().skinState;
let dailyCompleted = loadSave().dailyCompleted;

function loadSave() {
  const defaults = { best: 0, muted: false, played: false, dailyCompleted: '', taskState: createTaskState(), skinState: { coins: 0, unlocked: ['courier'], equipped: 'courier' } };
  try {
    const saved = { ...defaults, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
    saved.taskState = { ...createTaskState(), ...(saved.taskState || {}) };
    saved.skinState = { ...defaults.skinState, ...(saved.skinState || {}) };
    return saved;
  } catch { return defaults; }
}

function persist(extra = {}) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best, muted, played: true, dailyCompleted, taskState, skinState, ...extra }));
  } catch {
    // 部分手机浏览器会限制 file:// 页面的本地存储；不影响离线游玩。
  }
}

function resetGame(isDaily = false) {
  dailyMode = isDaily;
  dailyWon = false;
  dailyRewardEarned = 0;
  runRandom = isDaily ? seededRandom(dailySeed(dailyKey())) : Math.random;
  score = 0;
  combo = 0;
  action = 'idle';
  charge = 0;
  activePointer = null;
  particles = [];
  floaters = [];
  screenShake = 0;
  fragileTimer = 0;
  const first = { x: 80, y: 440, width: 108, height: 54, hue: 186, kind: 'normal', baseY: 440 };
  platforms = [first];
  for (let i = 1; i < 7; i += 1) platforms.push(makeNextPlatform(platforms[i - 1], i - 1, runRandom));
  currentPlatform = 0;
  player = { x: first.x + first.width / 2, y: first.y, vy: 0, squash: 0, trail: [] };
  cameraX = 0;
  cameraTarget = 0;
  mode = 'playing';
  jump = null;
  ui.startPanel.hidden = true;
  ui.gameOverPanel.hidden = true;
  ui.skinsPanel.hidden = true;
  ui.tutorial.hidden = !firstRun;
  persist();
}

function applyTaskProgress(progress) {
  const result = advanceTasks(taskState, progress);
  taskState = result.state;
  skinState.coins += result.coinsEarned;
  if (result.coinsEarned) floaters.push({ x: player.x, y: player.y - 70, text: `任务 +${result.coinsEarned}币`, life: 1.5, color: colors.amber });
  persist();
  renderMetaUi();
}

function beginCharge(pointerId) {
  if (mode !== 'playing' || action !== 'idle') return;
  ensureAudio();
  activePointer = pointerId;
  chargeStartedAt = performance.now();
  charge = 0;
  action = 'charging';
  ui.tutorial.hidden = true;
  firstRun = false;
  tone(160, .025, 'square', .025);
}

function dismissStartPanel() {
  if (!ui.startPanel) return;
  ui.startPanel.classList.add('is-dismissed');
  ui.startPanel.hidden = true;
  ui.startPanel.setAttribute('inert', '');
}

function showMenu() {
  mode = 'menu';
  action = 'idle';
  ui.gameOverPanel.hidden = true;
  ui.skinsPanel.hidden = true;
  ui.startPanel.classList.remove('is-dismissed');
  ui.startPanel.hidden = false;
  ui.startPanel.removeAttribute('inert');
  renderMetaUi();
}

function cancelCharge() {
  if (action !== 'charging') return;
  action = 'idle';
  charge = 0;
  activePointer = null;
  player.squash = 0;
}

function releaseCharge(pointerId) {
  if (mode !== 'playing' || action !== 'charging') return;
  if (activePointer !== null && pointerId !== activePointer) return;
  charge = chargeRatio(performance.now() - chargeStartedAt);
  const physics = jumpFromCharge(charge);
  if (platforms[currentPlatform]?.kind === 'bounce') {
    physics.distance *= 1.12;
    physics.height *= 1.28;
  }
  const target = platforms[currentPlatform + 1];
  jump = {
    startedAt: performance.now(),
    duration: physics.duration * 1000,
    startX: player.x,
    startY: player.y,
    endX: player.x + physics.distance,
    endY: target?.y ?? player.y + 20,
    height: physics.height,
    target,
  };
  action = 'jumping';
  activePointer = null;
  player.squash = 0;
  applyTaskProgress({ jumps: 1 });
  tone(260 + charge * 210, .08, 'square', .04);
}

function update(dt, now) {
  elapsed += dt;
  cameraX += (cameraTarget - cameraX) * Math.min(1, dt * 4.8);
  screenShake = Math.max(0, screenShake - dt * 18);
  for (let i = currentPlatform + 1; i < platforms.length; i += 1) {
    const p = platforms[i];
    if (p.kind === 'moving' && p !== jump?.target) p.y = (p.baseY ?? p.y) + Math.sin(elapsed * 1.8 + (p.phase ?? 0)) * 18;
  }

  if (mode === 'playing') {
    if (action === 'charging') {
      charge = chargeRatio(now - chargeStartedAt);
      player.squash = Math.sin(charge * Math.PI * .5) * 8;
      if (Math.floor((now - chargeStartedAt) / 130) !== Math.floor((now - chargeStartedAt - dt * 1000) / 130)) {
        tone(150 + charge * 330, .02, 'square', .012);
      }
    } else if (action === 'jumping' && jump) {
      const t = Math.min(1, (now - jump.startedAt) / jump.duration);
      const point = ballisticPoint(jump, t);
      player.x = point.x;
      player.y = point.y;
      player.trail.push({ x: player.x, y: player.y - 10, life: 1 });
      if (player.trail.length > 14) player.trail.shift();
      if (t >= 1) resolveLanding();
    } else if (action === 'falling') {
      player.vy += 520 * dt;
      player.y += player.vy * dt;
      player.x += 22 * dt;
      if (player.y - platforms[currentPlatform].y > H * .7) finishGame();
    } else if (action === 'idle' && fragileTimer > 0) {
      fragileTimer -= dt;
      if (fragileTimer <= 0) { action = 'falling'; player.vy = 42; }
    }
  }

  for (const p of player.trail) p.life -= dt * 3.2;
  player.trail = player.trail.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt; p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const f of floaters) { f.y -= 24 * dt; f.life -= dt; }
  floaters = floaters.filter((f) => f.life > 0);
  for (const r of rain) {
    r.x -= 55 * dt; r.y += r.speed * dt;
    if (r.y > H + 10) { r.y = -10; r.x = Math.random() * W; }
    if (r.x < -10) r.x = W + 10;
  }
}

function resolveLanding() {
  const target = jump.target;
  const landing = target ? classifyLanding(player.x, target) : 'miss';
  const hazardHit = target?.hasHazard && Math.abs(player.x - (target.x + target.width / 2)) < Math.min(17, target.width * .18);
  if (landing === 'miss' || hazardHit) {
    action = 'falling';
    player.vy = 42;
    combo = 0;
    tone(92, .28, 'sawtooth', .05);
    return;
  }

  player.y = target.y;
  currentPlatform += 1;
  score += 1;
  const perfect = landing === 'perfect';
  if (perfect) {
    combo += 1;
    const bonus = Math.min(combo, 5);
    score += bonus;
    floaters.push({ x: player.x, y: player.y - 50, text: `完美 +${bonus}`, life: 1.1, color: colors.amber });
    burst(player.x, player.y - 4, colors.amber, 16);
    tone(660 + combo * 35, .12, 'square', .05);
    applyTaskProgress({ perfects: 1 });
  } else {
    combo = 0;
    floaters.push({ x: player.x, y: player.y - 46, text: landing === 'edge' ? '惊险!' : '+1', life: .8, color: landing === 'edge' ? colors.pink : colors.cyan });
    burst(player.x, player.y - 2, colors.cyan, 8);
    tone(430, .06, 'square', .035);
  }
  screenShake = landing === 'edge' ? 4 : 2;
  player.squash = 6;
  setTimeout(() => { if (action === 'idle') player.squash = 0; }, 120);
  action = 'idle';
  fragileTimer = target.kind === 'fragile' ? .85 : 0;
  jump = null;
  cameraTarget = Math.max(0, target.x - 120);
  while (platforms.length < currentPlatform + 7) {
    platforms.push(makeNextPlatform(platforms.at(-1), score, runRandom));
  }
  const dailyResult = resolveDailyCompletion(currentPlatform, dailyCompleted);
  if (dailyMode && dailyResult.complete) {
    dailyWon = true;
    dailyRewardEarned = dailyResult.reward;
    dailyCompleted = dailyResult.completedKey;
    skinState.coins += dailyResult.reward;
    persist();
    renderMetaUi();
    finishGame();
  }
}

function finishGame() {
  mode = 'gameover';
  action = 'idle';
  const previousBest = best;
  best = Math.max(best, score);
  applyTaskProgress({ bestScore: score });
  ui.finalScore.textContent = String(score);
  ui.bestScore.textContent = String(best);
  ui.gameOverEyebrow.textContent = dailyWon ? 'DAILY COMPLETE' : 'SIGNAL LOST';
  ui.gameOverTitle.textContent = dailyWon ? '挑战完成' : '坠入暗巷';
  ui.recordMessage.textContent = dailyWon
    ? dailyRewardEarned ? `今日首次通关 +${dailyRewardEarned} 像素币` : '今日挑战完成 · 奖励已领取'
    : score > previousBest && score > 0 ? 'NEW NIGHT RECORD // 新纪录' : combo >= 3 ? `最高连续完美 ${combo}` : '';
  ui.gameOverPanel.hidden = false;
}

function draw() {
  ctx.save();
  if (screenShake > 0) ctx.translate(Math.round((Math.random() - .5) * screenShake), Math.round((Math.random() - .5) * screenShake));
  drawSky();
  drawCity();
  drawRain();
  drawPlatforms();
  drawTrail();
  drawPlayer();
  drawParticles();
  if (mode === 'playing') drawHud();
  ctx.restore();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, colors.skyTop);
  gradient.addColorStop(.6, colors.skyBottom);
  gradient.addColorStop(1, '#101126');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(88,246,231,.05)';
  for (let y = 44; y < H; y += 44) ctx.fillRect(0, y, W, 1);
  for (let x = 0; x < W; x += 48) ctx.fillRect(x, 0, 1, H);
}

function drawCity() {
  const parallax = cameraX * .18;
  for (let i = -2; i < 11; i += 1) {
    const x = Math.round(i * 62 - (parallax % 62));
    const height = 90 + ((i * 37) % 115 + 115) % 115;
    const y = H - 118 - height;
    ctx.fillStyle = i % 2 ? '#10142d' : '#131733';
    ctx.fillRect(x, y, 52, height + 120);
    ctx.fillStyle = i % 3 ? '#34405e' : '#4e2f59';
    ctx.fillRect(x + 4, y - 4, 44, 4);
    for (let wy = y + 14; wy < H - 125; wy += 18) {
      for (let wx = x + 8; wx < x + 46; wx += 14) {
        const on = ((wx + wy + i * 9) % 5) < 2;
        ctx.fillStyle = on ? 'rgba(255,208,90,.52)' : 'rgba(55,70,100,.35)';
        ctx.fillRect(wx, wy, 5, 7);
      }
    }
  }
  ctx.fillStyle = '#080916';
  ctx.fillRect(0, H - 120, W, 120);
  ctx.fillStyle = colors.pink;
  ctx.fillRect(24, H - 106, 52, 4);
  ctx.fillStyle = colors.cyan;
  ctx.fillRect(W - 90, H - 82, 64, 3);
}

function worldToScreenX(x) { return Math.round(x - cameraX); }

function drawPlatforms() {
  for (let i = Math.max(0, currentPlatform - 2); i < platforms.length; i += 1) {
    const p = platforms[i];
    const x = worldToScreenX(p.x);
    if (x > W + 80 || x + p.width < -80) continue;
    const hue = p.hue ?? 190;
    const glow = i === currentPlatform + 1;
    ctx.save();
    if (glow) { ctx.shadowColor = `hsl(${hue} 90% 64%)`; ctx.shadowBlur = 12; }
    ctx.fillStyle = p.kind === 'bounce' ? colors.amber : p.kind === 'fragile' ? '#ff8469' : p.kind === 'moving' ? colors.blue : `hsl(${hue} 48% 46%)`;
    ctx.fillRect(x, p.y - 8, Math.round(p.width), 8);
    ctx.fillStyle = `hsl(${hue} 35% 27%)`;
    ctx.fillRect(x, p.y, Math.round(p.width), p.height);
    ctx.fillStyle = `hsl(${hue} 30% 18%)`;
    ctx.fillRect(x + 7, p.y + 8, Math.round(p.width - 14), p.height - 8);
    ctx.fillStyle = `hsl(${hue} 70% 65%)`;
    ctx.fillRect(x + 8, p.y + 12, Math.max(8, Math.round(p.width * .22)), 4);
    ctx.fillStyle = '#080915';
    for (let wx = x + 10; wx < x + p.width - 8; wx += 18) ctx.fillRect(wx, p.y + p.height - 11, 7, 5);
    if (p.kind === 'fragile') {
      ctx.strokeStyle = '#ffbea0'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x + p.width * .35, p.y); ctx.lineTo(x + p.width * .5, p.y + 16); ctx.lineTo(x + p.width * .62, p.y + 7); ctx.stroke();
    }
    if (p.kind === 'bounce') {
      ctx.strokeStyle = colors.amber; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x + 10, p.y + 12); ctx.lineTo(x + 20, p.y); ctx.lineTo(x + 30, p.y + 12); ctx.lineTo(x + 40, p.y); ctx.stroke();
    }
    if (p.hasHazard) {
      const center = x + p.width / 2;
      ctx.strokeStyle = colors.cyan; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(center - 16, p.y - 8); ctx.lineTo(center - 8, p.y - 20); ctx.lineTo(center, p.y - 8); ctx.lineTo(center + 8, p.y - 20); ctx.lineTo(center + 16, p.y - 8); ctx.stroke();
    }
    if (glow) {
      ctx.globalAlpha = .55 + Math.sin(elapsed * 4) * .2;
      ctx.strokeStyle = `hsl(${hue} 90% 70%)`;
      ctx.strokeRect(x - 2, p.y - 10, Math.round(p.width + 4), p.height + 12);
    }
    ctx.restore();
  }
}

function drawPlayer() {
  if (mode === 'menu' && platforms.length === 0) return;
  const x = worldToScreenX(player.x);
  const y = Math.round(player.y);
  const squash = Math.round(player.squash);
  ctx.save();
  ctx.translate(x, y);
  if (action === 'jumping') ctx.rotate(Math.sin((performance.now() - jump.startedAt) / jump.duration * Math.PI * 2) * .18);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(-13, 2, 26, 5);
  const skin = SKINS.find((item) => item.id === skinState.equipped) || SKINS[0];
  ctx.fillStyle = skin.body;
  ctx.fillRect(-8, -33 + squash, 16, 27 - squash);
  ctx.fillStyle = skin.accent;
  ctx.fillRect(-8, -28 + squash, 4, 17 - squash);
  ctx.fillStyle = '#2c3f70';
  ctx.fillRect(-10, -31 + squash, 4, 21 - squash);
  ctx.fillStyle = '#ffd7ba';
  ctx.fillRect(-7, -43 + squash, 14, 12);
  ctx.fillStyle = '#13172c';
  ctx.fillRect(-8, -46 + squash, 16, 6);
  ctx.fillRect(-9, -42 + squash, 4, 8);
  ctx.fillStyle = colors.cyan;
  ctx.fillRect(2, -39 + squash, 4, 3);
  ctx.fillStyle = '#050611';
  ctx.fillRect(-7, -7, 6, 7);
  ctx.fillRect(2, -7, 6, 7);
  ctx.restore();
}

function drawTrail() {
  for (const p of player.trail) {
    ctx.globalAlpha = p.life * .45;
    ctx.fillStyle = colors.pink;
    ctx.fillRect(worldToScreenX(p.x) - 4, p.y, 8, 3);
  }
  ctx.globalAlpha = 1;
}

function drawRain() {
  ctx.strokeStyle = 'rgba(110,180,255,.17)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const r of rain) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 4, r.y + 10); }
  ctx.stroke();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(worldToScreenX(p.x), p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = '#050611';
    ctx.fillText(f.text, worldToScreenX(f.x) + 2, f.y + 2);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, worldToScreenX(f.x), f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(7,9,23,.78)';
  ctx.fillRect(16, 18, 132, 54);
  ctx.fillStyle = colors.cyan;
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillText('SIGNAL SCORE', 26, 35);
  ctx.fillStyle = colors.paper;
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillText(String(score).padStart(3, '0'), 24, 62);

  ctx.textAlign = 'right';
  ctx.fillStyle = colors.amber;
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillText(dailyMode ? `DAILY ${Math.min(currentPlatform, DAILY_TARGET)}/${DAILY_TARGET}` : `COINS ${skinState.coins}`, W - 20, 22);

  if (combo > 1) {
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.amber;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(`PERFECT x${combo}`, W - 20, 36);
  }

  if (action === 'charging') {
    const barW = 220;
    const x = (W - barW) / 2;
    const y = H - 66;
    ctx.fillStyle = 'rgba(7,9,23,.88)';
    ctx.fillRect(x - 8, y - 19, barW + 16, 38);
    ctx.fillStyle = '#25314c';
    ctx.fillRect(x, y, barW, 8);
    ctx.fillStyle = charge > .86 ? colors.pink : colors.cyan;
    ctx.fillRect(x, y, Math.round(barW * charge), 8);
    ctx.fillStyle = colors.paper;
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(charge >= 1 ? 'MAX POWER / 松开!' : 'CHARGING', W / 2, y - 7);
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 38 + Math.random() * 74;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 42, life: .45 + Math.random() * .45, size: 2 + Math.floor(Math.random() * 3), color });
  }
}

function makeRain() {
  return Array.from({ length: 42 }, () => ({ x: Math.random() * W, y: Math.random() * H, speed: 170 + Math.random() * 160 }));
}

function ensureAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
}

function tone(frequency, duration, type = 'square', gainValue = .03) {
  if (muted) return;
  ensureAudio();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(gainValue, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function renderMetaUi() {
  ui.coinCount.textContent = String(skinState.coins);
  ui.shopCoinCount.textContent = String(skinState.coins);
  ui.dailyStatus.textContent = dailyCompleted === dailyKey() ? '今日已完成' : `${DAILY_TARGET} 跳 / +${DAILY_REWARD}币`;
  ui.taskList.innerHTML = TASKS.map((task) => {
    const value = Math.min(taskState[task.field], task.target);
    const done = taskState.claimed.includes(task.id);
    return `<div class="task-row"><span>${done ? '✓ ' : ''}${task.label}</span><span>${value}/${task.target} · ${task.reward}币</span></div>`;
  }).join('');
  ui.skinGrid.innerHTML = SKINS.map((skin) => {
    const owned = skinState.unlocked.includes(skin.id);
    const equipped = skinState.equipped === skin.id;
    return `<button class="skin-card${equipped ? ' is-equipped' : ''}" type="button" data-skin="${skin.id}"><span class="skin-avatar" style="--skin-body:${skin.body};--skin-accent:${skin.accent}"></span><strong>${skin.name}</strong><small>${equipped ? '使用中' : owned ? '点击装备' : `${skin.price} 像素币`}</small></button>`;
  }).join('');
}

function openSkins() {
  ui.startPanel.hidden = true;
  ui.skinsPanel.hidden = false;
  ui.shopMessage.textContent = '皮肤只改变外观，不影响跳跃属性。';
  renderMetaUi();
}

function lerp(a, b, t) { return a + (b - a) * t; }

function loop(now) {
  const dt = Math.min(.034, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt, now);
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  beginCharge(event.pointerId);
});
window.addEventListener('pointerup', (event) => {
  if (action !== 'charging') return;
  event.preventDefault();
  releaseCharge(event.pointerId);
}, { capture: true, passive: false });
window.addEventListener('pointercancel', (event) => {
  if (activePointer !== null && event.pointerId !== activePointer) return;
  cancelCharge();
}, { capture: true });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('blur', cancelCharge);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelCharge(); });

ui.startButton.addEventListener('click', () => {
  if (uiBusy) return;
  uiBusy = true;
  dismissStartPanel();
  ensureAudio();
  resetGame(false);
  requestAnimationFrame(() => { uiBusy = false; });
});
ui.dailyButton.addEventListener('click', () => {
  if (uiBusy) return;
  uiBusy = true;
  dismissStartPanel();
  ensureAudio();
  resetGame(true);
  requestAnimationFrame(() => { uiBusy = false; });
});
ui.skinsButton.addEventListener('click', openSkins);
ui.closeSkinsButton.addEventListener('click', showMenu);
ui.skinGrid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-skin]');
  if (!card) return;
  const result = purchaseSkin(skinState, card.dataset.skin);
  skinState = result.state;
  ui.shopMessage.textContent = result.ok
    ? result.reason === 'purchased' ? '解锁成功，已自动装备。' : '皮肤已装备。'
    : result.reason === 'coins' ? '像素币不足，完成任务或每日挑战可以获得。' : '皮肤不存在。';
  persist();
  renderMetaUi();
  tone(result.ok ? 620 : 120, .08, 'square', .03);
});
ui.restartButton.addEventListener('click', () => {
  if (uiBusy) return;
  uiBusy = true;
  ensureAudio();
  resetGame(dailyMode);
  requestAnimationFrame(() => { uiBusy = false; });
});
ui.menuButton.addEventListener('click', showMenu);
ui.muteButton.addEventListener('click', () => {
  muted = !muted;
  ui.muteButton.textContent = muted ? '声音 OFF' : '声音 ON';
  persist();
  if (!muted) tone(520, .05, 'square', .03);
});

ui.muteButton.textContent = muted ? '声音 OFF' : '声音 ON';
ui.deviceHint.textContent = matchMedia('(pointer: coarse)').matches ? 'TOUCH READY' : 'POINTER READY';
resetGame(false);
showMenu();
ui.tutorial.hidden = true;
renderMetaUi();
requestAnimationFrame(loop);

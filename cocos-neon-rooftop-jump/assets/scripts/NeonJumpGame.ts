import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  EventMouse,
  EventTouch,
  Graphics,
  Input,
  input,
  KeyCode,
  Label,
  Node,
  ResolutionPolicy,
  sys,
  UITransform,
  view,
} from 'cc';
import {
  ballisticPoint,
  chargeRatio,
  classifyLanding,
  jumpFromCharge,
  makeNextPlatform,
  type PlatformData,
} from './core/GameMath';
import {
  DAILY_REWARD,
  DAILY_TARGET,
  SKINS,
  TASKS,
  advanceTasks,
  createTaskState,
  dailyKey,
  dailySeed,
  normalizeSkinState,
  normalizeTaskState,
  purchaseSkin,
  resolveDailyCompletion,
  seededRandom,
  type SkinState,
  type TaskState,
} from './core/MetaSystems';

const { ccclass, requireComponent } = _decorator;

type Mode = 'menu' | 'playing' | 'gameover' | 'wardrobe';
type Action = 'idle' | 'charging' | 'jumping' | 'falling';

interface JumpRuntime {
  elapsed: number;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  height: number;
  target: PlatformData | undefined;
}

interface TrailDot { x: number; y: number; life: number }
interface RainDrop { x: number; y: number; speed: number }

const W = 480;
const H = 720;
const SAVE_KEY = 'neon-rooftop-jump:cocos:v1';
const CYAN = new Color(88, 246, 231, 255);
const PINK = new Color(255, 79, 163, 255);
const AMBER = new Color(255, 208, 90, 255);
const PAPER = new Color(233, 255, 247, 255);

@ccclass('NeonJumpGame')
@requireComponent(Graphics)
export class NeonJumpGame extends Component {
  private graphics!: Graphics;
  private scoreLabel!: Label;
  private messageLabel!: Label;
  private hintLabel!: Label;
  private metaLabel!: Label;
  private mode: Mode = 'menu';
  private action: Action = 'idle';
  private score = 0;
  private combo = 0;
  private best = 0;
  private charge = 0;
  private chargeMs = 0;
  private currentPlatform = 0;
  private platforms: PlatformData[] = [];
  private player = { x: 0, y: 0, vy: 0, squash: 0 };
  private cameraX = 0;
  private cameraTarget = 0;
  private jump: JumpRuntime | null = null;
  private trail: TrailDot[] = [];
  private rain: RainDrop[] = [];
  private pressing = false;
  private elapsed = 0;
  private fragileTimer = 0;
  private dailyMode = false;
  private dailyWon = false;
  private dailyCompleted = '';
  private runRandom: () => number = Math.random;
  private taskState: TaskState = createTaskState();
  private skinState: SkinState = { coins: 0, unlocked: ['courier'], equipped: 'courier' };
  private wardrobeIndex = 0;

  onLoad(): void {
    view.setDesignResolutionSize(W, H, ResolutionPolicy.FIXED_HEIGHT);
    this.graphics = this.getComponent(Graphics)!;
    this.node.getComponent(UITransform)?.setContentSize(W, H);
    this.loadSave();
    this.createLabels();
    this.resetGame(false);
    this.bindInput();
  }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onCancel, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  update(dt: number): void {
    const safeDt = Math.min(dt, 0.034);
    this.elapsed += safeDt;
    this.cameraX += (this.cameraTarget - this.cameraX) * Math.min(1, safeDt * 4.8);

    for (let i = this.currentPlatform + 1; i < this.platforms.length; i += 1) {
      const platform = this.platforms[i];
      if (platform.kind === 'moving' && platform !== this.jump?.target) {
        platform.y = (platform.baseY ?? platform.y) + Math.sin(this.elapsed * 1.8 + (platform.phase ?? 0)) * 18;
      }
    }

    if (this.mode === 'playing') {
      if (this.action === 'charging') {
        this.chargeMs += safeDt * 1000;
        this.charge = chargeRatio(this.chargeMs);
        this.player.squash = Math.sin(this.charge * Math.PI * 0.5) * 8;
      } else if (this.action === 'jumping' && this.jump) {
        this.jump.elapsed += safeDt;
        const t = Math.min(1, this.jump.elapsed / this.jump.duration);
        const point = ballisticPoint(this.jump, t);
        this.player.x = point.x;
        this.player.y = point.y;
        this.trail.push({ x: point.x, y: point.y + 18, life: 1 });
        if (this.trail.length > 14) this.trail.shift();
        if (t >= 1) this.resolveLanding();
      } else if (this.action === 'falling') {
        this.player.vy -= 520 * safeDt;
        this.player.y += this.player.vy * safeDt;
        this.player.x += 22 * safeDt;
        if (this.player.y < -H * 0.65) this.finishGame();
      } else if (this.action === 'idle' && this.fragileTimer > 0) {
        this.fragileTimer -= safeDt;
        if (this.fragileTimer <= 0) {
          this.action = 'falling';
          this.player.vy = -32;
        }
      }
    }

    for (const dot of this.trail) dot.life -= safeDt * 3.2;
    this.trail = this.trail.filter((dot) => dot.life > 0);
    for (const drop of this.rain) {
      drop.x -= 55 * safeDt;
      drop.y -= drop.speed * safeDt;
      if (drop.y < -H / 2) { drop.y = H / 2; drop.x = Math.random() * W - W / 2; }
      if (drop.x < -W / 2) drop.x = W / 2;
    }
    this.draw();
    this.updateLabels();
  }

  private bindInput(): void {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onCancel, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  private onTouchStart(event: EventTouch): void {
    const point = event.getUILocation();
    this.pressAt(point.x, point.y);
  }
  private onTouchEnd(_event: EventTouch): void { this.release(); }
  private onMouseDown(event: EventMouse): void {
    if (event.getButton() !== EventMouse.BUTTON_LEFT) return;
    const point = event.getUILocation();
    this.pressAt(point.x, point.y);
  }
  private onMouseUp(event: EventMouse): void { if (event.getButton() === EventMouse.BUTTON_LEFT) this.release(); }
  private onKeyDown(event: EventKeyboard): void {
    if (this.mode === 'menu' && event.keyCode === KeyCode.KEY_D) { this.startRun(true); return; }
    if (this.mode === 'menu' && event.keyCode === KeyCode.KEY_S) { this.openWardrobe(); return; }
    if (event.keyCode === KeyCode.ESCAPE && this.mode === 'wardrobe') { this.mode = 'menu'; return; }
    if (event.keyCode === KeyCode.SPACE) this.pressAt(W / 2, H / 2);
  }
  private onKeyUp(event: EventKeyboard): void { if (event.keyCode === KeyCode.SPACE) this.release(); }
  private onCancel(): void { this.pressing = false; if (this.action === 'charging') this.action = 'idle'; }

  private pressAt(screenX: number, screenY: number): void {
    if (this.pressing) return;
    this.pressing = true;
    const visible = view.getVisibleSize();
    const designX = screenX / Math.max(1, visible.width) * W - W / 2;
    const designY = screenY / Math.max(1, visible.height) * H - H / 2;
    if (this.mode === 'menu') {
      if (designY > -70) this.startRun(false);
      else if (designY > -180) this.startRun(true);
      else this.openWardrobe();
      return;
    }
    if (this.mode === 'wardrobe') {
      if (designY < -220) this.mode = 'menu';
      else if (designY < -80) this.buyOrEquipSelectedSkin();
      else this.wardrobeIndex = (this.wardrobeIndex + (designX >= 0 ? 1 : SKINS.length - 1)) % SKINS.length;
      return;
    }
    if (this.mode === 'gameover') {
      this.startRun(this.dailyMode);
      return;
    }
    if (this.action !== 'idle') return;
    this.action = 'charging';
    this.charge = 0;
    this.chargeMs = 0;
  }

  private release(): void {
    this.pressing = false;
    if (this.mode !== 'playing' || this.action !== 'charging') return;
    this.charge = chargeRatio(this.chargeMs);
    const physics = jumpFromCharge(this.charge);
    const current = this.platforms[this.currentPlatform];
    if (current?.kind === 'bounce') {
      physics.distance *= 1.12;
      physics.height *= 1.28;
    }
    const target = this.platforms[this.currentPlatform + 1];
    this.jump = {
      elapsed: 0,
      duration: physics.duration,
      startX: this.player.x,
      startY: this.player.y,
      endX: this.player.x + physics.distance,
      endY: target?.y ?? this.player.y - 20,
      height: physics.height,
      target,
    };
    this.player.squash = 0;
    this.action = 'jumping';
    this.applyTaskProgress({ jumps: 1 });
  }

  private startRun(daily: boolean): void {
    this.dailyMode = daily;
    this.dailyWon = false;
    this.runRandom = daily ? seededRandom(dailySeed(dailyKey())) : Math.random;
    this.resetGame(true);
  }

  private resetGame(playImmediately: boolean): void {
    const first: PlatformData = { x: 80, y: -80, width: 108, height: 54, hue: 186, kind: 'normal', baseY: -80 };
    this.platforms = [first];
    for (let i = 1; i < 8; i += 1) {
      this.platforms.push(makeNextPlatform(this.platforms[i - 1], i - 1, this.runRandom));
    }
    this.score = 0;
    this.combo = 0;
    this.currentPlatform = 0;
    this.player = { x: first.x + first.width / 2, y: first.y, vy: 0, squash: 0 };
    this.cameraX = 0;
    this.cameraTarget = 0;
    this.charge = 0;
    this.chargeMs = 0;
    this.fragileTimer = 0;
    this.jump = null;
    this.trail = [];
    this.rain = Array.from({ length: 42 }, () => ({
      x: Math.random() * W - W / 2,
      y: Math.random() * H - H / 2,
      speed: 170 + Math.random() * 160,
    }));
    this.action = 'idle';
    this.mode = playImmediately ? 'playing' : 'menu';
  }

  private resolveLanding(): void {
    const target = this.jump?.target;
    const landing = target ? classifyLanding(this.player.x, target) : 'miss';
    const hazardHit = Boolean(
      target?.hasHazard
      && Math.abs(this.player.x - (target.x + target.width / 2)) < Math.min(17, target.width * 0.18),
    );
    if (!target || landing === 'miss' || hazardHit) {
      this.action = 'falling';
      this.player.vy = -42;
      this.combo = 0;
      return;
    }

    this.player.y = target.y;
    this.currentPlatform += 1;
    this.score += 1;
    if (landing === 'perfect') {
      this.combo += 1;
      this.score += Math.min(this.combo, 5);
      this.applyTaskProgress({ perfects: 1 });
    } else {
      this.combo = 0;
    }
    this.player.squash = landing === 'edge' ? 6 : 3;
    this.scheduleOnce(() => { if (this.action === 'idle') this.player.squash = 0; }, 0.12);
    this.action = 'idle';
    this.fragileTimer = target.kind === 'fragile' ? 0.85 : 0;
    this.jump = null;
    this.cameraTarget = Math.max(0, target.x - 120);
    while (this.platforms.length < this.currentPlatform + 8) {
      this.platforms.push(makeNextPlatform(this.platforms[this.platforms.length - 1], this.score, this.runRandom));
    }
    const dailyResult = resolveDailyCompletion(this.currentPlatform, this.dailyCompleted);
    if (this.dailyMode && dailyResult.complete) {
      this.dailyWon = true;
      this.dailyCompleted = dailyResult.completedKey;
      this.skinState.coins += dailyResult.reward;
      this.persist();
      this.finishGame();
    }
  }

  private finishGame(): void {
    this.mode = 'gameover';
    this.action = 'idle';
    this.best = Math.max(this.best, this.score);
    this.applyTaskProgress({ bestScore: this.score });
    this.persist();
  }

  private loadSave(): void {
    try {
      const saved = JSON.parse(sys.localStorage.getItem(SAVE_KEY) || '{}');
      this.best = saved.best || 0;
      this.dailyCompleted = saved.dailyCompleted || '';
      this.taskState = normalizeTaskState(saved.taskState);
      this.skinState = normalizeSkinState(saved.skinState);
    } catch {
      this.best = 0;
      this.taskState = createTaskState();
      this.skinState = { coins: 0, unlocked: ['courier'], equipped: 'courier' };
    }
  }

  private persist(): void {
    sys.localStorage.setItem(SAVE_KEY, JSON.stringify({
      best: this.best,
      dailyCompleted: this.dailyCompleted,
      taskState: this.taskState,
      skinState: this.skinState,
    }));
  }

  private applyTaskProgress(progress: { jumps?: number; perfects?: number; bestScore?: number }): void {
    const result = advanceTasks(this.taskState, progress);
    this.taskState = result.state;
    this.skinState.coins += result.coinsEarned;
    this.persist();
  }

  private openWardrobe(): void {
    this.mode = 'wardrobe';
    this.wardrobeIndex = Math.max(0, SKINS.findIndex((skin) => skin.id === this.skinState.equipped));
  }

  private buyOrEquipSelectedSkin(): void {
    const result = purchaseSkin(this.skinState, SKINS[this.wardrobeIndex].id);
    this.skinState = result.state;
    if (result.ok) this.persist();
  }

  private createLabels(): void {
    this.scoreLabel = this.makeLabel('Score', 26, PAPER, -W / 2 + 28, H / 2 - 58, Label.HorizontalAlign.LEFT);
    this.messageLabel = this.makeLabel('Message', 34, PAPER, 0, 32, Label.HorizontalAlign.CENTER);
    this.hintLabel = this.makeLabel('Hint', 16, CYAN, 0, -H / 2 + 42, Label.HorizontalAlign.CENTER);
    this.metaLabel = this.makeLabel('Meta', 14, AMBER, W / 2 - 120, H / 2 - 54, Label.HorizontalAlign.RIGHT);
  }

  private makeLabel(name: string, size: number, color: Color, x: number, y: number, align: Label.HorizontalAlign): Label {
    const node = new Node(name);
    node.parent = this.node;
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(name === 'Score' ? 180 : 430, 90);
    const label = node.addComponent(Label);
    label.fontSize = size;
    label.lineHeight = Math.round(size * 1.25);
    label.color = color;
    label.horizontalAlign = align;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableWrapText = true;
    return label;
  }

  private updateLabels(): void {
    this.scoreLabel.string = `SIGNAL SCORE\n${String(this.score).padStart(3, '0')}`;
    const activeTasks = TASKS.map((task) => {
      const value = Math.min(this.taskState[task.field], task.target);
      return `${value}/${task.target}`;
    }).join('  ');
    this.metaLabel.string = `像素币 ${this.skinState.coins}\n任务 ${activeTasks}`;
    if (this.mode === 'menu') {
      this.messageLabel.string = '霓虹跃迁\nNEON ROOFTOP';
      const dailyStatus = this.dailyCompleted === dailyKey() ? '今日已完成' : `目标 ${DAILY_TARGET} 跳 / +${DAILY_REWARD}币`;
      this.hintLabel.string = `上方：普通模式\n中间：每日挑战（${dailyStatus}）\n下方：皮肤仓库`;
    } else if (this.mode === 'wardrobe') {
      const skin = SKINS[this.wardrobeIndex];
      const owned = this.skinState.unlocked.includes(skin.id);
      this.messageLabel.string = `皮肤仓库\n${skin.name}`;
      this.hintLabel.string = `上半区左右切换\n中间${owned ? '装备' : `解锁 ${skin.price} 币`}\n底部返回`;
    } else if (this.mode === 'gameover') {
      this.messageLabel.string = this.dailyWon
        ? `每日挑战完成\n奖励 ${DAILY_REWARD} 像素币`
        : `任务中断\n得分 ${this.score}  ·  最高 ${this.best}`;
      this.hintLabel.string = '点击屏幕重新开始';
    } else {
      this.messageLabel.string = '';
      this.hintLabel.string = this.action === 'charging'
        ? `${this.charge >= 1 ? 'MAX POWER / 松开!' : 'CHARGING'}  ${Math.round(this.charge * 100)}%`
        : this.combo > 1
          ? `PERFECT × ${this.combo}`
          : this.dailyMode
            ? `DAILY ${Math.min(this.currentPlatform, DAILY_TARGET)}/${DAILY_TARGET}`
            : 'TOUCH / POINTER READY';
    }
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();
    g.fillColor = new Color(9, 10, 32, 255);
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    this.drawGrid(g);
    this.drawCity(g);
    this.drawRain(g);
    this.drawPlatforms(g);
    this.drawTrail(g);
    this.drawPlayer(g);
    if (this.action === 'charging') this.drawCharge(g);
    g.strokeColor = CYAN;
    g.lineWidth = 2;
    g.rect(-W / 2 + 8, -H / 2 + 8, W - 16, H - 16);
    g.stroke();
  }

  private drawGrid(g: Graphics): void {
    g.fillColor = new Color(88, 246, 231, 10);
    for (let y = -H / 2 + 44; y < H / 2; y += 44) { g.rect(-W / 2, y, W, 1); g.fill(); }
    for (let x = -W / 2; x < W / 2; x += 48) { g.rect(x, -H / 2, 1, H); g.fill(); }
  }

  private drawCity(g: Graphics): void {
    const parallax = this.cameraX * 0.18;
    for (let i = -2; i < 11; i += 1) {
      const x = i * 62 - (parallax % 62) - W / 2;
      const height = 90 + ((i * 37) % 115 + 115) % 115;
      g.fillColor = i % 2 ? new Color(16, 20, 45, 255) : new Color(19, 23, 51, 255);
      g.rect(x, -H / 2 + 120, 52, height + 30);
      g.fill();
      g.fillColor = new Color(255, 208, 90, 105);
      for (let wy = -H / 2 + 138; wy < -H / 2 + height + 135; wy += 19) {
        for (let wx = x + 8; wx < x + 46; wx += 14) {
          if ((Math.round(wx + wy + i * 9) % 5 + 5) % 5 < 2) { g.rect(wx, wy, 5, 7); g.fill(); }
        }
      }
    }
    g.fillColor = new Color(8, 9, 22, 255);
    g.rect(-W / 2, -H / 2, W, 118);
    g.fill();
  }

  private drawRain(g: Graphics): void {
    g.strokeColor = new Color(110, 180, 255, 42);
    g.lineWidth = 1;
    for (const drop of this.rain) { g.moveTo(drop.x, drop.y); g.lineTo(drop.x - 4, drop.y - 10); }
    g.stroke();
  }

  private sx(worldX: number): number { return worldX - this.cameraX - W / 2; }

  private drawPlatforms(g: Graphics): void {
    for (let i = Math.max(0, this.currentPlatform - 2); i < this.platforms.length; i += 1) {
      const p = this.platforms[i];
      const x = this.sx(p.x);
      if (x > W / 2 + 80 || x + p.width < -W / 2 - 80) continue;
      const active = i === this.currentPlatform + 1;
      const topColor = p.kind === 'bounce'
        ? AMBER
        : p.kind === 'fragile'
          ? new Color(255, 132, 105, 255)
          : p.kind === 'moving'
            ? new Color(85, 115, 255, 255)
            : active ? PINK : new Color(48, 163, 164, 255);
      g.fillColor = topColor;
      g.rect(x, p.y, p.width, 8); g.fill();
      g.fillColor = active ? new Color(75, 38, 94, 255) : new Color(34, 73, 78, 255);
      g.rect(x, p.y - p.height, p.width, p.height); g.fill();
      g.fillColor = new Color(8, 9, 21, 255);
      for (let wx = x + 10; wx < x + p.width - 8; wx += 18) { g.rect(wx, p.y - p.height + 8, 7, 5); g.fill(); }
      if (p.kind === 'fragile') {
        g.strokeColor = new Color(255, 190, 150, 230); g.lineWidth = 2;
        g.moveTo(x + p.width * 0.35, p.y); g.lineTo(x + p.width * 0.5, p.y - 16); g.lineTo(x + p.width * 0.62, p.y - 7); g.stroke();
      }
      if (p.kind === 'bounce') {
        g.strokeColor = AMBER; g.lineWidth = 2;
        g.moveTo(x + 10, p.y - 10); g.lineTo(x + 20, p.y); g.lineTo(x + 30, p.y - 10); g.lineTo(x + 40, p.y); g.stroke();
      }
      if (p.hasHazard) {
        const center = x + p.width / 2;
        g.strokeColor = CYAN; g.lineWidth = 3;
        g.moveTo(center - 16, p.y + 8); g.lineTo(center - 8, p.y + 20); g.lineTo(center, p.y + 8); g.lineTo(center + 8, p.y + 20); g.lineTo(center + 16, p.y + 8); g.stroke();
      }
      if (active) { g.strokeColor = PINK; g.lineWidth = 2; g.rect(x - 2, p.y - p.height - 2, p.width + 4, p.height + 12); g.stroke(); }
    }
  }

  private drawTrail(g: Graphics): void {
    for (const dot of this.trail) {
      g.fillColor = new Color(255, 79, 163, Math.round(dot.life * 120));
      g.rect(this.sx(dot.x) - 4, dot.y, 8, 3); g.fill();
    }
  }

  private drawPlayer(g: Graphics): void {
    const x = this.sx(this.player.x);
    const y = this.player.y;
    const squash = Math.round(this.player.squash);
    const skin = SKINS.find((item) => item.id === this.skinState.equipped) ?? SKINS[0];
    g.fillColor = this.colorFromHex(skin.body);
    g.rect(x - 8, y + 6, 16, 27 - squash); g.fill();
    g.fillColor = this.colorFromHex(skin.accent); g.rect(x - 8, y + 11, 4, 17 - squash); g.fill();
    g.fillColor = new Color(255, 215, 186, 255); g.rect(x - 7, y + 33 - squash, 14, 12); g.fill();
    g.fillColor = new Color(19, 23, 44, 255); g.rect(x - 8, y + 41 - squash, 16, 6); g.fill();
    g.fillColor = CYAN; g.rect(x + 2, y + 37 - squash, 4, 3); g.fill();
    g.fillColor = new Color(5, 6, 17, 255); g.rect(x - 7, y, 6, 7); g.fill(); g.rect(x + 2, y, 6, 7); g.fill();
  }

  private drawCharge(g: Graphics): void {
    const width = 220;
    const x = -width / 2;
    const y = -H / 2 + 76;
    g.fillColor = new Color(37, 49, 76, 255); g.rect(x, y, width, 10); g.fill();
    g.fillColor = this.charge > 0.86 ? PINK : CYAN; g.rect(x, y, width * this.charge, 10); g.fill();
  }

  private colorFromHex(hex: string): Color {
    const value = Number.parseInt(hex.replace('#', ''), 16);
    return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, 255);
  }
}

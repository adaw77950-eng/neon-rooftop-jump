# 霓虹跃迁 · Cocos Creator 工程

这是网页原型迁移后的 Cocos Creator 3.8 LTS 2D TypeScript 工程。

## 打开与试玩

1. 安装 Cocos Dashboard，并在 Dashboard 中安装 Cocos Creator 3.8.7（同一 3.8 LTS 小版本通常也可用）。
2. 在 Dashboard 选择“导入”，指向本目录 `cocos-neon-rooftop-jump`。
3. 等待编辑器首次导入资源，打开 `assets/scenes/main.scene`。
4. 点击编辑器上方的浏览器预览按钮。

操作：点击开始；按住鼠标或屏幕蓄力；松开起跳；键盘空格也支持。游戏失败后再次点击即可重开。

## 0.2.0 新增模块

### 每日挑战

- 每天根据本地日期生成固定种子，同一天所有重试的平台顺序一致。
- 完成 12 次落地即通关，每天首次通关奖励 80 像素币。
- 主菜单中间区域进入每日挑战；键盘也可以按 `D`。

### 任务与皮肤

- 首批任务：完成 10 次跳跃、累计 3 次完美落地、单局达到 15 分。
- 任务达成后自动领取奖励，奖励不会重复发放。
- 首批皮肤：夜班信使、故障玫红、黄金脉冲、量子青蓝。
- 主菜单下方进入皮肤仓库；仓库上半区左右切换，中间区域解锁或装备，底部返回。

### 平台与障碍

- 移动平台：上下往复移动。
- 易碎平台：落地后只有短暂起跳时间。
- 弹跳平台：增强下一跳的高度和距离。
- 霓虹电网：落在平台中心危险区域会失败。

## 工程结构

- `assets/scripts/core/GameMath.ts`：纯 TypeScript 玩法内核，可脱离 Cocos 测试。
- `assets/scripts/core/MetaSystems.ts`：每日挑战、任务奖励、皮肤经济与确定性随机数。
- `assets/scripts/NeonJumpGame.ts`：输入、状态机、Cocos Graphics 像素绘制、UI、存档。
- `assets/scenes/main.scene`：已经挂好启动组件的主场景。
- `tests/game-math.test.mjs`：弹道、蓄力、落点和平台生成测试。

## 本地验证

```powershell
npm test
npm run check:json
```

## 构建网页与微信小游戏

- 网页：菜单“项目 → 构建发布”，平台选择 Web Mobile。
- 微信小游戏：平台选择 WeChat Mini Game，填写自己的小游戏 AppID；首版不包含网络请求或外部资源。
- 推荐勾选 MD5 Cache，并保持设计分辨率 480×720、适配高度。

第一次用不同的 3.8 小版本打开时，编辑器可能自动升级 `.meta` 或场景序列化版本，这是正常现象。

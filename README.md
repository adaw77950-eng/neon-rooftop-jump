# 霓虹跃迁

原创像素风浏览器跳跃游戏。电脑端按住鼠标蓄力，手机端长按屏幕蓄力，松开后起跳。

## 本地运行

在 `dist` 目录启动任意静态服务器，然后打开 `index.html`。

```powershell
python -m http.server 4173 --directory dist
```

## 测试

```powershell
npm test
npm run check
```

## 文件结构

- `dist/`：可直接部署的静态站点。
- `src/game-core.js`：可测试的纯玩法逻辑。
- `tests/`：Node 内置测试。

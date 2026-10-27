# Neon Rooftop Jump Cocos Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an importable Cocos Creator 3.8 LTS project that reproduces the current long-press rooftop jumping game on desktop and mobile.

**Architecture:** Keep deterministic gameplay math in a Cocos-independent TypeScript module and place rendering, input, UI, persistence, and game state in one Cocos component for the first playable migration. Construct the pixel-art scene at runtime so the project needs no external art assets or manual editor wiring.

**Tech Stack:** Cocos Creator 3.8 LTS, TypeScript, Cocos 2D Graphics, Node test runner.

---

### Task 1: Create the Cocos project shell

**Files:**
- Create: `cocos-neon-rooftop-jump/package.json`
- Create: `cocos-neon-rooftop-jump/tsconfig.json`
- Create: `cocos-neon-rooftop-jump/settings/v2/packages/project.json`
- Create: `cocos-neon-rooftop-jump/assets/scenes/main.scene`

**Steps:** Create the standard 3.8 project metadata, add a minimal scene, then verify all JSON files parse.

### Task 2: Port and test gameplay math

**Files:**
- Create: `cocos-neon-rooftop-jump/assets/scripts/core/GameMath.ts`
- Create: `cocos-neon-rooftop-jump/tests/game-math.test.mjs`

**Steps:** Write tests for charge clamping, constant horizontal speed, parabolic vertical motion, landing classes, and safe opening platforms. Run `npm test`, confirm failure before implementation, then implement the minimum functions and rerun until green.

### Task 3: Implement the playable runtime

**Files:**
- Create: `cocos-neon-rooftop-jump/assets/scripts/NeonJumpGame.ts`

**Steps:** Implement the state machine, pointer/touch input, jump timing, landing resolution, infinite platform generation, camera tracking, restart, score and local storage. Render the existing neon pixel style with Graphics.

### Task 4: Wire the scene and document usage

**Files:**
- Modify: `cocos-neon-rooftop-jump/assets/scenes/main.scene`
- Create: `cocos-neon-rooftop-jump/README.md`

**Steps:** Attach the startup component, document Cocos Creator import/preview/build, and describe WeChat Mini Game export settings.

### Task 5: Verify the migration

**Steps:** Run `npm test`, syntax/JSON validation, scan for missing imports and external URLs, then open in Cocos Creator when the editor is available. Expected result: tests pass, the project is self-contained, and no runtime asset download is required.


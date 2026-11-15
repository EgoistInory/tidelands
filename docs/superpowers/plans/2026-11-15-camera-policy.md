# 连续镜头与局部遮挡处理 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task in the current chat. No subagent delegation is requested.

**Goal:** Replace discontinuous orbit selection with connected camera movement and reversible foreground visibility.

**Architecture:** Keep physical endpoint/path constraints separate from subject line of sight. A bounded camera planner follows collision-free segments and stable obstacle corners; a material hook restores subject visibility while that path is traversed.

**Tech Stack:** Existing JavaScript, Three.js, node:test, installed headless Playwright.

**Spec:** docs/CAMERA-POLICY-SPEC.md

## Global Constraints

- Keep src/camera.js and all historical failure inputs unchanged during the spike.
- No paid API, downloaded asset, public deployment, save rewriting or user content deletion.
- QA candidates live in tools; production needs visible acceptance and native short-path/delivery evidence.

## Review Focus

- Current lens remains outside solids although the focus ray is blocked.
- Camera cannot jump sides to enforce a preferred distance.
- A detour must make progress rather than stick forever at the first corner.
- Shared material maps, wind callbacks and shadow materials retain ownership.
- Imported/initial inside-camera states have an explicit recovery boundary.

### Task 1: Connected camera planner

- [x] Add actual-input and simple obstacle tests; observe RED.
- [x] Implement tools/camera_controller_candidate.js with point/path validation, bounded advance and stable corner detours.
- [x] Pass actual three cases and synthetic safety/progress/state-preservation cases.

### Task 2: Reversible foreground visibility

- [x] Add shader callback/ownership tests, then tools/camera_occlusion_candidate.js.
- [x] Preserve existing wind callback/cache keys, shader alpha/shadow semantics and shared textures.
- [x] Inspect declared scene captures with unchanged actors and gameplay state.

### Task 3: Acceptance checkpoint

- [ ] Review the combined scene and camera safety/continuity at desktop and390 sizes.
- [x] Preserve the reviewed QA candidate and record unresolved terrain, continuous motion and runtime cost; do not promote.
- [ ] Update progress and ordinarily commit/push the reviewed bounded checkpoint, verifying remote HEAD.

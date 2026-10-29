# 大面地貌表层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 用一个有限整组候选验证四岛大面重复是否可通过连续风化层次缓解。

**Architecture:** QA模块从既有地形采样连续20–60米湿干/凸脊/沉积场，仅添加一个vec3属性并克隆地表材质。原材质作为真实A/B基线，不改高度、法线、资源、装饰或生产启动；复用所有本地贴图，不增加纹理读取。

**Tech Stack:** 固定本地Three.js、node:test、受控IAB、原生WebGL2计时。

**Spec:** `docs/GROUND-SUPPORT-DELIVERY.md`最后一段与ROADMAP当前M5待办。

## Global Constraints

不下载、不付费、不公网发布、不改普通存档；生产209输入及独立包SHA保持。仅一轮候选后明确保留/拒用及下一步，不继续单色/单叶调参。M5五门槛与完整3A继续未完成。

## Review Focus

水边不出现新增干土变色；连续场跨采样格不跳变；基线几何/规则字节不变；候选增加的属性有确定字节预算；实际GPU与CPU计时分开，不把静态调用数当帧率。

### Task 1: 连续场与材质候选

**Files:** Create `tests/landform-surface-candidate.js` and `tests/landform-surface.test.js`.

**Interfaces:** `landformSample(x,z) -> [weather,exposure,deposition]`; `createLandformSurfaceCandidate(base,geometry) -> {material,attributeBytes,buildCpuMs,release}`.

- [x] 写两个契约：全四岛有界连续/水域权重零；真实320网格位置/法线/颜色/层次字节和世界不变、属性1236492字节、原材质回调与贴图不动、着色纹理读取次数不变。
- [x] 运行契约确认RED，再最小实现；不为改变美术松动原生产断言。
- [x] 运行契约确认GREEN；属性/材质只用于QA。

### Task 2: 实景同位审查与预算

**Files:** Create `tests/landform-surface-review.html`; write `docs/landform-surface-*` observations and checkpoint.

**Interfaces:** 复用当前WorldView、作者人物/植被准备方法，UI选择四岛/近中远/旧新两材质，固定位置/时钟/相机，无存档。另固定高地相机16秒原生GPU渲染样本，CPU与rAF单列。

- [x] 同位捕获四岛近中远24图，保存实际资源/镜头/GL与世界不变证据；若收益不清晰拒用，不生产推广。
- [x] 实测旧/新短GPU预算，记录初始化属性字节；不能取得有效样本则明确未验。
- [x] 运行全量测试与当前209交付核验；记录最终决定、剩余M5边界并本地提交，更新两处进度及ignored检查点。

用户已授权无人值守推进，按其既有策略直接执行原生流程，不为日常候选另设审批。


## 执行账本与裁定

- 2新契约全RED→GREEN；实际图发现clone丢宏开关，补真实材质契约1RED→GREEN，原断言保持。全量381通过。
- 24原生图/12对保存，首2失效图另保留；林地近景一对被枝干遮挡，不作为收益，剩余11对足以拒绝本路线。无需为拒用候选延伸同一镜头反复调整。
- GPU旧960帧/120查询P95 12.293749ms，新961/121及12.436625ms，均固定诊断图，无最终main性能结论。
- Ruling: 拒绝生产推广，保留209源码/ZIP — 裸坡与重复构图未解决，收益不足以抵消额外属性和维护面；错误接受会增加生产复杂度。
- Ruling: 两个Minor保留复用边界，不继续扩建拒用候选QA — 湿区像素不变未证、计时器未来需拒绝resize/隐藏/样本不足；当前原始计时已独立验证有效。
- 新上下文只读审查landform_review完成，无Critical/Important；审查未独立判美术，不夸大证据范围。
- 最终审计及下一批次见 `docs/LANDFORM-SURFACE-CHECKPOINT.md`。完整M5/3A不勾。

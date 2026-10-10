# 未采用的镜头平滑实验

2026-10-05：角速度限制加直线插值、径向恢复限速及轨道插值的尝试没有通过实际连续绕塔检查。最后的轨道方案留在 camera-motion-smoothing.mjs；其单元回归可运行 `node --test tests/experiments/camera-motion-smoothing.test.mjs`，但通过单测不代表通过实景品质。它不被生产模块导入，也不包含在 npm test 的 tests/*.test.js 范围内。

生产 camera.js、scene.js 和 camera.test.js 已恢复到本轮前的 SHA，取景保护保留。不要直接重新启用实验：实景曾从约16米回缩至0.25米，最大一步15.7378米。实际复现、源码绑定和剩余缺口见 ../../docs/camera-motion-review.json。下一方向检查树木从地面贯穿树冠的整体包围盒及 focus 在盒内/外切换；本轮未证明该方向的改动能解决问题。

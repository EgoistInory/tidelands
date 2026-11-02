# 地表零权重岩石采样候选 · 2026-11-02

## 范围

只在 `tests/ground-rock-sampling-candidate.js` 的 QA 材质回调中，把地形层 `rockBlend == 0` 时的三投影岩石 albedo、normal、roughness 采样改为显式 `textureGrad` 与分支跳过。梯度在分支外求值，避免导数函数落在非一致控制流内。运行页面采用源码 `WorldView`、全世界、已加载作者角色和固定新游戏状态；没有读写普通存档，也没有编辑生产着色器、输入文件或正式ZIP。

## 证据

页面中 `groundStatus=ready`、`rockStatus=ready`，窗口 1280×720、绘图缓冲 1920×945、pixel ratio 1.5。基线与候选在高地、坡地、海岸、林地四个固定镜位各进行一次相同 camera 的 framebuffer RGBA8 对照，每处 1,814,400 像素，差异均为零。独立 GPU 采样采用 `EXT_disjoint_timer_query_webgl2`，每地点 96 次交错查询，基线/候选各48次；修正后的查询检查 `timer.GPU_DISJOINT_EXT`，所有组 `disjoint=0`、`glError=0`、计时器精度64位。

|位置|基线 P50/P95/max ms|候选 P50/P95/max ms|
|---|---:|---:|
|高地|14.473 / 29.759 / 46.917|14.335 / 27.073 / 28.281|
|坡地|13.449 / 21.962 / 44.788|14.349 / 22.147 / 28.791|
|海岸|25.667 / 49.185 / 62.149|25.741 / 55.397 / 65.715|
|林地|26.817 / 56.700 / 63.788|25.245 / 47.902 / 52.877|

GPU结果按地点混杂、方差较大：高地和林地部分分位数下降，坡地和海岸没有改善。**不推广候选，不宣称优化成功**；同机固定视角像素相同仅证明这四个视图输出一致，不覆盖其他GPU/驱动/移动设备、纹理边界、长时或热状态。

一个先行测量读取错了disjoint枚举，产生 `GL_INVALID_ENUM`，该轮GPU数据废弃；修正为扩展对象 `timer.GPU_DISJOINT_EXT` 后重跑，报告仅留无错误的修正轮次。该错误没有修改产品或浏览器存档。

## 回归/正式产物守卫

- `npm test`：385 passed，0 failed，输出 `docs/ground-rock-sampling-tests.txt`。
- `tools/verify_ground_rock_sampling_candidate.py`：逐文件对比209输入源码、解压目录、正式ZIP，以及原 `33455473…` 普通备份指纹；验证像素、计时样本、disjoint/GL状态及测试计数。
- 正式包仍是 `ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f`，未重打包。
- 首次系统 Python 缺少Pillow；后续使用已安装的工作区Python运行原 GPU attribution verifier，没有安装依赖。

## 当前状态与下一步

此有限shader实验完成，候选保持QA-only并拒绝进入生产。后续转回M5其他剩余项，不再围绕这个采样分支反复测。历史208 GPU超限未被解释；M5的完整画面/动作/听感/反馈/性能与完整3A目标仍未完成。旧tab11与4190服务保持原状；本次临时tab77关闭，4195服务关闭。

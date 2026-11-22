# 导入存档后的着色器等待 · 2026-11-23

使用 `tidelands-m5-2026-11-23-boar-strike.zip`（SHA-256 `24c06df1dcd8805476e44afc0c70c8bdf456e267cb3ea3989044bd45e7415af1`）。每轮以独立 Chromium 浏览器上下文载入验过哈希的离线包，通过暂停菜单的文件选择器导入 `docs/yard-delivery-2026-11-15/desktop-final-save.json`。记录从选择文件到首个未暂停完整帧，再保存、刷新、点「继续旅程」并导出。这次的提交扩展了诊断脚本，游戏运行包仍使用同一版本。

| 浏览器视口 | 首个 WorldView.draw，r4 / r5 | 世界渲染，r4 / r5 | `getProgramInfoLog` 总耗时，r4 / r5 | 调用次数 | r5 独立 CPU 采样 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1920×1080，DPR 1 | 365.6 / 353.5 ms | 362.4 / 350.4 ms | 298.8 / 293.2 ms | 35 | 289.1 ms |
| 390×844，DPR 1.5 | 221.0 / 218.3 ms | 218.1 / 215.2 ms | 176.6 / 177.8 ms | 28 | 176.6 ms |

r4 用单调时钟记录 WebGL 调用。r5 加用 Chrome DevTools CPU profiler，按 `NavigationStart` 对齐页面时钟，仅累计首个 `draw` 时间窗中的 `getProgramInfoLog` 栈叶。两轮耗时集中在 Three.js 第一次取得材质着色器程序时查询诊断日志。每个被查询的新程序均带 `USE_SHADOWMAP`，涵盖普通物件、实例化植被和角色。桌面单次最长 12.8 ms，窄屏 9.2 ms。当前 Chromium 两端均报告支持 `KHR_parallel_shader_compile`。浏览器内部的编译阶段及显卡时间还需独立测量。

r4 与 r5 四条导入和继续流程均通过。刷新保持持久化字符串原样。分别对四份原生导出的 JSON 与输入比较，所有进度字段相同，游戏时间向前推进。未发现脚本错误、控制台警告或 WebGL 错误。窄屏是同一桌面主机的视口模拟。

下一组以相同包和存档为基线，对照导入目的地的异步着色器编译。使用画面完全可操作前的总耗时、最长主线程任务、首帧与存档恢复结果判断收益，并覆盖扩展缺失时的导入。M5 性能验收继续开放。

```sh
node tools/check_load_transition.mjs tidelands-m5-2026-11-23-boar-strike \
  docs/yard-delivery-2026-11-15/desktop-final-save.json dist/load-transition-2026-11-23-r4-programs
node tools/check_load_transition.mjs tidelands-m5-2026-11-23-boar-strike \
  docs/yard-delivery-2026-11-15/desktop-final-save.json dist/load-transition-2026-11-23-r5-profile --profile
```

命令从仓库根目录运行，使用 `127.0.0.1:4190` 已有的静态文件服务及本机 Chromium。可用 `PLAYWRIGHT_PACKAGE` 指向本机 Playwright 入口。复跑使用新的输出目录。原始调用记录、Chrome CPU profile 和存档导出保存在上述本机 `dist` 目录。

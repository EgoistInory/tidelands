# 潮生群岛 Tidelands

正在开发的单人 3D 海岛开放世界。中文界面，本地运行；M1 自由探索、M2 生存与营地、M3 世界内容与成长、M4 本地交付已完成功能验收，证据见 docs/M1-ACCEPTANCE.md 至 docs/M4-ACCEPTANCE.md。最终 M5 品质验收仍在推进，见 AGENT_PROGRESS.md 和 ROADMAP.md。

## 启动

```sh
python3 serve.py
```

打开 http://127.0.0.1:4190 。需要支持 WebGL 2 的现代浏览器。不需要安装 npm 依赖，Three.js 0.180.0 在 vendor 中附带，许可证随包保留。ES 模块需要本地 HTTP 服务，不能双击 HTML 代替。

最近已打包的本地品质检查点在 `dist/tidelands-m5-2026-10-08-geometry.zip`，包含此前功能及生物资源占用优化。116项测试、34文件校验、独立解压普通桌面/390窄屏采集保存刷新通过；同一固定地域巡回的缓冲峰值降低46.86%，绘制计数保持，见 `docs/resident-geometry-review.json`。解压后按随包 README 启动；端口占用时运行 `python3 serve.py --port 4191`。操作和存档说明见 `docs/LOCAL-DELIVERY.md`。九个历史包保持原内容；这些包都不代表 M5/完整3A目标完成。

当前开发源码还增加低岸线起伏海浪层，与既有风声叠加、渐入内陆，并共享暂停/静音。112项测试、八组真实离线PCM和实际营地/海域接线验证通过，见 `docs/coastal-audio-review.json`；尚未试听或做完整声场品质验收。这批声音修改已进入coastal及最新state-reuse包，本地开发服务运行相同生产源码。

用 `python3 tools/verify_local.py --name tidelands-m5-2026-10-08-geometry` 校验并单独解压当前包。后续构建使用 `python3 tools/package_local.py --name tidelands-m5-next --stage 'M5 quality batch checkpoint'`，每次改源码换新包名；已有包只允许相同来源的完全一致重建，拒绝覆盖历史检查点。打包工具回归运行 `python3 tools/test_local_delivery.py`。四岛正常旅程和实际战斗已有十分钟有效帧调度/JS堆记录，见 `docs/cross-island-review.json`：含间歇输入与较多静止时间，不能代替持续运动或GPU品质验收；该采样在两处岛民对话修正之前完成，绑定自己的源码SHA，不能作为当前包完全一致的长时证明。

2026-10-07后续源码增加岛民近距交谈朝向和待机手臂轻动，以及攻击/采集从装备待机姿态进入和恢复的衔接；101项测试和桌面/窄屏12秒隔离循环通过，见 `docs/islander-response-review.json` 与 `docs/action-transition-review.json`。攻击结果统一由短时战斗提示显示，消除空挥时残留旧命中提示；桌面键盘/390窄屏攻击键已实测。上述早期包不含这些后续修改，完整动作品质与声音同步仍待验收。

## 操作

WASD / 方向键移动，Shift 奔跑，左右拖动场景旋转镜头，上下拖动调整俯仰，滚轮缩放。默认使用较近且较低的角色视角，可拉远观察营地；向下拖动可抬头观察灯塔等高处地标，手机同样支持。
E 与最近目标交互，空格攻击，1–6 快捷操作，B 背包、C 制作、M 地图、Esc 暂停。
攻击先蓄势，在挥击中段判定范围内的敌人。打击前暂停、交互或切换装备会取消本次攻击；恢复后可以重新攻击。
手机使用左下摇杆移动，拖动场景转向，点交互提示和攻击按钮。
手机横屏也提供摇杆和攻击键；暂停、切换窗口或页面隐藏时清除移动输入。暂停菜单的声音开关会记住选择。声音在首次点击开始后启用；不支持音频的环境仍可继续游戏。

从守灯人阿岚开始任务。采集木材和石料制作石斧，建起营火，前往其他岛屿寻找伙伴和晶石，最终修复归航灯塔。可游泳跨岛；地图点位提供导航距离。主线完成后可继续探索建造。

默认每 8 秒保存。暂停菜单可主动保存及导出/导入 JSON。导入会替换当前进度，建议先导出备份。存档只属于当前浏览器和网址，无联网账号。

## 验证与续做

`npm test` 运行无第三方测试依赖的 Node 规则测试。
`node tests/soak-rules.js` 执行确定性加速规则审计：模拟一小时移动/采集/战斗及60次读档。它不是实际运行一小时的浏览器或GPU性能测试。
`AGENT_PROGRESS.md` 记录最新真实验证与 next_action，`ROADMAP.md` 保留完整交付目标。
自动化 ID `2048` 每小时检查并接续，限额后下一小时再检查；不会购买额度、消费重置券或公网发布。

本地验收入口（先启动服务）：

| 页面 | 用途 |
| --- | --- |
| `/tests/playthrough.html?mode=journey` | 与正式存档隔离的真实主线旅程，不预填材料 |
| `/tests/playthrough.html?mode=m1` | M1 探索基础的独立旅程，使用生产世界与正常新游戏，不预填材料或改敌人 |
| `/tests/playthrough.html?mode=m3` | M3 内容/任务/装备隔离验收，使用实际导入入口载入明确标注的 m3 测试档；不替代从零主线 |
| `/tests/playthrough.html?mode=m4` | 当前版本从零主线回归的独立旅程，正常世界和新游戏，不预填材料，不改敌人 |
| `/tests/playthrough.html?mode=render-blocked` | 隔离模拟 WebGL 2 创建失败，检查启动错误提示与禁用入口 |
| `/tests/playthrough.html?mode=imports` | 导入/导出验证，独立存档键；读取生产导出Blob并显示恢复校验结果，不生成下载文件 |
| `/tests/playthrough.html?mode=menus` | 固定菜单测试档；刷新重置测试状态 |
| `/tests/playthrough.html?mode=berry` | 新手浆果点旁的隔离测试档，用真实采集入口检查模型耗尽/背包增量；刷新重置测试状态 |
| `/tests/playthrough.html?mode=stone` | 新手石料旁的隔离测试档，核对大小石块一起消失和背包增量；刷新重置测试状态 |
| `/tests/playthrough.html?mode=fiber` | 新手纤维旁的隔离测试档，核对穗束耗尽与背包增量；刷新重置测试状态 |
| `/tests/playthrough.html?mode=swim` | 潮汐岸边海域的隔离测试档，用真实移动查看泳姿及上岸落脚；刷新重置测试状态 |
| `/tests/playthrough.html?mode=combat` | 固定近身战斗测试档，显示实际输入、肩部姿势、敌人生命和音效排入时序；刷新重置测试状态，不代替正常旅程或声音试听 |
| `/tests/playthrough.html?mode=respawn` | 5生命遭受致命攻击，核对回营地和背包保留；独立测试存档 |
| `/tests/playthrough.html?mode=performance` | 30秒有效运行帧调度采样；加 `&seconds=600` 采10分钟并记录每分钟昼夜/存档/生命/地域/坐标/敌人及可用的JS堆指标。在已有 `mode=m4` 等旅程加 `&sample=frames&seconds=600` 可观测原存档，不预填状态。暂停时段排除，2倍墙钟超时，不代表GPU耗时或完整世界性能 |
| `/tests/creatures.html` | 生产野猪/蟹的全身与近景、攻击定格及12秒行走/攻击/受击/倒地/恢复循环，输出实际模型反馈和帧调度；无存档读写，不证明真实战斗、落脚自然度或完整场景品质 |
| `/tests/buildings.html` | 生产建筑模型的隔离审查，不证明完整场景品质 |
| `/tests/locomotion.html` | 生产角色的平地/坡地落脚、7米/秒行走、12米/秒奔跑和泳姿隔离检查；可选徒手/石斧/剑、攻击/采集定格及12秒模拟动作循环，计数不代替自然动作和实战审查，无存档读写 |
| `/tests/render-load.html` | 固定起点60次绘制后输出渲染计数；加 `?suite=1` 采四岛固定视角，加 `&profile=1` 分类统计并重复巡回（每回调10次绘制），不代表帧率 |
| `/tests/audio-render.html` | 实际Web Audio离线渲染及可试听样本，含高负荷动作混音与暂停菜单成功提示；波形/队列计数不代替试听 |
| `/tests/coastal-audio-render.html` | 海岸/过渡/内陆、纯海浪、静音/暂停和高负荷八秒真实离线声场渲染及可试听控件；数值接线不代替试听 |
| `/tests/playthrough.html?mode=context-lost` | 真实WebGL上下文中断、暂停保护及刷新恢复；改为 `context-lost-blocked` 同时阻止存储。两模式拦截下载并校验真实导出Blob，不生成下载文件；独立存档键 |
| `/tests/scene-lifecycle.html` | 12次交替空营地/三建筑换档，保留首次计数并比较后续资源计数；不操作用户存档 |
| `/tests/visual-review.html` | 固定小屋/出生树林/林地/雾岬/浅湾/灌木/沙岸/野花/纤维及昼夜，直接使用生产渲染；地表、石料、草丛和沙岸沙草可切换，6米镜头检查材质，海平线镜头检查天空/水面。10秒时间推进输出帧间隔和隐藏标记，无存档读写，短样本不证明GPU耗时、完整动作或长期性能 |
| `/tests/camera-motion.html` | 20秒绕塔/树林/三建筑营地连续镜头诊断，复用生产移动/渲染，移除敌人、无存档读写；输出取景距离、转向/位移跳变，当前品质未通过 |
| `/tests/dynamic-endurance.html` | 无存档脚本动态负载，五场景分段传送、生产移动/敌人/攻击/声音/绘制，60秒或10分钟；输出帧间隔、实际移动距离、战斗/脚步计数、JS堆与大于50ms前帧上下文，不代替正常主线/跨岛、试听、GPU或真机验收 |
| `/tests/state-switch-review.html` | 固定镜头交替五次同对象/五次新状态，诊断生产sync CPU、模型保留/释放与渲染计数；无存档或GPU计时 |
| `/tests/resident-budget.html` | 四轮固定五地域、GL bufferData字节/释放与共享模型驻留诊断；无存档，不代表帧率、完整显存/GPU计时或真机 |
| `/tests/frame-probe.html` | 无WebGL的帧调度对照 |

当前仍未完成最终视觉、音色试听、真实设备多指及长期渲染/内存验收。规则测试通过、主线完成和离线声音输出均不能代替“3A质感”要求。详细证据和局限见 `docs/VERIFICATION.md`。

## 设计与来源

docs/concept.png 使用内置 Image Gen 生成，作为完整主屏美术方向。世界是实际生成的三维网格，HUD 是原生 HTML，不使用概念截图假装游戏场景。当前模型精度尚低于概念，属于待完善项。
Three.js 使用官方 npm 包构建文件（MIT，vendor/THREE-LICENSE），安装方式参考 https://threejs.org/manual/en/installation.html 。游戏与规则代码独立实现。
草地使用 Charlotte Baglioni 的 [Leafy Grass](https://polyhaven.com/a/leafy_grass)，来自 Poly Haven，采用 [CC0](https://polyhaven.com/license)。三张1k贴图已随项目保存在 `assets/ground/leafy-grass`，共3172828字节；两米尺度、原始URL和校验值见 manifest.json。运行时仅加载本地文件，不访问素材API；缺少任一通道时保留原地表。地形/采集/存档规则不受材质变化影响。地表升级仍不能单独证明3A品质。
石料使用 Rico Cilliers 的 [Lichen Rock](https://polyhaven.com/a/lichen_rock)，同为 Poly Haven [CC0](https://polyhaven.com/license)。三张1k颜色/法线/粗糙度贴图保存在 `assets/rock/lichen-rock`，共2903835字节；来源、两米参考尺度及校验值见 manifest.json。球面UV按石块半径近似尺度并使水平接缝的重复周期相接；形变、缩放和极点仍会影响实际密度。运行时只读本地文件，加载失败保留原石料表面，不改变采集、碰撞或存档。


2026-10-07后续可运行检查点：`dist/tidelands-m5-2026-10-07-actions.zip` 包含岛民反馈、攻击采集姿势衔接及攻击提示去重。101项测试、33文件哈希校验、独立解压正常采集/首任务/保存刷新通过，详见 `docs/action-feedback-delivery-review.json`；运行指南随包附带。这是M5批次交付，完整3A品质尚未通过。

历史 coastal ZIP 和最新 state-reuse ZIP 已包含岸线海浪与沙草两批，旧 gather ZIP 保留此前内容。沙草有限验证见 `docs/shore-vegetation-review.json`，不能代替M5/3A完整品质验收。

历史coastal同源的五场景隔离动态桌面十分钟与390窄屏60秒已保存，见 `docs/dynamic-endurance-sample.json` 和 `docs/dynamic-endurance-mobile-sample.json`。阶段内持续运动/战斗/声音，桌面P95 17.5ms；场景fixture切换出现四次大于50ms尖峰，品质待办仍保留。这是脚本负载诊断，不能替代正常档连续跨岛、实际音色、GPU/真机或无泄漏验收。

历史state-reuse源码的同一脚本重新测量，阶段切换均无大于50ms尖峰；桌面十分钟P95 17.8ms，初始热身仍66.67ms。驻留几何数增加，后续仍需重复地域稳定性与字节预算审计，见 `docs/state-switch-desktop-sample.json` 与 `docs/state-switch-mobile-sample.json`；帧调度改善不代表M5性能/完整品质通过。

当前geometry版的四轮固定地域驻留审计与桌面十分钟/390窄屏60秒动态样本已保存。固定巡回热身后稳定，完整QA清理缓冲归零；动态P95 17.7/17.8ms，仍保留起始热身、驱动显存/GPU和实际设备等品质边界，详见 `docs/resident-geometry-review.json`。M5完整品质尚未通过。

# 潮生群岛 Tidelands

正在开发的单人 3D 海岛开放世界。中文界面，本地运行；M1 自由探索、M2 生存与营地、M3 世界内容与成长、M4 本地交付已完成功能验收，证据见 docs/M1-ACCEPTANCE.md 至 docs/M4-ACCEPTANCE.md。最终 M5 品质验收仍在推进，见 AGENT_PROGRESS.md 和 ROADMAP.md。

最新有限功能组：全身低物采集，33针对性/291全量与真实原生E/main结算、暂停取消通过；近距纤维/浆果/贝壳、390检视与远距手臂限伸已保存，见 `docs/LOW-GATHER-REVIEW.md`。整体自然度/远距真实接触仍待，M5和完整3A未完成。当前本地包 `dist/tidelands-m5-2026-10-23-low-gather.zip`，SHA `63501f1a6b641985928aefe6ea5fb3ddc82c13a96f6674f4f31af062aed2a3b8`；独立包普通q6接续/保存390恢复通过，见 `docs/LOW-GATHER-DELIVERY.md`。新源GPU/长时不套用旧证据。

## 启动

```sh
python3 serve.py
```

打开 http://127.0.0.1:4190 。需要支持 WebGL 2 的现代浏览器。不需要安装 npm 依赖，Three.js 0.180.0 在 vendor 中附带，许可证随包保留。ES 模块需要本地 HTTP 服务，不能双击 HTML 代替。

历史本地包：`dist/tidelands-m5-2026-10-16-motion-sound.zip`，SHA `0033d21e9fdd3e12ac39ee75fc3670b6072ff98f13cec17e160f9eaf3fe2cadc`。合并近障碍镜头小角度搜索与真实陡坡摆动脚落点修复；224全量/17声音接触针对性/4打包及51运行SHA通过。新增四组真实离线时钟混音与WAV、暂停/静音和自然回收证据；音频生产代码保持。普通q6原生继续、移动、保存、390与再次载入保持库存/HP79/营火1/击败3；本批未再下载普通JSON，旧e750备份保留。见 `docs/motion-sound-audit.json` 和 `docs/SOUND-MIX-REVIEW.md`。M5与完整3A未完成，未试听/真机/新来源长时GPU或完整主线复验。

前一空间包：`dist/tidelands-m5-2026-10-16-island-spaces.zip`。四岛树冠比例/叶色和夜间侧光候选已与雾岬遗迹空间一起交付：纹理石拱、分层柱、残柱和刻纹石碑替换旧立柱；柱基/石碑实体阻挡、中央通道可通过，镜头避让保留拱下空间。复用已有石料贴图，2合并表面/2268三角形。221全量/29针对性/4打包、51运行文件验证；生产界面隔离位置原生S/E读碑、同普通q6档原生移动/实际下载/390恢复和新全画布GPU对照已通过，见 `docs/island-spaces-audit.json`。树种/密度、角色与营地自然度、镜头运动/试听和最终统一主路径仍待，M5及完整3A目标未完成。

上一批反馈包：`dist/tidelands-m5-2026-10-16-enemy-windup.zip`。敌人先蓄力0.3秒，在动作冲击中段判定伤害；锁定方向与身体位置，可以退开或绕后闪避。面板暂停、画面中断、死亡和重载不会续打旧攻击。增加野猪/蟹两类预警声，并同步受击生命与HUD反馈。215全量/53针对性/4打包、49运行文件通过；原有普通q6档真实行走、蟹战斗受伤与转身击败2→3、奖励、实际下载和390刷新恢复已验证。见 `docs/enemy-windup-audit.json`。当前只是M5反馈批次；整体现代美术、自然动作/镜头、试听、持续长时/设备GPU和最终冻结主路径尚未全部验收。

前一c1a9反馈包另有600秒桌面/60秒390连续移动、战斗、营地/昼夜、JS堆及完整画布五阶段GPU计时。通过 `python3 tools/verify_quality_endurance.py` 核对；详见 `docs/QUALITY-ENDURANCE-REVIEW.md`。连续样本的诊断栏缩小了画布，GPU另用1920×1080/390×844全画布计时，真实设备/VRAM/试听与整体美术自然度仍未通过。普通q6存档不受隔离负载影响。

上一批演员接触包：`dist/tidelands-m5-2026-10-15-actor-contact.zip`。人物/岛民/活着的生物按身体范围阻挡穿过，追击不再越过停止距离；近处旧重叠逐步分离，角色可走出旧档重叠位置。野猪较大的身体有近身攻击补偿，方向、伤害、奖励和冷却保持；清理野兽后才可在其位置建造。208全量/44针对性/4打包测试和49运行文件校验通过；旧包10回归中8项失败，新包普通q6原生按键抵住阿岚、正常交谈、真实下载和390刷新保持，见 `docs/actor-contact-audit.json`。保守身体范围不代表逐三角形或自然动作全部通过；敌人前摇与命中时序/声音、复杂角落导航和最终品质验收继续推进。

上一批环境包：`dist/tidelands-m5-2026-10-15-environment.zip`。四岛地表按海拔、坡度和水线分层，林地底色与高地岩质、浅滩暖沙区分；岸线增加4783处可走过的低矮卵石，夜间近景环境光提高。复用已有石料三通道，不增加贴图请求。198项全量测试、48运行文件/49包项校验通过；四岛昼夜、岸线与180帧运动及390尺寸实景已检查。新包同地址接续真实普通任务6进度、W移动、实际导出和390刷新恢复通过，详见 `docs/environment-progress-audit.json`。该批次不等于整体美术或M5完成，重复植被、遗迹占位、演员接触、镜头余量、试听和最终性能/设备验收仍待；最终冻结时统一补新包完整主路径。

上一批资源接触检查点在 `dist/tidelands-m5-2026-10-14-resource-contact.zip`。保留手动镜头方向、优先已有避障安全侧，并让石料/晶石按与镜头一致的保守实体范围阻挡角色；大矿物可以从表面附近采集，耗尽后解除阻挡，旧档在矿物内部可正常向外走出。27项针对性、195项全量、4项打包测试通过；47运行文件校验通过。旧包已完成的普通q6旅程实际导入新包，原生按键证明石料阻挡、E从边缘采矿2→5、耗尽后穿过原位置，390刷新恢复同位置/库存/任务6，见 `docs/resource-contact-audit.json`。不重复首树或基础主线烟测；当前新包尚未重跑完整新手至结尾流程，最终冻结时统一验收。林地101.35度物理转镜已降到32.55度，仍属运动品质待办；整体环境、角色接触、试听和长期品质未完成，M5与完整3A未完成。

验收更正：两个隔离页漏防自动启动标记导致双实例，现已修正；旧极早存档隔离诊断撤回，原独立包直接页面记录保留。修正后单实例极早存档重验通过、正式存档在这轮前后SHA不变；此前历史影响无法追溯，详见 `docs/harness-isolation-correction.json`。

当前开发源码还增加低岸线起伏海浪层，与既有风声叠加、渐入内陆，并共享暂停/静音。112项测试、八组真实离线PCM和实际营地/海域接线验证通过，见 `docs/coastal-audio-review.json`；尚未试听或做完整声场品质验收。这批声音修改已进入coastal及最新state-reuse包，本地开发服务运行相同生产源码。

用 `python3 tools/verify_local.py --name tidelands-m5-2026-10-16-motion-sound` 校验并单独解压当前包；`python3 tools/verify_motion_sound_delivery.py` 核对本次运动模块、四组混音WAV、普通继续/两次恢复和来源证据。旧空间/运动候选审核绑定各自原源码，不能对新源码直接重跑套作通过结论。旧资源/镜头审计继续绑定各自历史源码，不对新源码套用旧通过结论。后续构建使用 `python3 tools/package_local.py --name tidelands-m5-next --stage 'M5 quality batch checkpoint'`，每次改源码换新包名；已有包只允许相同来源的完全一致重建，拒绝覆盖历史检查点。打包工具回归运行 `python3 tools/test_local_delivery.py`。四岛正常旅程和实际战斗已有十分钟有效帧调度/JS堆记录，见 `docs/cross-island-review.json`：含间歇输入与较多静止时间，不能代替持续运动或GPU品质验收；该采样在两处岛民对话修正之前完成，绑定自己的源码SHA，不能作为当前包完全一致的长时证明。

2026-10-07后续源码增加岛民近距交谈朝向和待机手臂轻动，以及攻击/采集从装备待机姿态进入和恢复的衔接；101项测试和桌面/窄屏12秒隔离循环通过，见 `docs/islander-response-review.json` 与 `docs/action-transition-review.json`。攻击结果统一由短时战斗提示显示，消除空挥时残留旧命中提示；桌面键盘/390窄屏攻击键已实测。上述早期包不含这些后续修改，完整动作品质与声音同步仍待验收。

## 操作

WASD / 方向键移动，Shift 奔跑，左右拖动场景旋转镜头，上下拖动调整俯仰，滚轮缩放。默认使用较近且较低的角色视角，可拉远观察营地；向下拖动可抬头观察灯塔等高处地标，手机同样支持。
连续移动期间自动避障转镜不会改变行走方向；松开后重新移动按当前视角定向，手动拖镜仍能主动转向。
E 与最近目标交互，空格攻击，1–6 快捷操作，B 背包、C 制作、M 地图、Esc 暂停。
采集需要走到资源中心3米以内，角色会转向资源，采植物/贝壳蹲身徒手，采树/石/晶石使用已拥有的石斧，没有石斧时徒手；结束后恢复原装备，在伸手中段获得资源。判定前走出范围不会获得资源。人物、建筑和地标互动保留原有距离。
攻击先蓄势，在挥击中段判定面前近处的敌人；先朝目标移动以转身。徒手、石斧、晶石剑的射程逐步增加，身后、正侧面及远处目标不会命中。打击前暂停、交互或切换装备会取消本次攻击；恢复后可以重新攻击。
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
| `/tests/startup-preparation.html?mode=normal` | 生产开始页的隔离准备诊断；fallback/all-fallback 模拟缺贴图，cancel 测原生上下文中断，restore 模拟准备中页面恢复，upload-error 注入原生GL错误；独立存档键，不代替正常旅程或实际bfcache |
| `/tests/creatures.html` | 生产野猪/蟹的全身与近景、攻击定格及12秒行走/攻击/受击/倒地/恢复循环，输出实际模型反馈和帧调度；无存档读写，不证明真实战斗、落脚自然度或完整场景品质 |
| `/tests/buildings.html` | 生产建筑模型的隔离审查，不证明完整场景品质 |
| `/tests/locomotion.html` | 生产角色的平地/坡地落脚、7米/秒行走、12米/秒奔跑和泳姿隔离检查；可选徒手/石斧/剑、攻击/采集定格及12秒模拟动作循环，计数不代替自然动作和实战审查，无存档读写 |
| `/tests/character-art-review.html` | 生产人物正侧背全身、面部双角度与两色衣装的固定模型检查，无存档读写；旧基线报告绑定旧源码 |
| `/tests/character-adult-world.html` | 新人物与明确营地fixture的昼夜实景、攻击/采集峰值姿势检查，无boot或存档，不代替正常流程/自然动作或性能验收 |
| `/tests/tree-art-review.html` | 生产树木正侧、根颈/树皮、枝叶近景和裸枝轮廓，带同尺度旅人；无boot/存档，固定模型不代替实景/普通采木或最终品质 |
| `/tests/lighthouse-art-review.html` | 生产灯塔正侧、入口/灯室近景与声明任务状态的昼夜实景；无boot/存档，固定q6状态不代替真实修复/完整普通旅程 |
| `/tests/gather-contact.html` | 生产世界树/石/浆果/纤维的固定位置、工具与镜头fixture；核对近距提示、判定前后增量和33帧采集，hand样本的刃部范围是隐藏剑，不能视作手部或实际表面接触；无存档读写 |
| `/tests/gather-kind.html` | 六种资源/有斧无斧/选中剑的明确位置与装备fixture，观察可见掌部、低身、工具切换和完整恢复，无存档；`playthrough?mode=berry` 或 `stone` 加 `&equipment=both` 以显式双工具fixture验生产入口，不代替普通进度 |
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

历史geometry检查点的四轮固定地域驻留审计与桌面十分钟/390窄屏60秒动态样本已保存。固定巡回热身后稳定，完整QA清理缓冲归零；动态P95 17.7/17.8ms，仍保留起始热身、驱动显存/GPU和实际设备等品质边界，详见 `docs/resident-geometry-review.json`。这些记录绑定当时源码，不能作为当前人物/树木版本的长时证明，M5完整品质尚未通过。

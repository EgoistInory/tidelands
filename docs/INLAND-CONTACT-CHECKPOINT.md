# 内陆成熟树接触候选检查点 · 2026-10-29

此批完成 R3 成熟树的根部测量、保守木质体积和隔离真实 main 功能验收。**尚未接入生产，也未完成 M5 或完整 3A。** 生产 181 输入和 `339b94de` ZIP 保持，普通旅程没有读写。

## 已核验

- `inland-root-support-survey.json`：15 原 ID/位置/scale/rotation，原几何 SHA；191 个最低栅格/顶点样本、7263 次投影探测。没有整条所采 basal band 高出地面 35cm 的树。1765 基底最小间隙 −0.974m、中位 0.149m、最大 0.859m，平地控制最大也有 0.753m；源根拱不能直接等同整树悬空。没有据单图降低或扭曲模型，完整自然贴地品质仍未通过。
- `inland-contact-cell-preparation.json`：原近/中枝干表面 35014 格，加入闭合且有方向平衡的树干内部后 35230 格；净增加 216 内部格。开放扫描线只保留表面。根基 native Y<3.2 使用 .2 格，上部 .4 格；全部原木质格被身体/镜头体积覆盖，基底覆盖不粗化。身体 3114、镜头 3010 个盒，未提高核心 10000 限制，也没有删掉高枝。
- `inland-contact-core-audit.json`：真实未改 `game.js/world.js/resource-footprint.js`，全部 15 株在完整世界对象和原 79 敌人记录下，阻挡→实际 deferred 采集木材+3→耗尽通过。15 个单树旧档重叠向外出离、15 旧营地隐藏/休息恢复通过。14 个建造返回恢复资源原因；另一个先触发既有其他限制，未冒称 15 个同原因。
- `inland-contact-native-observations.json`：受控 IAB、真实当前 main 和 UI；明确材料/任务/位置及零 HP 敌人夹具，独立 `tidelands-inland-contact-v1-*` key。桌面 1280×720、1920×1080 buffer 的1765 连续 W 停在 Z −97.063515，再按 W 坐标不变；E 后木材30→33/树隐藏，W 通过至 −100.983515。实际保存按钮、页面重载后 10 个持久字段和79敌人核心字段一致；`interactAt=-100`、敌人 `attackAt=0` 是既有恢复行为，原始序列化字符串并不逐字相等。
- 真正保存于树干内部的坐标重载不被传送；A 被邻近物体限制、S 仍重叠，两次原始观测保留。随后 W 到 `(162.973894,-105.543661)`，独立生产地形/注册木质体积核验证实已离开木质，树未耗尽。单树数值证明与这一株全世界原生证明分开记录。
- 窄屏实际390×844 buffer、中级加载的旧营地场景，树按既有营地优先级隐藏；触控“休息”HP62→100，营地原记录保持。这里近景3D为0，不能冒称窄屏成熟3D主路径通过。
- 镜头完整木质盒分成91个空间块/株，共1365条记录；实际世界包围半径最大7.629m，小于核心镜头候选12m余量，避免按大树根中心误剔除远枝。耗尽/旧营地按实际树状态禁用这些盒。只是边界和接入验证，**未接受实际连续环视、镜头避障和当前候选游戏循环 GPU/长时性能**。
- 3项新增内部体积测试 RED→PASS，和既有接触8项合计11项通过。4张截图已实际查看；3份相关console为空、原生GL0。`verify_inland_contact_checkpoint.py` 核对截图解码尺寸、原始状态、体积审计及所有181生产输入/现包SHA通过。

## 停止的方向与边界

两次 terrain 上界裁剪尝试仍超10000盒，第二次 resource949 为10480盒/34768格，已停止该方向；原型和错误保留 `dist/inland-*prototype*`。最终使用全覆盖的基底精细/上部粗格方案，不放大运行时限制。上部保守格的额外边界、开放树干扫描线、远景过亮/alpha与原normal烘焙、离散LOD、静态树叶列品质待办，不回单叶反复调预算。

`tests/inland-contact-renderer.js` 是隔离验收 binder，生命周期跟随 iframe；关闭页面后释放共享几何/贴图。它没有在同一世界内解除 WeakMap 物理的恢复接口，失败准备、取消与反复安装的生产生命周期仍需在正式迁移时收口。当前没有修改默认启动或正式资产。

## 下一步

先在此接触候选上完成连续镜头/整林穿行与当前游戏循环预算，补窄屏近3D实际操作；随后直接迁移正式启动/本地资产并独立包恢复采集营地回归。保留单级加载、12m最多一株3D的预算，不再调单叶或重新找素材；非阻断形态/风动记录后转晶石、果灌、地表大面。最终声音试听、角色生物动作、完整流程/真机/长时等仍按 M5 全目标审计。

复现：
```
node --test tests/inland-contact-volume.test.js tests/coastal-footprint.test.js
node tools/audit_inland_root_support.mjs
node tools/prepare_inland_contact_cells.mjs
node tools/verify_inland_contacts.mjs
node tools/verify_inland_contacts.mjs --native-overlap
/Users/huxiaocong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tools/verify_inland_contact_checkpoint.py
```

原生入口 `tests/inland-contact-main.html?case=branch`，`case=overlap&resume=1` 使用独立保存，`case=legacy&lod=mid` 为营地夹具。临时57页已关、视口reset；11普通原暂停handoff、4190原PID55245仍监听；临时4195 Ctrl-C/exit130已停。2048保留，历史goal不强改，无券、购买、付费API或公网推送。


2026-10-29 窄屏成熟3D主路径补验：实时96→98%/周47%允许，继续原候选而非只报额度。实际390×844 buffer加载mid，1765近景3D=1；W停在Z−97.084515，再W坐标完全不变，受控点击手机布局采集按钮使木材30→33/树隐藏，W通过至−101.120715。两张截图已看、console空/GL0/15原ID世界不变，正式verify_inland_contact_checkpoint.py连同已有全部证据/181正式输入和ZIP SHA通过。仅声明窄屏按钮采集+键盘穿行，未测本批摇杆/真机/连续镜头/当前循环GPU长时；新证据补齐此前营地场景3D0的范围缺口。生产尚未迁移，接下来优先镜头/循环预算与正式资产及生命周期整组落地，不再调单叶。58关、viewport reset、11原暂停handoff，临时4195预期Ctrl-C exit130停，原普通档未读写。M5五项/完整3A未完，2048保留；无券/购买/付费API/公网推送，仅本地提交。

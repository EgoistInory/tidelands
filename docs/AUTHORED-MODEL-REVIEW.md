# 连续基础模型与作者动作隔离审查

2026-10-21。此前429/Drive配额为历史边界。自然冷却后各一次匿名官方请求已成功取得零价格Standard：Base ZIP 128,968,391字节，SHA fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40；Animation ZIP 15,904,933字节，SHA cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724。完整CRC已核对，无付款、登录、额度重置、代理或身份切换。下载报告只保存稳定来源和档案清单，不保存签名URL或会话令牌。

实际Base Standard包含男性/女性FullBody及头发/眉毛的原点和绑定版本，共18个glTF；两个人体分别14,318/15,060三角形、65骨骼、3蒙皮网格，没有动画。Animation Standard实际43段、65同名骨骼，普通与RM两份GLB；隔离暂用无根位移版本，源参考人体13,744三角形。两包内置CC0 1.0原文已核对并保存docs/licenses，数量来自文件而非官网全版本宣传。

原包glTF有两个缺失法线文件名：T_Eye_Normal_png.png、T_Hair_1_Normal_png.png。档案实际文件为T_Eye_Normal.png、T_Hair_1_Normal.png；派生预览文件明确修正引用并记录对应关系，原ZIP不改。staging工具只读固定SHA档案，拒绝目录/远程URI、符号链接、重复项和超大成员，逐个核对PNG、缓冲/骨架/动作基本结构后写入忽略目录dist/authored-review，实际19文件SHA已保存。不是完整Khronos验证。11项离线工具测试通过。

隔离tests/authored-avatar-review.html使用未修改的官方Three r180 GLTFLoader/BufferGeometryUtils，与现有0.180.0一致，MIT许可证保留；仅测试目录引入，本地import map与同源资产限制，没有生产依赖/CDN。实际男性原始高度1.81959米、女性1.77505米；为检视统一显示1.8米。两者可载入真实皮肤/眼睛/法线和连续躯干，显示仍是光头、内衣基础人体，缺少旅人外套/围巾/背包/靴子和三NPC身份。

六张JPEG均已查看：男性待机、步行、游泳、挥剑，女性待机、390窄屏步行。四次180帧共720帧，按同名骨骼直接试播，6个采样姿态/次，全部GL0、console空且无hidden。步行/挥剑可实际驱动蒙皮；Swim_Fwd_Loop在站立地板视图中明显进入地板，已保留失败画面，游泳高度/坐标约定尚未适配，未调整地板或根节点隐藏问题。女性比例与所有骨骼平移/缩放仍需重定向审查；没有证明全部43段自然度或生产装备/IK接触正确。

素材7张图含5张2048²与2张256²，单性别按RGBA+完整mip粗估约107.3MiB纹理上传量，实际GPU驻留未测；游戏接入前需明确纹理预算。短试播rAF只代表单模型中性地面，不套用为群岛帧率、VRAM、真机或长期性能。原游戏仍使用现有人物，没有把裸基础人体、无剑挥击或白参考人当游戏交付。

本轮资产获取、基本结构、来源与隔离绑定入口收口；下一整组做旅人与三NPC衣装、头发身份、骨骼/装备/攻击采集时序和世界足端适配。保留真实规则、普通存档和角色身份，先有完整衣装/动作候选再替换生产。M5五项和完整3A目标仍未完成，自动化2048继续。核验工具：tools/verify_authored_models.py，原始证据authored-model-staging.json、authored-animation-inventory.json、authored-avatar-browser.json及authored-model-audit.json。

许可证原文保留作者的CRLF和行尾空格，与ZIP内字节SHA一致；Git whitespace检查仅排除这两份原文，其余新代码/文档正常核对。

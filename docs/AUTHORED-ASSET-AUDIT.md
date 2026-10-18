# 连续蒙皮与作者骨架资产审计检查点

2026-10-18。完整M5/3A仍未完成，当前可运行源码4a622d2，旧交付2d922da8和普通备份33455473保持。躯干响应组已收口；本轮转向连续模型/骨架与作者动作，避免继续以胶囊和球体细调替代整体造型。

## 官方来源与选型

使用agent-reach检索路由审查官方来源；遵守不调用付费API，检索通过已有内置网页工具完成。作者的 [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) 声明CC0、glTF/FBX和通用骨架，且与其动画库兼容；实际Standard包含哪些身体/头发仍须查包，不能把官网全版本数量当免费版清单。官网平均约13k三角形也不能替代实际加载统计。

作者的 [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) 为CC0通用骨架动作来源，但网页全部动作不等于免费Standard内容。这里只考虑作者提供的零价格Standard，不购买Pro/Source或调用生成API。[Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) 是备选衣装路线；[Kenney Mini Characters](https://kenney.nl/assets/mini-characters) 虽有CC0和动画，迷你比例不适合当前消除玩具感的主要方向，暂不引入。

官方 [Base Characters itch页面](https://quaternius.itch.io/universal-base-characters) 的免费Standard约122MB，Source另收费。通过“No thanks”实际进入仅列Standard的匿名下载页，没有付款、登录或个人信息填写。浏览器下载事件等待超时并重置自动化会话；随后精确检查Downloads中相应包名，没有文件落地证据，不能称已获得资产。没有盲目再次点击下载。

## 当前网络边界

默认沙盒读取遇到DNS限制；经批准的只读curl成功获得官方网页和公开下载处理代码。Python首次因本机3.14缺少默认证书链失败，改用现有系统CA `/etc/ssl/cert.pem` 严格校验，未关闭TLS验证。随后官方站返回HTTP429，已停止本轮该站请求，留待后续小时自然冷却后重试，不更换身份/IP绕过限流。

新增 tools/fetch_authored_asset.py 复现作者“No thanks”匿名流程，只接受固定作者的Standard名称、唯一零价格上传行、HTTPS文件地址；不保存会话令牌或过期签名URL，不执行下载内容，不覆盖已有档案。压缩包限制160MiB、解压清单总量512MiB和3000项，完整CRC核验后才记录下载成功。该脚本目前没有真实下载成功，3项离线解析/拒绝付费或歧义测试只证明选择保护，不能当网络或资产可用性证明。

## 接续与实际验收

下一小时先核对当前配额、目标、档案是否已存在及本报告，再仅重试一次官方匿名Standard下载；429仍在则保存边界，继续独立的地形/加载管线工作。获得文件后先查内置许可证、SHA、实际皮肤/骨骼/动作、纹理与外部URI，再用与当前Three r180匹配的加载器做隔离渲染和动作检查。只把适合海岛旅人/三NPC身份的连续衣装与模型接入，保留真实装备、动作优先级、足端和正常存档主路径。基础人体或下载样本不作为最终角色交付。

当前没有引入第三方模型、加载器或新运行依赖；没有改动生产代码、普通存档或旧包，也没有将M5勾选。大地形锥形轮廓、整体环境层次、全身自然动作、试听/真机及已记录的性能/混音差距继续保留。自动化2048不删除。

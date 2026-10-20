# 连续蒙皮与作者骨架资产审计检查点

最新状态（2026-10-21）：两份官方免费Standard已实际取得、CC0/清单和隔离试播已审查。见AUTHORED-MODEL-REVIEW.md；以下429和配额段落为历史证据，当前任务转衣装与游戏骨架适配，仍未生产接入。

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

## 2026-10-20 接续：两个素材源仍不可用，停止浏览器下载事件路线

本轮开始于10月18日，浏览器工具返回后已是10月20日。开始时冷却后按检查点仅重试一次Base Standard，严格TLS下仍在purchase GET返回HTTP429，未继续请求该端点。随后读取备选作者官网，其下载按钮明确链接公开Google Drive，而非限流站点的代理或镜像；沿作者文件夹实际查看包内License.txt，原文标明CC0 1.0。Humanoid Rig下单角色只有Blend/FBX；原Individual Characters/glTF下有11个角色，选择与旅人身份较接近的Adventurer.gltf（页面标称3.5MB）作候选，未用机器人/士兵替代角色。

该文件公开ID、目录和失败证据见 `authored-modular-acquisition.json`。浏览器下载返回Invalid InterceptionId，工具报告166739.4204秒墙钟；期间没有取得下载完成事件或落地档案证据，不能当作持续开发时间，长等待的具体原因未证实。此类事件在两个来源已重复，接续禁止再使用浏览器download等待，改为有明确进程/文件/45秒上限的命令行下载；不登录、更换身份或绕过配额。实际限定Downloads中Adventurer文件与项目候选目录检查均没有模型。

有界curl实际收到HTTP成功但内容是2040字节的Google Drive Quota exceeded HTML，说明传输成功不等于模型下载成功。未尝试复制到用户Drive、使用其他ID或代理绕过服务配额。响应改名为忽略目录 `dist/authored-source/Adventurer-drive-quota.html` 保留；没有把HTML当glTF、没有声称获得许可证文件或实际模型。

独立推进离线模型入口检查 `tools/inspect_authored_gltf.py`：只读本地嵌入式glTF/GLB，限制32MiB，拒绝外部URI且不输出该URI，检查GLB长度、缓冲区/访问器范围、骨骼引用/父子循环和动作时间序列，列出实际三角形、骨骼名称和动作时长。仅支持有界子集，遇到稀疏/必需扩展另行审查，不等于完整Khronos验证。5项合成文件测试与原3项免费选择保护共8项通过，实际Google配额HTML也以exit1拒绝；这些是入口工具证据，不是作者模型、动作或美术验收。没有引入加载器或新运行依赖。

本轮34个生产模块SHA与4a622d2检查点一致，旧ZIP和普通JSON的SHA仍为2d922da8/33455473。4190/PID31531仍监听回环，默认沙盒连接失败，经批准的回环curl实际HTTP成功；未错误重启服务。下一优先并行方向是大地形轮廓的独立兼容性基线（资源ID/坐标、规则高度与镜头必须一致），不再把整个开发挂在下载等待；资产额度自然恢复后每轮只做一次有界检查，取得真模型后再做隔离渲染与动作适配。M5五项和完整3A仍未完成，自动化2048保留。

格式依据：[Khronos glTF 2.0规范](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)。备选许可/下载来源：[作者Ultimate Modular Men页](https://quaternius.com/packs/ultimatemodularcharacters.html)。本轮未调用付费API、购买额度或使用重置券，未公网发布。

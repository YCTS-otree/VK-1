# 上游原版 README（桌面桌宠版）

本文是上游 VKmich16/VK-1 的原始说明，为留档保留；**插件版请看仓库根目录的 README.md**。

---
# DSH 余额宠物 · 双平台

贴在桌面上的小挂件：角色举着一块平板，实时显示你的 DeepSeek（DSH）余额。

余额每**下降 0.01 元**，她红闪 + 震动 + 播放打击音效，头顶飘出 `-0.01`，0.2 秒一次串成一条；
余额**上升（充值）**时，屏幕右侧掉下一盆米饭，把它拖到角色身上才一次性入账。

本仓库包含**两个独立实现**，按你的系统选一个：

| 平台 | 当前版本 | 技术栈 | 说明 |
| --- | --- | --- | --- |
| 🪟 **Windows** | **v3**（`大肥鱼桌宠改_D-16BVM`） | PowerShell 5.1 + 内嵌 C# | 见下文「Windows 版」 |
| 🍎 **macOS** | **v1.3.1** | Swift + AppKit | 见下文「macOS 版」 |

两个版本**互不依赖**，各自独立运行；都只访问 DeepSeek 官方接口，不联网上传任何数据。

---

## 🪟 Windows 版

不需要安装、不需要管理员权限 —— 双击就能跑。用 Windows 自带的 PowerShell 5.1
现场编译内嵌的 C#，WinForms 无边框窗口 + 逐像素透明，透明区域鼠标穿透。

![角色立绘](大肥鱼桌宠改_D-16BVM/sprite.png)

**v3 有三件好玩的：**

### 1. 她会换表情

四张脸，按当前状态自动切换：

| 表情 | 什么时候出现 |
| --- | --- |
| 😄 **开心** | 平时都是这张 |
| 😣 **紧张** | 正在扣费的时候（扣完还会保持 1 秒） |
| 😤 **傲娇** | 米饭盆放了 10 秒还没喂她 |
| 😐 **冷脸** | 铁盆扣在她头上的时候 |

铁盆在头上时**扣费她也保持冷脸**；只有新的米饭盆掉下来才会让她重新开心。

### 2. 铁盆：米饭盆的「后事」

米饭盆被她**吃掉**的地方，会掉出一个**铁盆**：

- 铁盆不值钱、也不能吃，纯玩具，随便拖
- **拖到她头上**（或者干脆扔到她头顶），它就会扣在她头上 → 她变冷脸，还会顶着盆一起抖
- **双击她的头** → 她弹一下，铁盆消失
- 同时只会有一个，不会越堆越多

### 3. 火控雷达：目标名牌

有米饭盆的时候，盆周围会出现一个《战争雷霆》风格的**绿色方括号 + 一排读数**：

| 读数 | 含义 |
| --- | --- |
| **距离** | 盆离她多远（单位 kpx） |
| **接近率** | 盆在靠近（正数）还是远离（负数） |
| **相对高度** | 正数 = 盆比她高，负数 = 比它低 |
| **方向环** | 一根指针，指向盆相对她的方位 |

> ⚠️ **米饭盆落地后 10 秒还没喂她，就会被自动吸走吃掉。**
> 如果一次充了好几笔、掉了一地盆：**只要有一个满 10 秒，所有的盆会一起被吸走。**

想提前看看名牌长什么样（不喂也不会被吸）：右键 →「测试充值动画」→「打开火控雷达」。

### 下载与使用

本仓库**暂未发布 Release**，直接下载仓库即可：

1. 点右上角 **Code → Download ZIP**（或 `git clone`），解压到任意目录
   （路径里有中文也没关系，但**不要放在只读位置**）。
2. 进入 **`大肥鱼桌宠改_D-16BVM/`** 目录 —— 这是当前版本。
3. 双击 **`启动DSH余额宠物.vbs`**。
4. 第一次启动会让你填自己的 DeepSeek API Key（`sk-` 开头）；不想填就先取消，
   挂件会离线显示 `--`，之后随时右键 →「设置 API Key」补上。
   装了 DSH 的话，Key 会被自动读取，不弹框。

**运行要求**：Windows + PowerShell 5.1（系统自带）。

> **建议装 Node.js** —— 取余额会先试 .NET，失败再走 Node。
> 有些机器上 .NET 拿不到 TLS 凭据（`SEC_E_NO_CREDENTIALS`），这时只有 Node 这条路能通。
> 出问题时看同目录的 `pet.log`，它会写明走了哪条路。

### 常用操作

| 操作 | 效果 |
| --- | --- |
| 左键按住拖动角色 | 移动；松手后自动吸附回屏幕左下角 |
| 左键按住米饭盆拖动 | 拖到角色身上就喂给她：盆消失 → 头顶冒爱心 → 充值一次性入账 |
| 左键按住铁盆拖动 | 铁盆也能拖，还能扣在她头上 |
| **双击她的头** | 头上扣着铁盆时：她弹一下，铁盆消失 |
| 右键 | 菜单：立即刷新余额 / 测试扣费 / 测试充值动画 / 演示连续扣费 / 尺寸 / 声音 / 设置 Key / 退出 |
| 双击托盘图标 | 手动触发一次扣费动画 |

尺寸有 **中杯 340 / 大杯 454（默认）/ 超大杯 624 像素**三档，也能自定义；
声音有开关和五档音量（改完立刻生效并记住，不影响系统音量）。

### 版本历史

| 版本 | 目录 | 状态 | 内容 |
| --- | --- | --- | --- |
| **v3** | [`大肥鱼桌宠改_D-16BVM`](大肥鱼桌宠改_D-16BVM) | **当前版本** | 表情差分 · 铁盆 · 多目标火控雷达 · PDF 说明书 |
| v2 | [`大肥鱼桌宠改_D-16B`](大肥鱼桌宠改_D-16B) | 保留 | 拖拽惯性 · DSH 风格菜单第二版 |
| v1 | [`大肥鱼桌宠初代_D-16A`](大肥鱼桌宠初代_D-16A) | 存档 | 初版（与下方「原版」内容相同） |
| — | [`原版（Windows版）`](原版（Windows版）) | 上游存档 | 本项目的起点版本，含 zip 归档 |

### 文档

`大肥鱼桌宠改_D-16BVM/` 里有两份说明，**每份都有 PDF / TXT / Markdown 三种格式，内容一样**：

| 文档 | 内容 | 建议 |
| --- | --- | --- |
| **先看这里（快速开始）** | 5 页，带插图，只讲功能 | 👍 **先看这个** |
| **说明文档** | 11 页，完整说明：菜单、账目规则、环境变量、排错、原理 | 想深入了解时看 |

`.txt` 用记事本直接打开；`.md` 适合 GitHub / VS Code；`.pdf` 排版最好、带插图。

---

## 🍎 macOS 版 · DSH大肥鱼桌宠

一个用于 **DeepSeek Harness** 的 macOS 原生余额桌宠。角色手持平板显示余额，扣费时播放受击动画与原版音效，充值时显示提示。使用 Swift + AppKit 开发，无第三方运行时依赖。

**当前版本 v1.3.1**：支持蓝色大肥鱼、GPT龙娘、大小姐Claude、北美猫娘Gemini四个角色；蓝色大肥鱼未连接时显示抱盆图，隐藏余额文字。

### 四个角色

以下为应用实际渲染的四角色拼图，使用统一示例余额，不包含真实账号信息。

[![四个角色使用预览](dsh-balance-pet-macos/docs/previews/four-characters-usage.webp)](dsh-balance-pet-macos/docs/screenshots/four-characters-usage.png)

<table>
  <tr><th width="50%">蓝色大肥鱼</th><th width="50%">GPT龙娘</th></tr>
  <tr>
    <td align="center" width="50%"><a href="dsh-balance-pet-macos/Resources/sprite.png"><img src="dsh-balance-pet-macos/docs/previews/sprite.webp" alt="蓝色大肥鱼" width="360" height="240"></a></td>
    <td align="center" width="50%"><a href="dsh-balance-pet-macos/Resources/sprite-gpt.png"><img src="dsh-balance-pet-macos/docs/previews/sprite-gpt.webp" alt="GPT龙娘" width="360" height="240"></a></td>
  </tr>
  <tr><th width="50%">大小姐Claude</th><th width="50%">北美猫娘Gemini</th></tr>
  <tr>
    <td align="center" width="50%"><a href="dsh-balance-pet-macos/Resources/sprite-claude.png"><img src="dsh-balance-pet-macos/docs/previews/sprite-claude.webp" alt="大小姐Claude" width="360" height="240"></a></td>
    <td align="center" width="50%"><a href="dsh-balance-pet-macos/Resources/sprite-gemini.png"><img src="dsh-balance-pet-macos/docs/previews/sprite-gemini.webp" alt="北美猫娘Gemini" width="360" height="240"></a></td>
  </tr>
</table>

四张原始透明 PNG 均包含在 [`Resources`](dsh-balance-pet-macos/Resources) 文件夹中；上表图片可点击查看原图。

**切换方法：** 右键桌宠，或点击菜单栏 **¥ → 切换角色**。选择立即生效，重启后自动恢复；切换保留余额、动画、窗口位置和尺寸。

蓝色大肥鱼在未配置 API Key / 账号凭证、连接中或连接失败时，改为显示抱盆图，不显示余额标题、金额、状态点或金额飘字；连接成功后自动恢复手持平板和余额显示。其他三个角色保持原有显示方式。

[![大肥鱼未连接状态](dsh-balance-pet-macos/docs/previews/deepseek-offline.webp)](dsh-balance-pet-macos/docs/screenshots/deepseek-offline.png)

### 更新记录

#### v1.3.1 · 离线抱盆状态

- 蓝色大肥鱼在未配置 API Key / 账号凭证、连接中或连接失败时，使用上方抱盆图。
- 隐藏余额标题、金额、状态点及金额飘字；连接成功后自动恢复平板图和余额。
- 透明点击区域随图片切换，其他三个角色不变。
- README 使用轻量预览图与固定尺寸的双列表格，点击图片仍可查看完整 PNG。

#### v1.3.0 · 四角色切换

- 新增 GPT龙娘、大小姐Claude、北美猫娘Gemini，与蓝色大肥鱼共四个角色。
- 通过桌宠右键菜单或菜单栏即时切换，重启后保留选择。
- 切换保留余额、动画、位置及尺寸；加入四角色使用截图和透明原图展示。

### 下载与运行

前往 [最新 Release](https://github.com/Andromedahk/DSH-DaFeiYu-Desktop-Pet/releases/latest)，下载 `DSH-DaFeiYu-macOS.zip`，解压后将 **DSH大肥鱼桌宠.app** 放入“应用程序”并打开。

- 支持 **macOS 13 及以上**；发布包同时包含 Apple Silicon 与 Intel 架构。
- 应用可读取本机 DeepSeek Harness 凭证，独立运行，无需持续打开 DSH；具体配置见 [macOS 使用说明](dsh-balance-pet-macos/README.md#凭证与余额)。
- 应用使用本地临时签名，尚未经过 Apple 开发者签名和公证。首次打开可能被系统拦截；确认下载来源后，可在“系统设置 → 隐私与安全性”中允许打开。

### 日常操作

| 操作 | 功能 |
| --- | --- |
| 左键拖动 | 移动桌宠；默认松手吸附当前屏幕左下角，可在菜单关闭 |
| 右键 / Control + 单击 | 打开菜单，切换角色、尺寸及音效等 |
| 菜单栏 ¥ | 查看余额状态、刷新余额或打开操作菜单 |
| 测试一次扣费 / 演示连续扣费 | 本地演示动画，不发起真实扣费 |

角色透明区域支持鼠标穿透，余额文字随手持平板倾斜和震动，长金额自动缩小显示。

### 从源码构建

安装 Xcode Command Line Tools 后运行：

```sh
cd dsh-balance-pet-macos
ARCH=universal ./build.sh
./verify.sh
open "dist/DSH大肥鱼桌宠.app"
```

省略 `ARCH=universal` 时只构建当前机器架构。离线验证使用独立临时配置，检查四角色资源、切换绘制、配置恢复、余额逻辑、签名和启动行为。

### 文档与来源

- [macOS 版源码与完整使用说明](dsh-balance-pet-macos/README.md)
- [代码审查与验证记录](dsh-balance-pet-macos/docs/REVIEW.md)
- [角色素材来源与文件哈希](dsh-balance-pet-macos/Resources/README.md)
- [Windows 原版存档](原版（Windows版）/DSH余额桌宠/先看这里（快速开始）.md)

本项目基于 [VKmich16/V](https://github.com/VKmich16/V) 的 Windows 原版移植，感谢原作者。原版代码和素材完整保留在 `原版（Windows版）` 目录；缓存、编译产物及个人凭证不纳入版本控制。

上游暂未附带许可证；本仓库保留来源说明，不对上游代码和素材另行授予许可。

---

## 贡献者

| 平台 | 作者 | 说明 |
| --- | --- | --- |
| 🪟 Windows 版（v1 → v3） | [@VKmich16](https://github.com/VKmich16) | 本仓库维护者 |
| 🍎 macOS 版 | [@Andromedahk](https://github.com/Andromedahk) | 从 Windows 原版移植到 Swift + AppKit，独立维护 |
| 上游 Windows 原版 | — | 见 `原版（Windows版）/` |

## 许可

上游暂未附带许可证，本仓库保留来源说明，**不对上游代码和素材另行授予许可**。
macOS 版的许可以其[独立说明](dsh-balance-pet-macos/README.md)为准。

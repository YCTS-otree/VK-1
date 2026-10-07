# DSH 余额挂件 · 插件版（VK-1 网页插件）

> **这是上游 [VKmich16/VK-1](https://github.com/VKmich16/VK-1) 的「插件实现」，不是原版桌面小程序。**
> 原版是一个独立的桌面宠物（macOS Swift App / Windows PowerShell 窗口）；
> 本仓库把它的全部行为移植成 **DSH（DeepSeek Harness）网页插件**，在 DSH Web 界面里运行。

## 这是什么

一个 DSH bundle 插件：角色举着黑屏平板显示 DeepSeek 余额。逐分扣费时红闪 + 震动 + 飘字 + 打击音效；充值不掉数字而是掉一盆米饭，拖到她身上才入账；吃掉米饭盆会掉出铁盆，可以扣在她头上；有米盆时会出现火控雷达目标名牌。

移植自上游最新变体 `大肥鱼桌宠改_D-16BVM`（说明文档自称 v11），保留它全部可观察行为与手感参数。

## 与桌宠原版的区别

| | 桌宠原版 | 本插件 |
| --- | --- | --- |
| 运行宿主 | 独立进程（PowerShell / Swift） | DSH Web 页面内 |
| 窗口 | 原生置顶窗口 + 托盘 + 屏幕角吸附 + 透明像素点击穿透 | 页面内挂件（无置顶/托盘；透明像素仍可穿透） |
| 素材来源 | `%USERPROFILE%\.dsh\.credentials.yaml` | DSH 凭据服务（`DEEPSEEK_API_KEY`） |
| 多外观协同 | 无 | 接入 DSH「切换外观」：可与其它余额显示外观一键互切 |

定位沿用 DSH 生态的惯例：四边四分之一吸附（可组合成角落）、锚点持久化、滚动条避让；吸附到右边缘时镜像美术（**连同铁盆等道具一起镜像**，否则盆会歪向和镜像后的头相反的方向），平板文字重算仿射矩阵保持正向。

## 安装（推荐）

1. 打开 DSH，**把工作区设为 DSH 目录**
2. 对 DeepSeek 说：

   > 安装这个插件：https://github.com/YCTS-otree/VK-1

   （插件包在仓库的 `dsh-plugin/` 子目录；clone 之后把那个目录的路径交给 `plugin_manager` 的 `install_bundle`。）
3. 重启 `dsh web`，然后刷新页面

**需要**：DSH 已配置 `DEEPSEEK_API_KEY` 凭据。不需要平台会话令牌。

> 第 2 步是最省事的方式：让 agent 用 `plugin_manager` 的 `install_bundle` 装，它会一次写好 profile 的 `dependencies` 与 `dsh.bundles`。命令行等价物是
>
> ```
> dsh plugin --profile web add <dsh-plugin 目录的绝对路径>
> ```
>
> （该子命令已实测：`dsh plugin --profile web --version` 返回 pnpm `11.22.0`、退出码 0，`list --depth 0` 能列出 profile 依赖——它就是把参数转交给 profile 里的 pnpm。注意**只跑这一条还不够**：还要把这个包登记为 bundle（加进 profile 的 `dsh.bundles`，或写一条 loader 补丁行），否则不会被装配；让 agent 装就是让它代劳这一步。）

<details>
<summary>手工安装（不想让 agent 代劳时）</summary>

把 `dsh-plugin/` 放到一个固定位置，然后在 DSH profile 的 `package.json` 里加上：

```json
"dependencies": { "dsh-vk1-balance-widget": "link:<绝对路径>/dsh-plugin" },
"dsh": { "bundles": ["dsh-vk1-balance-widget"] }
```

再建一个 `node_modules/dsh-vk1-balance-widget` 指向该目录的 junction，重启 `dsh web`。
</details>

## 功能

- 余额：60s 内缓存 + 点击手动刷新；接口抖动时沿用上次读数
- 逐分结算：每 0.01 元一次完整动画（红闪 / 震动 / 飘字 / 音效），0.2s 一次，单次轮询最多排队 40 次
- 四种表情按优先级自动切换：铁盆扣头（且无米盆）> 扣费中（含 1s 保持）> 米盆闲置 10s > 常态
- 充值 = 掉米饭盆：自由落体 + 弹跳（按落高 0/1/2/3 次）、可拖拽、盆间有碰撞体积；拖到她身上入账并冒爱心
- 铁盆：吃掉米盆后掉出，可拖到她头上戴住；双击她的头取下
- 火控雷达名牌：绿括号 + 类型 + 距离 / 接近率 / 相对高度 + 方向环；任一盆闲置满 10s 全部锁定，1s 后磁吸入账
- 菜单：立即刷新余额 / 测试一次扣费 / 测试充值动画（掉盆、开雷达）/ 演示连续扣费 / 尺寸 128·192·256·384·512 与自定义 px / 声音与音量 / 位置与滚动条避让

## 已知问题

- **「切换外观」目前需要刷新页面**：停用 / 启用外观不会重新挂载挂件，切换后请按一次 F5。根因在注入路径，待修。
- 素材授权状态见下一节。

## 维护

我会持续维护本插件实现：跟随上游的行为变更同步移植，并处理 DSH 侧的兼容问题。

## 致谢与素材

美术、音效、结算节奏与全部手感参数都属于上游作者 **VKmich16**（[VKmich16/VK-1](https://github.com/VKmich16/VK-1)）。本仓库只做形态移植。

> **素材与授权**：上游仓库已采用 **MIT 许可**，并在其 README 的「许可」章节里**明确列出了覆盖范围**——本插件再分发的每一项素材都在清单内：
>
> | 本插件文件 | 上游路径 | 覆盖依据 |
> | --- | --- | --- |
> | `assets/expression_1x/2x.png` | `大肥鱼桌宠改_D-16BVM/sprites/expression_*.png` | MIT 清单「`sprites/*.png`」 |
> | `assets/rice.png`、`assets/iron_bowl.png` | 同目录 | MIT 清单逐项列出 |
> | `assets/hit.mp3`、`assets/feed.mp3` | 同目录 | MIT 清单逐项列出 |
>
> 上游原文：**「可以自由使用、修改、再分发，甚至商用，只要保留版权声明即可」**；以及「**想把这里的素材用在自己的项目（包括移植到别的平台）：注明来源即可，无需另行询问**」。作者另在 [issue #3](https://github.com/VKmich16/VK-1/issues/3) 下以仓库所有者身份回复「感谢你的移植工作，我授权给你了」。
>
> 因此本插件按 MIT 要求随附 [`LICENSE`](LICENSE)（上游版权声明 + 移植者版权声明）。上游的 `.ps1` 源码与桌面端实现**未被本插件包含**。

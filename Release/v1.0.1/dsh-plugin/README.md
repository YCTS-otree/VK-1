# VK-1 · DSH 余额挂件

把大肥鱼桌宠搬进 DSH：她举着平板显示 DeepSeek 余额，花钱时挨打，充值时掉米饭盆。

**插件版本：1.0.1** · 维护者：[YCTS-otree](https://github.com/YCTS-otree) · [报告 BUG / 提建议](https://github.com/YCTS-otree/VK-1/issues) · [更新记录](https://github.com/YCTS-otree/VK-1/blob/main/CHANGELOG.md)

本项目由 [VKmich16/VK-1](https://github.com/VKmich16/VK-1) 的 `大肥鱼桌宠改_D-16BVM` 移植而来，作为 DSH bundle 在网页界面中运行。美术、音效与原版行为来自上游；插件移植和 DSH 兼容由本仓库维护。

> **移植版的问题请在本仓库反馈。** 请勿到原作者仓库提交 DSH 插件 BUG，以免打扰桌宠原版的维护。

## 安装

最简单的方式，是让 DSH 给自己安装插件。

1. 打开 DSH，将工作区设为 **DSH 目录**。
2. 对 DeepSeek 说：

   > 安装这个插件：https://github.com/YCTS-otree/VK-1

3. 安装完成后，重启 `dsh web`，再刷新页面。

DSH 需要已配置 `DEEPSEEK_API_KEY` 凭据。插件通过 DSH 凭据服务读取，不需要额外的平台会话令牌，也不用把 Key 发到聊天里。

<details>
<summary>给安装 agent 的说明 / 手动安装</summary>

可安装的 bundle 位于 `dsh-plugin/`。请把这个子目录的绝对路径交给 `plugin_manager` 的 `install_bundle`，同时登记 profile 依赖和 `dsh.bundles`。

手动管理 profile 时，依赖与 bundle 配置示意如下。需要合并进现有配置，勿覆盖其他插件：

```json
{
  "dependencies": {
    "dsh-vk1-balance-widget": "link:<仓库绝对路径>/dsh-plugin"
  },
  "dsh": {
    "bundles": ["dsh-vk1-balance-widget"]
  }
}
```

通过现有 DSH profile 的包管理流程解析依赖，再重启 Web 服务。仅运行 `dsh plugin --profile web add <dsh-plugin 绝对路径>` 不会完成 bundle 登记，推荐仍让 DSH 的安装工具处理。

独立发布包在 `Release/v1.0.1/dsh-plugin/`，也可交给同一个安装工具。

</details>

## 能做什么

- **余额平板**：显示 DeepSeek 余额，支持手动刷新；接口短暂抖动时尽量保留上次读数，宿主接口缓存 8 秒。
- **逐分扣费**：每下降 0.01 元播放一次红闪、震动、飘字与打击音效，间隔 0.2 秒，单轮最多排队 40 次。
- **充值掉饭盆**：饭盆自由落下、弹跳，可以拖动；拖到角色身上才完成入账动画。
- **铁盆与表情**：吃完饭留下铁盆，拖到头上可以戴住，双击头部取下；四种表情随状态切换。
- **火控雷达**：饭盆闲置 10 秒后触发锁定，随后磁吸入账。
- **位置与外观**：拖动定位、边缘吸附、位置记忆、右侧镜像和滚动条避让；菜单可调大小、声音和音量，也可演示扣费和充值。

## 与桌宠原版的区别

| 项目 | DSH 插件版 | 桌宠原版 |
| --- | --- | --- |
| 运行位置 | DSH Web 页面内 | 独立桌面窗口 |
| 余额凭据 | DSH 凭据服务 | 原桌宠自己的配置流程 |
| 吸附范围 | 网页窗口边缘 | 原生桌面窗口范围 |
| 桌面置顶与托盘 | 无 | 由桌面版实现 |
| 反馈入口 | [本仓库 Issues](https://github.com/YCTS-otree/VK-1/issues) | [原作者仓库](https://github.com/VKmich16/VK-1) |

## 已知问题

**切换外观后可能需要刷新页面。** 当前停用 / 启用流程不会重新挂载挂件，切换后请按 F5。这是移植版待处理的兼容问题。

提交 BUG 请附插件、DSH、浏览器版本与复现步骤；不要上传 API Key、凭据文件、私钥或未脱敏日志。

## 仓库导航

日常开发统一使用 **`main`**。`dsh-plugin` 分支暂时兼容原作者 README 的旧链接，不作为第二条开发线；请以仓库首页为准，原作者更新链接后可删除兼容分支。

| 路径 | 用途 |
| --- | --- |
| `dsh-plugin/` | 正在维护的插件源码、素材和安装入口 |
| `tools/` | 离线检查与发布工具 |
| `Release/v<版本>/` | 各版本独立发布包与 SHA-256 清单 |
| `CHANGELOG.md` | 插件更新记录 |
| `AGENTS.md` | 项目维护规则 |

本仓库只保留 DSH 插件。Windows/macOS 原生桌宠代码与构建工作流已移除；需要桌面版请访问[原作者仓库](https://github.com/VKmich16/VK-1)。历史内容仍可从 Git 提交记录追溯。

## 版本与开发

插件版本以 `dsh-plugin/package.json` 为准，规范化基线为 **1.0.0**（前身版本为 0.2.0），当前维护版本为 **1.0.1**。新增功能递增 MINOR，修复和小改进递增 PATCH，MAJOR 由维护者决定。

上游文档的 **v11** 是来源标记，与本插件版本无关。`index-v11.js` 的文件名保留用于 Loader 缓存兼容。

使用已有 Node.js 与 npm，无需安装额外依赖：

```sh
npm --prefix dsh-plugin run check
npm --prefix dsh-plugin run release
```

离线检查覆盖语法、宿主入口、素材路由、页面脚本注入去重和卸载清理，不读取个人凭据、不访问真实余额接口。UI 变更仍需在 DSH 中检查拖拽、缩放、动画和外观切换。

发布工具输出 `Release/v<版本>/dsh-plugin/` 与 SHA-256 清单，已有版本目录拒绝覆盖。版本更新同步 README 和 CHANGELOG。见[维护规则](https://github.com/YCTS-otree/VK-1/blob/main/AGENTS.md)和[贡献说明](https://github.com/YCTS-otree/VK-1/blob/main/CONTRIBUTING.md)。

## 来源与许可

感谢 **VKmich16** 提供原版桌宠、美术、音效与行为设计。插件移植自 `大肥鱼桌宠改_D-16BVM`，本仓库仅分发插件所需代码与素材。

插件和随附素材按 [MIT 许可](LICENSE)分发，保留原作者与移植者的版权声明。授权说明见[上游 README](https://github.com/VKmich16/VK-1#readme)及[作者授权回复](https://github.com/VKmich16/VK-1/issues/3)。

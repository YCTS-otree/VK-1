# DSH 插件维护规则

## 范围与安全
- YCTS-otree 维护 dsh-plugin/ 中的 DSH 网页插件。本仓库只维护插件，不包含原生桌宠代码、桌面构建链或平台兼容矩阵。
- 禁止读取、展示、复制、提交任何私钥内容；已知路径仅可在明确需要时交给可信程序。
- 不提交凭据、API Key、令牌、个人设置或敏感日志。

## Git、版本与发布
- 修改前检查 Git 状态，保留他人工作，不重写公共历史。
- 开发统一在 main；dsh-plugin 暂时兼容旧链接，不分别开发。
- dsh-plugin/package.json 的 version 是唯一版本来源，规范化初始版本 1.0.0。
- 新功能或显著性能改进递增 MINOR；修复或小改进递增 PATCH；MAJOR 由维护者决定。
- 任务完成后在根 CHANGELOG.md 末尾追加一次条目，格式 ## vMAJOR.MINOR.PATCH - YYYY-MM-DD，只含有实际内容的 Added/Changed/Fixed/Removed/Notes 章节。
- 包元数据、README、CHANGELOG、发布输出版本一致。
- Release/v<版本>/ 独立保存分发文件，不覆盖旧版，不夹带缓存或开发中间产物。

## 兼容与验证
- 保持 dsh-plugin/ 安装路径，保留 MIT 声明与素材来源。
- index-v11.js 是 Loader 历史缓存标识，与插件语义版本无关，变更时同步 exports、files、cordis.patch.yml。
- 文档 UTF-8 无 BOM + LF，不改写历史平台文件编码。
- 使用已有 Node.js/npm，提交前运行 npm --prefix dsh-plugin run check。
- 发布运行 npm --prefix dsh-plugin run release，拒绝覆盖已存在版本。
- UI 变更须在 DSH 中检查拖拽、缩放、动画、外观切换，不能只以构建成功代替。
- 重大架构变更先获维护者同意，在独立分支验证并保留旧实现。

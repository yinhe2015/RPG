# 仓库内容、隐私与第三方资源

## 提交范围

仓库包含游戏与学习版源码、前后端、测试、构建和启动脚本、主题接口、基础题库、C-Eval 中学子集、纸上冒险图形与 Kenney 方块素材。

以下文件只保存在使用者本机，不提交，也不打包为仓库附件：

- `deepseek_apikey.txt`、环境文件与其他密钥文件；克隆后自行配置服务端密钥。
- `data/`：账号、密码哈希、学习问答、错题与存档。克隆后注册新账号。
- 日志、PID、截图（`error.png`、`other/`）、测试截图与报告（`artifacts/`）。
- `node_modules/`、`dist/`、编辑器配置和 Python 缓存。
- `public/themes/pal/`：仙剑已提取的图片、角色帧、背景、音乐及音效。

提交前运行 `npm run repo:check`。检查读取 Git 暂存区，阻止排除路径、常见密钥、密码哈希、个人绝对路径和本地私密值进入提交，报告只输出文件名和规则。它是基础检查，不能保证发现所有形式的敏感信息。可执行 `git config core.hooksPath .githooks` 启用提交前检查。

Git 提交作者使用 GitHub 的 noreply 邮箱。`.gitignore` 不会清除已经进入历史的文件；若未来发生误提交，应撤销相关密钥并清理历史，不能只补忽略规则。

## 仙剑资源

仓库提供兼容代码及素材映射元数据，不提供游戏资源或它们的再分发许可。保留人物名称和主题适配代码不代表项目获得官方授权，也不代表相关角色、标识或素材可任意用于公开发行。私有仓库可限制访问，但不会替代素材授权。

克隆后先使用纸上冒险或方块世界。仙剑主题和学习版人物图像需要另行在本地配置有权使用的资源；未配置时相应图片及原版音频不可用。将提取好的文件直接放入 `public/themes/pal/`，具体目录结构见 [主题文档](themes.md#仙剑资源配置)，来源见 [素材说明](asset-sources.md)。提取出的资源仍受 `.gitignore` 保护。

本机已配置资源的功能不受这些 Git 排除规则影响。任何公开部署、分发或商业用途，都应另行确认涉及的游戏素材、人物与标识等权利，或者替换为自行创作/取得许可的素材。

不带仙剑资源的克隆副本仍可运行 `npm test` 和 `npm run build`；原版音频文件完整性检查在资源目录不存在时明确跳过。三主题完整浏览器测试和 `test:pal-media` 则需要先配置本地仙剑资源。

## 随附第三方许可

| 内容 | 来源及许可 | 仓库中的说明 |
| --- | --- | --- |
| 方块图形 | [Kenney Voxel Pack](https://kenney.nl/assets/voxel-pack)，CC0 | `public/themes/voxel/LICENSE.txt`；不是 Mojang 原版贴图 |
| C-Eval 中学题库 | [C-Eval](https://github.com/hkust-nlp/ceval)，数据采用 [CC BY-NC-SA 4.0](https://github.com/hkust-nlp/ceval/blob/main/LICENSE-DATA) | `docs/licenses/CEVAL-LICENSE-DATA.txt`；保留非商业、署名和相同方式共享要求 |

C-Eval 数据集作者与贡献者的原始来源在上游仓库；本项目对子集进行了筛选、格式转换、知识点标注及问题记录过滤，具体变更见 `docs/ceval-import-report.json`、`scripts/import-ceval.py` 和题库自身的来源字段。该派生子集沿用 CC BY-NC-SA 4.0，不将它改标成代码许可证或 CC0。商用版本需要移除或另行授权该数据集。

本仓库没有为整个混合项目统一授予 MIT 等开源许可；第三方文件继续适用各自许可。依赖库由 `npm ci` 安装，遵守其随包附带的许可。正式公开或商用发布前，应单独确定项目自有代码的许可证与最终素材/题库清单。

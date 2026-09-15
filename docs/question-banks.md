# 题库更换与公开题库

当前游戏装入的是 `question-banks/starter.json`：111 道固定题（75 道选择、18 道简答、18 道开放题），另有三个学段的数学参数化出题。选择题可转成填空或推理题。参数变化和题型改写不计作新的固定题；这仍是基础题库，不是已经导入了万题题库。

## 换题库

1. 复制 `docs/example-bank.json`，修改题库 `id`、`name` 和 `questions`。`id` 只使用小写英文、数字、下划线、连字符，题库之间不能重复。
2. 运行 `npm run bank:check -- /完整路径/你的题库.json` 检查格式。
3. 把 JSON 放入 `question-banks/`，重启 Node/Vite 服务。无需重新构建前端。
4. 登录游戏，在“游戏设置 → 题库”选择它，再选择题库实际覆盖的学科和学段。设置随账号保存。

也可通过服务端环境变量 `QUEST_QUESTION_BANK_DIR=/完整路径/其他题库目录` 完全更换加载目录。目录中每个 `.json` 都应是一份有效题库。读到损坏、重复或缺少答案的题库时，服务会明确报错，不会让题目进入无法作答的战斗。删除一个被选中的题库后，账号下次读取时会回到默认题库。

题庫由服务启动时加载。`dist/` 中不包含题库和参考答案；HTTP 不能读取原始 JSON，浏览器通过 `/api/question` 只获取当前题目、选项、知识点和题库名称。`GET /api/question-banks` 只返回题库简介、题数和覆盖学段。

## 格式 v1

完整例子见 [`example-bank.json`](./example-bank.json)。

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` | 固定为 `1` |
| `id`, `name`, `description`, `source` | 题库标识、显示名称、简介、来源及许可说明 |
| `questions[].id` | 题目稳定标识，同一题库中唯一 |
| `subject` | `chinese / math / english / history / geography / physics` |
| `grade` | `0` 小学，`1` 初中，`2` 高中 |
| `type` | `choice / fill / short / open` |
| `difficulties` | 适用难度数组：`easy / normal / hard`；同一道题可适用于多个档位 |
| `knowledgePoint.id`, `.name` | 稳定知识点标识、显示名称；同一知识点的不同题使用同一个 id |
| `text` | 纯文本题干，可用换行；当前版本不执行 HTML，也没有图题和 LaTeX 专用渲染 |
| `options`, `answer` | 选择题 2–4 个唯一选项，答案必须是选项原文；填空答案不超过 100 字符 |
| `explanation`, `hint` | 解析与技能提示；建议填写 |
| `rubric` | 简答、开放题必填，发送给 DeepSeek 的判分标准，可明确允许的不同观点 |

题库适配器与战斗分离：`server/banks/registry.js` 发现并加载题库，`server/questions.js` 选择题目及衍生题型，`server/deepseek.js` 负责主观题判卷，`src/game.js` 只保留战斗和经验规则。可以单独加入 CSV、其他 JSON 格式、数据库或 HTTP 题库适配器，最终输出相同题目结构即可。

游戏不会把缺少内容的题库悄悄换成另一份题库；所选学科、学段、难度没有题时会提示调整。主观题优先使用题库自带的题干及 rubric；仅有选择题时也可以衍生解释与开放探究题。客观填空目前按规范化后的答案精确比较，复杂同义表达应使用简答题和 rubric。

## 可选的公开大题库

核查日期：2026-09-08。下面是数据集总规模，并非本游戏已安装题数，也不代表所有题都覆盖本游戏的六个学科。

| 数据集 | 总量、语言与内容 | 接入本游戏时需要处理 |
| --- | --- | --- |
| [C-Eval](https://github.com/hkust-nlp/ceval) | 13,948 道中文选择题，52 学科、四个教育层次；数据许可 [CC BY-NC-SA 4.0](https://github.com/hkust-nlp/ceval/blob/main/LICENSE-DATA) | 优先筛选初中、高中子集，保留答案和解析；补知识点标签，复杂公式需要数学排版适配。官方英文 README 记载 2025-07-27 已公开完整测试集，导入仍应以实际文件中的答案字段为准。 |
| [ScienceQA](https://github.com/lupantech/ScienceQA) | 21,208 道多模态选择题，覆盖自然、社会和语言科学，含知识讲解、解析与 skill 标签；数据许可 CC BY-NC-SA 4.0 | 题目主要是英文；可先接无图题并进行翻译校对。完整接入需增加图题展示，不能丢掉必要图片。skill 可以映射到怪物知识点。 |
| [GSM8K](https://github.com/openai/grade-school-math) | 约 8,500 道英文小学数学应用题，带分步解答和最终数值；仓库 [MIT 许可](https://github.com/openai/grade-school-math/blob/master/LICENSE) | 适合数学填空、简答；需中文翻译校对、单位处理和知识点分类。只有数学，不能补齐所有学科。 |
| [CMMU](https://github.com/flageval-baai/CMMU) | 3,603 道中文多模态、多题型题，七学科、小学至高中 | 作者说明公开验证集，测试集通过平台评测；公开可用子集小于总量。需核对实际下载包的使用条款，并增加图题与子题适配。 |

这些资料适合用来扩充，但没有一份可以直接当作“覆盖所有年级、教材版本、知识点、难度和开放题的完整中文学校题库”。对于这个游戏，建议先整理 C-Eval 的中学子集，增加数学应用题来源，再保留自编开放题。数据集的代码许可和数据许可需要分别看；上表中 C-Eval、ScienceQA 的数据都有非商业与相同方式共享条款。

本次已经完成可替换的题库结构、校验工具和可运行示例；上述公开大数据集尚未批量导入。导入时先筛选“有完整题干、有效答案、必要插图齐全”的记录，再补学段、难度与知识点，不把标签缺失的题直接交给学生。

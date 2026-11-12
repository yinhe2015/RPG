# 主题与界面扩展（API v2）

三种主题共用题库、迷宫生成、答题判分、经验和卡片规则；主题负责场景、角色、行走、战斗演出与音频。切换主题不重新开战，不改变血量，也保留输入中的答案和账号偏好。

## 当前能力

| 能力 | 纸上冒险 | 仙剑奇侠 | 方块世界 |
| --- | --- | --- | --- |
| 场景与怪物 | SVG 手绘，知识点徽记与形态进阶 | 原版背景和妖怪，随难度改变素材 | 方块地形、角色、装甲和武器 |
| 探索行走 | 通用移动动作 | 原版四向连续行走帧 | 通用移动动作 |
| 战斗演出 | 通用攻击、投射物、命中与倒下 | 连续动作帧、法术、伙伴辅助及协同演出 | 通用攻击、投射物、命中与倒下 |
| 音乐音效 | 独立程序合成配乐 | 本地原版场景音乐、战斗与结算音效 | 独立程序合成配乐 |

仙剑目前的美术、动作和声音最丰富。规则能力仍然共用，例如卡片和法术造成的伤害由服务端决定，主题只展示结果。`learn.html` 的学习版老师配置是另一套功能，不由冒险主题决定。

## 新建一个主题

在项目根目录执行：

```sh
npm run theme:create -- forest "森林书院"
npm run build
./stop-web.sh
./start-web.sh
```

生成器创建 `src/themes/packs/forest.js`、`forest.css`，并在 `src/themes/catalog.json` 增加主题。新主题立即继承纸上冒险的场景、地图角色、通用动画和音乐，可以在设置中选择并保存到账号。已有文件或同名主题不会被覆盖。

不需要修改 `main.js`、`registry.js`、`server/accounts.js`、地图或音频调度代码。Vite 自动收集 `packs/*.js`，设置界面与服务端使用同一份目录。部署时要同时更新服务端目录与前端构建产物。开发服务器也需重启才能刷新服务端的主题目录。

这是开发者本地主题接口；网页内目前可以选择主题、改强调色和减少动画，没有开放用户上传 JavaScript。

## 目录和边界

| 位置 | 职责 |
| --- | --- |
| `src/themes/catalog.json` | 唯一主题目录：id、API 版本、名字、预览标记、默认色、继承关系、音频配置 |
| `src/themes/catalog.js` | 前后端共用的目录校验、账号偏好识别及已移除主题的默认回退 |
| `src/themes/contract.js` | 纯函数解析继承、合并钩子、检查缺失或错误的接口 |
| `src/themes/registry.js` | 浏览器加载主题适配器及 CSS；应用主题和强调色 |
| `src/themes/packs/<id>.js` | 每个主题的统一入口：场景、地图、动画、指令、样式入口 |
| `src/themes/paper.js`、`pal.js`、`voxel.js` | 三个现有主题的场景渲染器 |
| `src/themes/monsters.js`、`knowledge-points.json` | 稳定的知识点身份、难度与通用形态数据 |
| `src/themes/pal-monsters.js` | 仙剑专用素材映射，与共用怪物身份分离 |
| `src/themes/audio-profiles.js` | 音频预设、配置继承、场景回退；不依赖浏览器或样式 |
| `src/themes/soundtracks.js`、`pal-audio.json` | 现有合成乐谱、仙剑原版音频素材清单 |
| `src/ui/dungeon.js` | 共用地图、相机、迷雾、交互；调用主题地图钩子 |
| `src/ui/arena.js`、`battle-motion.js` | 共用整屏战场和动画调度；调用主题场景与演出钩子 |
| `src/audio.js` | 播放调度、开关、后台暂停、声音清理；读取主题音频配置 |
| `public/themes/<id>/` | 新主题的图片、动作帧、音乐和音效 |

服务器负责状态和规则，主题不要判卷、改血量、修改账号或自行计算经验。保持 `data-action` 接入共用交互；账号名、题目等动态文本输出到 HTML 时使用 `esc()`。

## 主题接口

目录条目包含 `id / version: 2 / name / subtitle / mark / accent`，可选 `extends` 和 `audio`。id 使用小写字母、数字和连字符，以字母开头；发布后保持稳定，否则原账号偏好会退回默认主题。父主题必须存在，不能循环继承。

入口文件默认导出适配器对象，未覆盖的接口继承父主题：

```js
import './forest.css';
import {scene} from './forest-scene.js';

export default {
  scene,
  dungeon: {
    hero: ({dungeon, profile, account}) => '<span class="forest-walker"></span>',
    enemy: ({foe, monster, dungeon, profile}) => '<span class="forest-foe"></span>',
    step: (playerElement, facing, moved) => { /* facing: up/down/left/right */ },
  },
  motion: { actors: ['.forest-player', '.forest-enemy'] },
};
```

上述自定义例子需要自行提供 `forest-scene.js` 和对应样式；生成器默认只输出 `export default {}`，可直接使用。

| 接口 | 约定 |
| --- | --- |
| `scene(model)` | 返回大厅或战场的 HTML；`model` 含 `account, profile, subject, battle, level, inBattle`。`embedded: true` 时只画场景和角色，血条和题目由共用战场绘制 |
| `commands(model)` | 可选，返回主题战斗指令 HTML；未提供时使用通用指令 |
| `dungeon.hero(context)` | 地图人物 HTML，放入共用 `#map-player` 容器 |
| `dungeon.enemy(context)` | 地图怪物 HTML；`foe` 包含稳定的 `id, serial, tier, topic, hue, symbol`，`monster` 包含地图位置与 Boss 标记 |
| `dungeon.step(element, facing, moved)` | 同步地图方向及步行动画；碰墙 `moved=false`，仍可转向 |
| `motion.actors` | 战场中的玩家、怪物 CSS 选择器，用于通用入场、召唤、攻击、倒下 |
| `motion.attack(root, battle, {sound})` | 可选异步专属演出，返回 Promise；只消费已确认的判分和 `lastAction`，结束时清理临时节点。未提供则使用通用演出 |
| `classes.question` | 可选题目容器附加类名 |

减少动画偏好由共用战斗调度处理。专用行走钩子也应遵守该偏好。通用动画会锁定下一题直到完成；避免未结束就 resolve。

`extends` 继承渲染钩子和音频配置，`dungeon / motion / classes` 按字段合并。它不会自动改写 CSS 的主题选择器；继承仙剑接口后若要继承完整皮肤，仍需为新 id 提供样式。无需定制的主题优先从默认纸上冒险开始。

## 样式与怪物

新 CSS 通过主题入口 import，使用 `:root[data-theme="forest"]` 或专属类名前缀限制作用域，避免影响其他主题。预览使用 `.preview-forest`。地图已有 `--maze-floor / --maze-wall / --maze-line / --maze-panel / --maze-text` 变量；完整战斗布局可参考 `pal.css`、`voxel.css`。既有三主题的历史布局规则仍在 `themes.css / arena.css / dungeon.css`，新增主题可以把样式全部放在自己的文件中。

场景根节点沿用 `.game-scene`，保留 `data-monster-id` 和 `data-monster-tier`。根节点中的角色应与 `motion.actors` 匹配。怪物通过 `encounter(model)` 取得知识点身份，再由主题自行映射图片；同一个映射同时用于地图和战斗，避免遇敌后形象跳变。内置知识点编号不要重排，外部知识点使用稳定哈希。`tier` 为 0/1/2，Boss 使用最高档。

## 音乐配置

未设置 `audio` 时继承父主题；也可在目录条目中设置预设与自己的本地素材：

```json
"audio": {
  "preset": "paper",
  "music": {
    "home": {"src": "/themes/forest/home.mp3", "loop": true, "volume": 0.5},
    "battle": {"src": "/themes/forest/battle.mp3", "loop": true},
    "victory": {"src": "/themes/forest/victory.mp3", "loop": false}
  },
  "effects": {"magic": {"src": "/themes/forest/magic.wav", "volume": 0.4}}
}
```

内置预设为 `paper / pal / voxel`，新主题不必增加新预设就能替换全部音乐。场景名为 `home, dungeon, battle, boss, victory, bossVictory, defeat`。未指定的场景沿用预设；缺少 Boss 专曲时回退普通战斗，缺少 Boss 胜利曲时回退普通胜利。音效事件包含 `click, attack, right, wrong, shield, magic, lose, encounter, win`；未提供文件的事件使用合成音效，`mutedEffects` 可以关闭指定事件。合成音乐可通过 `tracks` 按场景覆盖，乐谱结构参考 `soundtracks.js`。

胜利、失败曲通常设置 `loop: false`。切换主题或场景会停止旧音乐；背景音乐与音效开关分别生效。为每种场景配置不同文件即可拥有完整的独立配乐，不需要修改播放器。

## 验证

```sh
npm test
npm run build
node tests/themes-browser.mjs
node tests/dungeon-browser.mjs
node tests/pal-media-browser.mjs
npm run test:theme-extension
```

单元测试覆盖目录错误、循环继承、缺失接口、新主题局部覆盖、生成器文件保护。浏览器测试使用临时账号，验证三个现有主题的切换和存档、响应式战场、地图行走、动画和原版音频。新增主题时还应检查自己的图片加载、角色选择器、各场景音轨、窄屏和减少动画模式。

`test:theme-extension` 在临时副本里真正生成并构建第四个主题，验证设置自动发现、服务端保存、刷新恢复及继承的战斗界面，不会在日常游戏里留下测试主题或测试账号。

## 仙剑资源配置

将已提取好的资源直接放入 `public/themes/pal/`，保留文件名和目录结构：

```text
public/themes/pal/
├── background-*.png       # 战斗背景
├── enemies-*.png          # 妖怪图集及姿态
├── players-*.png          # 队伍人物图集及姿态（学习版也使用）
├── portrait-*.png         # 头像
├── walking-2.png          # 四个朝向的行走图集
└── audio/
    ├── music-*.mp3        # 7 段音乐
    └── sound-*.wav        # 7 种战斗音效
```

资源必须与仓库中的 `src/themes/pal-assets.json`、`src/themes/pal-walk.json` 和 `src/themes/pal-audio.json` 匹配；这些清单保留图片尺寸、动作帧和音频播放配置，由应用直接读取。资源目录只需放入提取好的图片和音频，无需复制清单副本。

配置完成后运行 `npm run build`，再启动服务；开发模式可直接运行 `npm run dev`。部署时使用包含这些静态资源的构建结果。原始游戏文件、提取脚本和转换工具均不再需要，项目中只保留主题运行代码、素材清单及本地提取结果。详细来源见 [素材说明](asset-sources.md)。

探索地图共用格点和交互逻辑，以 `--maze-floor / --maze-wall / --maze-line / --maze-panel / --maze-text` 控制外观。仙剑主题复用本地原版角色和妖怪像素素材；方块主题复用 Kenney 地形，手绘主题沿用 SVG 角色。新增主题时可添加变量、地形 CSS 和探索角色的美术渲染。

纸上冒险和方块世界的程序合成配乐配置在 `src/themes/soundtracks.js`。仙剑配乐独立配置在 `src/themes/pal-audio.json`，直接播放 `public/themes/pal/audio/` 中已转换好的 MP3；这些资源源自 `MUS.MKF` 的 DOS RIX 原曲。大厅、迷宫、普通战斗、Boss 战分别使用原始块 5、19、36、46；普通胜利、Boss 胜利、失败使用块 3、2、1，结算曲只播放一次。浏览器的解码和音量设置可能与当年声卡输出存在差别。

仙剑攻击、挥剑、暴击、施法、格挡、濒死和倒下音效直接使用 `public/themes/pal/audio/` 中的 WAV，来源为 `VOC.MKF`，索引对应 `DATA.MKF` 中李逍遥的角色配置。源档案哈希及曲目索引保存在音频清单中，仅用于记录来源。

仙剑战斗使用已提取的人物 PNG 图集播放连续动作帧：蓄力 7、挥剑 8、收招 9、受击 4、格挡 3、倒下 2。出招时先移动到敌人面前，再播放挥剑与命中音效、受击闪烁、伤害数字、返回站位；怪物也切换动作帧，胜负演出后立即切换结算曲。动画仅展示服务端已确认的结果，并遵守减少动态效果设置。背景音乐和操作音效分别受现有开关控制，切换主题或场景会停止旧配乐，切到后台暂停声音。

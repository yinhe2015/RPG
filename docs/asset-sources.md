# 素材来源

## 仙剑奇侠主题

`pal/` 和 `public/themes/pal/` 均不进入 Git 仓库；下面描述的是本地资源配置，不表示授予原版素材的再分发许可。仓库提交规则见 [仓库说明](repository.md)。

- 输入：用户提供的本地 `pal/` DOS 游戏资源；原文件保持不变。
- 输出：`public/themes/pal/`，由 `scripts/extract-pal.py` 从 MKF 数据提取 PNG 和动作姿态。
- 地图行走：从 `DATA.MKF` 的角色记录读取李逍遥的地图精灵编号，再从 `MGO.MKF` 提取四个朝向、每方向三帧的原版行走动作。图集为 `walking-2.png`，映射为 `src/themes/pal-walk.json`；可用 `python3 scripts/extract-pal.py --walking-only` 单独重新提取。
- 原版音频：`public/themes/pal/audio/`。7 段音乐从 `MUS.MKF` 的 RIX 数据解码，7 种角色音效从 `VOC.MKF` 转成 WAV；没有使用外部下载的游戏录音。索引、时长和原始文件 SHA-256 见 `src/themes/pal-audio.json`。
- 音频转换依赖 [AdPlug](https://github.com/adplug/adplug) 2.4（LGPL-2.1-or-later，系统安装的共享库，仅离线转换时使用）及 FFmpeg。RIX 格式由该库解析，OPL2 模拟器生成原版 FM 乐器声音。游戏音乐及音效的权利仍归原权利人。
- 人物动作帧语义参考 [SDLPAL fight.c](https://github.com/sdlpal/sdlpal/blob/master/fight.c)，角色音效字段参考 [SDLPAL global.h](https://github.com/sdlpal/sdlpal/blob/master/global.h)。
- 美术版权仍属于原游戏权利人，本项目没有把这些资源声明为开源或 CC0。
- 格式参考：[SDLPAL palcommon.c](https://github.com/sdlpal/sdlpal/blob/master/palcommon.c)。离线解压器 [`yj1.c`](https://github.com/sdlpal/sdlpal/blob/master/yj1.c) 原样存于 `scripts/vendor/`，Copyright Wei Mingzhi / SDLPAL development team，GPL-3.0，完整许可 `scripts/vendor/COPYING`。新增 `common.h` 只是独立编译兼容头，不依赖 SDL。提取工具不参与网页运行。

## 方块世界主题

- 作者：Kenney。
- 素材：[Voxel Pack 官方页](https://kenney.nl/assets/voxel-pack)。官方页标记 190 个文件、CC0。
- 下载文件：[kenney_voxel-pack.zip](https://kenney.nl/media/pages/assets/voxel-pack/a3a73d0ff7-1677662501/kenney_voxel-pack.zip)。下载日期：2026-09-08。
- 使用位置：`public/themes/voxel/`；原始许可保留为 `LICENSE.txt`。
- 草地、泥土、树叶、木纹、矿石、人物肢体、剑等素材来自该包；场景组合、角色动画、装甲与界面由本项目代码实现。
- 这是类似《我的世界》的方块沙盒视觉主题，未下载或使用 Mojang 的游戏贴图。

## 纸上冒险主题

沿用本项目的 SVG 角色和手绘风景，增加按知识点变化的徽记、配色与进阶外观。背景音乐和音效使用浏览器 Web Audio 合成，未下载商业音乐。

# 素材来源

## 仙剑奇侠主题

提取好的图片与音频统一放在 `public/themes/pal/`，该目录不进入 Git 仓库。配置方法见 [主题文档](themes.md#仙剑资源配置)，提交规则见 [仓库说明](repository.md)。

- 图片：已从用户提供的本地 DOS 游戏资源提取为 PNG，包括背景、人物、妖怪、姿态和头像。
- 地图行走：`walking-2.png` 包含李逍遥四个朝向、每方向三帧的动作，来源为 `MGO.MKF`；映射和尺寸见 `src/themes/pal-walk.json`。
- 原版音频：`audio/` 中的 7 段 MP3 源自 `MUS.MKF`，7 种 WAV 音效源自 `VOC.MKF`。索引、时长和原始文件 SHA-256 见 `src/themes/pal-audio.json`。
- 当前资源的音乐曾通过 AdPlug 2.4 / OPL2 离线转换；项目直接使用转换结果，不包含提取器、解压器或音频转换工具。
- 人物动作帧语义参考 [SDLPAL fight.c](https://github.com/sdlpal/sdlpal/blob/master/fight.c)，角色音效字段参考 [SDLPAL global.h](https://github.com/sdlpal/sdlpal/blob/master/global.h)。
- 美术、音乐和音效版权仍属于原游戏权利人，本项目没有把这些资源声明为开源或 CC0。

## 方块世界主题

- 作者：Kenney。
- 素材：[Voxel Pack 官方页](https://kenney.nl/assets/voxel-pack)。官方页标记 190 个文件、CC0。
- 下载文件：[kenney_voxel-pack.zip](https://kenney.nl/media/pages/assets/voxel-pack/a3a73d0ff7-1677662501/kenney_voxel-pack.zip)。下载日期：2026-09-08。
- 使用位置：`public/themes/voxel/`；原始许可保留为 `LICENSE.txt`。
- 草地、泥土、树叶、木纹、矿石、人物肢体、剑等素材来自该包；场景组合、角色动画、装甲与界面由本项目代码实现。
- 这是类似《我的世界》的方块沙盒视觉主题，未下载或使用 Mojang 的游戏贴图。

## 纸上冒险主题

沿用本项目的 SVG 角色和手绘风景，增加按知识点变化的徽记、配色与进阶外观。背景音乐和音效使用浏览器 Web Audio 合成，未下载商业音乐。

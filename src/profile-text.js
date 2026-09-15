import {subjects,difficulties,levelFor} from './game.js';
import {availableMoves,cardInventory,cardCatalog} from './combat-cards.js';

// Explicit public fields only; copy every saved history row, not just the five shown.
export function profileText(account,profile,banks=[]){
 const subject=id=>subjects.find(s=>s.id===id)?.name||id;
 const level=levelFor(profile.xp),types={mixed:'混合题型',choice:'选择题',fill:'填空题',short:'简答题',open:'开放题'};
 const date=value=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toLocaleString('zh-CN',{hour12:false}):'未记录';
 return [
  '学科大冒险 · 个人信息',`名字：${account.displayName||account.username}`,`登录账号：${account.username}`,
  `注册时间：${date(profile.createdAt)}`,`等级：Lv.${level}`,`累计经验：${profile.xp} EXP`,
  `本级经验：${profile.xp%100} / 100 EXP`,`距下一级：${100-profile.xp%100} EXP`,
  `战斗场数：${profile.battles}`,`迷宫通关：${profile.dungeonClears||0} 次`,`战胜怪物：${profile.wins}`,`正确作答：${profile.correct}`,`最高连击：${profile.bestCombo}`,
  `已战胜学科：${profile.defeated.map(subject).join('、')||'暂无'}`,
  `已解锁技能：${['口袋计算器',...(level>=2?['知识护盾']:[]),...(level>=3?['灵感提示']:[])].join('、')}`,
  `已解锁招式：${availableMoves(level).map(m=>m.name).join('、')}`,
  `伙伴卡：${cardCatalog.filter(c=>cardInventory(profile)[c.id]).map(c=>`${c.name} ${cardInventory(profile)[c.id]} 星`).join('、')||'暂无'}`,
  '', '当前设置',`学科：${subject(profile.subject)}`,`学段：${['小学','初中','高中'][profile.grade]}`,
  `难度：${difficulties[profile.difficulty]?.name||profile.difficulty}`,`题型：${types[profile.questionType]||profile.questionType}`,
  `题库：${banks.find(b=>b.id===profile.questionBank)?.name||profile.questionBank}`,
  `思考时间：${profile.pace?`${profile.pace/60} 分钟轻提醒`:'不限时'}`,
  `界面：${{paper:'纸上冒险',pal:'仙剑奇侠',voxel:'方块世界'}[profile.theme]||profile.theme}`,
  `强调色：${profile.themeAccent||'默认'}`,`减少动画：${profile.reducedMotion?'是':'否'}`,
  `背景音乐：${profile.music?'开启':'关闭'}`,`战斗音效：${profile.effects?'开启':'关闭'}`,
  '',`已保存的冒险记录（${profile.history.length} 条，最多保留最近 50 条）`,
  ...profile.history.map((h,i)=>`${i+1}. ${date(h.date)} | ${subject(h.subject)} | ${h.result?.boss&&h.win?'迷宫通关':h.win?'挑战成功':'有所收获'} | 正确作答 ${h.correct}${h.result?.answered!==undefined?'/'+h.result.answered:''} | +${h.xp} EXP`),
  ...(profile.history.length?[]:['暂无冒险记录']),
 ].join('\n');
}

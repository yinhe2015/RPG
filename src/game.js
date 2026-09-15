export const subjects = [
 {id:'chinese',name:'语文',en:'CHINESE',monster:'古籍小书妖',desc:'字里行间，藏着你的超能力。',tag:'文字魔法',color:'#eaf0e3',ink:'#658663',icon:'book'},
 {id:'math',name:'数学',en:'MATHEMATICS',monster:'公式计算兽',desc:'解开每道谜题，击破数字迷阵。',tag:'逻辑对决',color:'#fbecdc',ink:'#c58c4e',icon:'calculator'},
 {id:'english',name:'英语',en:'ENGLISH',monster:'单词捣蛋鬼',desc:'用单词作武器，打开新世界。',tag:'词汇风暴',color:'#eeebf5',ink:'#8d7bab',icon:'book'},
 {id:'history',name:'历史',en:'HISTORY',monster:'时光守卫者',desc:'穿越千年，与历史交个手。',tag:'时空探险',color:'#f5edda',ink:'#ad9252',icon:'flag'},
 {id:'geography',name:'地理',en:'GEOGRAPHY',monster:'迷路地球君',desc:'山川与海洋，都在你的地图上。',tag:'世界探索',color:'#e5eeea',ink:'#608d7a',icon:'compass'},
 {id:'physics',name:'物理',en:'PHYSICS',monster:'能量实验怪',desc:'发现万物规律，释放科学力量。',tag:'科学觉醒',color:'#e7edf3',ink:'#698aa6',icon:'bolt'},
];
export const difficulties={easy:{name:'轻松',hp:80,damage:15,reward:40,time:0},normal:{name:'标准',hp:100,damage:20,reward:60,time:0},hard:{name:'挑战',hp:140,damage:25,reward:90,time:0}};
export const shuffle = list => [...list].sort(()=>Math.random()-.5);
export const levelFor = xp => Math.floor(xp/100)+1;
export function applyAnswer(battle, correct, action) {
 const next={...battle};
 if(correct){next.combo++;next.bestCombo=Math.max(next.bestCombo||0,next.combo);next.monsterHP=Math.max(0,next.monsterHP-(action?.totalDamage??(next.combo>=3?35:25)));next.playerHP=Math.min(100,next.playerHP+(action?.heal||0));next.correct++;}
 else {next.combo=0;next.playerHP=Math.max(0,next.playerHP-(action?.totalDamage??(next.shield?0:difficulties[next.difficulty].damage)));next.shield=false;}
 if(action)next.lastAction=action;
 next.answered++;
 next.outcome=next.monsterHP===0?'win':next.playerHP===0?'lose':null;
 return next;
}

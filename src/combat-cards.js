// Shared descriptions and pure combat rules. Only the server rolls and commits outcomes.
export const moves=[
 {id:'attack',name:'挥剑',level:1,kind:'physical',element:'sword',bonus:0},
 {id:'spirit',name:'灵气弹',level:1,kind:'spell',element:'spirit',bonus:0},
 {id:'wind',name:'风咒',level:2,kind:'spell',element:'wind',bonus:3},
 {id:'fire',name:'炎咒',level:3,kind:'spell',element:'fire',bonus:5},
 {id:'thunder',name:'雷咒',level:5,kind:'spell',element:'thunder',bonus:8},
 {id:'swords',name:'万剑诀',level:8,kind:'spell',element:'sword',bonus:12},
];
export const cardCatalog=[
 {id:'yueru',name:'林月如 · 斩龙诀',actor:'yueru',element:'sword',unlock:'首次战斗胜利',description:'答对后概率追加剑击。'},
 {id:'linger',name:'赵灵儿 · 五气朝元',actor:'linger',element:'water',unlock:'累计战斗胜利 3 次',description:'答对后概率追加法术，并恢复少量体力。'},
 {id:'bond',name:'同心 · 仙剑合璧',actor:'both',element:'spirit',unlock:'首次迷宫通关',description:'拥有两位伙伴后，概率发动双人协同，替代本回合单人助战。'},
];
export function cardInventory(user){
 const cards={};for(const c of cardCatalog){const n=user.cards?.[c.id];if(Number.isInteger(n)&&n>0)cards[c.id]=Math.min(3,n);}
 if(user.wins>=1)cards.yueru=Math.max(1,cards.yueru||0);
 if(user.wins>=3)cards.linger=Math.max(1,cards.linger||0);
 if(user.dungeonClears>=1)cards.bond=Math.max(1,cards.bond||0);
 return cards;
}
export function cardPower(id,rank){
 const star=Math.max(1,Math.min(3,rank||1));
 return id==='bond'?{chance:.12+(star-1)*.04,damage:24+(star-1)*8,heal:0}:
  id==='linger'?{chance:.25+(star-1)*.05,damage:10+(star-1)*5,heal:6+(star-1)*2}:
  {chance:.25+(star-1)*.05,damage:8+(star-1)*4,heal:0};
}
export const availableMoves=level=>moves.filter(m=>m.level<=level);
const pick=(items,random)=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
export function rollAction(battle,correct,random=Math.random){
 const pool=correct?availableMoves(battle.combatLevel||1):moves.filter(m=>m.level<=({easy:2,normal:3,hard:5}[battle.difficulty]+(battle.boss?3:0)));
 const move=pick(pool,random),base=correct?(battle.combo+1>=3?35:25):{easy:15,normal:20,hard:25}[battle.difficulty];
 // Enemy spells diversify the presentation without unexpectedly raising the chosen difficulty.
 const blocked=!correct&&Boolean(battle.shield),damage=Math.min(correct?battle.monsterHP:battle.playerHP,blocked?0:base+(correct?move.bonus:0));
 const action={actor:correct?'player':'enemy',move:{...move},damage,heal:0,blocked,assists:[],totalDamage:damage};
 if(!correct)return action;
 let remaining=battle.monsterHP-damage;
 const cards=battle.cards||{},trigger=id=>cards[id]&&random()<cardPower(id,cards[id]).chance;
 const chosen=remaining>0&&cards.yueru&&cards.linger&&trigger('bond')?['bond']:remaining>0?['yueru','linger'].filter(trigger):[];
 for(const id of chosen){
  if(remaining<=0)break;
  const card=cardCatalog.find(c=>c.id===id),power=cardPower(id,cards[id]);
  const hit=Math.min(remaining,power.damage),heal=Math.min(100-battle.playerHP-action.heal,power.heal);
  action.assists.push({id,name:card.name,actor:card.actor,element:card.element,rank:cards[id],damage:hit,heal});
  remaining-=hit;action.heal+=heal;action.totalDamage+=hit;
 }
 return action;
}
export function rewardCards(before,user,boss,random=Math.random){
 const cards=cardInventory(user),rewards=[];
 for(const c of cardCatalog)if(cards[c.id]&&!before[c.id])rewards.push({id:c.id,name:c.name,rank:cards[c.id],previousRank:0});
 const pool=cardCatalog.filter(c=>cards[c.id]&&cards[c.id]<3);
 if(!rewards.length&&pool.length&&(boss||random()<.35)){
  const card=pick(pool,random),previousRank=cards[card.id];cards[card.id]++;
  rewards.push({id:card.id,name:card.name,rank:cards[card.id],previousRank});
 }
 return {cards,rewards};
}

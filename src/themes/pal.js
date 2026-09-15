import assets from './pal-assets.json';
import {palSpriteFor} from './pal-monsters.js';
import {encounter} from './monsters.js';
import {esc} from '../ui/html.js';
import {difficulties} from '../game.js';
import {cardInventory} from '../combat-cards.js';

const backgrounds={chinese:[3,14,13],math:[2,5,25],english:[8,9,4],history:[20,30,16],geography:[9,6,22],physics:[4,12,37]};
function sprite(kind,id,frame=0,tier=1){
 const asset=assets[kind][id];
 const scale=kind==='enemies'?Math.min(1,90/Math.max(asset.width,asset.height))*[.78,.95,1.12][tier]:1;
 return `<span class="pal-sprite pal-frames" data-frames="${asset.frames}" data-frame="${frame}" aria-hidden="true" style="--sprite-w:${asset.width*scale};--sprite-h:${asset.height*scale};--idle-to:${asset.frames>1?100/(asset.frames-1):0}%;background-image:url('/themes/pal/${asset.src}');background-size:${asset.frames*100}% 100%;background-position:${asset.frames>1?frame/(asset.frames-1)*100:0}% 0"></span>`;
}
export function scene(model){
 const {battle:b,subject:s,profile,inBattle,level}=model,foe=encounter(model),hp=b?.playerHP??100,max=b?.maxHP??difficulties[profile.difficulty].hp;
 const palSprite=palSpriteFor(foe);
 const hit=b?.feedback&&b?.animating,won=hit&&b.lastCorrect;
 const cards=b?.cards||cardInventory(profile);
 return `<div class="game-scene pal-scene ${inBattle?'combat-scene':''} ${hit?'pal-impact':''}" data-monster-id="${esc(foe.id)}" data-monster-tier="${foe.tier}" data-sprite="${palSprite}" style="background-image:url('/themes/pal/background-${backgrounds[s.id][foe.tier]}.png')">
  <div class="pal-location">${['竹影初逢','江湖试炼','镇妖之境'][foe.tier]}<small>${esc(s.name)} · ${esc(foe.topic)}</small></div>
  ${inBattle&&!model.embedded?`<div class="fighter-health monster-health pal-enemy-health"><div><b>${esc(foe.name)}</b><span>${b.monsterHP}<em> / ${max}</em></span></div><div class="health-track"><span style="width:${b.monsterHP/max*100}%"></span></div></div>`:''}
  <div class="pal-enemy tier-${foe.tier} ${won?'pal-hurt':''}">${sprite('enemies',palSprite,hit&&!won?1:0,foe.tier)}${won?`<span class="damage-number">${b.combo>=3?35:25}</span>`:''}<span class="pal-target">▽</span>${!inBattle?`<span class="pal-nameplate">${esc(foe.name)}</span>`:''}</div>
  <div class="pal-party pal-companion pal-companion-one ${cards.linger?'':'sleeping'}">${sprite('players',1)}<span class="pal-nameplate">赵灵儿 · ${cards.linger?'★'.repeat(cards.linger):'待结缘'}</span></div>
  <div class="pal-party pal-companion pal-companion-two ${cards.yueru?'':'sleeping'}">${sprite('players',2)}<span class="pal-nameplate">林月如 · ${cards.yueru?'★'.repeat(cards.yueru):'待结缘'}</span></div>
  <div class="pal-party pal-leader ${hit?(won?'pal-attack':'pal-hurt'):''}">${sprite('players',0,b?.outcome==='lose'&&!b.animating?2:0)}${b?.shield?'<span class="shield-bubble"></span>':''}${hit&&!won?`<span class="damage-number">${b.blocked?'格挡':difficulties[b.difficulty].damage}</span>`:''}<span class="pal-nameplate">${esc(model.account?.displayName||model.account?.username||'少年侠客')}</span></div>
  ${won?'<div class="pal-sword-trail" aria-hidden="true">✧</div>':''}
  ${inBattle?`<div class="pal-status-strip"><span>第 ${b.answered+(b.feedback?0:1)} 回合</span><span>${b.combo>=2?`${b.combo} 连击 · 剑意渐盛`:'凝神静思　以学破阵'}</span><span>不限时</span></div>`:'<div class="pal-intro-caption">仗剑入江湖 · 以学问为锋</div>'}
 </div>`;
}

export function commands(model){
 const b=model.battle,level=model.level,busy=b.loading||b.grading||b.feedback||b.animating;
 return `<nav class="pal-commands" aria-label="仙剑战斗指令"><button data-action="focus-answer"><b>攻</b>作答</button><button data-action="hint" ${level<3||b.hintUsed||busy?'disabled':''}><b>术</b>灵感</button><button data-action="shield" ${level<2||b.shieldUsed||busy?'disabled':''}><b>防</b>护盾</button><button data-action="calculator" id="calc-skill" ${Date.now()<b.calcReadyAt||busy?'disabled':''}><b>物</b>计算器 <small id="calc-cooldown"></small></button><button data-action="skills"><b>状</b>技能</button><button data-action="leave"><b>逃</b>返回</button></nav>`;
}

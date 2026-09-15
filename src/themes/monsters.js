import {monster} from '../art.js';
import {esc} from '../ui/html.js';
import knowledgePoints from './knowledge-points.json';

export const tiers={easy:0,normal:1,hard:2};
const hash=value=>[...value].reduce((n,c)=>((n*31+c.codePointAt(0))>>>0),7);
const defaults={chinese:'古诗积累',math:'一元一次方程',english:'基础词汇',history:'古代发明',geography:'四大洋',physics:'磁性材料'};
const species=['chinese','math','english','history','geography','physics'];
// Monster identity depends on a stable knowledge-point id, never on question text/order.
export function encounter({subject,battle,profile}){
 const knowledgePoint=battle?.encounterPoint||battle?.question?.knowledgePoint||battle?.lastKnowledgePoint||{id:`${subject.id}:${defaults[subject.id]}`,name:defaults[subject.id]};
 const serial=(Object.hasOwn(knowledgePoints,knowledgePoint.id)?knowledgePoints[knowledgePoint.id]:hash(knowledgePoint.id))+(battle?.variant||0),tier=battle?.boss?2:tiers[battle?.difficulty||profile.difficulty]??1;
 return {id:knowledgePoint.id,topic:knowledgePoint.name,serial,tier,subject:subject.id,
  name:battle?.boss?`${knowledgePoint.name} · 关底领主`:`${knowledgePoint.name} · ${['小灵','妖卫','魔将'][tier]}`,form:species[(serial+tier)%species.length],
  hue:serial*47%360,symbol:['✦','☽','◇','✳','☀','⌘','△','∞'][serial%8],
  code:(serial%4096).toString(16).padStart(3,'0').toUpperCase()};
}

export function paperMonster(foe){
 const crest=`<span class="monster-crest" aria-hidden="true">${foe.symbol}<small>${esc(foe.topic.slice(0,2))}</small></span>`;
 return `<div class="monster-form tier-${foe.tier}" style="--monster-hue:${foe.hue}deg" role="img" aria-label="${esc(foe.name)}"><div class="monster-body">${monster(foe.form)}</div>${crest}${foe.tier>0?'<span class="monster-horns" aria-hidden="true">⌁</span>':''}${foe.tier===2?'<span class="monster-wings" aria-hidden="true">◀　▶</span><span class="monster-crown" aria-hidden="true">♛</span>':''}</div>`;
}

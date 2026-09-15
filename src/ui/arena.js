import {icon} from '../art.js';
import {encounter} from '../themes/monsters.js';
import {esc} from './html.js';
import {actionSummary} from './combat-cards.js';
import {getTheme} from '../themes/registry.js';

export function arena(model,slots){
 const {battle:b,profile,account,level}=model,foe=encounter(model);
 const health=(name,hp,max,side)=>`<div class="fighter-health ${side}-health"><div><b>${esc(name)}</b><span>${hp}<em> / ${max}</em></span></div><div class="health-track"><span style="width:${hp/max*100}%"></span></div></div>`;
 return `<main class="combat-screen arena-shell"><section class="battle-arena" id="battle-arena" aria-label="战斗场景" data-outcome="${b.outcome||''}" data-animating="${Boolean(b.animating)}">
  <div class="arena-world">${slots.scene}</div><div class="arena-shade" aria-hidden="true"></div>
  <div class="arena-top">${slots.header}</div>
  <div class="arena-status">${health(account.displayName||account.username,b.playerHP,100,'player')}<div class="arena-round"><span>ROUND ${String(b.answered+(b.feedback?0:1)||1).padStart(2,'0')}</span><b>${b.combo>=2?`${b.combo} 连击`:'知识对决'}</b></div>${health(foe.name,b.monsterHP,b.maxHP,'monster')}</div>
  <div class="arena-effects" aria-hidden="true"></div>
  ${b.outcome?`<div class="arena-outcome ${b.outcome}" role="status"><span>${b.outcome==='win'?'战斗胜利':'下次再战'}</span><small>+${b.settlement?.result.xp??0} EXP${b.outcome==='win'?' · 又学会了一点':' · 每一步都有收获'}</small></div>`:''}
  <div class="arena-dock"><section class="question-panel arena-question ${esc(getTheme(profile.theme).classes.question||'')}" aria-labelledby="question-title"><div class="arena-question-scroll">${actionSummary(b)}${slots.question}</div></section><div class="arena-controls"><div class="arena-command-label">${icon('sword',16)} <span>${b.animating?'正在出招':b.grading?'正在判卷':b.feedback?'回合结束':'选择你的行动'}</span></div>${slots.tools}<span class="arena-level">Lv.${level}</span></div></div>
 </section></main>`;
}

import {moves,cardCatalog,cardInventory,cardPower} from '../combat-cards.js';
import {levelFor} from '../game.js';
import {esc} from './html.js';

export function collectionContent(profile){
 const cards=cardInventory(profile),level=levelFor(profile.xp);
 return `<section class="combat-collection"><h3>招式图鉴</h3><p>答对后随机施展已解锁招式；连续答对 3 题，基础伤害由 25 提升至 35，再叠加法术威力。新招式和伙伴卡在下一场战斗生效。</p><div class="spell-collection">${moves.map(m=>`<div class="spell-card ${level<m.level?'locked':''}" data-move-id="${m.id}"><b>${m.name}</b><span>${level>=m.level?'已解锁':`Lv.${m.level} 解锁`}</span><small>${m.bonus?`额外伤害 +${m.bonus}`:'基础伤害'}</small></div>`).join('')}</div><h3>伙伴奖励卡</h3><p>获得后自动助战。普通胜利有 35% 概率升星，Boss 胜利必定获得一张可升级的卡片；里程碑首卡优先，每张最高三星。</p><div class="companion-cards">${cardCatalog.map(c=>{const rank=cards[c.id]||0,p=cardPower(c.id,rank);return `<article class="companion-card ${rank?'owned':'locked'}" data-card-id="${c.id}"><span class="card-portrait">${c.actor==='yueru'?'剑':c.actor==='linger'?'灵':'合'}</span><b>${c.name}</b><span class="card-stars">${rank?'★'.repeat(rank)+'☆'.repeat(3-rank):'尚未获得'}</span><p>${c.description}</p><small>${rank?`触发率 ${Math.round(p.chance*100)}% · 追加 ${p.damage} 伤害${p.heal?` · 恢复 ${p.heal} 体力`:''}`:c.unlock}</small>${c.id==='bond'&&rank&&(!cards.yueru||!cards.linger)?'<small>等待集齐两位伙伴后生效</small>':''}</article>`;}).join('')}</div><p>伙伴只在答对且敌人仍存活时助战。已有账号按累计战绩补齐首张卡片。</p></section>`;
}
export function rewardContent(result){
 const rewards=result?.cardRewards||[],unlocks=(result?.newMoves||[]).map(id=>moves.find(m=>m.id===id)).filter(Boolean);
 return `${rewards.length?`<div class="card-rewards"><h3>获得奖励卡</h3>${rewards.map(c=>`<div class="reward-card" data-reward-card="${esc(c.id)}"><b>${esc(c.name)}</b><span>${'★'.repeat(Math.min(3,c.rank))} · ${c.previousRank?'升星':'新伙伴'}</span></div>`).join('')}</div>`:''}${unlocks.length?`<p class="spell-unlocked">新招式：${unlocks.map(m=>m.name).join('、')}</p>`:''}`;
}
export function actionSummary(battle){
 const a=battle.feedback&&battle.lastAction;if(!a)return '';
 return `<div class="combat-action-summary" role="status"><b>${a.actor==='enemy'?'敌方 · ':''}${esc(a.move.name)}</b><span>${a.blocked?'护盾格挡':`造成 ${a.damage} 伤害`}</span>${a.assists.map(s=>`<span>${esc(s.name)} +${s.damage}${s.heal?` · 恢复 ${s.heal} 体力`:''}</span>`).join('')}${a.assists.length?`<strong>合计 ${a.totalDamage} 伤害</strong>`:''}</div>`;
}

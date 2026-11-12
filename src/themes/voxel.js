import {encounter} from './monsters.js';
import {esc} from '../ui/html.js';
import {difficulties} from '../game.js';

function actor(kind='Player male',foe){
 const prefix={'Player male':'male',Gnome:'gnome',Zombie:'zombie',Skeleton:'skeleton',Alien:'alien'}[kind];
 const image=(part,cls=part)=>`<img class="voxel-${cls}" src="/themes/voxel/Characters/${encodeURIComponent(kind)}/${prefix}_${part}.png" alt="">`;
 return `<div class="voxel-actor ${foe?'voxel-foe tier-'+foe.tier:''}" style="--voxel-hue:${foe?foe.hue%95:0}deg">${image('leg','leg back')}${image('arm','arm back')}${image('body')}${image('leg')}${image('arm')}${image('head')}${foe?`<span class="voxel-rune">${foe.symbol}</span>${foe.tier>0?'<span class="voxel-armor"></span>':''}${foe.tier===2?'<span class="voxel-crown">♛</span><img class="voxel-weapon" src="/themes/voxel/Items/sword_diamond.png" alt="钻石剑">':''}`:'<img class="voxel-weapon" src="/themes/voxel/Items/sword_iron.png" alt="铁剑">'}</div>`;
}
function world(tier){
 return `<div class="voxel-world" aria-hidden="true"><span class="voxel-sun"></span><span class="voxel-cloud cloud-a"></span><span class="voxel-cloud cloud-b"></span><div class="voxel-mountains"></div><div class="voxel-hills"></div>${[0,1,2,3].map(i=>`<div class="voxel-tree tree-${i}"><i></i><b></b></div>`).join('')}<div class="voxel-ground ${tier===2?'ore-ground':''}"></div><span class="voxel-ore"></span><span class="voxel-flower">✿</span></div>`;
}
export function scene(model){
 const {battle:b,subject:s,profile,inBattle}=model,foe=encounter(model),hit=b?.feedback&&b?.animating,win=hit&&b.lastCorrect,max=b?.maxHP??difficulties[profile.difficulty].hp;
 return `<div class="game-scene voxel-scene ${inBattle?'combat-scene':''}" data-monster-id="${esc(foe.id)}" data-monster-tier="${foe.tier}">${world(foe.tier)}<div class="voxel-biome"><b>${['草原','深林','矿洞边境'][foe.tier]}</b><span>${esc(s.name)} / ${esc(foe.topic)}</span></div>${inBattle&&!model.embedded?`<div class="fighter-health player-health"><div><b>${esc(model.account.displayName||model.account.username)}</b><span>${b.playerHP}<em> / 100</em></span></div><div class="health-track"><span style="width:${b.playerHP}%"></span></div></div><div class="fighter-health monster-health"><div><b>${esc(foe.name)}</b><span>${b.monsterHP}<em> / ${max}</em></span></div><div class="health-track"><span style="width:${b.monsterHP/max*100}%"></span></div></div>`:''}<div class="voxel-player ${hit?(win?'voxel-attack':'hurt'):''}">${actor()}${b?.shield?'<span class="shield-bubble"></span>':''}${hit&&!win?`<span class="damage-number">${b.blocked?'格挡':'−'+difficulties[b.difficulty].damage}</span>`:''}</div><div class="voxel-monster ${win?'hurt':''}">${actor(['Gnome','Zombie','Skeleton','Alien'][(foe.serial+foe.tier)%4],foe)}${win?`<span class="damage-number">−${b.combo>=3?35:25}</span>`:''}<span class="voxel-nameplate">${esc(foe.name)} <small>#${foe.code}</small></span></div><div class="voxel-crosshair">+</div><div class="voxel-scene-note">${b?.combo>=2?`${b.combo} 连击 · 知识暴击`:'探索 · 思考 · 升级'}</div></div>`;
}

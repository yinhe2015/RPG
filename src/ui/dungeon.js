import {icon} from '../art.js';
import {subjects,difficulties} from '../game.js';
import {encounter} from '../themes/monsters.js';
import {getTheme} from '../themes/registry.js';
import {esc} from './html.js';
import '../themes/dungeon.css';

export const mazeNames={chinese:'墨香书林',math:'玄机数阵',english:'符文回廊',history:'时光古陵',geography:'山海秘境',physics:'灵能机关城'};
export function dungeonView({dungeon:d,profile,account},header){
 const s=subjects.find(s=>s.id===d.subject),known=new Set(d.revealed);
 const theme=getTheme(profile.theme),hero=theme.dungeon.hero({dungeon:d,profile,account});
 return `<main class="dungeon-screen" id="dungeon-screen" data-status="${d.status}" data-subject="${d.subject}">
 <div class="dungeon-header">${header}</div>
 <div class="dungeon-heading"><div><span>${s.name}迷宫 · ${['小学','初中','高中'][d.grade]} / ${difficulties[d.difficulty].name}</span><h1>${d.name}</h1></div><button class="text-button" data-action="dungeon-leave">${icon('arrow',15)} 返回营地</button></div>
 <div class="dungeon-viewport" id="dungeon-viewport" aria-label="${d.name}探索地图"><div class="dungeon-world" style="--cols:${d.width};--rows:${d.height}">
 <div class="dungeon-tiles">${d.grid.flatMap((row,y)=>row.map((floor,x)=>`<button class="dungeon-tile ${floor?'floor':'wall'} ${known.has(y*d.width+x)?'known':'fog'} decor-${(x*7+y*13)%9}" data-action="walk-to" data-x="${x}" data-y="${y}" data-cell="${y*d.width+x}" tabindex="-1" aria-label="${floor?'道路':'障碍'} ${x},${y}"></button>`)).join('')}</div>
 <div class="map-entrance" style="--x:${d.start.x};--y:${d.start.y}" title="迷宫入口">門</div>
 ${d.supplies.map(p=>`<div class="map-spring ${p.used?'used':''}" data-spring="${p.id}" style="--x:${p.x};--y:${p.y};visibility:${known.has(p.y*d.width+p.x)?'visible':'hidden'}" title="灵泉：恢复全部体力">✦<small>灵泉</small></div>`).join('')}
 ${d.monsters.map(m=>{
 const foe=encounter({subject:s,profile,battle:{difficulty:d.difficulty,encounterPoint:m.knowledgePoint,boss:m.boss,variant:m.variant}});
 const art=theme.dungeon.enemy({foe,monster:m,dungeon:d,profile});
 return `<button class="map-enemy ${m.boss?'boss':''}" data-monster="${m.id}" data-action="walk-to" data-x="${m.x}" data-y="${m.y}" style="--x:${m.x};--y:${m.y};visibility:${!m.defeated&&known.has(m.y*d.width+m.x)?'visible':'hidden'}" aria-label="${esc(foe.name)}">${art}<small>${m.boss?'关底 BOSS':esc(m.knowledgePoint.name)}</small></button>`;
 }).join('')}
 <div class="map-player" id="map-player" style="--x:${d.player.x};--y:${d.player.y}" role="img" aria-label="${esc(account.displayName||account.username)}">${hero}<span class="player-marker">▼</span></div>
 </div><div class="dungeon-vignette"></div></div>
 <aside class="dungeon-minimap" aria-label="探索小地图"><svg viewBox="0 0 ${d.width*5} ${d.height*5}" role="img" aria-label="已探索道路与关底方向">${d.grid.flatMap((row,y)=>row.map((floor,x)=>`<rect data-mini="${y*d.width+x}" x="${x*5}" y="${y*5}" width="4" height="4" fill="${floor?'#92b784':'#384a42'}" opacity="${known.has(y*d.width+x)?1:.12}"/>`)).join('')}<rect class="mini-boss" x="${d.exit.x*5}" y="${d.exit.y*5}" width="5" height="5" fill="#e8aa60"/><circle id="mini-player" cx="${d.player.x*5+2}" cy="${d.player.y*5+2}" r="3" fill="#fffbd1"/></svg><span>金色方块 · 关底</span></aside>
 <div class="dungeon-bottom"><div class="explore-status"><b>${esc(account.displayName||account.username)}</b><span>体力 <strong id="explore-hp">${d.hp}</strong> / 100</span><i><i id="explore-hp-bar" style="width:${d.hp}%"></i></i><small id="explore-count">已击败 ${d.defeated} / ${d.monsters.length}</small></div><div class="explore-tip"><b id="explore-tip">寻找关底，击败领主</b><span>方向键 / WASD · 点击道路移动<br>遇敌即战 · 灵泉恢复体力</span></div><nav class="dungeon-dpad" aria-label="移动方向">${[['up','↑','向上'],['left','←','向左'],['down','↓','向下'],['right','→','向右']].map(([dir,label,name])=>`<button data-action="move" data-direction="${dir}" aria-label="${name}">${label}</button>`).join('')}</nav></div>
 ${d.status!=='active'?`<div class="dungeon-ending"><span>${d.status==='cleared'?'✦':'☽'}</span><h2>${d.status==='cleared'?'迷宫通关':'休息一下，再出发'}</h2><p>${d.status==='cleared'?`${esc(d.name)}的关底领主已被击败。`:'已经获得的经验会保留。下次会是全新的地图。'}</p><p>击败 ${d.defeated} 个怪物 · 行走 ${d.steps} 步</p><div><button class="secondary-button" data-action="dungeon-home">返回营地</button><button class="primary-button" data-action="dungeon-restart">再探新迷宫</button></div></div>`:''}
 <div class="encounter-wipe" aria-hidden="true"></div>
 </main>`;
}
export function syncDungeon(d,{moved=false}={}){
 const root=document.querySelector('#dungeon-screen');if(!root)return;
 const known=new Set(d.revealed),player=root.querySelector('#map-player');player.style.setProperty('--x',d.player.x);player.style.setProperty('--y',d.player.y);
 getTheme(document.documentElement.dataset.theme).dungeon.step(player,d.facing,moved);
 for(const cell of root.querySelectorAll('[data-cell]')){const visible=known.has(Number(cell.dataset.cell));cell.classList.toggle('known',visible);cell.classList.toggle('fog',!visible);}
 for(const cell of root.querySelectorAll('[data-mini]'))cell.setAttribute('opacity',known.has(Number(cell.dataset.mini))?'1':'.12');
 for(const m of d.monsters){const e=root.querySelector(`[data-monster="${m.id}"]`);e.style.visibility=!m.defeated&&known.has(m.y*d.width+m.x)?'visible':'hidden';}
 for(const p of d.supplies){const e=root.querySelector(`[data-spring="${p.id}"]`);e.classList.toggle('used',p.used);e.style.visibility=known.has(p.y*d.width+p.x)?'visible':'hidden';}
 root.querySelector('#mini-player').setAttribute('cx',d.player.x*5+2);root.querySelector('#mini-player').setAttribute('cy',d.player.y*5+2);
 root.querySelector('#explore-hp').textContent=d.hp;root.querySelector('#explore-hp-bar').style.width=`${d.hp}%`;root.querySelector('#explore-count').textContent=`已击败 ${d.defeated} / ${d.monsters.length}`;
 positionCamera(d);
}
export function positionCamera(d){
 const viewport=document.querySelector('#dungeon-viewport'),world=viewport?.querySelector('.dungeon-world');if(!world)return;
 const tile=parseFloat(getComputedStyle(world).getPropertyValue('--tile'));
 const x=viewport.clientWidth/2-(d.player.x+.5)*tile;
 const y=viewport.clientHeight*.48-(d.player.y+.5)*tile;
 world.style.transform=`translate(${x}px,${y}px)`;
}
export function routeTo(d,x,y){
 const key=(x,y)=>`${x},${y}`,known=new Set(d.revealed);if(!known.has(y*d.width+x)||!d.grid[y]?.[x])return [];
 const queue=[{...d.player,path:[]}],seen=new Set([key(d.player.x,d.player.y)]);
 for(let i=0;i<queue.length;i++){const p=queue[i];if(p.x===x&&p.y===y)return p.path;for(const [direction,dx,dy]of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){const nx=p.x+dx,ny=p.y+dy,k=key(nx,ny);if(d.grid[ny]?.[nx]&&known.has(ny*d.width+nx)&&!seen.has(k)){seen.add(k);queue.push({x:nx,y:ny,path:[...p.path,direction]});}}}
 return [];
}

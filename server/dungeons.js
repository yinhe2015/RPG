import {randomUUID,randomInt} from 'node:crypto';
import {getBank} from './banks/registry.js';
import {createQuestion} from './questions.js';

export const dungeonNames={chinese:'墨香书林',math:'玄机数阵',english:'符文回廊',history:'时光古陵',geography:'山海秘境',physics:'灵能机关城'};
export const directions={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const shuffled=(values,random)=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function distances(grid,start){
 const result=new Map([[`${start.x},${start.y}`,0]]),queue=[start];
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy]of Object.values(directions)){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(grid[y]?.[x]===1&&!result.has(key)){result.set(key,result.get(`${p.x},${p.y}`)+1);queue.push({x,y});}}}
 return result;
}
export function reveal(d){
 const known=new Set(d.revealed);for(let y=d.player.y-3;y<=d.player.y+3;y++)for(let x=d.player.x-3;x<=d.player.x+3;x++)if(x>=0&&y>=0&&x<d.width&&y<d.height&&Math.hypot(x-d.player.x,y-d.player.y)<=3.6)known.add(y*d.width+x);
 d.revealed=[...known];
}
export function generateDungeon(settings,random=()=>randomInt(0,0x1000000)/0x1000000){
 const sample=createQuestion({...settings,type:settings.questionType||settings.type||'mixed'});
 const [width,height,count]={easy:[13,11,4],normal:[17,13,6],hard:[21,15,8]}[settings.difficulty];
 const grid=Array.from({length:height},()=>Array(width).fill(0)),start={x:1+2*Math.floor((width-1)/4),y:1+2*Math.floor((height-1)/4)},stack=[start];grid[start.y][start.x]=1;
 while(stack.length){const p=stack.at(-1),options=shuffled(Object.values(directions),random).filter(([dx,dy])=>{const x=p.x+dx*2,y=p.y+dy*2;return x>0&&y>0&&x<width-1&&y<height-1&&!grid[y][x];});if(!options.length){stack.pop();continue;}const [dx,dy]=options[0];grid[p.y+dy][p.x+dx]=1;grid[p.y+dy*2][p.x+dx*2]=1;stack.push({x:p.x+dx*2,y:p.y+dy*2});}
 // Small chambers and a few loops keep the maze from being a single twisting corridor.
 for(let room=0;room<3;room++){const x=1+2*Math.floor(random()*((width-3)/2)),y=1+2*Math.floor(random()*((height-3)/2));for(let dy=0;dy<3&&y+dy<height-1;dy++)for(let dx=0;dx<3&&x+dx<width-1;dx++)grid[y+dy][x+dx]=1;}
 for(let i=0;i<width;i++){const x=1+Math.floor(random()*(width-2)),y=1+Math.floor(random()*(height-2));if((grid[y][x-1]&&grid[y][x+1])||(grid[y-1][x]&&grid[y+1][x]))grid[y][x]=1;}
 const reach=distances(grid,start),cells=[...reach].map(([key,distance])=>{const [x,y]=key.split(',').map(Number);return{x,y,distance};}).sort((a,b)=>b.distance-a.distance);
 const exit=cells[0],pool=getBank(settings.questionBank).questions.filter(q=>q.subject===settings.subject&&q.grade===settings.grade&&q.difficulties.includes(settings.difficulty)&&q.type==='choice');
 const topics=shuffled([...new Map(pool.map(q=>[q.knowledgePoint.id,q.knowledgePoint])).values()],random);if(!topics.length)topics.push(sample.knowledgePoint);
 const occupied=new Set([`${start.x},${start.y}`,`${exit.x},${exit.y}`]),monsters=[];
 for(const p of shuffled(cells.filter(c=>c.distance>3),random)){
  if(monsters.length>=count)break;if(occupied.has(`${p.x},${p.y}`)||monsters.some(m=>Math.abs(m.x-p.x)+Math.abs(m.y-p.y)<3))continue;
  occupied.add(`${p.x},${p.y}`);monsters.push({id:randomUUID(),x:p.x,y:p.y,boss:false,defeated:false,knowledgePoint:topics[monsters.length%topics.length],variant:Math.floor(random()*1000)});
 }
 monsters.push({id:randomUUID(),x:exit.x,y:exit.y,boss:true,defeated:false,knowledgePoint:{id:`${settings.subject}:关底试炼`,name:'关底试炼'},variant:Math.floor(random()*1000)});
 const supplies=shuffled(cells.filter(p=>p.distance>3&&!occupied.has(`${p.x},${p.y}`)),random).slice(0,2).map((p,i)=>({id:`spring-${i}`,x:p.x,y:p.y,used:false}));
 const d={id:randomUUID(),...settings,name:dungeonNames[settings.subject],width,height,grid,player:{...start},facing:'down',start,exit:{x:exit.x,y:exit.y},monsters,supplies,revealed:[],hp:100,steps:0,status:'active',battleId:null,created:Date.now(),defeated:0};reveal(d);return d;
}
export function moveInDungeon(d,direction,step){
 if(d.status!=='active')throw Error('DUNGEON_FINISHED');if(!Object.hasOwn(directions,direction))throw Error('INVALID_MOVE');
 if(step!==d.steps)return {stale:true};
 d.facing=direction;
 const [dx,dy]=directions[direction],x=d.player.x+dx,y=d.player.y+dy;
 if(d.grid[y]?.[x]!==1)return {blocked:true};
 const monster=d.monsters.find(m=>m.x===x&&m.y===y&&!m.defeated);d.steps++;
 if(monster)return {monster};
 d.player={x,y};reveal(d);const spring=d.supplies.find(s=>s.x===x&&s.y===y&&!s.used);if(spring){spring.used=true;d.hp=100;}
 return {healed:Boolean(spring)};
}
export function applyDungeonBattle(d,b){
 if(!b.outcome||b.dungeonApplied)return;b.dungeonApplied=true;
 const monster=d.monsters.find(m=>m.id===b.monsterId);
 if(b.outcome==='win'){
  monster.defeated=true;d.defeated++;d.player={x:monster.x,y:monster.y};d.hp=Math.min(100,b.playerHP+25);reveal(d);
  if(monster.boss)d.status='cleared';
 }else{d.hp=0;d.status='failed';}
}
export function publicDungeon(d){if(!d)return null;const{created,...value}=d;return value;}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {generateDungeon,distances,moveInDungeon,applyDungeonBattle} from '../server/dungeons.js';
import {createApiMiddleware} from '../server/api.js';
import {createAccountStore} from '../server/accounts.js';
import {banks} from '../server/banks/registry.js';
import {createQuestion} from '../server/questions.js';
const settings={subject:'math',grade:1,difficulty:'easy',questionBank:'ceval-school',questionType:'choice',pace:0};
function pathTo(d,target){
 const queue=[{...d.player,path:[]}],seen=new Set([`${d.player.x},${d.player.y}`]);
 for(let i=0;i<queue.length;i++){const p=queue[i];if(p.x===target.x&&p.y===target.y)return p.path;for(const [dir,dx,dy]of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){const x=p.x+dx,y=p.y+dy,k=`${x},${y}`;if(d.grid[y]?.[x]===1&&!seen.has(k)){seen.add(k);queue.push({x,y,path:[...p.path,dir]});}}}
 throw Error('No route');
}
test('random mazes connect every floor, place reachable distinct enemies/springs and put boss at the farthest point',()=>{
 const layouts=new Set();
 for(let i=0;i<40;i++){
  const d=generateDungeon({...settings,difficulty:['easy','normal','hard'][i%3]});layouts.add(JSON.stringify(d.grid));
  const reachable=distances(d.grid,d.start);assert.equal(reachable.size,d.grid.flat().filter(Boolean).length);
  assert.equal(reachable.get(`${d.exit.x},${d.exit.y}`),Math.max(...reachable.values()));
  assert.equal(d.monsters.filter(m=>m.boss).length,1);
  const positions=[...d.monsters,...d.supplies].map(p=>`${p.x},${p.y}`);assert.equal(new Set(positions).size,positions.length);
  for(const p of positions)assert.ok(reachable.has(p));
  d.player={x:1,y:1};const before={...d.player};assert.equal(moveInDungeon(d,'up',0).blocked,true);assert.deepEqual(d.player,before);assert.equal(d.steps,0);
 }
 assert.equal(layouts.size,40);
});
test('defeat ends exploration; regular victories preserve the run; a boss victory alone clears it',()=>{
 const d=generateDungeon(settings),m=d.monsters.find(m=>!m.boss);
 const b={outcome:'win',monsterId:m.id,playerHP:42};applyDungeonBattle(d,b);assert.equal(d.status,'active');assert.equal(d.hp,67);assert.equal(d.defeated,1);
 applyDungeonBattle(d,b);assert.equal(d.defeated,1);
 const boss=d.monsters.find(m=>m.boss);applyDungeonBattle(d,{outcome:'win',monsterId:boss.id,playerHP:20});assert.equal(d.status,'cleared');
 const failed=generateDungeon(settings);applyDungeonBattle(failed,{outcome:'lose',monsterId:failed.monsters[0].id});assert.equal(failed.status,'failed');assert.equal(failed.hp,0);
 assert.throws(()=>moveInDungeon(failed,'right',failed.steps),/DUNGEON_FINISHED/);
});
test('walking remembers direction, turns at walls and enemies, and ignores stale turns',()=>{
 const d=generateDungeon(settings);
 assert.equal(d.facing,'down');
 d.grid=Array.from({length:d.height},()=>Array(d.width).fill(1));
 d.player={x:2,y:2};d.monsters=[];d.supplies=[];
 for(const direction of ['up','right','down','left']){
  const step=d.steps;moveInDungeon(d,direction,step);assert.equal(d.facing,direction);assert.equal(d.steps,step+1);
 }
 d.grid[1][2]=0;
 assert.equal(moveInDungeon(d,'up',d.steps).blocked,true);assert.equal(d.facing,'up');assert.deepEqual(d.player,{x:2,y:2});
 assert.equal(moveInDungeon(d,'down',d.steps-1).stale,true);assert.equal(d.facing,'up');
 d.monsters=[{id:'guard',x:3,y:2}];
 assert.equal(moveInDungeon(d,'right',d.steps).monster.id,'guard');assert.equal(d.facing,'right');
 applyDungeonBattle(d,{outcome:'win',monsterId:'guard',playerHP:50});assert.equal(d.facing,'right');
});
test('exploration API enforces ownership and steps, resumes encounters, clears boss exactly once and persists clearance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-dungeon-api-'));const file=join(dir,'accounts.json'),store=createAccountStore(file);let clock=Date.now();
 const middleware=createApiMiddleware({accountStore:store,now:()=>clock});const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const post=async(path,body,cookie)=>{clock+=1000;return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie:cookie||''},body:JSON.stringify(body)});};
 const get=cookie=>fetch(base+'dungeon/current',{headers:{cookie}}).then(r=>r.json());
 try{
  const reg=await post('auth/register',{username:'maze-owner',password:'test-pass'}),cookie=reg.headers.get('set-cookie').split(';')[0],user=(await reg.json()).user;
  const other=await post('auth/register',{username:'maze-other',password:'test-pass'}),foreign=other.headers.get('set-cookie').split(';')[0];
  let state=await(await post('dungeon/start',settings,cookie)).json(),d=state.dungeon;assert.ok(d?.id);
  assert.equal((await post('dungeon/move',{dungeonId:d.id,direction:'right',step:0},foreign)).status,404);
  assert.equal((await post('dungeon/start',settings,cookie)).status,409);
  const direction=pathTo(d,d.exit)[0];const firstBody={dungeonId:d.id,direction,step:d.steps};await post('dungeon/move',firstBody,cookie);const after=await get(cookie);
  await post('dungeon/move',firstBody,cookie);assert.equal((await get(cookie)).dungeon.steps,after.dungeon.steps);d=after.dungeon;
  assert.equal(d.facing,direction);assert.equal((await get(cookie)).dungeon.facing,direction);
  let lastGrade,bossHP=0;
  for(let guard=0;guard<500&&d.status==='active';guard++){
   state=await get(cookie);
   if(!state.encounter){const direction=pathTo(state.dungeon,state.dungeon.exit)[0];state=await(await post('dungeon/move',{dungeonId:d.id,direction,step:state.dungeon.steps},cookie)).json();}
   if(state.encounter){
    const b=state.encounter.battle;if(b.boss)bossHP=b.maxHP;
    assert.equal((await get(cookie)).encounter.battle.id,b.id);
    assert.equal((await post('dungeon/continue',{dungeonId:d.id},cookie)).status,409);
    let grade;
    do{const q=await(await post('question',{battleId:b.id},cookie)).json();const raw=banks.get('ceval-school').questions.find(raw=>raw.text===q.text&&raw.options.every((o,i)=>o===q.options[i]));assert.ok(raw);if(!b.boss)assert.equal(q.knowledgePoint.id,b.encounterPoint.id);
     grade=await(await post('grade',{questionId:q.id,answer:raw.answer},cookie)).json();assert.ok(grade.battle);lastGrade={q,raw,grade};
    }while(!grade.battle.outcome);
    const duplicate=await(await post('grade',{questionId:lastGrade.q.id,answer:lastGrade.raw.answer},cookie)).json();assert.equal(duplicate.settlement.user.xp,grade.settlement.user.xp);
    state=await(await post('dungeon/continue',{dungeonId:d.id},cookie)).json();
   }
   d=state.dungeon;
  }
  assert.equal(d.status,'cleared');assert.ok(bossHP>80);assert.equal(lastGrade.grade.settlement.result.xp,80);
  const saved=await createAccountStore(file).get(user.id);assert.equal(saved.dungeonClears,1);
  const next=await(await post('dungeon/start',settings,cookie)).json();assert.notEqual(next.dungeon.id,d.id);assert.notDeepEqual(next.dungeon.grid,d.grid);
  assert.equal((await post('dungeon/leave',{dungeonId:next.dungeon.id},cookie)).status,200);assert.equal((await get(cookie)).dungeon,null);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('every school stage, subject and question type can load consecutive dungeon rounds, including procedural math',()=>{
 for(const subject of ['chinese','math','english','history','geography','physics'])for(const grade of [0,1,2])for(const type of ['mixed','choice','fill','short','open']){
  const d=generateDungeon({subject,grade,difficulty:'normal',questionBank:'starter',questionType:type});
  for(const m of d.monsters)for(let round=0;round<4;round++){
   const q=createQuestion({subject,grade,difficulty:'normal',questionBank:'starter',type,round,knowledgePointId:m.boss?undefined:m.knowledgePoint.id});assert.ok(q.text);
  }
 }
});

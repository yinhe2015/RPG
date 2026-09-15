import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {availableMoves,rollAction,cardInventory,cardPower,rewardCards} from '../src/combat-cards.js';
import {applyAnswer} from '../src/game.js';
import {createAccountStore} from '../server/accounts.js';
import {createApiMiddleware} from '../server/api.js';

const battle={id:'fight',combatLevel:1,cards:{},playerHP:90,monsterHP:200,combo:0,bestCombo:0,correct:0,answered:0,difficulty:'normal'};
test('random moves respect level unlocks and enemy difficulty; client state cannot select a locked spell',()=>{
 assert.deepEqual(availableMoves(1).map(m=>m.id),['attack','spirit']);
 assert.equal(rollAction(battle,true,()=>.99).move.id,'spirit');
 assert.equal(rollAction({...battle,combatLevel:3},true,()=>.99).move.id,'fire');
 assert.equal(rollAction({...battle,combatLevel:8},true,()=>.99).move.id,'swords');
 assert.equal(rollAction({...battle,difficulty:'hard',boss:true},false,()=>.99).move.id,'swords');
 assert.equal(rollAction({...battle,difficulty:'hard',boss:true},false,()=>.99).damage,25);
 const hit=rollAction({...battle,combo:2,combatLevel:8},true,()=>.99);assert.equal(hit.damage,47);
});
test('partner and co-op hits apply exactly once, cap at remaining HP and healing at 100',()=>{
 const b={...battle,cards:{yueru:1,linger:2},playerHP:98};
 const action=rollAction(b,true,()=>0);assert.deepEqual(action.assists.map(a=>a.id),['yueru','linger']);assert.equal(action.heal,2);assert.equal(action.totalDamage,48);
 const next=applyAnswer(b,true,action);assert.equal(next.monsterHP,152);assert.equal(next.playerHP,100);assert.equal(next.correct,1);
 const coop=rollAction({...b,cards:{yueru:1,linger:1,bond:3}},true,()=>0);assert.deepEqual(coop.assists.map(a=>a.id),['bond']);assert.equal(coop.totalDamage,65);
 const overkill=rollAction({...b,monsterHP:28},true,()=>0);assert.equal(overkill.totalDamage,28);assert.equal(overkill.assists.length,1);assert.equal(overkill.assists[0].damage,3);
 assert.equal(rollAction({...b,monsterHP:25},true,()=>0).assists.length,0);
 const blocked=rollAction({...b,shield:true},false,()=>0);assert.equal(blocked.totalDamage,0);assert.equal(blocked.assists.length,0);assert.equal(blocked.heal,0);
 assert.equal(applyAnswer({...b,shield:true},false,blocked).shield,false);
});
test('milestone grants, duplicate upgrades, star caps and probabilities are explicit',()=>{
 assert.deepEqual(cardInventory({wins:3,dungeonClears:1}),{yueru:1,linger:1,bond:1});
 assert.equal(cardPower('yueru',3).chance,.35);
 const first=rewardCards({}, {wins:1},false,()=>.99);assert.equal(first.rewards[0].id,'yueru');
 const failedRoll=rewardCards({yueru:1},{wins:2,cards:{yueru:1}},false,()=>.9);assert.equal(failedRoll.rewards.length,0);
 const upgrade=rewardCards({yueru:1},{wins:2,cards:{yueru:1}},false,()=>0);assert.equal(upgrade.cards.yueru,2);
 const full={yueru:3,linger:3,bond:3};assert.equal(rewardCards(full,{wins:5,dungeonClears:2,cards:full},true,()=>0).rewards.length,0);
});
test('card rewards persist atomically, duplicate settlement cannot grant twice, and settings cannot forge cards',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-card-store-')),file=join(dir,'accounts.json');
 try{
  const store=createAccountStore(file,{random:()=>0}),user=await store.register({username:'伙伴卡测试',password:'card-test'});
  const win={...battle,outcome:'win',correct:4,answered:4,bestCombo:4};
  const results=await Promise.all([store.settle(user.id,win),store.settle(user.id,win)]);assert.deepEqual(results[0],results[1]);assert.equal(results[0].user.cards.yueru,1);
  assert.equal((await store.preferences(user.id,{cards:{bond:3},xp:9999})).cards.bond,undefined);
  await store.settle(user.id,{...win,id:'fight2'});const third=await store.settle(user.id,{...win,id:'fight3'});assert.equal(third.result.cardRewards[0].id,'linger');
  const boss=await store.settle(user.id,{...win,id:'boss',boss:true,dungeonId:'maze'});assert.equal(boss.result.cardRewards[0].id,'bond');
  const loss=await store.settle(user.id,{...win,id:'loss',outcome:'lose'});assert.equal(loss.result.cardRewards.length,0);
  const reopened=await createAccountStore(file).get(user.id);assert.deepEqual(reopened.cards,boss.user.cards);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')).users[0].cards,reopened.cards);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('API snapshots owned cards, ignores forged actions and caches the same random action for retries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-card-api-'));let rolls=0;
 const middleware=createApiMiddleware({accountStore:createAccountStore(join(dir,'accounts.json')),random:()=>{rolls++;return 0;}});
 const server=createServer((req,res)=>middleware(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 let cookie='';const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return {r,data:await r.json()};};
 try{
  const registered=await post('auth/register',{username:'施法测试',password:'card-test'});cookie=registered.r.headers.get('set-cookie').split(';')[0];
  const {data:{battle:b}}=await post('battle/start',{subject:'math',grade:1,difficulty:'normal',questionType:'fill',cards:{bond:3},combatLevel:99});assert.deepEqual(b.cards,{});assert.equal(b.combatLevel,1);
  const {data:q}=await post('question',{battleId:b.id});const [a,c,d]=q.text.match(/\d+/g).map(Number),answer=String((d-c)/a);
  const responses=await Promise.all([post('grade',{questionId:q.id,answer,lastAction:{damage:999}}),post('grade',{questionId:q.id,answer})]);
  assert.deepEqual(responses[0].data.battle.lastAction,responses[1].data.battle.lastAction);assert.equal(rolls,1);assert.equal(responses[0].data.battle.monsterHP,75);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

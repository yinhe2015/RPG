import {chromium,firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {moves,rollAction} from '../src/combat-cards.js';

const dir=await mkdtemp(join(tmpdir(),'quest-cards-browser-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',QUEST_DATA_FILE:join(dir,'accounts.json')},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await once(server.stdout,'data');await mkdir('artifacts',{recursive:true});
 for(const [name,engine,options]of [['chrome',chromium,{channel:'chrome'}],['firefox',firefox,{}]]){
  browser=await engine.launch({headless:true,...options});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const user={id:'cards-fixture',username:'伙伴同行',displayName:'伙伴同行',xp:700,wins:3,correct:0,battles:3,bestCombo:0,dungeonClears:1,defeated:[],history:[],cards:{yueru:1,linger:1,bond:1},theme:'pal',grade:1,subject:'math',difficulty:'normal',questionType:'choice',pace:0,questionBank:'starter',music:false,effects:false,reducedMotion:false};
  await page.route('**/api/auth/me',r=>r.fulfill({json:{user}}));
  await page.route('**/api/question-banks',r=>r.fulfill({json:{banks:[{id:'starter',name:'基础题库',count:111,coverage:['math:1'],types:['choice']}]}}));
  await page.route('**/api/profile/settings',r=>r.fulfill({json:{ok:true}}));
  await page.route('**/api/dungeon/current',r=>r.fulfill({json:{dungeon:null,encounter:null}}));
  let battle,round=0;
  await page.route('**/api/battle/start',r=>{battle={id:'cards-battle',subject:'math',grade:1,difficulty:'normal',questionType:'choice',questionBank:'starter',pace:0,playerHP:70,monsterHP:1000,maxHP:1000,combo:0,bestCombo:0,correct:0,answered:0,round:0,shield:false,shieldUsed:false,calcReadyAt:Date.now()+20000,combatLevel:8,cards:user.cards};return r.fulfill({json:{battle}});});
  await page.route('**/api/question',r=>r.fulfill({json:{id:'cards-question',type:'choice',text:'知识化为招式：1 + 1 = ?',options:['2','3','4','5'],knowledgePoint:{id:'math:方程',name:'方程'},bankName:'战斗检查'}}));
  const actions=moves.map(move=>({actor:'player',move,damage:25+move.bonus,heal:0,blocked:false,assists:[],totalDamage:25+move.bonus}));
  actions.push(rollAction({difficulty:'normal',combatLevel:8,monsterHP:1000,playerHP:70,cards:{},combo:0},false,()=>.99));
  actions.push(rollAction({difficulty:'normal',combatLevel:8,monsterHP:1000,playerHP:70,cards:{yueru:1,linger:1},combo:0},true,()=>0));
  actions.push(rollAction({difficulty:'normal',combatLevel:8,monsterHP:1000,playerHP:70,cards:user.cards,combo:0},true,()=>0));
  await page.route('**/api/grade',r=>{
   const action=actions[round++],correct=action.actor==='player',outcome=round===actions.length?'win':null;
   battle={...battle,answered:round,correct:round-1,combo:correct?1:0,monsterHP:outcome?0:battle.monsterHP-(correct?action.totalDamage:0),playerHP:Math.min(100,battle.playerHP+(correct?action.heal:-action.totalDamage)),outcome,lastAction:action};
   const settlement=outcome?{user:{...user,cards:{...user.cards,bond:2}},result:{win:true,xp:60,correct:8,answered:9,oldLevel:8,cardRewards:[{id:'bond',name:'同心 · 仙剑合璧',rank:2,previousRank:1}],newMoves:[]}}:null;
   return r.fulfill({json:{correct,blocked:false,battle,settlement,source:'local',score:correct?100:0,feedback:'动作及伙伴助战检查',explanation:'1 + 1 = 2',reference:'2'}});
  });
  const click=action=>page.locator(`[data-action="${action}"]`).first().click();
  await page.goto(`http://127.0.0.1:${port}`);await page.locator('[data-action="practice"]').waitFor();
  await click('skills');assert.equal(await page.locator('.spell-card:not(.locked)').count(),6);assert.equal(await page.locator('.companion-card.owned').count(),3);await click('close');
  await click('practice');
  for(let i=0;i<actions.length;i++){
   if(i===7)await page.setViewportSize({width:390,height:844});
   await page.locator('[data-action="answer"]').first().click();
   await page.locator('[data-choreography="impact"]').waitFor();
   assert.ok((await page.locator('.battle-move-label').textContent()).includes(actions[i].move.name));
   if(actions[i].move.kind==='spell')assert.ok(await page.locator(`.pal-spell.spell-${actions[i].move.element}`).count());
   if(actions[i].assists.length){
    await page.locator('.assist-bolt').first().waitFor({state:'attached'});
    if(i===actions.length-1)assert.equal(await page.locator('.arena-outcome').evaluate(e=>getComputedStyle(e).visibility),'hidden','victory waits for the co-op attack to finish');
    await page.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
    await page.screenshot({path:`artifacts/cards-assist-${i}-${name}.png`});
    await page.evaluate(()=>document.getAnimations().forEach(a=>a.play()));
   }
   await page.locator('[data-animating="false"]').waitFor();
   const summary=await page.locator('.combat-action-summary').textContent();assert.ok(summary.includes(String(actions[i].damage)));
   for(const assist of actions[i].assists)assert.ok(summary.includes(assist.name));
   await click('next');
  }
  await page.locator('[data-reward-card="bond"]').scrollIntoViewIfNeeded();assert.match(await page.locator('[data-reward-card="bond"]').textContent(),/★★.*升星/);
  await page.screenshot({path:`artifacts/cards-reward-${name}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log(`PASS ${name}: six moves, enemy spell, both solo assists, co-op, healing summary, star reward and mobile layout`);
  await browser.close();browser=null;
 }
}finally{await browser?.close();server.kill('SIGTERM');await once(server,'exit');await rm(dir,{recursive:true,force:true});}

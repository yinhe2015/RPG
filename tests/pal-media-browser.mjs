import {chromium,firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import media from '../src/themes/pal-audio.json' with {type:'json'};

const dir=await mkdtemp(join(tmpdir(),'quest-pal-media-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',QUEST_DATA_FILE:join(dir,'accounts.json')},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await once(server.stdout,'data');await mkdir('artifacts',{recursive:true});
 for(const [name,engine,options]of [['chrome',chromium,{channel:'chrome'}],['firefox',firefox,{}]]){
  browser=await engine.launch({headless:true,...options});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const Native=window.Audio;window.playedAudio=[];
   window.Audio=class extends Native{constructor(src){super(src);window.playedAudio.push(this);}};
   window.frameLog=[];window.phaseLog=[];new MutationObserver(records=>{for(const r of records){if(r.attributeName==='data-frame')window.frameLog.push(Number(r.target.dataset.frame));if(r.attributeName==='data-choreography')window.phaseLog.push(r.target.dataset.choreography);}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-frame','data-choreography']});
  });
  const user={id:'media-fixture',username:'逍遥',displayName:'逍遥',xp:300,wins:0,correct:0,battles:0,bestCombo:0,defeated:[],history:[],theme:'pal',grade:1,subject:'math',difficulty:'normal',questionType:'choice',pace:0,questionBank:'starter',music:true,effects:true,reducedMotion:false};
  await page.route('**/api/auth/me',r=>r.fulfill({json:{user}}));
  await page.route('**/api/question-banks',r=>r.fulfill({json:{banks:[{id:'starter',name:'基础题库',count:111,coverage:['math:1'],types:['choice']}]}}));
  await page.route('**/api/profile/settings',r=>r.fulfill({json:{ok:true}}));
  await page.route('**/api/dungeon/current',r=>r.fulfill({json:{dungeon:null,encounter:null}}));
  let battle,round=0,lose=false;
  await page.route('**/api/battle/start',r=>{round=0;battle={id:'media-battle',subject:'math',grade:1,difficulty:'normal',questionType:'choice',questionBank:'starter',pace:0,playerHP:100,monsterHP:100,maxHP:100,combo:0,bestCombo:0,correct:0,answered:0,round:0,shield:false,shieldUsed:false,calcReadyAt:Date.now()+20000};return r.fulfill({json:{battle}});});
  await page.route('**/api/question',r=>r.fulfill({json:{id:'media-question',type:'choice',text:'一招一式，用知识出剑：1 + 1 = ?',options:['2','3','4','5'],knowledgePoint:{id:'math:方程',name:'方程'},bankName:'动画检查'}}));
  await page.route('**/api/grade',r=>{
   round++;const correct=!lose&&round!==2,outcome=lose?'lose':round===3?'win':null;
   battle={...battle,answered:round,correct:correct?round:1,combo:correct?1:0,monsterHP:outcome==='win'?0:correct?75:75,playerHP:lose?0:correct?100:80,outcome};
   const settlement=outcome?{user,result:{win:!lose,xp:60,correct:2,answered:round,oldLevel:4}}:null;
   return r.fulfill({json:{correct,blocked:false,battle,settlement,source:'local',score:correct?100:0,feedback:'动画测试',explanation:'1 + 1 = 2',reference:'2'}});
  });
  const click=action=>page.locator(`[data-action="${action}"]`).first().click();
  await page.goto(base);await page.locator('[data-action="practice"]').waitFor();await page.locator('body').click({position:{x:5,y:5}});
  await page.waitForFunction(()=>playedAudio.some(a=>a.src.endsWith('music-5.mp3')&&a.currentTime>0));
  // Decode every extracted resource with the browser, independent of scene routing.
  for(const asset of [...Object.values(media.music),...Object.values(media.effects)]){
   const status=await page.evaluate(src=>new Promise(resolve=>{const a=new Audio(src);a.onloadedmetadata=()=>resolve({duration:a.duration});a.onerror=()=>resolve({error:a.error?.code});a.load();}),asset.src);
   assert.ok(status.duration>0,`${name}: decode ${asset.src}`);
  }
  await click('practice');await page.locator('[data-action="answer"]').first().waitFor();
  await page.waitForFunction(()=>playedAudio.some(a=>a.src.endsWith('music-36.mp3')&&a.currentTime>0));
  for(let i=1;i<=3;i++){
   await page.evaluate(()=>{window.phaseLog=[];});
   await page.locator('[data-action="answer"]').first().click();
   // Observe the whole phase history: impact lasts only 420 ms and can fall
   // between polling frames when headless browsers are busy decoding audio.
   await page.waitForFunction(()=>phaseLog.includes('impact')).catch(async error=>{
    throw Error(`${name} round ${i}: ${error.message}\n${JSON.stringify({errors,...await page.evaluate(()=>({phases:phaseLog,frames:frameLog,arena:document.querySelector('#battle-arena')?.dataset,feedback:document.querySelector('.answer-feedback')?.textContent}))})}`);
   });
   if(i===1){
    await page.waitForFunction(()=>{const n=document.querySelector('.arena-damage');return n&&Number(getComputedStyle(n).opacity)>.3;});
    await page.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
    await page.screenshot({path:`artifacts/pal-strike-${name}.png`});
    await page.evaluate(()=>document.getAnimations().forEach(a=>a.play()));
   }
   await page.locator('[data-animating="false"]').waitFor();
   if(i<3)await click('next');
  }
  const frames=await page.evaluate(()=>frameLog);for(const f of [7,8,9,4,0])assert.ok(frames.includes(f),`${name}: original frame ${f} shown`);
  await page.waitForFunction(()=>playedAudio.some(a=>a.src.endsWith('music-3.mp3')&&a.currentTime>0));
  await click('next');await click('close');
  lose=true;await page.setViewportSize({width:390,height:844});await click('practice');await page.locator('[data-action="answer"]').first().click();
  await page.locator('[data-animating="false"][data-outcome="lose"]').waitFor();
  assert.equal(await page.locator('.pal-leader .pal-frames').getAttribute('data-frame'),'2');
  await page.waitForFunction(()=>playedAudio.some(a=>a.src.endsWith('music-1.mp3')&&a.currentTime>0));
  await page.screenshot({path:`artifacts/pal-defeat-mobile-${name}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await click('music');
  assert.ok(await page.evaluate(()=>playedAudio.filter(a=>a.src.includes('/music-')).every(a=>a.paused)));
  assert.deepEqual(errors,[]);console.log(`PASS ${name}: native music/sounds decode and play, scene cues, frames 7/8/9/4/2, mobile defeat and mute`);
  await browser.close();browser=null;
 }
}finally{await browser?.close();server.kill('SIGTERM');await once(server,'exit');await rm(dir,{recursive:true,force:true});}

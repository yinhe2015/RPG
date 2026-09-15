import {chromium,firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';

// Requires installed Chrome and `npx playwright install firefox`.
// Reproduce the reported C-Eval formula using public UI responses and a disposable account store.
const dir=await mkdtemp(join(tmpdir(),'quest-formula-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',QUEST_DATA_FILE:join(dir,'accounts.json')},stdio:['ignore','pipe','pipe']});
const bank=JSON.parse(await readFile('question-banks/ceval-school.json','utf8'));
const reported=bank.questions.find(q=>q.id==='ceval:middle_school_mathematics:test:126');
let browser;
try{
 await once(server.stdout,'data');await mkdir('artifacts',{recursive:true});
 for(const [name,engine,options]of [['chrome',chromium,{channel:'chrome'}],['firefox',firefox,{}]]){
  browser=await engine.launch({headless:true,...options});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth/me',r=>r.fulfill({json:{user:{id:'formula-fixture',username:'公式检查',displayName:'公式检查',xp:100,wins:0,correct:0,battles:0,bestCombo:0,defeated:[],history:[],theme:'paper',grade:1,subject:'math',difficulty:'normal',questionType:'choice',pace:0,questionBank:'ceval-school',effects:false}}}));
  await page.route('**/api/question-banks',r=>r.fulfill({json:{banks:[{id:'ceval-school',name:'C-Eval',count:bank.questions.length,coverage:['math:1'],types:['choice']}]}}));
  await page.route('**/api/profile/settings',r=>r.fulfill({json:{ok:true}}));
  await page.route('**/api/dungeon/current',r=>r.fulfill({json:{dungeon:null,encounter:null}}));
  const battle={id:'formula-battle',subject:'math',grade:1,difficulty:'normal',questionType:'choice',questionBank:'ceval-school',pace:0,playerHP:100,monsterHP:100,maxHP:100,combo:0,bestCombo:0,correct:0,answered:0,round:0,shield:false,shieldUsed:false,calcReadyAt:Date.now()+20000};
  await page.route('**/api/battle/start',r=>r.fulfill({json:{battle}}));
  let text=reported.text,answers=reported.options;
  await page.route('**/api/question',r=>r.fulfill({json:{id:'formula-question',type:'choice',text,options:answers,knowledgePoint:reported.knowledgePoint,bankName:'C-Eval · 中学学科题库'}}));
  await page.route('**/api/battle/leave',r=>r.fulfill({json:{ok:true}}));
  const click=action=>page.locator(`[data-action="${action}"]`).first().click();
  await page.goto(base);await page.locator('[data-action="practice"]').waitFor();
  for(const theme of ['paper','pal','voxel']){
   await click('settings');await page.locator(`[data-action="theme"][data-theme="${theme}"]`).click();await click('close');
   for(const fixture of ['reported','tall-and-wide']){
    text=fixture==='reported'?reported.text:'分数、根式、上下标与矩阵：$\\frac{1}{\\frac{\\sqrt{x^2+1}}{2}}$，$\\sum_{n=1}^{\\infty}\\frac{1}{n^2}$，$\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$';
    answers=fixture==='reported'?reported.options:['$\\frac{\\sqrt{3}}{2}$','$\\dfrac{1}{1+\\frac{1}{x}}$','$x^{n+1}_{i-1}$','$\\frac{'+Array.from({length:30},(_,i)=>`x_{${i}}`).join('+')+'}{2}$'];
    await click('practice');await page.locator('#question-title').waitFor();await page.evaluate(()=>document.fonts.ready);
    for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
     await page.setViewportSize(viewport);await page.evaluate(()=>document.fonts.ready);
     const measurements=await page.locator('.question-math').evaluateAll(elements=>elements.map(e=>{
      const box=e.getBoundingClientRect(),style=getComputedStyle(e);
      const ink=[...e.querySelectorAll('.katex-html span,.katex-html svg')].filter(n=>n.tagName.toLowerCase()==='svg'||n.classList.contains('frac-line')||(!n.children.length&&n.textContent.trim()&&!n.classList.contains('vlist-s')));
      return {vertical:style.overflowY,scroll:e.scrollHeight-e.clientHeight,clip:ink.some(n=>{const r=n.getBoundingClientRect();return r.height>0&&(r.top<box.top-1||r.bottom>box.bottom+1);}),horizontal:e.scrollWidth>e.clientWidth+1,width:box.width};
     }));
     assert.ok(measurements.length>0);
     for(const m of measurements){assert.equal(m.vertical,'hidden',`${name} ${theme}: no vertical formula scrollbar`);assert.ok(!m.clip,`${name} ${theme} ${fixture} ${viewport.width}: math ink stays inside its container`);}
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: no page overflow`);
     if(fixture==='reported')assert.ok(measurements.every(m=>!m.horizontal),`${name}: short radical fraction must not need scrolling`);
     if(fixture==='tall-and-wide'&&viewport.width===390)assert.ok(measurements.some(m=>m.horizontal),'long equations remain horizontally scrollable');
     if(theme==='pal'&&fixture==='reported')await page.screenshot({path:`artifacts/formula-${name}-${viewport.width}.png`});
    }
    await click('leave');await click('quit');
   }
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${name}: reported radical fraction, nested fractions, subscripts, sums and matrices; three themes and screen sizes; long formulas still scroll horizontally`);
  await browser.close();browser=null;
 }
}finally{await browser?.close();server.kill('SIGTERM');await once(server,'exit');await rm(dir,{recursive:true,force:true});}

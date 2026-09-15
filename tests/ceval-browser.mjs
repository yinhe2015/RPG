import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';

const dir=await mkdtemp(join(tmpdir(),'quest-ceval-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',QUEST_DATA_FILE:join(dir,'accounts.json')},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await once(server.stdout,'data');browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const bank=JSON.parse(await readFile('question-banks/ceval-school.json','utf8'));
 let question;page.on('response',async r=>{if(r.url().endsWith('/api/question')&&r.ok())question=await r.json();});
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 await page.goto(base);await page.locator('[data-mode="register"]').click();
 await page.locator('#auth-username').fill('题库验收旅人');await page.locator('#auth-password').fill('ceval-test-123');await page.locator('#auth-confirm').fill('ceval-test-123');await page.locator('#auth-form button[type="submit"]').click();
 await page.locator('[data-action="practice"]').waitFor();await page.locator('#grade').selectOption('0');await page.locator('[data-id="english"]').click();
 await click('settings');await page.locator('#questionType').selectOption('open');await page.locator('#questionBank').selectOption('ceval-school');
 await expect(page.locator('#questionType')).toHaveValue('choice');await expect(page.locator('#questionType option[value="open"]')).toHaveAttribute('disabled','');await click('close');
 await expect(page.locator('[data-id="english"]')).toBeDisabled();await expect(page.locator('#grade option[value="0"]')).toHaveAttribute('disabled','');
 await page.locator('#grade').selectOption('2');await page.locator('[data-id="math"]').click();await page.reload();await page.locator('[data-action="practice"]').waitFor();
 await click('settings');await expect(page.locator('#questionBank')).toHaveValue('ceval-school');await click('close');
 await mkdir('artifacts',{recursive:true});
 for(const theme of ['paper','pal','voxel']){
  await click('settings');await page.locator(`[data-action="theme"][data-theme="${theme}"]`).click();await click('close');
  await click('practice');await page.locator('#question-title').waitFor();
  let gotMath=false;
  for(let round=0;round<4;round++){
   await expect.poll(()=>question?.text).toBeTruthy();
   const raw=bank.questions.find(q=>q.text===question.text&&q.options.every((o,i)=>o===question.options[i]));assert.ok(raw,'question came from imported data in original order');
   for(const field of ['answer','source','explanation','rubric'])assert.equal(question[field],undefined);
   if(question.text.includes('$')||question.options.some(o=>o.includes('$'))){await expect(page.locator('.question-math .katex').first()).toBeVisible();gotMath=true;}
   for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1));
    for(const option of await page.locator('.answer-option').all())assert.ok(await option.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'math option fits its button');
   }
   if(round===0){await page.setViewportSize({width:390,height:844});await page.screenshot({path:`artifacts/ceval-${theme}-mobile.png`});await page.setViewportSize({width:1280,height:800});await page.screenshot({path:`artifacts/ceval-${theme}-desktop.png`});}
   await page.locator(`.answer-option[data-index="${raw.options.indexOf(raw.answer)}"]`).click();await expect(page.locator('.answer-feedback')).toHaveClass(/positive/);
   if(round===0)await expect(page.locator('.monster-health')).toContainText('75');
   question=null;await click('next');if(round<3)await page.locator('#question-title').waitFor();
  }
  assert.ok(gotMath,'at least one formula rendered during the math battle');
  await expect(page.locator('#battle-arena #result-title')).toContainText('打赢');await click('close');
 }
 const me=await (await page.request.get(base+'/api/auth/me')).json();assert.equal(me.user.wins,3);assert.equal(me.user.xp,180);
 await click('settings');await page.locator('#questionBank').selectOption('starter');await page.locator('#questionType').selectOption('open');await click('close');await expect(page.locator('[data-id="english"]')).toBeEnabled();
 assert.equal((await page.request.get(base+'/question-banks/ceval-school.json')).status(),404);
 assert.deepEqual(errors,[]);
 console.log('PASS: C-Eval selection, coverage constraints, persisted preferences, original options, three-theme math/mobile rendering, local grading and saved XP; answer data stays private');
}finally{await browser?.close();server.kill('SIGTERM');await once(server,'exit');await rm(dir,{recursive:true,force:true});}

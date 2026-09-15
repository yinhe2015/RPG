import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const dir=await mkdtemp(join(tmpdir(),'quest-themes-'));
const server=spawn(process.execPath,['--input-type=module','-e',`process.env.PORT='0'; const {createServer}=await import('node:net');const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));process.env.PORT=String(probe.address().port);await new Promise(r=>probe.close(r));await import('./server.js');`],{env:{...process.env,QUEST_DATA_FILE:join(dir,'accounts.json')},stdio:['ignore','pipe','pipe']});
let browser;
try{
 const [output]=await once(server.stdout,'data'),base=output.toString().match(/http:\/\/[^\s]+/)[0];
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/themes/')&&r.status()!==200)errors.push(`Asset ${r.status()}: ${r.url()}`);});
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 async function checkArena(label){
  const geometry=await page.evaluate(()=>{
   const root=document.querySelector('#battle-arena'),r=root.getBoundingClientRect();
   const inside=selector=>{const e=root.querySelector(selector),b=e.getBoundingClientRect();return b.x>=r.x-1&&b.y>=r.y-1&&b.right<=r.right+1&&b.bottom<=r.bottom+1;};
   return {viewport:Math.abs(r.height-innerHeight)<1&&document.documentElement.scrollHeight<=innerHeight+1,
    hud:inside('.arena-top'),health:inside('.arena-status'),question:inside('.arena-question'),controls:inside('.arena-controls'),
    scroll:document.querySelector('.arena-question-scroll').scrollWidth<=document.querySelector('.arena-question-scroll').clientWidth+1};
  });
  for(const [part,valid] of Object.entries(geometry))assert.ok(valid,`${label}: ${part} stays within the battle viewport`);
 }

 await page.goto(base);await page.locator('[data-mode="register"]').click();
 await page.locator('#auth-username').fill('三个世界的旅人');await page.locator('#auth-password').fill('theme-test-123');await page.locator('#auth-confirm').fill('theme-test-123');await page.locator('#auth-form button[type="submit"]').click();await page.locator('[data-action="practice"]').waitFor();
 await mkdir('artifacts',{recursive:true});
 const banks=await (await page.request.get(base+'/api/question-banks')).json();assert.ok(banks.banks[0].count>0);assert.ok(!JSON.stringify(banks).includes('rubric'));
 for(const theme of ['paper','pal','voxel']){
  await click('settings');await page.locator(`[data-action="theme"][data-theme="${theme}"]`).click();await page.locator('#questionType').selectOption('choice');await click('close');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await page.reload();await page.locator('[data-action="practice"]').waitFor();await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await page.screenshot({path:`artifacts/theme-${theme}-home.png`,fullPage:true});
  await click('practice');await page.locator('#question-title').waitFor();
  const foe=page.locator('.game-scene');await expect(foe).toHaveAttribute('data-monster-id','math:一元一次方程');
  await page.screenshot({path:`artifacts/theme-${theme}-battle.png`,fullPage:true});
  if(theme==='pal'){assert.equal(await page.locator('.pal-commands button').count(),6);assert.ok(await page.locator('.pal-enemy').boundingBox());}
  await checkArena(`${theme} desktop`);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const [a,b,c]=(await page.locator('#question-title').textContent()).match(/\d+/g).map(Number),answer=String((c-b)/a);
  for(const option of await page.locator('.answer-option').all())if((await option.textContent()).trim().slice(1).trim()===answer){await option.click();break;}
  await expect(page.locator('.answer-feedback')).toHaveClass(/positive/);
  await expect(page.locator('#battle-arena')).toHaveAttribute('data-animating','true');
  await expect(page.locator('[data-action="next"]')).toBeDisabled();
  if(theme==='pal')await expect(page.locator('#battle-arena')).toHaveAttribute('data-choreography',/windup|approach|strike|impact|return/);
  else assert.equal(await page.locator('.arena-bolt').count(),1);
  await page.screenshot({path:`artifacts/theme-${theme}-attack.png`});
  await expect(page.locator('[data-action="next"]')).toBeEnabled();
  await expect(page.locator('.arena-bolt')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [768,390,360]){await page.setViewportSize({width,height:900});await checkArena(`${theme} width ${width}`);}
  await page.screenshot({path:`artifacts/theme-${theme}-mobile.png`,fullPage:true});
  await page.setViewportSize({width:844,height:390});await checkArena(`${theme} landscape`);
  await page.screenshot({path:`artifacts/theme-${theme}-landscape.png`});
  await click('leave');await click('quit');await page.locator('[data-action="practice"]').waitFor();
  for(const type of ['fill','short','open']){
   await click('settings');await page.locator('#questionType').selectOption(type);await click('close');await click('practice');await page.locator('#written-answer').waitFor();
   await page.setViewportSize({width:390,height:844});await checkArena(`${theme} ${type}`);
   await page.locator('#written-answer').fill('我的回答和思考过程');
   await page.locator('#question-title').evaluate(e=>e.textContent='长题目阅读材料。'.repeat(80));
   await page.locator('#answer-form button').scrollIntoViewIfNeeded();await expect(page.locator('#answer-form button')).toBeInViewport();await checkArena(`${theme} long ${type}`);
   await click('settings');await expect(page.locator('#battle-arena [role="dialog"]')).toBeVisible();await click('close');
   await expect(page.locator('#written-answer')).toHaveValue('我的回答和思考过程');
   await click('leave');await click('quit');
  }
  await page.setViewportSize({width:1440,height:1100});
 }
 console.log('PASS: three themes render and persist, all assets load, combat grades correctly, mobile layout fits');
 await click('settings');await page.locator('#questionType').selectOption('open');await click('close');await click('practice');await page.locator('#written-answer').fill('换个世界，也保留我的回答。');
 await click('settings');await page.locator('[data-theme="pal"][data-action="theme"]').click();await click('close');await expect(page.locator('#written-answer')).toHaveValue('换个世界，也保留我的回答。');
 assert.match(await page.locator('.player-health').textContent(),/100/);
 await click('settings');await page.locator('.theme-customize summary').click();await page.locator('#themeAccent').fill('#ddaa55');await page.locator('#reducedMotion').check();await click('close');
 await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
 await expect.poll(async()=>((await (await page.request.get(base+'/api/auth/me')).json()).user.themeAccent)).toBe('#ddaa55');
 await click('leave');await click('quit');
 await page.locator('[data-id="chinese"]').click();await click('settings');await page.locator('#questionType').selectOption('choice');await click('close');
 const forms=[];
 for(const difficulty of ['easy','normal','hard']){
  await page.locator('#difficulty').selectOption(difficulty);await click('practice');await page.locator('#question-title').waitFor();
  const first=await page.locator('.game-scene').getAttribute('data-monster-id');forms.push(await page.locator('.game-scene').getAttribute('data-monster-tier'));
  await page.locator('.answer-option').first().click();await page.locator('.answer-feedback').waitFor();await click('next');await page.locator('#question-title').waitFor();
  assert.notEqual(await page.locator('.game-scene').getAttribute('data-monster-id'),first,'new knowledge point gets a different monster');
  await click('leave');await click('quit');
 }
 assert.deepEqual(forms,['0','1','2']);
 for(const path of ['/question-banks/starter.json','/pal/ABC.MKF','/data/accounts.json'])assert.equal((await page.request.get(base+path)).status(),404);
 assert.deepEqual(errors,[]);
 console.log('PASS: live theme switching preserves answers/HP, customization saves, knowledge points and difficulty change monsters, bank answers stay private');
}finally{await browser?.close();server.kill('SIGTERM');await once(server,'exit');await rm(dir,{recursive:true,force:true});}

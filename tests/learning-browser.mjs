import {chromium,firefox,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {join,extname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createApiMiddleware} from '../server/api.js';
import {createAccountStore} from '../server/accounts.js';

const dir=await mkdtemp(join(tmpdir(),'quest-learning-browser-'));let failNext=false;const seen=[];
const api=createApiMiddleware({accountStore:createAccountStore(join(dir,'accounts.json')),aiGrader:async()=>({correct:false,score:10,feedback:'先检查等式两边的运算',explanation:'可以请老师一起找原因。',reference:'两边进行相同运算',source:'local'}),aiTutor:async(session,text,{onDelta}={})=>{
 seen.push({teacher:session.teacherId,text,reference:session.reference,language:session.language});onDelta?.('这是先收到的部分回复。');await new Promise(r=>setTimeout(r,400));
 if(failNext){failNext=false;throw Error('PROVIDER_UNAVAILABLE');}
 return {message:text?'等式两边同时减去 2。请你试着解 $x+2=5$，并说说为什么。\n这里的 <img src=x onerror=alert(1)> 只是文本。':session.reference?'我们从你这道错题开始。你当时的第一步是怎样想的？':'我们从等式的平衡开始。$x+2=5$ 中，你觉得怎样才能让左边只剩下 $x$？',focus:text?'练习等式两边同时运算':'确认等式的基本性质',stage:text?'practicing':'exploring',summary:'先了解原始思路，再检查等式两边的运算。',quickReplies:['我不确定该怎么开始','请换一种解释']};
}});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer((req,res)=>api(req,res,async()=>{try{const path=new URL(req.url,'http://local').pathname,file=resolve('dist',`.${path==='/'?'/index.html':path}`);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}}));
const host=process.env.QUEST_TEST_HOST||'127.0.0.1';
await new Promise(r=>server.listen(0,host,r));const base=`http://${host}:${server.address().port}`;let browser;
try{
 await mkdir('artifacts',{recursive:true});
 for(const [engine,name,options]of [[chromium,'chrome',{channel:'chrome'}],[firefox,'firefox',{}]]){
  browser=await engine.launch({headless:true,...options});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  const sent=[];page.on('request',r=>{if(/\/api\/learning\/(start|chat)$/.test(r.url()))sent.push(r.postDataJSON());});
  await context.addInitScript(()=>{for(const name of ['any','timeout'])Object.defineProperty(AbortSignal,name,{configurable:true,value:undefined});});
  await context.addInitScript(()=>Object.defineProperty(crypto,'randomUUID',{configurable:true,value:undefined}));
  await context.addInitScript(()=>{window.testSpeech=[];Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'test-zh',name:'测试中文',lang:'zh-CN'},{voiceURI:'test-en',name:'Test English',lang:'en-US'}],cancel(){},speak(u){window.testSpeech.push({text:u.text,lang:u.lang,voice:u.voice?.voiceURI});},addEventListener(){}}});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}}});});
  await page.goto(base+'/learn.html');await page.locator('[data-action="auth-mode"]').click();await page.locator('[name="username"]').fill(`学习测试-${name}`);await page.locator('[name="password"]').fill('learning-test');await page.locator('[name="confirm"]').fill('learning-test');await page.locator('#learning-auth [type="submit"]').click();
  await page.locator('#lesson-start').waitFor();await page.screenshot({path:`artifacts/learning-setup-${name}.png`});
  if(host!=='127.0.0.1'&&host!=='localhost')assert.equal(await page.evaluate(()=>isSecureContext),false);
  // A failure before fetch must be visible and leave the form usable.
  await page.evaluate(()=>{const generate=crypto.getRandomValues;crypto.getRandomValues=function(bytes){crypto.getRandomValues=generate;throw Error('无法生成请求标识，请重试。');};});
  await page.locator('#learn-topic').fill('一元一次方程');await page.locator('#lesson-start [type="submit"]').click();
  await expect(page.locator('[role="alert"]')).toContainText('无法生成请求标识，请重试。');
  await expect(page.locator('#learn-topic')).toHaveValue('一元一次方程');await expect(page.locator('#lesson-start [type="submit"]')).toBeEnabled();assert.equal(sent.length,0);
  for(const teacher of ['xiaoyao','linger','yueru']){
   await page.locator(`[data-action="teacher"][data-id="${teacher}"]`).click();await page.locator('#learn-topic').fill('一元一次方程');await page.locator('#lesson-start [type="submit"]').click();
   await expect(page.locator('#stream-reply')).toContainText('先收到的部分回复');await expect(page.locator('#lesson-chat [type="submit"]')).toBeDisabled();await expect(page.locator('#lesson-chat [type="submit"]')).toBeEnabled();assert.equal(seen.at(-1).teacher,teacher);await expect(page.locator('.message .katex').first()).toBeVisible();
   if(teacher!=='yueru')await page.locator('[data-action="new"]').click();
  }
  const url=page.url();await page.locator('#reply-language').selectOption('en-US');await page.locator('[data-action="quick"]').first().click();await expect(page.locator('#learn-message')).toHaveValue('我不确定该怎么开始');
  await page.locator('#learn-voice').selectOption('test-en');await page.locator('[data-action="voice-toggle"]').click();
  failNext=true;await page.locator('#learn-message').fill('我把 2 移到右边，还是加 2。');await page.locator('#lesson-chat [type="submit"]').click();await page.locator('[role="alert"]').waitFor();
  await expect(page.locator('#learn-message')).toHaveValue('我把 2 移到右边，还是加 2。');assert.equal(await page.locator('.message.user').count(),0);
  await page.locator('[data-action="retry-turn"]').click();await expect(page.locator('#learn-message')).toHaveValue('');await expect(page.locator('.message.assistant')).toHaveCount(2);assert.equal(seen.at(-1).language,'en-US');
  assert.equal(sent.at(-1).requestId,sent.at(-2).requestId,'retry must reuse the same request ID');
  const starts=sent.filter(r=>!r.sessionId).map(r=>r.requestId);assert.equal(new Set(starts).size,3);
  assert.ok(await page.evaluate(()=>testSpeech.some(s=>s.lang==='en-US'&&s.voice==='test-en')));await page.locator('[data-action="stop-reading"]').click();await page.locator('[data-action="voice-toggle"]').click();
  assert.equal(await page.locator('.messages img').count(),0);await expect(page.locator('.messages')).toContainText('<img src=x onerror=alert(1)>');
  await page.screenshot({path:`artifacts/learning-conversation-${name}.png`});
  await page.reload();await expect(page.locator('.message.assistant')).toHaveCount(2);assert.equal(page.url(),url);await expect(page.locator('#reply-language')).toHaveValue('en-US');
  assert.ok(await page.locator('.mentor').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('.lesson-heading').getBoundingClientRect();return a.x>b.x+b.width/2&&a.bottom<=b.bottom;}));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`artifacts/learning-mobile-${name}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await expect(page.locator('#lesson-chat [type="submit"]')).toBeVisible();
  await page.locator('[data-action="new"]').click();await page.locator('[data-action="history"]').click();await expect(page.locator('.history-entry')).toHaveCount(3);await page.locator('.history-entry').first().click();await expect(page.locator('.message.assistant')).toHaveCount(2);
  // The actual adventure feedback opens a separate learning tab with its saved question.
  await page.request.post(base+'/api/profile/settings',{data:{questionType:'short',theme:'pal',reducedMotion:true}});
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/');await page.locator('[data-action="practice"]').waitFor();
  await expect(page.locator('a[href="/learn.html"]')).toBeVisible();await page.locator('[data-action="practice"]').click();await page.locator('#written-answer').fill('我觉得把数字搬过去就可以了。');await page.locator('#answer-form [type="submit"]').click();
  const link=page.locator('a[href^="/learn.html?mistake="]');await link.waitFor();
  const popupPromise=context.waitForEvent('page');await link.click();const study=await popupPromise;await study.locator('#lesson-start').waitFor();await expect(study.locator('.original-answer')).toContainText('我觉得把数字搬过去就可以了。');
  await study.locator('#lesson-start [type="submit"]').click();await study.locator('.lesson-reference').waitFor();await expect(study.locator('#lesson-chat [type="submit"]')).toBeEnabled();assert.ok(seen.at(-1).reference?.studentAnswer.includes('搬过去'));
  await study.locator('.lesson-reference>summary').click();await expect(study.locator('.original-answer')).toContainText('搬过去');await study.screenshot({path:`artifacts/learning-mistake-${name}.png`});
  await study.locator('[data-action="logout"]').click();await study.locator('#learning-auth').waitFor();assert.equal(await study.locator('.messages').count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS ${name} (${host}): HTTP-compatible request IDs, visible preparation errors, shared registration, three teachers, math, guided chat, retry/draft retention, reload/history, mobile layout, escaped AI content and real battle-to-mistake learning`);
  await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}

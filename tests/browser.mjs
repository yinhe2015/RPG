import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';

// Exercise the production server against a temporary database, never real accounts.
const directory=await mkdtemp(join(tmpdir(),'quest-browser-')),dataFile=join(directory,'accounts.json');
const portProbe=createServer();await new Promise(r=>portProbe.listen(0,'127.0.0.1',r));const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));
const base=`http://127.0.0.1:${port}`;let server;
async function launch(){server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',QUEST_DATA_FILE:dataFile},stdio:['ignore','pipe','pipe']});await once(server.stdout,'data');}
async function stop(){if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}}
await launch();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
const username='知识勇者',password='adventure-1234';
async function me(p=page){const response=await p.request.get(base+'/api/auth/me');return (await response.json()).user;}
async function login(p=page){await p.locator('#auth-username').fill(username);await p.locator('#auth-password').fill(password);await p.locator('#auth-form button[type="submit"]').click();await p.locator('[data-action="practice"]').waitFor();}
async function settings(type,pace='0'){await click('settings');await page.locator('#questionType').selectOption(type);await page.locator('#pace').selectOption(pace);await click('close');}
async function start(){await click('practice');await page.locator('#question-title').waitFor();}
async function leave(){await click('leave');await click('quit');await page.locator('[data-action="practice"]').waitFor();}
async function answerMath(){const [a,b,c]=(await page.locator('#question-title').textContent()).match(/\d+/g).map(Number);const answer=String((c-b)/a);for(const option of await page.locator('.answer-option').all())if((await option.textContent()).trim().slice(1).trim()===answer){await option.click();break;}await page.locator('.answer-feedback').waitFor();}

try{
 await page.goto(base);await page.locator('#auth-form').waitFor();
 assert.equal((await page.request.post(base+'/api/battle/start',{data:{}})).status(),401);
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/login-desktop.png',fullPage:true});
 await page.evaluate(()=>localStorage.setItem('subject-quest-v1',JSON.stringify({xp:190,wins:2,battles:2,bestCombo:3,correct:8})));
 await page.reload();await page.locator('[data-mode="register"]').click();
 await page.locator('#auth-username').fill(username);await page.locator('#auth-password').fill(password);await page.locator('#auth-confirm').fill('not-the-same');
 await page.locator('#auth-form button[type="submit"]').click();await expect(page.locator('#auth-error')).toContainText('不一致');
 await page.locator('#auth-confirm').fill(password);await page.locator('[name="importLegacy"]').check();await page.locator('#auth-form button[type="submit"]').click();
 await page.locator('[data-action="practice"]').waitFor();assert.equal((await me()).xp,190);
 assert.equal(await page.evaluate(()=>localStorage.getItem('subject-quest-v1')),null);
 assert.equal(await page.locator('.subject-button').count(),6);assert.doesNotMatch(await page.locator('body').textContent(),/每日任务|每日小目标/);
 await settings('choice');await start();
 for(let i=0;i<4;i++){await answerMath();if(i<3){await click('next');await page.locator('#question-title').waitFor();}}
 // Experience is already on disk before the user opens the victory dialog.
 assert.equal((await me()).xp,250);assert.equal((await me()).wins,3);
 await click('next');await expect(page.locator('#result-title')).toContainText('打赢');await expect(page.locator('#battle-arena [role="dialog"]')).toBeVisible();await click('close');await expect(page.locator('#battle-arena')).toHaveCount(0);
 await page.reload();await expect(page.locator('.hud-level b')).toHaveText('3');
 console.log('PASS: registration, password confirmation, optional old-save import, server settlement and reload');

 await click('settings');await click('logout');await page.locator('#auth-form').waitFor();
 await page.locator('#auth-username').fill(username);await page.locator('#auth-password').fill('wrong-password');await page.locator('#auth-form button[type="submit"]').click();
 await expect(page.locator('#auth-error')).toContainText('账号或密码不正确');
 await login();assert.equal((await me()).xp,250);
 const second=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await second.goto(base);await second.locator('#auth-form').waitFor();await login(second);assert.equal((await me(second)).xp,250);
 const other=await browser.newPage();await other.goto(base);await other.locator('[data-mode="register"]').click();await other.locator('#auth-username').fill('另一位同学');await other.locator('#auth-password').fill('other-1234');await other.locator('#auth-confirm').fill('other-1234');await other.locator('#auth-form button[type="submit"]').click();await other.locator('[data-action="practice"]').waitFor();assert.equal((await me(other)).xp,0);await other.close();await second.close();
 console.log('PASS: wrong-password handling, login, logout, cross-browser progress and account isolation');

 await settings('fill','300');await start();
 await page.clock.install();await page.clock.runFor(301000);await expect(page.locator('#time-label')).toContainText('继续思考');assert.match(await page.locator('.player-health').textContent(),/100/);
 // This check concerns popup placement; backend cooldowns use real server time and are covered by API tests.
 await page.route('**/api/battle/skill',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({battle:{shield:false,shieldUsed:false,calcReadyAt:Date.now()+400000}})}),{times:1});
 await page.locator('#written-answer').fill('保留我的草稿 abc');await click('calculator');await expect(page.locator('#battle-arena .calculator-popover')).toBeVisible();await click('close-calculator');await click('hint');await page.locator('.hint-note').waitFor();await expect(page.locator('#written-answer')).toHaveValue('保留我的草稿 abc');
 await click('shield');await page.locator('.shield-bubble').waitFor();
 const [a,b,c]=(await page.locator('#question-title').textContent()).match(/\d+/g).map(Number);const answer=String((c-b)/a);await page.locator('#written-answer').fill(answer);
 await page.route('**/api/grade',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'暂时无法完成判卷，答案已保留。'})}),{times:1});
 await page.locator('#written-answer').press('Enter');await page.locator('.error-note').waitFor();await expect(page.locator('#written-answer')).toHaveValue(answer);assert.match(await page.locator('.player-health').textContent(),/100/);
 await click('retry-answer');await expect(page.locator('.answer-feedback')).toHaveClass(/positive/);await leave();assert.equal((await me()).xp,250);
 console.log('PASS: soft timing, authenticated skills, input preservation, grading retry and no reward for unfinished combat');

 await page.locator('[data-id="chinese"]').click();await settings('open');await start();await page.locator('#written-answer').fill('我喜欢纸质书，因为没有通知干扰，也方便写笔记。');
 if(process.env.QUEST_LIVE_AI==='1'){await page.locator('#answer-form').evaluate(el=>el.requestSubmit());await expect(page.locator('.answer-feedback')).toHaveClass(/positive/,{timeout:70000});console.log('PASS: authenticated real DeepSeek Flash grading');}
 await leave();
 await stop();await launch();await page.reload();await page.locator('#auth-form').waitFor();await login();assert.equal((await me()).xp,250);assert.equal((await me()).subject,'chinese');
 const raw=await readFile(dataFile,'utf8'),db=JSON.parse(raw);assert.ok(!raw.includes(password));assert.equal(db.users.length,2);assert.match(db.users[0].passwordHash,/^scrypt:/);assert.equal(db.users[0].xp,250);
 const apiUser=await me();assert.equal(apiUser.passwordHash,undefined);assert.equal(apiUser.password,undefined);
 console.log('PASS: server restart, persisted settings, JSON password hashes and no credential fields in API responses');

 await click('progress');await expect(page.locator('.profile-name')).toHaveText(username);
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await click('copy-profile');
 await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('累计经验：250 EXP');
 await click('rename-profile');await page.locator('#display-name').fill('齐天大圣');await page.locator('#rename-form [type="submit"]').click();
 await expect(page.locator('.profile-name')).toHaveText('齐天大圣');assert.equal((await me()).displayName,'齐天大圣');assert.equal((await me()).username,username);
 await click('copy-profile');await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('名字：齐天大圣');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('clipboard unavailable');}}}));
 await click('copy-profile');await expect(page.locator('#profile-copy')).toContainText('名字：齐天大圣');await click('close');
 await expect(page.locator('.player-character .character-label')).toContainText('齐天大圣');
 await page.reload();await page.locator('[data-action="practice"]').waitFor();await expect(page.locator('.player-character .character-label')).toContainText('齐天大圣');
 assert.equal((await page.request.post(base+'/api/profile/rename',{data:{displayName:'   '}})).status(),400);assert.equal((await me()).xp,250);
 await settings('choice');await start();await expect(page.locator('.player-health')).toContainText('齐天大圣');await leave();
 await page.setViewportSize({width:390,height:844});await click('progress');await page.screenshot({path:'artifacts/profile-name-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Profile overflow');await click('close');
 await click('settings');await click('logout');await page.locator('#auth-form').waitFor();await login();await expect(page.locator('.hud-username')).toContainText('齐天大圣');
 console.log('PASS: nickname display, backend rename/reload/login, full text copy, clipboard fallback and unchanged progress');

 for(const width of [1440,1024,768,390,360]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Home overflow at ${width}`);}
 await click('settings');await click('logout');await page.locator('#auth-form').waitFor();
 for(const width of [1440,768,390,360]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Login overflow at ${width}`);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/login-mobile.png',fullPage:true});
 await page.locator('[data-mode="register"]').click();await page.screenshot({path:'artifacts/register-mobile.png',fullPage:true});
 for(const path of ['/data/accounts.json','/data/accounts.json?raw','/server/accounts.js','/deepseek_apikey.txt'])assert.equal((await page.request.get(base+path)).status(),404);
 assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile login and game layout, private JSON protection and no JS errors');
}finally{await browser.close();await stop();await rm(directory,{recursive:true,force:true});}

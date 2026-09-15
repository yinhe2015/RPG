import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,symlink,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {build} from 'vite';
import {createTheme} from '../scripts/create-theme.js';

// Build and run a real fourth theme in isolation, without modifying the installed game.
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=await mkdtemp(join(tmpdir(),'quest-new-theme-'));
let browser,server;
try{
 for(const name of ['src','server','question-banks','server.js','package.json','index.html','learn.html'])await cp(join(root,name),join(fixture,name),{recursive:true});
 await symlink(join(root,'node_modules'),join(fixture,'node_modules'),'dir');
 await createTheme({id:'forest',name:'森林书院',root:fixture});
 await build({root:fixture,configFile:false,logLevel:'error',build:{copyPublicDir:false,rollupOptions:{input:{game:join(fixture,'index.html'),learn:join(fixture,'learn.html')}}}});
 for(const name of await readdir(join(root,'public')))await symlink(join(root,'public',name),join(fixture,'dist',name));
 server=spawn(process.execPath,['--input-type=module','-e',`const {createServer}=await import('node:net');const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));process.env.PORT=String(probe.address().port);await new Promise(r=>probe.close(r));await import('./server.js');`],{cwd:fixture,env:{...process.env,HOST:'127.0.0.1',QUEST_DATA_FILE:join(fixture,'accounts.json')},stdio:['ignore','pipe','pipe']});
 const [output]=await once(server.stdout,'data'),base=output.toString().match(/http:\/\/[^\s]+/)[0];
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('[data-mode="register"]').click();
 await page.locator('#auth-username').fill('新主题测试');await page.locator('#auth-password').fill('forest-test-password');await page.locator('#auth-confirm').fill('forest-test-password');await page.locator('#auth-form button[type="submit"]').click();
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 await click('settings');
 await expect(page.locator('.theme-card')).toHaveCount(4);
 await page.locator('[data-action="theme"][data-theme="forest"]').click();await click('close');
 await expect(page.locator('html')).toHaveAttribute('data-theme','forest');
 await page.reload();await page.locator('[data-action="practice"]').waitFor();
 await expect(page.locator('html')).toHaveAttribute('data-theme','forest');
 const me=await (await page.request.get(base+'/api/auth/me')).json();assert.equal(me.user.theme,'forest');
 await click('practice');await expect(page.locator('#question-title')).toBeVisible();
 await expect(page.locator('.player-character')).toBeVisible();await expect(page.locator('.monster-character')).toBeVisible();
 await page.locator('[data-action="answer"]').first().click();await expect(page.locator('.answer-feedback')).toBeVisible();
 assert.deepEqual(errors,[]);
 console.log('PASS: generated fourth theme builds, auto-registers, persists through the real account API, and inherits a working battle scene');
}finally{
 await browser?.close();
 if(server){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}
 await rm(fixture,{recursive:true,force:true});
}

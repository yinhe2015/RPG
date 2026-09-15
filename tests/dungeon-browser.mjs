import {chromium,firefox,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
const dir=await mkdtemp(join(tmpdir(),'quest-maze-browser-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',QUEST_DATA_FILE:join(dir,'accounts.json')},stdio:['ignore','pipe','pipe']});
let browser;
function pathTo(d,target){const queue=[{...d.player,path:[]}],seen=new Set([`${d.player.x},${d.player.y}`]);for(let i=0;i<queue.length;i++){const p=queue[i];if(p.x===target.x&&p.y===target.y)return p.path;for(const [direction,dx,dy]of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(d.grid[y]?.[x]&&!seen.has(key)){seen.add(key);queue.push({x,y,path:[...p.path,direction]});}}}return [];}
try{
 await once(server.stdout,'data');browser=await(process.env.QUEST_BROWSER==='firefox'?firefox.launch({headless:true}):chromium.launch({channel:'chrome',headless:true}));const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));let state,question,grade;
 page.on('response',async r=>{if(!r.ok())return;const path=new URL(r.url()).pathname;if(path.startsWith('/api/dungeon/'))state=await r.json();if(path==='/api/question')question=await r.json();if(path==='/api/grade')grade=await r.json();});
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 await page.goto(base);await page.locator('[data-mode="register"]').click();await page.locator('#auth-username').fill('山海探险者');await page.locator('#auth-password').fill('maze-browser-test');await page.locator('#auth-confirm').fill('maze-browser-test');await page.locator('#auth-form button[type="submit"]').click();await page.locator('[data-action="start"]').waitFor();
 await click('settings');await page.locator('#questionBank').selectOption('ceval-school');await click('close');await page.locator('#grade').selectOption('1');await page.locator('[data-id="math"]').click();await page.locator('#difficulty').selectOption('easy');
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/dungeon-camp.png',fullPage:true});
 await click('start');await page.locator('#dungeon-screen').waitFor();assert.equal(await page.locator('#battle-arena').count(),0);
 const first=state.dungeon;
 for(const theme of ['paper','pal','voxel']){
  await click('settings');await page.locator(`[data-action="theme"][data-theme="${theme}"]`).click();await expect(page.locator('#questionBank')).toBeDisabled();await click('close');
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1));
   await expect(page.locator('#map-player')).toBeInViewport();
   assert.ok(await page.locator('#map-player').evaluate(e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !top?.closest('.dungeon-heading,.dungeon-header,.dungeon-bottom');}));
   await page.screenshot({path:`artifacts/dungeon-${theme}-${viewport.width}.png`});
  }
  if(theme==='pal'){
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.setViewportSize({width:1280,height:800});
   assert.ok(await page.locator('.map-pal-hero').evaluate(async e=>{
    const image=new Image();image.src=getComputedStyle(e).backgroundImage.slice(5,-2);await image.decode();return image.naturalWidth===264&&image.naturalHeight===50;
   }));
   await page.evaluate(()=>{
    window.walkFrames=[];
    new MutationObserver(records=>{for(const record of records)if(record.attributeName==='data-frame')window.walkFrames.push(Number(record.target.dataset.frame));}).observe(document.querySelector('.map-pal-hero'),{attributes:true});
   });
   const keys={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'},idle={down:0,left:3,up:6,right:9},reverse={up:'down',down:'up',left:'right',right:'left'};
   let animated=0;
   for(const direction of ['up','left','down','right']){
    await page.waitForTimeout(200);const before={...state.dungeon.player};
    await page.evaluate(()=>window.walkFrames=[]);
    const response=page.waitForResponse(r=>r.url().endsWith('/api/dungeon/move'));
    await page.keyboard.press(keys[direction]);await response;
    await expect(page.locator('.map-pal-hero')).toHaveAttribute('data-facing',direction);
    await page.waitForTimeout(210);
    await expect(page.locator('.map-pal-hero')).toHaveAttribute('data-frame',String(idle[direction]));
    await expect(page.locator('#map-player')).not.toHaveClass(/walking/);
    const moved=before.x!==state.dungeon.player.x||before.y!==state.dungeon.player.y;
    const frames=await page.evaluate(()=>window.walkFrames);
    if(moved){
     assert.ok(frames.some(f=>f===idle[direction]+1||f===idle[direction]+2),`${direction} must change foot poses`);animated++;
     await page.keyboard.press(keys[reverse[direction]]);
     await expect.poll(()=>state.dungeon.player).toEqual(before);
    }else assert.ok(frames.every(f=>f===idle[direction]),'wall collision must not walk in place');
   }
   assert.ok(animated>0);
   await page.waitForTimeout(220);const facing=state.dungeon.facing;
   await page.reload();await page.locator('#dungeon-screen').waitFor();
   await expect(page.locator('.map-pal-hero')).toHaveAttribute('data-facing',facing);
   await page.emulateMedia({reducedMotion:'reduce'});
   console.log('PASS: PAL native walking sheet, four headings, real footsteps, wall turns, stop/idle and heading after reload');
  }
 }
 await page.setViewportSize({width:1280,height:800});await page.reload();await page.locator('#dungeon-screen').waitFor();assert.equal(state.dungeon.id,first.id);
 const bank=JSON.parse(await readFile('question-banks/ceval-school.json','utf8'));let clearedRegular=false,refreshedBattle=false,quitTested=false;
 const goal=first.monsters.find(m=>!m.boss);
 for(let turn=0;turn<500;turn++){
  if(await page.locator('#battle-arena').count()){
   await page.locator('#question-title').waitFor();
   if(!refreshedBattle){const id=state.encounter.battle.id;await page.reload();await page.locator('#question-title').waitFor();assert.equal(state.encounter.battle.id,id);refreshedBattle=true;}
   if(!quitTested){await click('leave');await click('quit');await page.locator('#dungeon-screen').waitFor();quitTested=true;continue;}
   const raw=bank.questions.find(q=>q.text===question.text&&q.options.every((o,i)=>o===question.options[i]));assert.ok(raw);
   grade=null;await page.locator(`.answer-option[data-index="${raw.options.indexOf(raw.answer)}"]`).click();await page.locator('.answer-feedback').waitFor();await expect.poll(()=>grade?.correct).toBe(true);
   await click('next');
   if(grade.battle.outcome){
    if(grade.battle.boss)await expect(page.locator('#result-title')).toContainText('迷宫通关');
    else{clearedRegular=true;await expect(page.locator('#result-title')).toContainText('守卫');}
    await click('dungeon-return');await page.locator('#dungeon-screen').waitFor();if(state.dungeon.status==='cleared')break;
   }
   continue;
  }
  const d=state.dungeon,target=clearedRegular?d.exit:goal,direction=pathTo(d,target)[0];assert.ok(direction);
  const before=d.steps;await page.waitForTimeout(185);await page.keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction]);
  await expect.poll(()=>state.dungeon.steps).toBeGreaterThan(before);
 }
 assert.ok(clearedRegular);assert.equal(state.dungeon.status,'cleared');await expect(page.locator('.dungeon-ending h2')).toContainText('迷宫通关');await page.screenshot({path:'artifacts/dungeon-cleared.png'});
 const me=await(await page.request.get(base+'/api/auth/me')).json();assert.equal(me.user.dungeonClears,1);
 await click('dungeon-restart');await page.locator('#dungeon-screen[data-status="active"]').waitFor();assert.notEqual(state.dungeon.id,first.id);assert.notDeepEqual(state.dungeon.grid,first.grid);
 const d=state.dungeon,direction=pathTo(d,d.exit)[0];await page.waitForTimeout(190);await page.locator(`[data-action="move"][data-direction="${direction}"]`).click();await expect.poll(()=>state.dungeon.steps).toBeGreaterThan(0);
 await click('dungeon-leave');await click('dungeon-quit');await page.locator('[data-action="start"]').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: three themed maze viewports, wall-aware walking, keyboard/touch controls, live theme switching, reload/resume, retreat, regular encounter return, boss clearance/persisted rewards and random new runs');
}finally{await browser?.close();server.kill('SIGTERM');await once(server,'exit');await rm(dir,{recursive:true,force:true});}

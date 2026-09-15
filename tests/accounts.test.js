import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createAccountStore,hashPassword,verifyPassword} from '../server/accounts.js';
import {createApiMiddleware,blockPrivateFiles} from '../server/api.js';
import {profileText} from '../src/profile-text.js';

test('display names persist without changing login credentials, progress or another account',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-rename-')),file=join(dir,'accounts.json');
 try{
  const store=createAccountStore(file),user=await store.register({username:'原账号',password:'rename-test',legacyProgress:{xp:250}});
  const other=await store.register({username:'另一账号',password:'other-test'});
  assert.equal(user.displayName,'原账号');
  const renamed=await store.rename(user.id,'  齐天大圣  ');assert.equal(renamed.displayName,'齐天大圣');assert.equal(renamed.username,'原账号');assert.equal(renamed.xp,250);
  for(const invalid of ['', ' \n ', 'x'.repeat(33), '<script>', 'a\nb'])await assert.rejects(store.rename(user.id,invalid),/INVALID_DISPLAY_NAME/);
  await assert.rejects(store.rename('nonexistent','新名字'),/LOGIN_REQUIRED/);
  const restored=await createAccountStore(file).login({username:'原账号',password:'rename-test'});assert.equal(restored.displayName,'齐天大圣');assert.equal(restored.xp,250);
  assert.equal((await store.get(other.id)).displayName,'另一账号');
  const history=Array.from({length:8},(_,i)=>({subject:'math',win:true,correct:4,xp:60,date:`2026-09-0${i+1}T00:00:00Z`}));
  const text=profileText(restored,{...restored,history,passwordHash:'secret-hash',password:'secret-password'});
  assert.match(text,/名字：齐天大圣/);assert.match(text,/累计经验：250/);assert.match(text,/8\. .*数学/);assert.match(text,/8 条/);assert.doesNotMatch(text,/secret-hash|secret-password|scrypt/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('passwords use distinct salted scrypt hashes and compare on the server',async()=>{
 const one=await hashPassword('a test password'),two=await hashPassword('a test password');
 assert.notEqual(one,two);assert.equal(await verifyPassword('a test password',one),true);
 assert.equal(await verifyPassword('wrong password',one),false);assert.equal(await verifyPassword('x','corrupt'),false);
});
test('JSON stores no plaintext, serializes concurrent changes, and survives reopening',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-accounts-')),file=join(dir,'accounts.json');
 try{
  const store=createAccountStore(file);
  const a=await store.register({username:'同学甲',password:'private-password',legacyProgress:{xp:190,wins:2}});
  const b=await store.register({username:'同学乙',password:'different-password'});
  assert.equal(a.xp,190);assert.equal(b.xp,0);assert.equal(a.passwordHash,undefined);
  await assert.rejects(store.register({username:'同学甲',password:'new-password'}),/USERNAME_TAKEN/);
  await assert.rejects(store.login({username:'同学甲',password:'wrong'}),/LOGIN_FAILED/);
  const win={id:'battle-one',subject:'math',difficulty:'normal',outcome:'win',correct:4,answered:4,bestCombo:4};
  const result=await store.settle(a.id,win);assert.equal(result.user.xp,250);
  await Promise.all([store.settle(a.id,win),store.settle(a.id,{...win,id:'battle-two'}),store.preferences(a.id,{pace:600,xp:9999999,passwordHash:'bad'}),store.preferences(b.id,{grade:2})]);
  assert.equal((await store.get(a.id)).xp,310);assert.equal((await store.get(a.id)).pace,600);assert.equal((await store.get(b.id)).xp,0);
  const text=await readFile(file,'utf8'),db=JSON.parse(text);
  assert.ok(!text.includes('private-password')&&!text.includes('different-password'));
  assert.match(db.users[0].passwordHash,/^scrypt:/);assert.equal(db.users[0].password,undefined);
  const reopened=createAccountStore(file);assert.equal((await reopened.login({username:'同学甲',password:'private-password'})).xp,310);
  const duplicate=await Promise.allSettled([store.register({username:'Student',password:'1234'}),store.register({username:'student',password:'1234'})]);
  assert.equal(duplicate.filter(r=>r.status==='fulfilled').length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('a damaged account file is reported without overwriting it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-damaged-')),file=join(dir,'accounts.json');
 try{await writeFile(file,'broken-json');await assert.rejects(createAccountStore(file).get('x'),/ACCOUNT_STORAGE/);assert.equal(await readFile(file,'utf8'),'broken-json');}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('authenticated battles isolate accounts, settle exactly once, enforce skills and survive server restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-api-')),file=join(dir,'accounts.json');
 let clock=Date.now(),calls=0,fail=true;
 const aiGrader=async()=>{calls++;if(fail)throw new Error('PROVIDER_UNAVAILABLE');await new Promise(r=>setTimeout(r,15));return {score:90,correct:true,feedback:'理解正确',explanation:'解释清楚',reference:'示例',source:'test'};};
 let server,base;
 async function launch(){const middleware=createApiMiddleware({accountStore:createAccountStore(file),aiGrader,now:()=>clock});server=createServer((req,res)=>blockPrivateFiles(req,res,()=>middleware(req,res,()=>{res.writeHead(404);res.end();})));await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 const post=(path,body={},cookie='')=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body)});
 async function register(username,legacyProgress){const r=await post('auth/register',{username,password:'1234-test',legacyProgress});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];return {cookie,user:(await r.json()).user};}
 try{
  await launch();assert.equal((await post('battle/start')).status,401);
  const a=await register('player-a',{xp:190}),b=await register('player-b');
  const start=await post('battle/start',{subject:'math',grade:1,difficulty:'normal',questionType:'fill'},a.cookie);const battle=(await start.json()).battle;
  assert.equal((await post('battle/leave',{battleId:battle.id},b.cookie)).status,404);
  assert.equal((await post('battle/skill',{battleId:battle.id,skill:'calculator'},a.cookie)).status,409);
  clock+=21000;assert.equal((await post('battle/skill',{battleId:battle.id,skill:'calculator'},a.cookie)).status,200);
  assert.equal((await post('battle/skill',{battleId:battle.id,skill:'calculator'},a.cookie)).status,409);
  const firstQ=await (await post('question',{battleId:battle.id},a.cookie)).json();assert.equal(firstQ.answer,undefined);assert.equal(firstQ.rubric,undefined);
  assert.equal((await post('grade',{questionId:firstQ.id,answer:'5'},b.cookie)).status,404);
  assert.equal((await post('hint',{questionId:firstQ.id},a.cookie)).status,409);
  let final;
  for(let i=0;i<4;i++){
   const q=await (await post('question',{battleId:battle.id},a.cookie)).json();const [x,y,z]=q.text.match(/\d+/g).map(Number);
   const responses=await Promise.all([post('grade',{questionId:q.id,answer:String((z-y)/x),xp:999999},a.cookie),post('grade',{questionId:q.id,answer:String((z-y)/x)},a.cookie)]);
   for(const response of responses){assert.equal(response.status,200);final=await response.json();assert.equal(final.battle.answered,i+1);}
  }
  assert.equal(final.settlement.user.xp,250);assert.equal(final.settlement.user.wins,1);
  assert.equal((await (await fetch(base+'/api/auth/me',{headers:{cookie:b.cookie}})).json()).user.xp,0);
  const settings=await post('profile/settings',{xp:999999,password:'overwritten',pace:600},a.cookie);assert.equal((await settings.json()).user.xp,250);
  const open=await(await post('battle/start',{questionType:'open'},a.cookie)).json();const q=await(await post('question',{battleId:open.battle.id},a.cookie)).json();
  assert.equal((await post('hint',{questionId:q.id},a.cookie)).status,200);
  assert.equal((await post('grade',{questionId:q.id,answer:'回答'},a.cookie)).status,503);fail=false;
  const retries=await Promise.all([post('grade',{questionId:q.id,answer:'回答'},a.cookie),post('grade',{questionId:q.id,answer:'回答'},a.cookie)]);
  for(const r of retries){assert.equal(r.status,200);assert.equal((await r.json()).battle.answered,1);}assert.equal(calls,2);
  for(const path of ['/data/accounts.json','/data/accounts.json?raw','/@fs/tmp/accounts.json','/server/accounts.js','/deepseek_apikey.txt'])assert.equal((await fetch(base+path)).status,404);
  const cross=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://unrelated.example','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
  await post('auth/logout',{},a.cookie);assert.equal((await fetch(base+'/api/auth/me',{headers:{cookie:a.cookie}})).status,401);
  await new Promise(r=>server.close(r));await launch();
  const loggedIn=await post('auth/login',{username:'player-a',password:'1234-test'});assert.equal(loggedIn.status,200);const recovered=(await loggedIn.json()).user;
  assert.equal(recovered.xp,250);assert.equal(recovered.level,3);assert.equal(recovered.battles,1);assert.equal(recovered.pace,600);assert.equal(recovered.passwordHash,undefined);
 }finally{if(server?.listening)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

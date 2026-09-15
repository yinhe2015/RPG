import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createApiMiddleware} from '../server/api.js';
import {createAccountStore} from '../server/accounts.js';
import {tutorWithDeepseek,validateTutorReply} from '../server/tutor.js';
import {MODEL} from '../server/deepseek.js';
import {streamEvents} from '../src/stream-events.js';

const reply={message:'先说说你是怎么想的？',focus:'确认移项时的等式两边关系',summary:'尚未确认理解，先询问思路。',stage:'exploring',quickReplies:['我不清楚怎么开始']};
function streamed(parts,finish='stop'){
 const frames=[...parts.map(content=>({choices:[{delta:{content},finish_reason:null}]})),...(finish?[{choices:[{delta:{},finish_reason:finish}]}]:[])];
 const bytes=new TextEncoder().encode(': ping\r\n\r\n'+frames.map(frame=>'data: '+JSON.stringify(frame)+'\r\n\r\n').join('')+'data: [DONE]\r\n\r\n');
 return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}
test('tutoring streams plain text, keeps full history, follows language and tolerates absent metadata',async()=>{
 let payload;const chunks=[],session={teacherId:'linger',subject:'math',grade:1,language:'en-US',topic:'方程',reference:{text:'x+2=5',studentAnswer:'7'},messages:Array.from({length:24},(_,i)=>({role:i%2?'assistant':'user',content:`第${i}句`}))};
 const result=await tutorWithDeepseek(session,'x的平方知道',{getKey:async()=>'test-only',onDelta:part=>chunks.push(part),fetchImpl:async(url,options)=>{payload=JSON.parse(options.body);return streamed(['你知道平方，','我们接着看 $x^2$。']);}});
 assert.equal(result.message,'你知道平方，我们接着看 $x^2$。');assert.deepEqual(chunks,['你知道平方，','我们接着看 $x^2$。']);
 assert.equal(payload.model,MODEL);assert.equal(payload.stream,true);assert.equal(payload.response_format,undefined);assert.equal(payload.messages.length,27);
 assert.match(payload.messages[0].content,/赵灵儿/);assert.match(payload.messages[0].content,/Reply in English/);assert.match(payload.messages[0].content,/最多一个主要问题/);
 assert.match(payload.messages[1].content,/studentAnswer/);assert.equal(payload.messages[2].content,'第0句');assert.equal(payload.messages[3].content,'第1句');
 assert.equal(validateTutorReply({message:'内容有效',summary:42,stage:'unexpected',quickReplies:'bad'}).message,'内容有效');
 assert.throws(()=>validateTutorReply({message:'   '}),/EMPTY_TUTOR_REPLY/);
 await assert.rejects(tutorWithDeepseek(session,'x',{getKey:async()=>'test-only',fetchImpl:async()=>({ok:false,status:401})}),/KEY_REJECTED/);
 const partial=[];await assert.rejects(tutorWithDeepseek(session,'x',{getKey:async()=>'test-only',onDelta:p=>partial.push(p),fetchImpl:async()=>streamed(['回答一半'],null)}),/STREAM_INTERRUPTED/);assert.deepEqual(partial,['回答一半']);
 const long=await tutorWithDeepseek(session,'x',{getKey:async()=>'test-only',fetchImpl:async()=>streamed(['先讲这一部分'],'length')});assert.equal(long.truncated,true);assert.equal(long.message,'先讲这一部分');
 let attempts=0;const retried=await tutorWithDeepseek(session,'x',{getKey:async()=>'test-only',fetchImpl:async()=>streamed([++attempts===1?'   ':'现在有内容'])});assert.equal(attempts,2);assert.equal(retried.message,'现在有内容');
 await assert.rejects(tutorWithDeepseek(session,'x',{getKey:async()=>'test-only',fetchImpl:async()=>streamed([' '])}),/EMPTY_TUTOR_REPLY/);
});

test('learning API persists real mistakes and discussions, isolates users, retries safely and resumes after restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-learning-')),file=join(dir,'accounts.json');let calls=0,fail=false,release,entered,seen;
 const aiTutor=async(s,text)=>{calls++;seen=structuredClone(s);if(text==='慢请求'){entered();await new Promise(r=>release=r);}if(fail)throw Error('PROVIDER_UNAVAILABLE');return {...reply,message:text?'现在两边都减 2，左边会剩下什么？':reply.message};};
 let middleware=createApiMiddleware({accountStore:createAccountStore(file),aiTutor,aiGrader:async()=>({correct:false,score:0,feedback:'再想想',reference:'两边同时减去 2',explanation:'保持等式平衡',source:'local'})});
 const server=createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const post=(path,body,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie:cookie||''},body:JSON.stringify(body)});
 const get=cookie=>fetch(base+'learning/current',{headers:{cookie:cookie||''}}).then(async r=>({status:r.status,...await r.json()}));
 try{
  assert.equal((await get()).status,401);
  const reg=await post('auth/register',{username:'learn-owner',password:'test-pass'});let cookie=reg.headers.get('set-cookie').split(';')[0];const owner=(await reg.json()).user;
  const other=await post('auth/register',{username:'learn-other',password:'test-pass'}),foreign=other.headers.get('set-cookie').split(';')[0];
  const b=(await(await post('battle/start',{subject:'math',grade:1,questionType:'short'},cookie)).json()).battle;
  const q=await(await post('question',{battleId:b.id},cookie)).json();const answer='两边加二？';
  const graded=await(await post('grade',{questionId:q.id,answer},cookie)).json();assert.equal(graded.correct,false);
  await post('grade',{questionId:q.id,answer},cookie);
  let state=await get(cookie);assert.equal(state.mistakes.length,1);assert.equal(state.mistakes[0].studentAnswer,answer);assert.equal(state.mistakes[0].id,q.id);assert.ok(state.topics.length>0);
  const body={requestId:'start-lesson-001',teacherId:'linger',mistakeId:q.id};
  assert.equal((await post('learning/start',body,foreign)).status,404);
  let response=await post('learning/start',body,cookie);assert.equal(response.status,200);let lesson=(await response.json()).session;
  assert.equal(lesson.reference.text,q.text);assert.equal(lesson.messages.length,1);assert.equal(seen.reference.studentAnswer,answer);
  await post('learning/start',body,cookie);assert.equal(calls,1);
  const chat={sessionId:lesson.id,requestId:'chat-lesson-001',version:1,text:'先把 2 移过去'};
  assert.equal((await post('learning/chat',chat,foreign)).status,404);
  fail=true;assert.equal((await post('learning/chat',chat,cookie)).status,503);assert.equal((await get(cookie)).sessions[0].messages.length,1);
  fail=false;lesson=(await(await post('learning/chat',chat,cookie)).json()).session;assert.equal(lesson.messages.length,3);
  const before=calls;await post('learning/chat',chat,cookie);assert.equal(calls,before);
  assert.equal((await post('learning/chat',{...chat,requestId:'stale-chat-001'},cookie)).status,409);
  const waiting=new Promise(r=>entered=r),slow=post('learning/chat',{sessionId:lesson.id,requestId:'slow-chat-001',version:3,text:'慢请求'},cookie);await waiting;
  assert.equal((await post('learning/chat',{sessionId:lesson.id,requestId:'other-chat-001',version:3,text:'另一个标签页'},cookie)).status,409);release();await slow;
  assert.equal((await get(cookie)).sessions[0].messages.length,5);
  const publicUser=await createAccountStore(file).get(owner.id);assert.equal(publicUser.xp,0);assert.equal(publicUser.learningSessions,undefined);assert.equal(publicUser.passwordHash,undefined);
  middleware=createApiMiddleware({accountStore:createAccountStore(file),aiTutor});
  const login=await post('auth/login',{username:'learn-owner',password:'test-pass'});cookie=login.headers.get('set-cookie').split(';')[0];
  state=await get(cookie);assert.equal(state.sessions[0].messages.length,5);assert.equal(state.sessions[0].reference.studentAnswer,answer);assert.equal(state.mistakes.length,1);
 }finally{release?.();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('SSE delivers text before commit, saves before done, replays once, and keeps interrupted replies unsaved',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quest-learning-stream-')),store=createAccountStore(join(dir,'accounts.json'));let finish,calls=0;
 const middleware=createApiMiddleware({accountStore:store,aiTutor:async(s,text,{onDelta})=>{calls++;onDelta('先收到的文字');if(text==='断流')throw Error('STREAM_INTERRUPTED');await new Promise(r=>finish=r);return {message:'完整回答，请说说你的理解？'};}});
 const server=createServer((req,res)=>middleware(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 let cookie;
 const post=(path,body,stream=false)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie:cookie||'',...(stream?{Accept:'text/event-stream'}:{})},body:JSON.stringify(body)});
 try{
  const auth=await post('auth/register',{username:'stream-user',password:'test-pass'});cookie=auth.headers.get('set-cookie').split(';')[0];const user=(await auth.json()).user;
  const body={requestId:'stream-start-001',teacherId:'linger',subject:'math',grade:1,topic:'方程',language:'en-US'};
  const response=await post('learning/start',body,true),events=streamEvents(response.body);
  assert.equal(response.headers.get('Content-Type'),'text/event-stream; charset=utf-8');assert.equal((await events.next()).value.event,'ready');
  assert.equal(JSON.parse((await events.next()).value.data).text,'先收到的文字');assert.equal((await store.learning(user.id)).sessions.length,0);
  finish();const done=(await events.next()).value;assert.equal(done.event,'done');assert.equal((await store.learning(user.id)).sessions[0].messages.length,1);assert.equal((await store.learning(user.id)).sessions[0].language,'en-US');await events.return();
  const repeated=await post('learning/start',body,true);const replay=[];for await(const event of streamEvents(repeated.body))replay.push(event);assert.equal(calls,1);assert.deepEqual(replay.map(e=>e.event),['done']);
  const failed=await post('learning/chat',{sessionId:body.requestId,requestId:'stream-fail-001',version:1,text:'断流',language:'bilingual'},true),failure=[];
  for await(const event of streamEvents(failed.body))failure.push(event);assert.deepEqual(failure.map(e=>e.event),['ready','delta','error']);
  const saved=(await store.learning(user.id)).sessions[0];assert.equal(saved.messages.length,1);assert.equal(saved.language,'en-US');
 }finally{finish?.();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

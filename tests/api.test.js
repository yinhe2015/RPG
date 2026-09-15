import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createApiMiddleware,blockPrivateFiles} from '../server/api.js';
import {createQuestion,gradeObjective,questionTypes} from '../server/questions.js';
import {gradeWithDeepseek,validateGrade,MODEL} from '../server/deepseek.js';
import {subjects,difficulties} from '../src/game.js';

test('four question types cover six subjects and three stages',()=>{
 for(const s of subjects)for(const grade of [0,1,2])for(const type of questionTypes){
  const q=createQuestion({subject:s.id,grade,difficulty:'normal',type});
  assert.equal(q.type,type);assert.ok(q.text&&q.hint);
  if(type==='choice')assert.ok(q.options.includes(q.answer));
  else assert.equal(q.options,undefined);
  if(type==='open'||type==='short')assert.ok(q.rubric);
 }
 const mixed=Array.from({length:4},(_,round)=>createQuestion({subject:'math',grade:1,difficulty:'normal',type:'mixed',round}).type);
 assert.deepEqual(new Set(mixed),new Set(questionTypes));
 for(const d of Object.values(difficulties))assert.equal(d.time,0);
});
test('objective grading accepts harmless formatting without partial-match guessing',()=>{
 assert.equal(gradeObjective({answer:'5',explanation:'x=5'},' x = ５ ').correct,true);
 assert.equal(gradeObjective({answer:'《论语》',explanation:'出处'},'论语。').correct,true);
 assert.equal(gradeObjective({answer:'5',explanation:'x=5'},'15').correct,false);
});
test('AI grading validates scores and never trusts a model-provided pass flag',()=>{
 assert.equal(validateGrade({score:59,correct:true,feedback:'再试一次',explanation:'缺少解释',reference:'参考'}).correct,false);
 assert.equal(validateGrade({score:60,feedback:'基本理解',explanation:'解释',reference:'参考'}).correct,true);
 for(const score of [-1,101,'100',null,NaN])assert.throws(()=>validateGrade({score,feedback:'x',explanation:'y',reference:'z'}));
 assert.throws(()=>validateGrade({score:100,feedback:'',explanation:'',reference:''}));
});
test('provider uses Flash with JSON grading and rejects malformed or rejected responses',async()=>{
 const q=createQuestion({subject:'chinese',grade:1,difficulty:'normal',type:'open'});
 let payload;
 const fetchImpl=async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');payload=JSON.parse(options.body);
  return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({score:88,feedback:'观点清楚',explanation:'理由充分',reference:'一种示例'})}}]})};
 };
 const r=await gradeWithDeepseek(q,'我喜欢纸质书',{fetchImpl,getKey:async()=>'test-key'});
 assert.equal(r.correct,true);assert.equal(payload.model,MODEL);assert.equal(payload.thinking.type,'disabled');
 assert.equal(payload.response_format.type,'json_object');assert.match(payload.messages[0].content,/不可信/);
 await assert.rejects(gradeWithDeepseek(q,'回答',{getKey:async()=>'test-key',fetchImpl:async()=>({ok:false,status:401})}),/KEY_REJECTED/);
 await assert.rejects(gradeWithDeepseek(q,'回答',{getKey:async()=>'test-key',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length'}]})})}),/INVALID_GRADING/);
});

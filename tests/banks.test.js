import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBank,banks,listBanks} from '../server/banks/registry.js';
import {createQuestion} from '../server/questions.js';
import {createAccountStore} from '../server/accounts.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const custom=()=>({schemaVersion:1,id:'external-test',name:'外部练习',questions:[{id:'angle-1',subject:'math',grade:1,type:'choice',difficulties:['hard'],knowledgePoint:{id:'math:三角形内角和',name:'三角形内角和'},text:'三角形内角和是？',answer:'180°',options:['90°','180°','360°'],explanation:'三角形的三个内角和为 180°。'}]});
test('replacement JSON banks drive questions and AI rubrics without editing game code',()=>{
 const bank=validateBank(custom());banks.set(bank.id,bank);
 try{
  const settings={subject:'math',grade:1,difficulty:'hard',questionBank:bank.id};
  const q=createQuestion({...settings,type:'choice'});assert.equal(q.answer,'180°');assert.equal(q.bankId,bank.id);assert.equal(q.knowledgePoint.id,'math:三角形内角和');
  const fill=createQuestion({...settings,type:'fill'});assert.equal(fill.answer,'180°');assert.equal(fill.options,undefined);
  const short=createQuestion({...settings,type:'short'});assert.match(short.rubric,/180°/);assert.equal(short.knowledgePoint.id,q.knowledgePoint.id);
  assert.throws(()=>createQuestion({...settings,difficulty:'easy',type:'choice'}),/BANK_EMPTY/);
  assert.throws(()=>createQuestion({...settings,questionBank:'missing',type:'choice'}),/BANK_MISSING/);
  assert.ok(!JSON.stringify(listBanks()).includes('rubric'));
 }finally{banks.delete(bank.id);}
});
test('malformed banks fail with actionable errors instead of becoming unanswerable battles',()=>{
 const b=custom();b.questions[0].options=['90°','90°'];assert.throws(()=>validateBank(b),/选项/);
 const duplicate=custom();duplicate.questions.push(structuredClone(duplicate.questions[0]));assert.throws(()=>validateBank(duplicate),/重复/);
 const missing=custom();delete missing.questions[0].knowledgePoint;assert.throws(()=>validateBank(missing),/知识点/);
 const open=custom();open.questions[0].type='open';assert.throws(()=>validateBank(open),/rubric/);
});
test('theme preferences persist as allowed values and never accept CSS injection',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'quest-themes-'));
 try{
  const store=createAccountStore(join(directory,'accounts.json')),user=await store.register({username:'界面测试',password:'test-password'});
  assert.equal(user.theme,'paper');await store.preferences(user.id,{theme:'pal',themeAccent:'#ffaa33',reducedMotion:true});
  const saved=await createAccountStore(store.file).get(user.id);assert.equal(saved.theme,'pal');assert.equal(saved.themeAccent,'#ffaa33');assert.equal(saved.reducedMotion,true);
  await store.preferences(user.id,{theme:'evil',themeAccent:'url(javascript:evil)',reducedMotion:'true'});const unchanged=await store.get(user.id);assert.equal(unchanged.theme,'pal');assert.equal(unchanged.themeAccent,'#ffaa33');
 }finally{await rm(directory,{recursive:true,force:true});}
});

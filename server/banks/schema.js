import {subjects} from '../../src/game.js';
const types=['choice','fill','short','open'];
const text=(v,max=12000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;

export function validateBank(bank){
 const fail=message=>{throw new Error(`题库格式错误：${message}`);};
 if(bank?.schemaVersion!==1||!text(bank.id,64)||!/^[a-z0-9_-]+$/.test(bank.id)||!text(bank.name,80)||!Array.isArray(bank.questions)||!bank.questions.length)fail('需要 schemaVersion: 1、id、name 和非空 questions');
 for(const key of ['allowDerivedTypes','shuffleOptions'])if(bank[key]!==undefined&&typeof bank[key]!=='boolean')fail(`${key} 必须是布尔值`);
 const ids=new Set();
 for(const q of bank.questions){
  if(!text(q.id,160)||ids.has(q.id))fail('题目 id 缺失或重复');ids.add(q.id);
  if(!subjects.some(s=>s.id===q.subject)||![0,1,2].includes(q.grade)||!types.includes(q.type))fail(`${q.id} 的学科、学段或题型无效`);
  if(!text(q.text)||!text(q.knowledgePoint?.id,160)||!text(q.knowledgePoint?.name,80))fail(`${q.id} 缺少题干或知识点`);
  if(!Array.isArray(q.difficulties)||!q.difficulties.length||q.difficulties.some(d=>!['easy','normal','hard'].includes(d)))fail(`${q.id} 需要明确 difficulties`);
  if(['choice','fill'].includes(q.type)&&!text(q.answer,q.type==='fill'?100:2000))fail(`${q.id} 缺少答案`);
  if(q.type==='choice'&&(!Array.isArray(q.options)||q.options.length<2||q.options.length>4||q.options.some(o=>!text(o,2000))||new Set(q.options).size!==q.options.length||!q.options.includes(q.answer)))fail(`${q.id} 的选项必须唯一并包含正确答案`);
  if(['short','open'].includes(q.type)&&!text(q.rubric))fail(`${q.id} 缺少判分标准 rubric`);
 }
 return bank;
}

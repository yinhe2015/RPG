import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {banks,listBanks,validateBank} from '../server/banks/registry.js';
import {createQuestion,gradeObjective} from '../server/questions.js';
import {questionText} from '../src/ui/question-text.js';
import {reconcileBankPreferences} from '../src/bank-preferences.js';

const bank=banks.get('ceval-school');
test('C-Eval import is traceable, complete and matches its filtering report',()=>{
 const report=JSON.parse(readFileSync(new URL('../docs/ceval-import-report.json',import.meta.url)));
 validateBank(bank);assert.equal(bank.questions.length,report.imported);assert.equal(report.downloaded,report.imported+report.excluded);
 assert.equal(new Set(bank.questions.map(q=>q.id)).size,bank.questions.length);
 for(const q of bank.questions){assert.equal(q.answer,q.options['ABCD'.indexOf(q.source.answerLabel)]);assert.equal(q.source.revision,report.revision);assert.ok(!report.exclusions.some(e=>e.id===q.id));}
 assert.equal(Object.keys(report.bySubset).length,9);
 assert.deepEqual(new Set(bank.questions.map(q=>q.source.split)),new Set(['dev','val','test']));
});
test('C-Eval preserves options and question type, grades locally and exhausts fresh questions before repeating',()=>{
 const settings={subject:'math',grade:2,difficulty:'normal',questionBank:bank.id,type:'mixed'};
 const used=[];
 for(let round=0;round<40;round++){
  const q=createQuestion({...settings,round,exclude:used}),original=bank.questions.find(item=>item.id===q.id);
  assert.equal(q.type,'choice');assert.deepEqual(q.options,original.options);assert.ok(!used.includes(q.id));used.push(q.id);
  assert.equal(gradeObjective(q,q.answer).correct,true);assert.equal(gradeObjective(q,q.options.find(o=>o!==q.answer)).correct,false);
 }
 assert.throws(()=>createQuestion({...settings,type:'open'}),/BANK_TYPE/);
 assert.throws(()=>createQuestion({...settings,grade:0}),/BANK_EMPTY/);
 assert.throws(()=>createQuestion({...settings,subject:'english'}),/BANK_EMPTY/);
});
test('C-Eval excludes source questions with an unspecified symmetry axis',()=>{
 const report=JSON.parse(readFileSync(new URL('../docs/ceval-import-report.json',import.meta.url)));
 for(const id of [137,159,160]){
  const key=`ceval:middle_school_mathematics:test:${id}`;
  assert.ok(!bank.questions.some(q=>q.id===key));
  assert.ok(report.exclusions.some(e=>e.id===key&&e.reason==='missing_symmetry_axis'));
 }
 for(const q of bank.questions)assert.doesNotMatch(q.text,/关于\s*轴/,q.id);
});
test('bank changes correct unsupported preferences without modifying player progress',()=>{
 const p={questionBank:bank.id,grade:0,subject:'english',questionType:'open',xp:125,displayName:'学科勇者'};
 reconcileBankPreferences(p,listBanks());assert.ok(listBanks().find(b=>b.id===bank.id).coverage.includes(`${p.subject}:${p.grade}`));
 assert.equal(p.questionType,'choice');assert.equal(p.xp,125);assert.equal(p.displayName,'学科勇者');
 p.subject='chinese';p.grade=1;reconcileBankPreferences(p,listBanks());assert.equal(p.subject,'math');
});
test('exam formulas render without allowing imported markup or trusted TeX commands',()=>{
 assert.match(questionText('求 $\\frac{x^2}{2}$ 的值'),/class="katex"/);
 assert.match(questionText('<img src=x onerror=alert(1)>'),/&lt;img/);
 assert.doesNotMatch(questionText('$\\href{javascript:alert(1)}{点击}$'),/<a[ >]|href="javascript:/);
 assert.match(questionText('$\\unknown{<img>}$'),/math-fallback/);
 for(const q of bank.questions)for(const text of [q.text,...q.options,q.explanation])assert.doesNotMatch(questionText(text),/math-fallback/,q.id);
});

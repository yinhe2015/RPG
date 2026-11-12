import {subjects,difficulties} from '../src/game.js';
import {getBank,defaultBankId,supportedTypes} from './banks/registry.js';
import {mathQuestion,shuffle} from './banks/starter.js';
export const questionTypes=['choice','fill','short','open'];

export function createQuestion({subject,grade,difficulty,type,round=0,questionBank=defaultBankId,exclude=[],knowledgePointId}){
 if(!subjects.some(s=>s.id===subject)||![0,1,2].includes(grade)||!Object.hasOwn(difficulties,difficulty)||!['mixed',...questionTypes].includes(type)||!Number.isInteger(round)||round<0||round>1000)throw new Error('INVALID_QUESTION');
 const bank=getBank(questionBank),types=supportedTypes(bank),rotation=['choice','open','fill','short'].filter(t=>types.includes(t));
 const actualType=type==='mixed'?rotation[round%rotation.length]:type;
 if(!types.includes(actualType))throw new Error('BANK_TYPE');
 const procedural=bank.id==='starter'&&subject==='math'&&(!knowledgePointId||knowledgePointId===`math:${['乘法运算','一元一次方程','完全平方公式'][grade]}`);
 const base={subject,grade,difficulty,type:actualType,bankId:bank.id,bankName:bank.name};
 const pool=bank.questions.filter(q=>q.subject===subject&&q.grade===grade&&q.difficulties.includes(difficulty)&&(!knowledgePointId||q.knowledgePoint.id===knowledgePointId));
 const pick=entries=>{const fresh=entries.filter(q=>!exclude.includes(q.id));return (fresh.length?fresh:entries)[Math.floor(Math.random()*(fresh.length||entries.length))];};
 let q;
 if(procedural&&['choice','fill'].includes(actualType))q=mathQuestion(grade,difficulty);
 else{
  const exact=pool.filter(q=>q.type===actualType);
  // The starter bank also builds reasoning prompts from its tagged objective questions.
  if(exact.length&&(bank.id!=='starter'||knowledgePointId||round%4===0||actualType==='choice'||actualType==='fill'))q=pick(exact);
  else q=pick(pool.filter(q=>q.type==='choice'));
  if(!q&&procedural)q=mathQuestion(grade,difficulty);
 }
 if(!q)throw new Error('BANK_EMPTY');
 const metadata={...base,id:q.id,knowledgePoint:q.knowledgePoint,hint:q.hint||'找出关键词，联系学过的知识，分步骤思考。'};
 if(actualType==='choice')return {...q,...metadata,options:bank.shuffleOptions===false?[...q.options]:shuffle(bank.id==='starter'?[q.answer,...q.options.filter(o=>o!==q.answer).slice(0,difficulty==='easy'?2:3)]:q.options)};
 if(actualType==='fill')return {...q,...metadata,options:undefined};
 if(q.type===actualType)return {...q,...metadata,options:undefined};
 if(actualType==='short')return {...metadata,text:`${q.text}\n请写出答案，并用自己的话解释理由。`,rubric:`核心答案为“${q.answer}”。${q.explanation||''} 接受合理的同义表达，需要回答问题并给出基本理由。`};
 const prompts=[
  ['为同学设计一个记住下面知识点的小故事或比喻，并解释它与知识点的对应关系。','故事或比喻与知识有合理对应，基本事实正确，解释清楚；创意和表述自由。'],
  ['把下面的知识点放进一个你熟悉的场景，说说它能帮助你理解或解决什么问题。','给出合理具体的场景，联系知识说明用途或理解，允许多种回答。'],
  ['围绕下面的知识点，提出一个你想进一步研究的问题，并说说你会怎样寻找答案。','提出切题的问题，并给出可行的查证、观察、比较或计算方法。'],
 ];
 const [task,rubric]=prompts[round%3];
 return {...metadata,text:`${task}\n知识点：${q.explanation||`${q.text} 参考结论：${q.answer}`}`,rubric:`${rubric} 根据${['小学','初中','高中'][grade]}阶段宽容评价，重点看理解与理由，不按字数判分。`};
}

export function normalizeAnswer(answer) {
  return answer.normalize('NFKC').toLowerCase().trim().replace(/^[a-z]\s*=\s*/, '').replace(/[\s《》「」“”"']/g, '').replace(/[。.!！]+$/, '');
}

export function gradeObjective(question, answer) {
  const correct = normalizeAnswer(answer) === normalizeAnswer(question.answer);
  return {correct, score: correct ? 100 : 0, feedback: correct ? '答对了，知识命中！' : '再记住这个知识点，下次就会了。',
    explanation: question.explanation, reference: question.answer, source: 'local'};
}

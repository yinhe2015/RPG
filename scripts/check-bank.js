import {readFileSync} from 'node:fs';
import {validateBank} from '../server/banks/schema.js';

const file=process.argv[2];
if(!file){console.error('用法：npm run bank:check -- /path/to/bank.json');process.exitCode=1;}
else try{
 const bank=validateBank(JSON.parse(readFileSync(file,'utf8')));
 const topics=new Set(bank.questions.map(q=>q.knowledgePoint.id));
 console.log(`通过：${bank.name} (${bank.id})，${bank.questions.length} 道题，${topics.size} 个知识点。`);
}catch(error){console.error(error.message);process.exitCode=1;}

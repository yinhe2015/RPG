import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBank} from './schema.js';
export {validateBank} from './schema.js';

const directory=process.env.QUEST_QUESTION_BANK_DIR?resolve(process.env.QUEST_QUESTION_BANK_DIR):fileURLToPath(new URL('../../question-banks/',import.meta.url));
export function loadBanks(folder=directory){
 const result=new Map();
 for(const file of readdirSync(folder).filter(f=>f.endsWith('.json')).sort()){
  let bank;try{bank=validateBank(JSON.parse(readFileSync(resolve(folder,file),'utf8')));}catch(error){throw new Error(`${file}: ${error.message}`);}
  if(result.has(bank.id))throw new Error(`重复的题库 id：${bank.id}`);
  result.set(bank.id,bank);
 }
 if(!result.size)throw new Error('没有可用题库');
 return result;
}
export const banks=loadBanks();
export const defaultBankId=banks.has('starter')?'starter':banks.keys().next().value;
export function supportedTypes(bank){return bank.allowDerivedTypes===false?[...new Set(bank.questions.map(q=>q.type))]:['choice','fill','short','open'];}
export function listBanks(){return [...banks.values()].map(b=>({id:b.id,name:b.name,description:b.description||'',count:b.questions.length,source:b.source,types:supportedTypes(b),
 coverage:[...new Set(b.questions.map(q=>`${q.subject}:${q.grade}`))],procedural:b.id==='starter'}));}
export function getBank(id=defaultBankId){const bank=banks.get(id);if(!bank)throw new Error('BANK_MISSING');return bank;}

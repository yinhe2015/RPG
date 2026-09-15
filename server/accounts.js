import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {subjects,difficulties,levelFor} from '../src/game.js';
import {banks,defaultBankId} from './banks/registry.js';
import {cardInventory,rewardCards,availableMoves} from '../src/combat-cards.js';
import {hasTheme,themeDefinition} from '../src/themes/catalog.js';

const deriveKey=promisify(scrypt);
export const defaultPreferences={music:false,effects:true,grade:1,difficulty:'normal',subject:'math',questionType:'mixed',pace:0,theme:'paper',themeAccent:'',reducedMotion:false,questionBank:defaultBankId};
export const defaultProgress={xp:0,wins:0,correct:0,battles:0,bestCombo:0,dungeonClears:0,defeated:[],history:[],cards:{}};
export const defaultAccountsPath=process.env.QUEST_DATA_FILE?resolve(process.env.QUEST_DATA_FILE):fileURLToPath(new URL('../data/accounts.json',import.meta.url));

export function validateCredentials(username,password){
 if(typeof username!=='string'||typeof password!=='string')throw new Error('INVALID_CREDENTIALS');
 const name=username.normalize('NFKC').trim();
 if(!/^[\p{L}\p{N}_.@-]{2,32}$/u.test(name))throw new Error('INVALID_USERNAME');
 if(password.length<4||password.length>128)throw new Error('INVALID_PASSWORD');
 return {username:name,usernameKey:name.toLowerCase()};
}
export async function hashPassword(password){
 const salt=randomBytes(16).toString('hex');
 const hash=await deriveKey(password,salt,64);
 return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password,encoded){
 if(typeof encoded!=='string'||!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded))return false;
 const [,salt,stored]=encoded.split(':');
 const candidate=await deriveKey(password,salt,64);
 return timingSafeEqual(candidate,Buffer.from(stored,'hex'));
}
export function publicAccount(user){
 return {id:user.id,username:user.username,displayName:user.displayName||user.username,createdAt:user.createdAt,...Object.fromEntries(Object.keys(defaultProgress).map(k=>[k,structuredClone(user[k]??defaultProgress[k])])),
  cards:cardInventory(user),level:levelFor(user.xp),...defaultPreferences,...user.preferences,theme:themeDefinition(user.preferences.theme).id,questionBank:banks.has(user.preferences.questionBank)?user.preferences.questionBank:defaultBankId};
}
function sanitizePreferences(input){
 const p={};
 for(const key of ['music','effects','reducedMotion'])if(typeof input[key]==='boolean')p[key]=input[key];
 if(hasTheme(input.theme))p.theme=input.theme;
 if(input.themeAccent===''||typeof input.themeAccent==='string'&&/^#[a-fA-F0-9]{6}$/.test(input.themeAccent))p.themeAccent=input.themeAccent;
 if(banks.has(input.questionBank))p.questionBank=input.questionBank;
 if([0,1,2].includes(input.grade))p.grade=input.grade;
 if(Object.hasOwn(difficulties,input.difficulty))p.difficulty=input.difficulty;
 if(subjects.some(s=>s.id===input.subject))p.subject=input.subject;
 if(['mixed','choice','fill','short','open'].includes(input.questionType))p.questionType=input.questionType;
 if([0,300,600].includes(input.pace))p.pace=input.pace;
 return p;
}
function importLegacy(input){
 const progress=structuredClone(defaultProgress);
 if(!input||typeof input!=='object')return progress;
 for(const key of ['xp','wins','correct','battles','bestCombo'])if(Number.isInteger(input[key])&&input[key]>=0)progress[key]=Math.min(input[key],1000000);
 if(Array.isArray(input.defeated))progress.defeated=[...new Set(input.defeated.filter(id=>subjects.some(s=>s.id===id)))];
 if(Array.isArray(input.history))progress.history=input.history.slice(0,50).filter(h=>h&&subjects.some(s=>s.id===h.subject)&&typeof h.win==='boolean'&&Number.isFinite(Date.parse(h.date))).map(h=>({subject:h.subject,win:h.win,correct:Math.max(0,Math.min(1000,Number(h.correct)||0)),xp:Math.max(0,Math.min(1000,Number(h.xp)||0)),date:new Date(h.date).toISOString()}));
 return progress;
}

export function createAccountStore(file=defaultAccountsPath,{random=Math.random}={}){
 let database=null,loading=null,queue=Promise.resolve();
 async function write(data){
  await mkdir(dirname(file),{recursive:true});
  const temporary=`${file}.${randomUUID()}.tmp`;
  try{await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{mode:0o600});await rename(temporary,file);}
  finally{await unlink(temporary).catch(()=>{});}
 }
 async function load(){
  if(database)return database;
  if(!loading)loading=(async()=>{
   let raw;try{raw=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;const initial={version:1,users:[]};await write(initial);return initial;}
   const parsed=JSON.parse(raw);
   if(parsed.version!==1||!Array.isArray(parsed.users)||parsed.users.some(u=>!u.id||!u.username||typeof u.passwordHash!=='string'||!Number.isFinite(u.xp)||!u.preferences||!Array.isArray(u.history)))throw new Error('INVALID_ACCOUNT_FILE');
   return parsed;
  })().then(data=>database=data).catch(()=>{loading=null;throw new Error('ACCOUNT_STORAGE');});
  return loading;
 }
 function mutate(operation){
  const task=queue.then(async()=>{
   const next=structuredClone(await load());
   const result=await operation(next);
   try{await write(next);}catch{throw new Error('ACCOUNT_STORAGE');}
   database=next;return result;
  });
  queue=task.catch(()=>{});return task;
 }
 return {
  file,
  async register({username,password,legacyProgress}){
   const names=validateCredentials(username,password);
   const passwordHash=await hashPassword(password);
   return mutate(db=>{
    if(db.users.some(u=>u.usernameKey===names.usernameKey))throw new Error('USERNAME_TAKEN');
    const user={id:randomUUID(),...names,passwordHash,createdAt:new Date().toISOString(),...importLegacy(legacyProgress),preferences:{...defaultPreferences}};
    db.users.push(user);return publicAccount(user);
   });
  },
  async login({username,password}){
   const names=validateCredentials(username,password);
   const db=await load(),user=db.users.find(u=>u.usernameKey===names.usernameKey);
   if(!user||!await verifyPassword(password,user.passwordHash))throw new Error('LOGIN_FAILED');
   return publicAccount(user);
  },
  async get(id){await queue;const user=(await load()).users.find(u=>u.id===id);return user?publicAccount(user):null;},
  async rename(id,displayName){
   if(typeof displayName!=='string')throw new Error('INVALID_DISPLAY_NAME');
   const name=displayName.normalize('NFKC').trim();
   if(!name||name.length>32||/[\p{Cc}\p{Cf}<>]/u.test(name))throw new Error('INVALID_DISPLAY_NAME');
   return mutate(db=>{const user=db.users.find(u=>u.id===id);if(!user)throw new Error('LOGIN_REQUIRED');user.displayName=name;return publicAccount(user);});
  },
  async preferences(id,input){return mutate(db=>{const user=db.users.find(u=>u.id===id);if(!user)throw new Error('LOGIN_REQUIRED');Object.assign(user.preferences,sanitizePreferences(input));return publicAccount(user);});},
  async learning(id){await queue;const user=(await load()).users.find(u=>u.id===id);if(!user)throw Error('LOGIN_REQUIRED');return structuredClone({sessions:user.learningSessions||[],mistakes:user.mistakes||[]});},
  async saveLesson(id,lesson){return mutate(db=>{
   const user=db.users.find(u=>u.id===id);if(!user)throw Error('LOGIN_REQUIRED');
   user.learningSessions=[structuredClone(lesson),...(user.learningSessions||[]).filter(s=>s.id!==lesson.id)].slice(0,12);return structuredClone(lesson);
  });},
  async recordMistake(id,mistake){return mutate(db=>{
   const user=db.users.find(u=>u.id===id);if(!user)throw Error('LOGIN_REQUIRED');
   if((user.mistakes||[]).some(m=>m.id===mistake.id))return;
   user.mistakes=[structuredClone(mistake),...(user.mistakes||[])].slice(0,100);
  });},
  async settle(id,battle){return mutate(db=>{
   const user=db.users.find(u=>u.id===id);if(!user)throw new Error('LOGIN_REQUIRED');
   const existing=user.history.find(h=>h.battleId===battle.id);
   if(existing)return {user:publicAccount(user),result:existing.result};
   if(!['win','lose'].includes(battle.outcome))throw new Error('BATTLE_NOT_FINISHED');
   const win=battle.outcome==='win',oldLevel=levelFor(user.xp),xp=win?difficulties[battle.difficulty].reward*(battle.boss?2:1):Math.min(25,battle.correct*5);
   const beforeCards=cardInventory(user);
   if(win&&battle.boss&&battle.dungeonId)user.dungeonClears=(user.dungeonClears||0)+1;
   user.xp+=xp;user.correct+=battle.correct;user.battles++;user.bestCombo=Math.max(user.bestCombo,battle.bestCombo);
   if(win){user.wins++;if(!user.defeated.includes(battle.subject))user.defeated.push(battle.subject);}
   const reward=win?rewardCards(beforeCards,user,Boolean(battle.boss&&battle.dungeonId),random):{cards:beforeCards,rewards:[]};user.cards=reward.cards;
   const result={win,xp,oldLevel,cardRewards:reward.rewards,newMoves:availableMoves(levelFor(user.xp)).filter(m=>m.level>oldLevel).map(m=>m.id),...(battle.dungeonId?{dungeonId:battle.dungeonId,boss:Boolean(battle.boss)}:{}),correct:battle.correct,answered:battle.answered};
   user.history.unshift({battleId:battle.id,subject:battle.subject,win,correct:battle.correct,xp,date:new Date().toISOString(),result});user.history=user.history.slice(0,50);
   return {user:publicAccount(user),result};
  });},
 };
}

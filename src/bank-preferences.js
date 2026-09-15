export function reconcileBankPreferences(profile,banks){
 const bank=banks.find(b=>b.id===profile.questionBank);if(!bank)return;
 const coverage=bank.coverage||[];
 if(coverage.length&&!coverage.includes(`${profile.subject}:${profile.grade}`)){
  const next=coverage.find(c=>c===`math:${profile.grade}`)||coverage.find(c=>c.endsWith(`:${profile.grade}`))||coverage.find(c=>c.startsWith(`${profile.subject}:`))||coverage[0];
  const [subject,grade]=next.split(':');profile.subject=subject;profile.grade=Number(grade);
 }
 if(bank.types?.length&&((profile.questionType!=='mixed'&&!bank.types.includes(profile.questionType))||bank.types.length===1))profile.questionType=bank.types[0];
}

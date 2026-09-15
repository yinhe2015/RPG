export const languages=[
 {id:'zh-CN',name:'中文',instruction:'使用简体中文讲解；英语例句可保留英文。',quickReplies:['我还没跟上','请给我一点提示','请换一种解释']},
 {id:'en-US',name:'English',instruction:'Reply in English, using simple language appropriate to the student’s school stage. Keep quoted source questions in their original language when needed.',quickReplies:['I am not following yet','Could you give me a hint?','Please explain another way']},
 {id:'bilingual',name:'中英对照',instruction:'使用中英对照：每一小段先写简短中文，再给对应英文。仍然只问一个主要问题，避免重复追问。',quickReplies:['我还没跟上 / I am not following','给一点提示 / Give me a hint','换个例子 / Try another example']},
];
export const languageOf=id=>languages.find(l=>l.id===id)||languages[0];

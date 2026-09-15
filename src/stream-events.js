// Shared SSE reader: network chunks need not align with UTF-8 or event boundaries.
export async function* streamEvents(body){
 if(!body)throw Error('STREAM_INTERRUPTED');
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
 const parse=block=>{
  let event='message';const lines=[];
  for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))lines.push(line.slice(5).replace(/^ /,''));}
  return lines.length?{event,data:lines.join('\n')}:null;
 };
 try{
  while(true){
   const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
   buffer=buffer.replace(/\r\n/g,'\n');
   let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const event=parse(block);if(event)yield event;}
   if(done){if(buffer.trim()){const event=parse(buffer);if(event)yield event;}break;}
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

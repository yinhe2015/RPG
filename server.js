import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {createApiMiddleware,blockPrivateFiles} from './server/api.js';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const api=createApiMiddleware();
createServer((req,res)=>blockPrivateFiles(req,res,()=>api(req,res,async()=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+pathname);
    if(file!==resolve(root)&&!file.startsWith(resolve(root)+sep)){res.writeHead(404);res.end();return;}
    if(pathname==='/'||!(await stat(file).catch(()=>null))?.isFile())file=resolve(root,'index.html');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('先运行 npm run build');}
}))).listen(Number(process.env.PORT)||5173,process.env.HOST||'127.0.0.1',()=>console.log(`游戏已启动：http://${process.env.HOST||'127.0.0.1'}:${Number(process.env.PORT)||5173}`));

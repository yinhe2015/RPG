import {readFile,writeFile,mkdir,unlink,rename} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateCatalog} from '../src/themes/catalog.js';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');

// Generate an immediately usable theme; inherit behavior until its own art is ready.
export async function createTheme({id,name,root=projectRoot}){
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]*$/.test(id))throw Error('主题 id 只能使用小写字母、数字和连字符，且以字母开头。');
 if(typeof name!=='string'||!name.trim())throw Error('请提供主题名称。');
 const catalogPath=join(root,'src/themes/catalog.json');
 const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
 if(catalog.some(theme=>theme.id===id))throw Error(`主题 ${id} 已存在。`);
 const definition={id,version:2,extends:'paper',name:name.trim(),subtitle:'自定义 · 从纸上冒险开始',mark:'✦',accent:'#537a68'};
 const updated=[...catalog,definition];validateCatalog(updated);
 const directory=join(root,'src/themes/packs');await mkdir(directory,{recursive:true});
 const files=[
  [join(directory,`${id}.js`),`import './${id}.css';\n\n// Omitted hooks inherit from catalog.json's extends theme.\n// Override scene(model), dungeon.{hero,enemy,step}, motion.{actors,attack},\n// commands(model), or classes.question here. See docs/themes.md.\nexport default {};\n`],
  [join(directory,`${id}.css`),`/* Keep all custom rules inside this theme to avoid affecting other worlds. */\n:root[data-theme="${id}"] {\n  --maze-floor: #e4ecdf;\n  --maze-wall: #537a68;\n  --maze-line: #bdd0bb;\n  --maze-panel: #f8faf3;\n  --maze-text: #294336;\n}\n.preview-${id} { background: #e4ecdf; color: #537a68; }\n`],
 ];
 const created=[];const temporary=`${catalogPath}.${process.pid}.tmp`;
 try{
  for(const [path,content] of files){await writeFile(path,content,{flag:'wx'});created.push(path);}
  await writeFile(temporary,JSON.stringify(updated,null,2)+'\n',{flag:'wx'});created.push(temporary);
  await rename(temporary,catalogPath);
 }catch(error){await Promise.all(created.map(path=>unlink(path).catch(()=>{})));throw error;}
 return [...files.map(([path])=>path),catalogPath];
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [id,name]=process.argv.slice(2);
 try{
  const paths=await createTheme({id,name});
  console.log(`已创建主题 ${name}：\n${paths.join('\n')}\n运行 npm run build，并重启网页服务，即可在设置中选择。接入说明：docs/themes.md`);
 }catch(error){console.error(error.message+'\n用法：npm run theme:create -- forest "森林书院"');process.exitCode=1;}
}

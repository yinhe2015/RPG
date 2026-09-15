import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {themeCatalog,validateCatalog,hasTheme,themeDefinition} from '../src/themes/catalog.js';
import {createThemeRegistry} from '../src/themes/contract.js';
import {audioForTheme,audioSceneFor} from '../src/themes/audio-profiles.js';
import {createTheme} from '../scripts/create-theme.js';

const base=themeCatalog[0];
const adapter={scene:()=>'<scene/>',dungeon:{hero:()=>'<hero/>',enemy:()=>'<enemy/>',step:()=>{}},motion:{actors:['.hero','.enemy']},classes:{question:''}};
const forest={...base,id:'forest',name:'森林书院',extends:'paper'};

test('a fourth theme overrides individual hooks without changing shared gameplay',()=>{
 const enemy=()=>'<forest-enemy/>',attack=()=>Promise.resolve();
 const registry=createThemeRegistry([base,forest],{paper:adapter,forest:{dungeon:{enemy},motion:{attack}}});
 const theme=registry.getTheme('forest');
 assert.equal(theme.scene,adapter.scene);assert.equal(theme.dungeon.enemy,enemy);
 assert.equal(theme.dungeon.hero,adapter.dungeon.hero);assert.equal(theme.motion.attack,attack);
 assert.deepEqual(theme.motion.actors,adapter.motion.actors);
 assert.equal(registry.getTheme('paper').dungeon.enemy,adapter.dungeon.enemy);
 assert.equal(registry.getTheme('unknown').id,'paper');
});

test('invalid theme declarations and missing adapters fail early',()=>{
 assert.throws(()=>validateCatalog([base,base]),/duplicate/);
 assert.throws(()=>validateCatalog([base,{...forest,extends:'absent'}]),/inheritance/);
 assert.throws(()=>validateCatalog([{...base,extends:'forest'},forest]),/inheritance/);
 assert.throws(()=>createThemeRegistry([base,forest],{paper:adapter}),/missing packs\/forest/);
 assert.throws(()=>createThemeRegistry([base],{paper:{...adapter,motion:{actors:['.hero']}}}),/selectors/);
 assert.throws(()=>createThemeRegistry([base],{paper:{...adapter,dungeon:{...adapter.dungeon,step:null}}}),/dungeon.step/);
});

test('account theme validation and scene music consume the same catalog',()=>{
 for(const theme of themeCatalog){
  assert.ok(hasTheme(theme.id));assert.equal(themeDefinition(theme.id),theme);
  const audio=audioForTheme(theme.id);
  for(const scene of ['home','dungeon','battle','boss','victory','bossVictory','defeat'])assert.ok(audioSceneFor(audio,scene));
 }
 assert.equal(hasTheme('removed-theme'),false);assert.equal(themeDefinition('removed-theme').id,'paper');
 assert.equal(audioSceneFor(audioForTheme('paper'),'boss'),'battle');
 assert.equal(audioSceneFor(audioForTheme('pal'),'boss'),'boss');
});

test('new themes can replace music and effects while inheriting other scene audio',()=>{
 const definitions=[base,{...forest,audio:{music:{home:{src:'/themes/forest/home.mp3',loop:true}},effects:{magic:{src:'/themes/forest/magic.wav'}}}}];
 const lookup=id=>definitions.find(t=>t.id===id);
 const audio=audioForTheme('forest',lookup);
 assert.equal(audio.music.home.src,'/themes/forest/home.mp3');
 assert.equal(audio.effects.magic.src,'/themes/forest/magic.wav');
 assert.equal(audio.tracks.battle,audioForTheme('paper').tracks.battle);
 assert.equal(audioForTheme('paper').music.home,undefined);
 assert.throws(()=>audioForTheme('broken',()=>({...forest,audio:{preset:'missing'}})),/unknown audio preset/);
});

test('scaffold creates a usable fourth catalog entry and refuses to overwrite files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'quest-theme-scaffold-'));
 try{
  await mkdir(join(root,'src/themes'),{recursive:true});
  const path=join(root,'src/themes/catalog.json');
  await writeFile(path,JSON.stringify(themeCatalog));
  await createTheme({id:'forest',name:'森林书院',root});
  const catalog=JSON.parse(await readFile(path,'utf8'));
  const adapters={paper:adapter,pal:{},voxel:{},forest:{}};
  assert.equal(createThemeRegistry(catalog,adapters).getTheme('forest').scene,adapter.scene);
  assert.match(await readFile(join(root,'src/themes/packs/forest.js'),'utf8'),/export default \{\}/);
  assert.match(await readFile(join(root,'src/themes/packs/forest.css'),'utf8'),/data-theme="forest"/);
  const before=await readFile(path,'utf8');
  await assert.rejects(createTheme({id:'forest',name:'重复',root}),/已存在/);
  await assert.rejects(createTheme({id:'../escape',name:'错误',root}),/主题 id/);
  await writeFile(join(root,'src/themes/packs/reserved.css'),'existing');
  await assert.rejects(createTheme({id:'reserved',name:'已占用',root}),/EEXIST/);
  assert.equal(await readFile(path,'utf8'),before);
  assert.equal(await readFile(join(root,'src/themes/packs/reserved.css'),'utf8'),'existing');
  await assert.rejects(readFile(join(root,'src/themes/packs/reserved.js')),/ENOENT/);
 }finally{await rm(root,{recursive:true,force:true});}
});

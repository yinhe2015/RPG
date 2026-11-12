import {DEFAULT_THEME_ID,validateCatalog} from './catalog.js';

// Pure factory: no browser, CSS, account state, or audio side effects.
export function createThemeRegistry(catalog,adapters){
 validateCatalog(catalog);const resolved=new Map();
 function resolve(id){
  if(resolved.has(id))return resolved.get(id);
  const definition=catalog.find(t=>t.id===id),adapter=adapters[id];
  if(!adapter)throw Error(`Theme ${id}: missing packs/${id}.js`);
  const base=definition.extends?resolve(definition.extends):{};
  const theme={...base,...adapter,...definition,dungeon:{...base.dungeon,...adapter.dungeon},motion:{...base.motion,...adapter.motion},classes:{...base.classes,...adapter.classes}};
  if(typeof theme.scene!=='function')throw Error(`Theme ${id}: scene(model) is required`);
  for(const hook of ['hero','enemy','step'])if(typeof theme.dungeon[hook]!=='function')throw Error(`Theme ${id}: dungeon.${hook} is required`);
  if(!Array.isArray(theme.motion.actors)||theme.motion.actors.length!==2||theme.motion.actors.some(s=>typeof s!=='string'||!s.trim()))throw Error(`Theme ${id}: motion.actors needs player and enemy selectors`);
  if(theme.commands!=null&&typeof theme.commands!=='function')throw Error(`Theme ${id}: commands must be a function`);
  if(theme.motion.attack!=null&&typeof theme.motion.attack!=='function')throw Error(`Theme ${id}: motion.attack must be a function`);
  resolved.set(id,theme);return theme;
 }
 const themes=catalog.map(t=>resolve(t.id));
 return {themes,getTheme:id=>resolved.get(id)||resolved.get(DEFAULT_THEME_ID)};
}

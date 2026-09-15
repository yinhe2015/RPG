import entries from './catalog.json' with {type:'json'};

export const DEFAULT_THEME_ID='paper';
export function validateCatalog(values){
 const ids=new Set();
 for(const t of values){
  if(!/^[a-z][a-z0-9-]*$/.test(t.id)||ids.has(t.id)||t.version!==2)throw Error(`Invalid or duplicate theme: ${t.id}`);
  for(const key of ['name','subtitle','mark'])if(typeof t[key]!=='string'||!t[key].trim())throw Error(`Theme ${t.id}: missing ${key}`);
  if(!/^#[a-f0-9]{6}$/i.test(t.accent))throw Error(`Theme ${t.id}: invalid accent`);
  ids.add(t.id);
 }
 if(!ids.has(DEFAULT_THEME_ID))throw Error('Missing default theme');
 for(const t of values){
  const seen=new Set([t.id]);let base=t.extends;
  while(base){if(!ids.has(base)||seen.has(base))throw Error(`Invalid theme inheritance: ${t.id}`);seen.add(base);base=values.find(v=>v.id===base).extends;}
 }
 return values;
}
export const themeCatalog=validateCatalog(entries);
export const hasTheme=id=>themeCatalog.some(t=>t.id===id);
export const themeDefinition=id=>themeCatalog.find(t=>t.id===id)||themeCatalog.find(t=>t.id===DEFAULT_THEME_ID);

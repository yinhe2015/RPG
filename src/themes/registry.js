import {themeCatalog} from './catalog.js';
import {createThemeRegistry} from './contract.js';
import './themes.css';
import './arena.css';

// Vite includes each local theme adapter and its CSS. Only catalog entries are enabled.
const modules=import.meta.glob('./packs/*.js',{eager:true});
const adapters=Object.fromEntries(Object.entries(modules).map(([path,module])=>[path.split('/').at(-1).slice(0,-3),module.default]));
export const {themes,getTheme}=createThemeRegistry(themeCatalog,adapters);
export function applyTheme(profile){
 const theme=getTheme(profile.theme),root=document.documentElement;
 root.dataset.theme=theme.id;
 root.dataset.motion=profile.reducedMotion?'reduced':'full';
 const accent=/^#[a-f0-9]{6}$/i.test(profile.themeAccent)?profile.themeAccent:theme.accent;
 root.style.setProperty('--theme-accent',accent);
 root.style.setProperty('--green',accent);
}

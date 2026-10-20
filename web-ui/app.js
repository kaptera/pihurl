import {API, rawFetch, rememberProject, signIn} from './js/api.js';
import {closeChatMenu, connectStream, initChat, renderSugg, setBusy, updateHint, actions as chatActions} from './js/chat.js';
import {$, S, tokens} from './js/core.js';
import {computeCov} from './js/hurl.js';
import {NAV, go, refreshProvChips, renderChrome, updateBadges, actions as navActions} from './js/nav.js';
import {renderProjButtons, actions as projectActions} from './js/projects.js';
import {loadPrompts, updCtx, actions as promptActions} from './js/prompts.js';
import {PRESETS, normProv, renderProviders, actions as providerActions} from './js/providers.js';
import {loadFile, pickSpec, refreshSpecs, renderEps, renderSpec, useSpecHost, actions as specActions} from './js/spec.js';
import {actions as settingsActions} from './js/settings.js';
import {isMobile, renderMain, renderTHead, renderTests, actions as testActions} from './js/tests.js';

// What the data-act buttons do, by name; each module owns the actions of its own view.
const A={...navActions,...chatActions,...projectActions,...specActions,...providerActions,...promptActions,...settingsActions,...testActions};

// Escape closes the open menus
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeChatMenu();$('#projMenu').hidden=true}});
document.addEventListener('click',e=>{
 if(!e.target.closest('#chatMenu,#chatsBtn'))closeChatMenu();
 if(!e.target.closest('#projMenu,#projBtn,#tbProj'))$('#projMenu').hidden=true;
 const t=e.target.closest('[data-act]');if(!t)return;
 const fn=A[t.dataset.act];if(fn)fn(t,e);
});
document.addEventListener('input',e=>{
 const id=e.target.id;
 if(id==='hostInp')S.host=e.target.value.trim();
 if(id==='epq'){S.q=e.target.value;renderEps()}
 if(id==='tpl-body'){$('#tpl-tok').textContent='~'+tokens(e.target.value)+' tokens'}
 if(id==='instr'){updCtx()}
});
document.addEventListener('change',e=>{
 if(e.target.id==='specSel'){pickSpec(e.target.value);useSpecHost();refreshProvChips();renderSpec()}
 if(e.target.id==='hostInp'){
  const v=e.target.value.trim();S.host=v;
  // The agent runs hurl against the same target: the backend mirrors it to hurl.env.
  if(/^https?:\/\/\S+$/i.test(v))API('/api/hosts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',baseUrl:v})}).catch(()=>{});
 }
 if(e.target.id==='runSelect'){S.runId=+e.target.value;renderMain();renderTHead();updateBadges()}
 if(e.target.id==='file'&&e.target.files[0]){loadFile(e.target.files[0]);e.target.value=''}
});
const drop=$('#drop');
['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f)});
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
matchMedia('(max-width:860px)').addEventListener('change',()=>{if(S.view==='tests'){if(!isMobile()&&S.tview==='files')S.tview='report';renderTests()}});

async function loadState(){
 try{
  const prov=await API('/api/providers');const provs=(prov.providers||[]).map(normProv);S.providers=provs;if(!S.active)S.active=provs.find(p=>p.active)?.id||null;if(provs.length)S.editId=(provs.find(p=>p.active)||provs[0]).id;
  // Inside Docker "localhost" is the container, so the backend knows the right Ollama URL.
  if(prov.defaults&&prov.defaults.ollamaUrl)PRESETS.ollama.url=prov.defaults.ollamaUrl;
  await refreshSpecs();
  const tests=await API('/api/tests');S.files=tests.files.map(f=>({...f}));
  const run=await API('/api/run');S.runs=run.history||[];S.runId=S.runs[0]?S.runs[0].id:null;
  const hosts=await API('/api/hosts');S.hosts=(hosts.hosts||[]).map(h=>({...h}));S.host=S.hosts[0]?.baseUrl||(/^https?:\/\//i.test(S.spec.server)?S.spec.server:'');
 }catch(e){console.error('loadState failed',e)}
 // Data lands AFTER the initial paint: refresh the views that read it, so the
 // providers list isn't stuck at "No providers yet" until a tab switch.
 refreshProvChips();if(S.view==='providers')renderProviders();
 computeCov();
 if(S.view==='spec')renderSpec();if(S.view==='tests')renderTests();
}

async function start(){
 let s={auth:false,authed:true};
 try{s=await rawFetch('/api/session').then(r=>r.json())}catch(e){}
 S.authOn=!!s.auth;
 if(s.auth&&!s.authed)await signIn();
 // which projects exist (without the project header: ours may be stale)
 try{S.projects=(await rawFetch('/api/projects').then(r=>r.json())).projects||[]}catch(e){}
 if(S.projects.length&&!S.projects.some(p=>p.id===S.proj))rememberProject('default');
 boot();
}
function boot(){
 loadState();
 loadPrompts();
 renderChrome();renderProjButtons();renderSugg();setBusy();updateBadges();updateHint();
 // Open the SSE stream up front so the agent's very first (seeded) turn
 // renders live instead of arriving all at once.
 connectStream();
 initChat();
 const h=(location.hash||'').slice(1);
 go(NAV.some(n=>n[0]===h)?h:'chat');
}
start();

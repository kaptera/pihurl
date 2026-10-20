import {rawFetch, rememberProject} from './api.js';
import {$, I, S, esc, toast} from './core.js';

/* ---------- projects ---------- */
// A project is one API under test with its own specs, tests, reports, chats and target host.
// Providers are shared. Switching reloads the page: every view then starts clean on the project.
const projName=()=>{const p=S.projects.find(x=>x.id===S.proj);return p?p.name:S.proj};
export function renderProjButtons(){
 $('#projBtn').innerHTML=`<span class="pn"><small>Project</small>${esc(projName())}</span>${I('chev')}`;
 $('#tbProj').textContent=projName();
}
function renderProjMenu(){
 const m=$('#projMenu');
 m.innerHTML=`<button class="btn sm cm-new" data-act="projNew">${I('plus')}New project</button>`+S.projects.map(p=>`<div class="cm-row ${p.id===S.proj?'cur':''}"><button class="cm-main" data-act="projSwitch" data-id="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.id)}</small></button><button class="cm-ic" data-act="projRename" data-id="${esc(p.id)}" aria-label="Rename">${I('write')}</button>${p.id==='default'?'':`<button class="cm-ic del" data-act="projDelete" data-id="${esc(p.id)}" aria-label="Delete">${I('trash')}</button>`}</div>`).join('');
}
function openProjMenu(anchor){
 const m=$('#projMenu');
 if(!m.hidden&&m.dataset.anchor===anchor.id){m.hidden=true;return}
 renderProjMenu();m.dataset.anchor=anchor.id;m.hidden=false;
 const r=anchor.getBoundingClientRect(),w=m.offsetWidth;
 m.style.left=Math.max(10,Math.min(r.left,innerWidth-w-10))+'px';m.style.top=(r.bottom+6)+'px';
}
const projApi=body=>rawFetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json','X-Pihurl-Project':'default'},body:JSON.stringify(body)}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||j.error||r.statusText);return j});
function switchProject(id){rememberProject(id);location.reload()}

export const actions={
 projMenu:t=>openProjMenu(t),
 projSwitch:t=>{if(t.dataset.id!==S.proj)switchProject(t.dataset.id);else $('#projMenu').hidden=true},
 projNew:async()=>{
  const name=prompt('Name of the new project (one API under test)');if(!name||!name.trim())return;
  try{const r=await projApi({action:'create',name});switchProject(r.created)}catch(e){toast(e.message,true)}
 },
 projRename:async t=>{
  const p=S.projects.find(x=>x.id===t.dataset.id);const name=prompt('Rename project',p?p.name:'');if(!name||!name.trim())return;
  try{const r=await projApi({action:'rename',id:t.dataset.id,name});S.projects=r.projects;renderProjButtons();renderProjMenu()}catch(e){toast(e.message,true)}
 },
 projDelete:async t=>{
  const p=S.projects.find(x=>x.id===t.dataset.id);
  if(!confirm('Delete project "'+(p?p.name:t.dataset.id)+'" with all its specs, tests, reports and chats? This cannot be undone.'))return;
  try{const r=await projApi({action:'delete',id:t.dataset.id});S.projects=r.projects;if(t.dataset.id===S.proj)switchProject('default');else{renderProjButtons();renderProjMenu()}}catch(e){toast(e.message,true)}
 }
};

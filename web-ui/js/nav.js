import {$, $$, I, S, esc} from './core.js';
import {computeCov} from './hurl.js';
import {renderPrompts} from './prompts.js';
import {renderProviders} from './providers.js';
import {renderSettings} from './settings.js';
import {refreshSpecs, renderSpec} from './spec.js';
import {refreshTests, renderTests, stats} from './tests.js';

/* ---------- navigation ---------- */
export const NAV=[['chat','Chat','Chat'],['spec','Spec','Spec'],['providers','Providers','Providers'],['prompts','Prompts','Prompts'],['tests','Tests & Reports','Tests'],['settings','Settings','Settings']];
export function go(v){
 S.view=v;
 $$('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
 $$('#nav button,#tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 try{history.replaceState(null,'','#'+v)}catch(e){}
 if(v==='spec'){renderSpec();refreshTests();refreshSpecs()}if(v==='tests'){renderTests();refreshTests()}if(v==='providers')renderProviders();if(v==='prompts')renderPrompts();if(v==='settings')renderSettings();
 if(v==='chat')setTimeout(()=>{$('#msgs').scrollTop=1e9},20);
}
export function updateBadges(){
 const r=S.runs.find(x=>x.id===S.runId)||S.runs[0];const bad=r?stats(r).fail:0;
 $$('.nb').forEach(n=>n.remove());
 if(bad){$$('[data-v="tests"]').forEach(b=>{if(b.closest('#nav,#tabbar'))b.insertAdjacentHTML('beforeend',`<span class="nb">${bad}</span>`)})}
}
export function renderChrome(){
 $('#nav').innerHTML=NAV.map(([v,l])=>`<button data-act="go" data-v="${v}">${I(v)}<span>${l}</span></button>`).join('');
 $('#tabbar').innerHTML=NAV.map(([v,,s])=>`<button data-act="go" data-v="${v}">${I(v)}<span>${s}</span></button>`).join('');
 $$('[data-i]').forEach(e=>e.innerHTML=I(e.dataset.i));
 $('#sendBtn').innerHTML=I('send');$('#upIc').innerHTML=I('upload');$('#seIc').innerHTML=I('search');$('#genIc').innerHTML=I('spark');
 refreshProvChips();
}
export function refreshProvChips(){
 const p=S.providers.find(x=>x.id===S.active);
 const t=p?`<span class="dot ok"></span><span class="mono">${esc(p.model)}</span>`:'<span class="dot off"></span><span>no provider</span>';
 $('#sfProv').innerHTML=p?`<span class="dot ok"></span>${esc(p.name)} · ${esc(p.model)}`:'<span class="dot off"></span>not connected';
 $('#sfSpec').innerHTML=S.spec.endpoints.length?`<span class="dot ok"></span>${esc(S.spec.title)} ${esc(S.spec.version)}`:'<span class="dot off"></span>no spec loaded';
 $('#modelChip').innerHTML=t;$('#tbProv').innerHTML=t;
 computeCov();const cov=[...S.cov.values()].filter(x=>x>0).length;
 $('#ctx').innerHTML=`<span class="chip">${I('spec')} ${esc(S.spec.name)}</span><span class="chip">${I('tests')} ${S.files.length} files</span><span class="chip">${cov}/${S.spec.endpoints.length} endpoints covered</span>`;
}

export const actions={
 go:t=>go(t.dataset.v)
};

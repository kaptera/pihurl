import {API} from './api.js';
import {askChat, send} from './chat.js';
import {$, $$, I, S, esc, toast, tokens} from './core.js';
import {computeCov} from './hurl.js';
import {go} from './nav.js';
import {curRun} from './tests.js';

/* ---------- project instructions as last saved on the server (the Reset target) ---------- */
let INSTR='';

// Failed entries of a run as plain text for the agent: file, request, status and
// the failing assertions with Hurl's explanation.
function failuresText(run){
 if(!run)return 'There is no test run yet.';
 const out=[];
 for(const f of run.files.filter(x=>x.status==='fail')){
  out.push('## '+f.path);
  if(!f.entries.length&&f.fail)out.push(f.fail.detail);
  for(const e of f.entries.filter(x=>!x.ok&&!x.skipped)){
   out.push(`${e.method} ${e.url} -> ${e.status??'no response'}`);
   for(const a of e.asserts.filter(x=>!x.ok))out.push(`  failed: ${a.text}${a.detail?'\n'+a.detail.slice(0,600):''}`);
  }
 }
 return out.length?out.join('\n'):'No failures in the latest run.';
}
export function fillTpl(body){
 computeCov();const u=S.spec.endpoints.find(e=>!S.cov.get(e.m+' '+e.p))||S.spec.endpoints[0];
 return body.replace(/\{\{endpoint\}\}/g,u?u.m+' '+u.p:'the API').replace(/\{\{spec\.title\}\}/g,S.spec.title||'the spec').replace(/\{\{spec\.path\}\}/g,S.spec.path||'the spec')
  .replace(/\{\{base_url\}\}/g,S.host).replace(/\{\{existing_tests\}\}/g,S.files.map(f=>f.path).join(', ')||'none yet')
  .replace(/\{\{last_report\}\}/g,failuresText(curRun()));
}

/* ---------- PROMPTS ---------- */
export function renderPrompts(){
 $$('#ptabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.ptab));
 if(S.ptab==='templates'){
  if(!S.templates.length){$('#promptBody').innerHTML='<div class="empty-s">No templates yet.</div>';return}
  const t=S.templates.find(x=>x.id===S.tpl)||S.templates[0];S.tpl=t.id;
  $('#promptBody').innerHTML=`<div class="g4"><div><button class="btn sm" style="width:100%;margin-bottom:10px" data-act="newTpl">${I('plus')}New template</button>${S.templates.map(x=>`<button class="tpl ${x.id===t.id?'sel':''}" data-act="tpl" data-id="${x.id}"><b>${esc(x.name)} ${x.builtin?'<span class="pill">core</span>':''}</b><small>${esc(x.desc||'Custom template')}</small></button>`).join('')}</div>
  <div class="card cp"><div class="field"><label class="lbl" for="tpl-name">Template name</label><input class="inp" id="tpl-name" value="${esc(t.name)}"></div>
  <div class="field"><label class="lbl" for="tpl-body">Prompt</label><textarea class="inp mono" id="tpl-body" rows="14">${esc(t.body)}</textarea><div class="row" style="justify-content:space-between;margin-top:6px"><span class="tok" id="tpl-tok">~${tokens(t.body)} tokens</span></div></div>
  <div class="field"><label class="lbl">Insert variable</label><div class="vars">${['{{endpoint}}','{{spec.path}}','{{spec.title}}','{{base_url}}','{{existing_tests}}','{{last_report}}'].map(v=>`<button data-act="insVar" data-v="${v}">${v}</button>`).join('')}</div></div>
  <div class="row wrap"><button class="btn primary" data-act="saveTpl">${I('check')}Save</button><button class="btn" data-act="useTpl">${I('chat')}Use in chat</button><span class="spacer"></span>${t.builtin?'':`<button class="btn danger" data-act="delTpl">${I('trash')}Delete</button>`}</div></div></div>`;
 }else{
  $('#promptBody').innerHTML=`<div class="g4 wide"><div class="card cp"><div class="row" style="margin-bottom:12px"><div class="min" style="flex:1"><h3 style="font-size:15px">AGENTS.md</h3><div class="muted" style="font-size:12.5px">Standing instructions. Saved at the project root and read by the agent at the start of every run.</div></div></div>
  <textarea class="inp mono" id="instr" rows="22" spellcheck="false">${esc(S.instr)}</textarea>
  <div class="row wrap" style="margin-top:12px"><button class="btn primary" data-act="saveInstr">${I('check')}Save</button><button class="btn" data-act="resetInstr">Reset</button><span class="spacer"></span><span class="tok" id="instr-tok"></span></div></div>
  <div><div class="card cp"><div class="row"><div class="min" style="flex:1"><h3>Attach to every run</h3><div class="muted" style="font-size:12px;margin-top:2px">Prepend instructions to the system prompt.</div></div><button class="sw ${S.instrOn?'on':''}" data-act="instrToggle" aria-label="Toggle"></button></div></div>
  <div class="card cp" style="margin-top:14px"><h3 style="margin-bottom:12px">Always-on context</h3><div id="ctxPrev"></div></div></div></div>`;
  updCtx();
}
}
export function updCtx(){
 const t0=S.templates[0];const sys=t0?tokens(t0.body):0,ins=S.instrOn?tokens($('#instr')?$('#instr').value:S.instr):0,spec=60+S.spec.endpoints.length*28,idx=S.files.length*18;
 const tot=sys+ins+spec+idx,budget=8000;
 const seg=[['System prompt',sys,'var(--acc)'],['Project instructions',ins,'var(--vio)'],['Spec summary',spec,'var(--blue)'],['Test index',idx,'var(--pink)']];
 const el=$('#ctxPrev');if(el)el.innerHTML=`<div class="stack">${seg.map(s=>`<i style="width:${s[1]/budget*100}%;background:${s[2]}"></i>`).join('')}</div><div class="lg">${seg.map(s=>`<div><i style="background:${s[2]}"></i><span>${s[0]}</span><span>~${s[1]}</span></div>`).join('')}<div style="border-top:1px solid var(--line);padding-top:7px;margin-top:2px"><span>Total</span><span style="color:var(--tx)">~${tot} / ${budget/1000}k</span></div></div>`;
 const it=$('#instr-tok');if(it)it.textContent='~'+tokens($('#instr').value)+' tokens · '+$('#instr').value.split('\n').length+' lines';
}

export async function loadPrompts(){
 try{
  const res=await API('/api/prompts');
  S.templates=(res.templates||[]).map(t=>({...t,builtin:!!t.builtin}));
  INSTR=S.instr=res.instructions||'';
 }catch(e){console.error('loadPrompts failed',e)}
}

export const actions={
 ptab:t=>{S.ptab=t.dataset.v;renderPrompts()},
 tpl:t=>{S.tpl=t.dataset.id;renderPrompts()},
 newTpl:()=>{const t={id:'t'+Date.now(),name:'Untitled template',desc:'Custom template',body:''};S.templates.push(t);S.tpl=t.id;renderPrompts();$('#tpl-name').select()},
 insVar:t=>{const a=$('#tpl-body'),s=a.selectionStart,e=a.selectionEnd;a.setRangeText(t.dataset.v,s,e,'end');a.focus();a.dispatchEvent(new Event('input'))},
 saveTpl:async()=>{const t=S.templates.find(x=>x.id===S.tpl);if(!t)return;t.name=$('#tpl-name').value||'Untitled';t.body=$('#tpl-body').value;
  try{await API('/api/prompts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templates:S.templates})});renderPrompts();toast('Template saved')}catch(e){toast('Could not save template: '+(e.message||String(e)),true)}},
 delTpl:async()=>{S.templates=S.templates.filter(x=>x.id!==S.tpl);if(S.templates[0])S.tpl=S.templates[0].id;
  try{await API('/api/prompts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templates:S.templates})});renderPrompts();toast('Template deleted')}catch(e){toast('Could not delete template: '+(e.message||String(e)),true)}},
 useTpl:()=>askChat(fillTpl($('#tpl-body').value)),
 sendFail:()=>{const t=(S.templates.find(x=>x.id==='fix-failures')||{}).body||'These tests failed in the latest run:\n\n{{last_report}}\n\nFix them.';go('chat');send(fillTpl(t))},
 saveInstr:async()=>{S.instr=$('#instr').value;
  try{await API('/api/prompts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instructions:S.instr})});toast('Saved AGENTS.md')}catch(e){toast('Could not save AGENTS.md: '+(e.message||String(e)),true)}},
 resetInstr:()=>{S.instr=INSTR;renderPrompts();toast('Reset to default')},
 instrToggle:()=>{S.instrOn=!S.instrOn;S.instr=$('#instr')?$('#instr').value:S.instr;renderPrompts()}
};

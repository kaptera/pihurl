import {API} from './api.js';
import {$, $$, I, S, esc, toast} from './core.js';
import {go, refreshProvChips} from './nav.js';

export const PRESETS={
 anthropic:{name:'Anthropic',url:'https://api.anthropic.com',models:['claude-sonnet-4-5','claude-opus-4-1','claude-haiku-4-5']},
 openai:{name:'OpenAI',url:'https://api.openai.com/v1',models:['gpt-4.1','gpt-4.1-mini','o4-mini']},
 openrouter:{name:'OpenRouter',url:'https://openrouter.ai/api/v1',models:['anthropic/claude-sonnet-4.5','deepseek/deepseek-chat-v3','google/gemini-2.5-pro']},
 ollama:{name:'Ollama (local)',url:'http://localhost:11434/v1',models:['qwen2.5-coder:14b','llama3.1:8b','mistral-nemo'],nokey:true},
 custom:{name:'Custom',url:'',models:[]}
};

/* ---------- PROVIDERS ---------- */
const isActive=p=>p.id===S.active;
export function renderProviders(){
 $('#provList').innerHTML=S.providers.map(p=>{let host=p.url;try{host=new URL(p.url).host}catch(e){}
  return `<button class="prov ${S.editId===p.id?'sel':''}" data-act="editProv" data-id="${p.id}"><div class="pv-ic">${esc(p.name[0]||'?')}</div><div class="pv-t"><b>${esc(p.name)} ${isActive(p)?'<span class="badge">active</span>':''}</b><small>${esc(host)} · ${esc(p.model)}</small></div><span class="dot ${p.status==='ok'?'ok':p.status==='bad'?'bad':'off'}"></span></button>`}).join('')||'<div class="note">No providers yet. Add one to start chatting.</div>';
 const p=S.editId==='new'?{id:'new',kind:'custom',name:'',url:'',key:'',model:'',temp:null,ctx:null}:S.providers.find(x=>x.id===S.editId);
 if(!p){$('#provForm').innerHTML='<div class="empty-s">Select or add a provider.</div>';return}
 const pr=PRESETS[p.kind]||PRESETS.custom;
 $('#provForm').innerHTML=`<div class="row" style="margin-bottom:14px"><h3 style="font-size:15px;flex:1">${p.id==='new'?'New provider':'Edit '+esc(p.name)}</h3>${p.id!=='new'&&!isActive(p)?'<button class="btn sm" data-act="activate">Make active</button>':''}</div>
 <div class="field"><label class="lbl">Preset</label><div class="row wrap">${Object.entries(PRESETS).map(([k,v])=>`<button class="chip ${p.kind===k?'on':''}" data-act="preset" data-k="${k}">${v.name.replace(' (local)','')}</button>`).join('')}</div></div>
 <div class="field"><label class="lbl" for="pf-name">Name</label><input class="inp" id="pf-name" value="${esc(p.name)}" placeholder="My provider"></div>
 <div class="field"><label class="lbl" for="pf-url">Base URL</label><input class="inp mono" id="pf-url" value="${esc(p.url)}" placeholder="https://api.example.com/v1" inputmode="url" autocapitalize="off" spellcheck="false"></div>
 <div class="field"><label class="lbl" for="pf-key">API key ${pr.nokey?'<span class="dim" style="text-transform:none;letter-spacing:0;font-weight:400">· optional for local models</span>':''}</label><div class="keywrap"><input class="inp mono" id="pf-key" type="password" value="" placeholder="${p.key?esc(p.key)+'  (saved)':'sk-…'}" autocomplete="off" style="padding-right:42px"><button type="button" data-act="eye" aria-label="Show key" id="eyeBtn">${I('read')}</button></div></div>
 <div class="field"><label class="lbl" for="pf-model">Model</label><input class="inp mono" id="pf-model" list="models" value="${esc(p.model)}" placeholder="model-id" autocapitalize="off" spellcheck="false"><datalist id="models">${pr.models.map(m=>`<option value="${esc(m)}">`).join('')}</datalist></div>
 <div class="field"><label class="lbl" for="pf-temp">Temperature <span class="mono" id="tv" style="text-transform:none;color:var(--tx)">${p.temp==null?'model default':p.temp}</span></label><div class="row"><input type="range" id="pf-temp" min="0" max="1" step=".05" value="${p.temp==null?.2:p.temp}" ${p.temp==null?'disabled':''} style="flex:1"><label class="chk"><input type="checkbox" id="pf-tdef" ${p.temp==null?'checked':''}> model default</label></div>${p.kind==='anthropic'?'<div class="dim" style="font-size:12px;margin-top:4px">Not used for Anthropic models.</div>':''}</div>
 <div class="field"><label class="lbl" for="pf-ctx">Context window <span class="dim" style="text-transform:none;letter-spacing:0;font-weight:400">· tokens, optional</span></label><input class="inp mono" id="pf-ctx" type="number" min="1024" step="1024" value="${p.ctx||''}" placeholder="pi's default"><div class="dim" style="font-size:12px;margin-top:4px">Tells the agent how much the model can read, so it summarizes old turns in time. It does not change the server: for Ollama set the same value with <code>OLLAMA_CONTEXT_LENGTH</code> or <code>num_ctx</code> in a Modelfile, or it cuts the prompt at its own default.</div></div>
 <div class="row wrap"><button class="btn" data-act="testProv">${I('bash')}Test connection</button><button class="btn primary" data-act="saveProv">${I('check')}Save</button><span class="spacer"></span>${p.id!=='new'?'<button class="btn danger" data-act="delProv">'+I('trash')+'Remove</button>':''}</div>
 <div class="test-res" id="pf-test"></div>
 <div class="note" style="margin-top:16px">${I('lock')}<span>Keys are stored on this server (in <code>providers.json</code> and the agent's <code>models.json</code>, both in the volume) and are never sent back to the browser after saving.</span></div>`;
 $('#pf-temp').addEventListener('input',e=>$('#tv').textContent=e.target.value);
 $('#pf-tdef').addEventListener('change',e=>{$('#pf-temp').disabled=e.target.checked;$('#tv').textContent=e.target.checked?'model default':$('#pf-temp').value});
}
function formVals(){return{name:$('#pf-name').value.trim(),url:$('#pf-url').value.trim(),key:$('#pf-key').value.trim(),model:$('#pf-model').value.trim(),temp:$('#pf-tdef').checked?null:+$('#pf-temp').value,ctx:$('#pf-ctx').value?+$('#pf-ctx').value:null}}
// Backend stores providers as {baseUrl,apiKey,temperature}; the UI model uses
// {url,key,temp}. Normalize backend responses into the UI shape so the list and
// editor always read url/key/temp even though the API returns baseUrl/apiKey.
export function normProv(p){return{id:p.id,kind:p.kind,name:p.name,url:p.baseUrl||'',key:p.apiKey||'',model:p.model,temp:p.temperature??null,ctx:p.contextWindow||null,active:!!p.active}}
async function testProv(){
 const v=formVals(),r=$('#pf-test');
 r.className='test-res run';r.innerHTML='<i class="spin"></i><span>Connecting to '+esc(v.url||'…')+'</span>';
 try{
  const res=await API('/api/providers/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:(S._draft&&S._draft.kind)||(S.providers.find(x=>x.id===S.editId)||{}).kind||'custom',baseUrl:v.url,id:S.editId==='new'?undefined:S.editId,apiKey:v.key})});
  if(res.ok){r.className='test-res ok';r.innerHTML=I('check')+`<span>Connected · ${res.ms} ms · ${res.models} model(s) reachable</span>`}
  else{r.className='test-res bad';r.innerHTML=I('x')+'<span>Connection failed: '+esc(res.error||'unknown')+'</span>'}
 }catch(e){r.className='test-res bad';r.innerHTML=I('x')+'<span>Error: '+esc(e.message||String(e))+'</span>'}
}

function renderDraft(d){ // preset click while creating a new provider
 const keep=$('#pf-key').value;S.editId='new';
 const pr=PRESETS[d.kind];
 renderProviders();
 $('#pf-name').value=d.name;$('#pf-url').value=d.url;$('#pf-model').value=d.model;$('#pf-key').value=keep;
 $('#pf-tdef').checked=d.temp==null;$('#pf-temp').disabled=d.temp==null;$('#pf-temp').value=d.temp==null?.2:d.temp;$('#tv').textContent=d.temp==null?'model default':d.temp;$('#pf-ctx').value=d.ctx||'';
 $$('#provForm [data-act=preset]').forEach(b=>b.classList.toggle('on',b.dataset.k===d.kind));
 $('#models').innerHTML=pr.models.map(m=>`<option value="${esc(m)}">`).join('');
}

export const actions={
 editProv:t=>{S.editId=t.dataset.id;renderProviders()},
 newProv:()=>{S.editId='new';S._draft=null;go('providers');renderProviders();setTimeout(()=>$('#pf-name')&&$('#pf-name').focus(),50)},
 preset:t=>{const k=t.dataset.k,pr=PRESETS[k],cur=S.editId==='new'?null:S.providers.find(x=>x.id===S.editId);
  const v=formVals();
  if(cur){cur.kind=k}
  const tmp={id:S.editId,kind:k,name:k==='custom'?v.name:pr.name,url:pr.url||v.url,key:cur?cur.key:'',model:pr.models[0]||v.model,temp:v.temp,ctx:v.ctx};
  if(cur){Object.assign(cur,{name:tmp.name,url:tmp.url,model:tmp.model,temp:tmp.temp,ctx:tmp.ctx});renderProviders()}else{S._draft=tmp;renderDraft(tmp)}},
 eye:()=>{const i=$('#pf-key'),show=i.type==='password';i.type=show?'text':'password';$('#eyeBtn').innerHTML=I(show?'eyeoff':'read')},
 testProv:()=>testProv(),
 saveProv:async()=>{const v=formVals();if(!v.name||!v.url||!v.model)return toast('Name, URL and model are required',true);
  const cur=S.providers.find(x=>x.id===S.editId);
  try{
   const {providers,saved}=await API('/api/providers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:S.editId==='new'?undefined:S.editId,kind:(S._draft&&S._draft.kind)||(cur&&cur.kind)||'custom',name:v.name,baseUrl:v.url,model:v.model,temperature:v.temp,contextWindow:v.ctx,apiKey:v.key})});
   S.providers=providers.map(normProv);if(saved&&saved.id)S.editId=saved.id;S.active=S.providers.find(p=>p.active)?.id||null;S._draft=null;
   refreshProvChips();renderProviders();toast('Provider saved')
  }catch(e){toast('Could not save provider: '+(e.message||String(e)),true)}},
 delProv:async()=>{try{
   const {providers}=await API('/api/providers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:S.editId})});
   S.providers=providers.map(normProv);S.active=S.providers.find(p=>p.active)?.id||null;S.editId=S.providers[0]?S.providers[0].id:'new';
   refreshProvChips();renderProviders();toast('Provider removed')
  }catch(e){toast('Could not remove provider: '+(e.message||String(e)),true)}},
 activate:async()=>{try{
   const {providers}=await API('/api/providers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'activate',id:S.editId})});
   S.providers=providers.map(normProv);S.active=S.editId;refreshProvChips();renderProviders();toast('Active provider updated')
  }catch(e){toast('Could not activate provider: '+(e.message||String(e)),true)}}
};

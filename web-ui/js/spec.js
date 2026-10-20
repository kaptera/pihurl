import {API} from './api.js';
import {askChat} from './chat.js';
import {$, EMPTY_SPEC, I, S, esc, toast} from './core.js';
import {computeCov} from './hurl.js';
import {refreshProvChips} from './nav.js';
import {fillTpl} from './prompts.js';
import {renderTests} from './tests.js';

/* ---------- SPEC ---------- */
function pathHTML(p){return esc(p).replace(/\{[^}]+\}/g,x=>`<em>${x}</em>`)}
export function renderSpec(){
 computeCov();
 renderSpecPick();
 const sp=S.spec,eps=sp.endpoints,cov=eps.filter(e=>S.cov.get(e.m+' '+e.p)>0).length,pct=eps.length?Math.round(cov/eps.length*100):0;
 const methods=['ALL',...new Set(eps.map(e=>e.m))];
 $('#mfs').innerHTML=methods.map(m=>`<button class="chip ${S.mf===m?'on':''}" data-act="mf" data-m="${m}">${m}</button>`).join('');
 if(!S.specs.length){
  $('#specInfo').innerHTML=`<h3 style="font-size:15px">No spec yet</h3><p class="muted" style="margin-top:6px;font-size:13px">Upload an OpenAPI file, or let the agent write one from the API's docs.</p><div class="row" style="margin-top:14px"><button class="btn sm primary" data-act="genSpec">${I('spark')}Ask the agent to create a spec</button></div>`;
  renderEps();return;
 }
 if(sp.error){
  $('#specInfo').innerHTML=`<h3 style="font-size:15px">${esc(sp.name)}</h3><div class="note" style="margin-top:10px;border-color:var(--bad);color:var(--bad)">${I('x')}<span>Not a usable spec: ${esc(sp.error)}</span></div><div class="row" style="margin-top:14px"><button class="btn sm" data-act="fixSpec">${I('chat')}Ask the agent to fix it</button></div>`;
  renderEps();return;
 }
 $('#specInfo').innerHTML=`<div class="row"><h3 class="min" style="flex:1;font-size:15px">${esc(sp.title||sp.name)}</h3>${sp.version?`<span class="chip mono">v${esc(sp.version)}</span>`:''}</div>
  <dl class="kv"><dt>File</dt><dd title="${esc(sp.path)}">${esc(sp.path)}</dd><dt>Server</dt><dd>${esc(sp.server||'—')}</dd><dt>Size</dt><dd>${esc(sp.size)}</dd><dt>Updated</dt><dd>${esc(sp.updated)}</dd><dt>Endpoints</dt><dd>${eps.length}</dd></dl>
  <div style="margin-top:16px"><div class="row" style="justify-content:space-between;font-size:12.5px;margin-bottom:6px"><span class="muted">Test coverage</span><b class="mono">${cov}/${eps.length} · ${pct}%</b></div><div class="bar"><i style="width:${pct}%;background:var(--ok)"></i></div></div>
  <div class="row" style="margin-top:14px"><button class="btn sm" data-act="pick">${I('upload')}Upload a different spec</button>`;
 renderEps();
}
function renderSpecPick(){
 const sel=$('#specSel');if(!sel)return;
 sel.innerHTML=S.specs.map(x=>`<option value="${esc(x.path)}" ${x.path===S.spec.path?'selected':''}>${x.error?'⚠ ':''}${esc(x.title?x.title+' — '+x.path:x.path)}</option>`).join('')||'<option>no specs</option>';
 sel.disabled=!S.specs.length;
 $('#specPick').style.display=S.specs.length?'':'none';
}
export function renderEps(){
 const q=S.q.toLowerCase();
 const list=S.spec.endpoints.filter(e=>(S.mf==='ALL'||e.m===S.mf)&&(!q||(e.p+' '+e.sum+' '+e.tag).toLowerCase().includes(q)));
 if(!list.length){$('#epList').innerHTML='<div class="empty-s">No endpoints match.</div>';return}
 const tags=[...new Set(list.map(e=>e.tag))];
 $('#epList').innerHTML=tags.map(t=>{const g=list.filter(e=>e.tag===t);return `<div class="tag-h"><span>${esc(t)}</span><span>${g.length}</span></div>`+g.map(e=>{
  const key=e.m+' '+e.p,c=S.cov.get(key)||0,open=S.openEp.has(key);
  return `<div class="ep ${open?'open':''}"><button class="eph" data-act="ep" data-k="${esc(key)}"><span class="mt m-${e.m}">${e.m}</span><span class="ep-p">${pathHTML(e.p)}</span><span class="ep-s">${esc(e.sum)}</span>${e.auth?`<span class="lock" title="Requires auth">${I('lock')}</span>`:''}<span class="cov ${c?'y':'n'}">${c?c+' test'+(c>1?'s':''):'no tests'}</span><span class="chev">${I('chev')}</span></button>
  <div class="epb"><div class="muted">${esc(e.sum)}</div>
  <div class="row wrap">${e.params.length?e.params.map(p=>{const[a,b]=p.split(':');return `<span class="chip mono">${esc(a)} <span class="dim">${esc(b||'')}</span></span>`}).join(''):'<span class="dim">no parameters</span>'}</div>
  <div class="row wrap">${e.resp.map(r=>`<span class="sc ${'s'+r[0]}">${r}</span>`).join('')}${e.auth?'<span class="chip">bearer auth</span>':''}</div>
  <div class="row"><button class="btn sm primary" data-act="genEp" data-k="${esc(key)}">${I('spark')}Write tests</button></div></div></div>`}).join('')}).join('');
}
/* ---------- specs (parsed by the backend; the agent writes them too) ---------- */
const specStore={get(){try{return localStorage.getItem('pihurl.spec')||''}catch(e){return ''}},set(v){try{localStorage.setItem('pihurl.spec',v)}catch(e){}}};
export function pickSpec(path){
 S.spec=S.specs.find(x=>x.path===path)||{...EMPTY_SPEC};
 if(S.spec.path)specStore.set(S.spec.path);
 S.openEp.clear();S.mf='ALL';
}
// Re-read the specs on disk. `fromAgent`: a spec that appeared meanwhile was written
// by the agent, so show it.
export async function refreshSpecs(fromAgent){
 let r;try{r=await API('/api/specs')}catch(e){console.error('specs failed',e);return}
 const known=new Set(S.specs.map(x=>x.path));
 S.specs=r.specs||[];
 const added=S.specsLoaded?S.specs.filter(x=>!known.has(x.path)&&!x.error):[];
 let want=S.spec.path;
 if(fromAgent&&added.length){want=added[0].path;toast('Spec added: '+added[0].name)}
 else if(!S.specs.some(x=>x.path===want)){
  const saved=specStore.get();
  want=S.specs.some(x=>x.path===saved)?saved:((S.specs.find(x=>!x.error)||S.specs[0]||{}).path||'');
 }
 S.specsLoaded=true;
 pickSpec(want);
 refreshProvChips();
 if(S.view==='spec')renderSpec();
 if(S.view==='tests')renderTests();
}
// A spec that names its server brings the target host with it.
export function useSpecHost(){
 const srv=S.spec.server;
 if(!srv||srv===S.host)return;
 S.host=srv;const hi=$('#hostInp');if(hi)hi.value=srv;
 API('/api/hosts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',baseUrl:srv})}).catch(()=>{});
 toast('Target host set to '+srv);
}
export function loadFile(file){
 const r=new FileReader();
 r.onload=async()=>{
  try{
   const res=await API('/api/specs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,content:String(r.result)})});
   S.specs=res.specs;pickSpec(res.saved);useSpecHost();refreshProvChips();renderSpec();
   toast(`Loaded ${S.spec.endpoints.length} endpoints from ${file.name}`);
  }catch(e){toast(e.message||'Could not save the spec',true)}
 };
 r.onerror=()=>toast('Could not read file',true);r.readAsText(file);
}

export const actions={
 pick:()=>$('#file').click(),
 genSpec:()=>askChat(fillTpl((S.templates.find(x=>x.id==='create-spec')||{}).body||'Create an OpenAPI spec for the API at {{base_url}}: look for a published spec, otherwise read its docs and probe it with GET requests. Save it as specs/<api-name>.yaml and check that it parses.')),
 fixSpec:()=>askChat(`The spec ${S.spec.path} does not parse: ${S.spec.error}. Fix it (check with the /api/specs call from the openapi-spec skill).`),
 specDelete:async()=>{
  const sp=S.spec;if(!sp.path)return;
  if(!confirm('Delete '+sp.path+'? The file is removed from the workspace.'))return;
  try{const r=await API('/api/specs?path='+encodeURIComponent(sp.path),{method:'DELETE'});S.specs=r.specs;pickSpec('');specStore.set('');await refreshSpecs();refreshProvChips();renderSpec();toast('Deleted '+sp.name)}catch(e){toast('Delete failed: '+(e.message||String(e)),true)}
 },
 mf:t=>{S.mf=t.dataset.m;renderSpec()},
 ep:t=>{const k=t.dataset.k;S.openEp.has(k)?S.openEp.delete(k):S.openEp.add(k);renderEps()},
 genEp:t=>askChat(`Write Hurl tests for ${t.dataset.k} from ${S.spec.path}`),
 genUncovered:()=>{if(!S.spec.endpoints.length)return toast('Select a spec with endpoints first',true);computeCov();const u=S.spec.endpoints.filter(e=>!S.cov.get(e.m+' '+e.p));if(!u.length)return toast('Every endpoint already has a test');askChat(`Cover the uncovered endpoints in ${S.spec.path}: `+u.slice(0,4).map(e=>e.m+' '+e.p).join(', '))}
};

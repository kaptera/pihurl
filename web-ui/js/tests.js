import {API} from './api.js';
import {$, $$, I, S, ago, esc, fmtMs, toast} from './core.js';
import {codeBlock, computeCov, hlLine, jsonHL, parseHurl} from './hurl.js';
import {refreshProvChips} from './nav.js';
import {renderSpec} from './spec.js';

/* ---------- TESTS & REPORTS ---------- */
export const isMobile=()=>matchMedia('(max-width:860px)').matches;
// The agent creates and edits test files on the backend; re-read them when it
// finishes a turn and whenever a view that shows them opens.
export async function refreshTests(){
 try{
  const t=await API('/api/tests');S.files=t.files.map(f=>({...f}));
  computeCov();refreshProvChips();
  if(S.view==='tests')renderTests();if(S.view==='spec')renderSpec();
 }catch(e){console.error('refreshTests failed',e)}
}
export function curRun(){return S.runs.find(r=>r.id===S.runId)||S.runs[0]}
export function renderTests(){
 const hi=$('#hostInp');if(hi){if(!S.host)S.host=hi.value.trim();hi.value=S.host||''}
 renderTHead();renderFiles();renderMain();
 const el=$('#tests');el.classList.toggle('files-on',S.tview==='files');
 $$('#tseg button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.tview||(S.tview==='files'&&!isMobile()&&b.dataset.v==='report')));
}
export function renderTHead(){
 const r=curRun(),st=r&&stats(r);
 $('#tSub').textContent=r?`Run #${r.id} · ${ago(r.at)} · ${st.pass}/${st.files} files passing`:'No runs yet';
 const busy=!!S.running;
 $('#runAll').innerHTML=busy?`<i class="spin"></i><span>Running ${S.running.n} file${S.running.n>1?'s':''}…</span>`:`${I('play')}<span>Run all</span>`;
 $('#runAll').disabled=busy;
 $('#runSel').innerHTML=`${I('play')}Run selected${S.checked.size?' ('+S.checked.size+')':''}`;$('#runSel').disabled=busy||!S.checked.size;
}
// Test files grouped by the spec they exercise (grouping.js). Computed on demand:
// it only reads the sources already in memory.
const NONE='_none';
const gkey=g=>g.specPath||NONE;
function fileGroups(){return groupFiles(S.files,S.specs,S.spec.path)}
function groupByKey(key){return fileGroups().find(g=>gkey(g)===key)}

// Tri-state checkbox: '' none, 'on' all, 'mix' some of `paths`.
function checkState(paths){const n=paths.filter(p=>S.checked.has(p)).length;return !n?'':n===paths.length?'on':'mix'}
const cbxIcon=st=>st==='on'?I('check'):st==='mix'?I('skip'):'';
function fileRow(f){
 const name=f.path.split('/').pop(),l=latest(f.path),rs=S.running&&S.running.status[f.path];
 const dot=rs==='running'?'run':rs==='queued'?'off':(rs?rs==='pass'?'ok':'bad':l?(l.f.status==='pass'?'ok':'bad'):'off');
 const meta=rs==='running'?'running…':rs==='queued'?'queued':(l?`${l.f.reqs} req · ${fmtMs(l.f.time)}`:'never run');
 return `<div class="tfile ${S.sel===f.path?'sel':''}" data-act="selFile" data-p="${esc(f.path)}"><span class="cbx ${S.checked.has(f.path)?'on':''}" data-act="chk" data-p="${esc(f.path)}">${S.checked.has(f.path)?I('check'):''}</span><div class="nm"><b>${esc(name)}</b><small>${meta}</small></div><span class="dot ${dot}"></span><button class="pl" data-act="runOne" data-p="${esc(f.path)}" aria-label="Run file">${I('play')}</button></div>`;
}
function renderFiles(){
 const groups=fileGroups(),all=S.files.map(f=>f.path);
 $('#tfCount').textContent=S.files.length+' test files';
 const ac=$('#allCbx');if(ac){const st=checkState(all);ac.className='cbx '+st;ac.innerHTML=cbxIcon(st)}
 $('#tfList').innerHTML=groups.map(g=>{
  const key=gkey(g),paths=g.files.map(f=>f.path),st=checkState(paths),open=!S.collapsed.has(key);
  const ran=paths.map(p=>latest(p)).filter(Boolean),pass=ran.filter(l=>l.f.status==='pass').length;
  const title=g.specPath?g.title:(groups.length>1?'No spec':'All tests');
  const sub=`${paths.length} file${paths.length>1?'s':''}`+(ran.length?` · ${pass}/${ran.length} passing`:'');
  let body='';
  if(open){let dir=null;body=g.files.map(f=>{const head=f.dir!==dir?`<div class="grp">${f.dir==='.'?'./':esc(f.dir)+'/'}</div>`:'';dir=f.dir;return head+fileRow(f)}).join('')}
  return `<div class="sg ${open?'open':''}"><div class="sgh"><span class="cbx ${st}" data-act="grpChk" data-g="${esc(key)}" role="checkbox" aria-label="Select all files of ${esc(title)}">${cbxIcon(st)}</span><button class="sgt" data-act="grpToggle" data-g="${esc(key)}" title="${esc(g.specPath||'tests that match no spec')}"><span class="chev">${I('chev')}</span><span class="nm"><b>${esc(title)}</b><small>${sub}</small></span></button><button class="pl" data-act="runGroup" data-g="${esc(key)}" aria-label="Run this group">${I('play')}</button></div>${body}</div>`;
 }).join('')||'<div class="empty-s">No test files yet. Ask the agent to write some.</div>';
}
export function renderMain(){
 const src=S.tview==='source';
 if(src){const f=S.files.find(x=>x.path===S.sel)||S.files[0];if(!f){$('#tMain').innerHTML='';return}
  const ents=parseHurl(f.src);computeCov();
  const covered=[...new Set(ents.map(e=>e.method+' '+e.url.replace('{{host}}','').split('?')[0]))];
  $('#tMain').innerHTML=`<div class="tm-h"><b class="mono" style="font-size:13px">${esc(f.path)}</b><span class="spacer"></span><button class="btn sm" data-act="copySrc">${I('copy')}Copy</button><button class="btn sm primary" data-act="runOne" data-p="${f.path}">${I('play')}Run</button></div><div class="tm-b"><div class="cover"><span class="dim" style="font-size:12px">Requests:</span>${covered.map(c=>`<span class="chip mono">${esc(c)}</span>`).join('')}</div>${codeBlock(f.src.trim())}</div>`;
  return}
 const run=curRun();
 const prevScroll=($('#repBody')||{}).scrollTop||0;
 let h=`<div class="tm-h"><select class="inp" id="runSelect" aria-label="Run history">${S.runs.map(r=>{const s=stats(r);return `<option value="${r.id}" ${r.id===(run&&run.id)?'selected':''}>#${r.id} · ${ago(r.at)} · ${s.pass}/${s.files} passed</option>`}).join('')}</select><span class="spacer"></span>${run&&(run.htmlFile||run.jsonFile)?`<button class="btn sm" data-act="viewReport">${I('info')}HTML</button>`:''}${run&&stats(run).fail?`<button class="btn sm" data-act="sendFail">${I('chat')}Send failures to agent</button>`:''}<div class="seg" id="rfseg"><button data-act="rfilter" data-v="all" class="${S.rfilter==='all'?'on':''}">All</button><button data-act="rfilter" data-v="fail" class="${S.rfilter==='fail'?'on':''}">Failed</button></div></div><div class="tm-b" id="repBody">`;
 if(S.running){h+=`<div class="card runbar"><div class="row"><i class="spin"></i><b>Running ${S.running.n} file${S.running.n>1?'s':''}…</b></div><div class="bar"><i style="width:100%;animation:pulse 1s infinite"></i></div></div>`}
 if(!run){h+='<div class="empty-s">No reports yet. Hit <b>Run all</b> to execute your Hurl files.</div></div>';$('#tMain').innerHTML=h;return}
 const s=stats(run),pct=s.files?Math.round(s.pass/s.files*100):0,col=s.fail?`conic-gradient(var(--ok) 0 ${pct}%,var(--bad) ${pct}% 100%)`:'var(--ok)';
 h+=`<div class="card sum"><div class="ring" style="background:${col}"><b>${pct}<small>%</small></b></div>
 <div class="stats"><div class="stat ok"><small>Passed</small><b>${s.pass}</b></div><div class="stat ${s.fail?'bad':''}"><small>Failed</small><b>${s.fail}</b></div><div class="stat"><small>Requests</small><b>${s.reqs}</b></div><div class="stat"><small>Duration</small><b>${s.dur>=1000?(s.dur/1000).toFixed(1)+'s':s.dur+'ms'}</b></div></div>
 <div class="cmd">${I('bash')}<span>${esc(run.command||'hurl --test')}</span></div></div>`;
 const files=run.files.filter(f=>S.rfilter==='all'||f.status==='fail');
 if(!files.length)h+='<div class="empty-s">🎉 No failures in this run.</div>';
 // Results are grouped like the file list: by the spec the file exercises.
 const groups=fileGroups(),slot=new Map();
 groups.forEach((g,gi)=>g.files.forEach((f,fi)=>slot.set(f.path,[gi,fi])));
 const pos=f=>slot.get(f.path)||[groups.length,0];
 const gTitle=gi=>gi>=groups.length||!groups[gi].specPath?'No spec':groups[gi].title;
 files.sort((a,b)=>pos(a)[0]-pos(b)[0]||pos(a)[1]-pos(b)[1]||a.path.localeCompare(b.path));
 let lastG=-1;
 h+=files.map(f=>{
  const gi=pos(f)[0],head=(gi!==lastG&&(groups.length>1||gi>=groups.length))?`<div class="grp rg">${esc(gTitle(gi))}</div>`:'';lastG=gi;
  const key='f:'+f.path,open=S.open.has(key)?S.open.get(key):f.status==='fail';
  return head+`<div class="rf ${f.status==='fail'?'fail':''} ${open?'open':''} ${S.sel===f.path?'hl':''}"><button class="rfh" data-act="tog" data-k="${key}" data-d="${f.status==='fail'?1:0}"><span class="si ${f.status==='pass'?'ok':'bad'}">${I(f.status==='pass'?'check':'x')}</span><span class="nm">${esc(f.path)}</span><span class="meta">${f.reqs} req · ${fmtMs(f.time)}</span><span class="chev">${I('chev')}</span></button><div class="rfb">${f.entries.length?f.entries.map((e,i)=>entryHTML(f,e,i)).join(''):`<div class="note" style="border-color:var(--bad);color:var(--bad);white-space:pre-wrap;font-family:var(--mono)">${esc(((f.fail&&f.fail.detail)||'No request was run.').replace(/\n\s*\|\s*/g,'\n'))}</div>`}</div></div>`}).join('');
 h+='</div>';
 $('#tMain').innerHTML=h;
 const nb=$('#repBody');if(nb)nb.scrollTop=prevScroll;
}
const STXT={200:'OK',201:'Created',204:'No Content',401:'Unauthorized',404:'Not Found',422:'Unprocessable Entity'};
function entryHTML(f,e,i){
 if(e.skipped)return `<div class="ent skip"><div class="eh"><span class="si skip">${I('skip')}</span><span class="mt m-${e.method}">${e.method}</span><span class="eu">${esc(e.url.replace(/\{\{host\}\}/,''))}</span><span class="dim" style="font-size:12px">skipped</span></div></div>`;
 const key=`e:${f.path}:${i}`,def=!e.ok,open=S.open.has(key)?S.open.get(key):def;
 const sc=e.status??(e.response?.status??0);const cls='s'+(String(sc)[0]);
 const redact=v=>/^Bearer /.test(v)?v.slice(0,16)+'…[redacted]':v;
 const path=e.url.replace(/\{\{host\}\}/,'').replace(/^https?:\/\/[^/]+/,'');
 const dur=(e.response?.durationMs||'').toString()||'';
 return `<div class="ent ${e.ok?'':'fail'} ${open?'open':''}"><button class="eh" data-act="tog" data-k="${key}" data-d="${def?1:0}"><span class="si ${e.ok?'ok':'bad'}">${I(e.ok?'check':'x')}</span><span class="mt m-${e.method}">${e.method}</span><span class="eu" title="${esc(e.url)}">${esc(path)}</span><span class="sc ${cls}">${sc||'-'}</span><span class="meta mono muted" style="font-size:11.5px">${dur} ms</span><span class="chev">${I('chev')}</span></button>
 <div class="eb"><div class="muted" style="font-size:12.5px;padding:2px 0 4px">${esc(f.path)} #${i+1}</div>
 <h4>Assertions · ${e.asserts.filter(a=>a.ok).length}/${e.asserts.length}</h4>
 ${e.asserts.map(a=>`<div class="as"><span class="si ${a.ok?'ok':'bad'}">${I(a.ok?'check':'x')}</span><div style="min-width:0;word-break:break-word"><span>${hlLine(a.text)}</span>${a.ok?'':`<span class="d" style="white-space:pre-wrap">${a.detail?esc(a.detail.replace(/\n\s*\|\s*/g,'\n')):''}</span>`}</div></div>`).join('')}
 <div class="hb" style="margin-top:12px"><div class="pane"><div><span>REQUEST</span><span>${e.method} ${esc(path)}</span></div><pre><span class="c-m">${e.method}</span> ${esc(path)} HTTP/1.1\n${(e.request?.headers||[]).map(([k,v])=>`<span class="c-hk">${esc(k)}</span>: <span class="hd">${esc(redact(v))}</span>`).join('\n')}${e.request?.body?'\n\n'+jsonHL(tryFmt(e.request.body)):''}</pre></div>
 <div class="pane"><div><span>RESPONSE</span><span>${sc||'-'} ${STXT[sc]||''}</span></div><pre>HTTP/1.1 <span class="sc ${cls}">${sc||'-'}</span> ${STXT[sc]||''}\n${(e.response?.headers||[]).map(([k,v])=>`<span class="c-hk">${esc(k)}</span>: <span class="hd">${esc(v)}</span>`).join('\n')}\n\n${jsonHL(e.response?.body||'')}</pre></div></div></div></div>`;
}
function tryFmt(s){try{return JSON.stringify(JSON.parse(s),null,2)}catch(e){return s}}
export function stats(run){
 let files=run.files.length,pass=0,reqs=0,asOk=0,as=0;
 run.files.forEach(f=>{if(f.status==='pass')pass++;reqs+=f.reqs;f.entries.forEach(e=>{e.asserts.forEach(a=>{as++;if(a.ok)asOk++})})});
 return{files,pass,fail:files-pass,reqs,as,asOk,dur:run.duration||0};
}
export const latest=p=>{for(const r of S.runs){const f=r.files.find(x=>x.path===p);if(f)return{run:r,f}}return null};
async function runSuite(paths){
 if(S.running||!paths.length)return;
 // Generated tests address the API as {{host}}; hurl fails on an undefined variable.
 if(!S.host&&paths.some(p=>(S.files.find(f=>f.path===p)||{src:''}).src.includes('{{host}}'))){
  toast('Set the target host first (field above Run all)',true);const hi=$('#hostInp');if(hi)hi.focus();return;
 }
 S.running={i:0,n:paths.length,done:0,status:Object.fromEntries(paths.map(p=>[p,'running']))};S.tview=S.tview==='files'&&isMobile()?'report':S.tview;renderTests();
 try{
  const {result}=await API('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({host:S.host,files:paths})});
  S.running=null;
  if(!result){toast('Run returned no result',true);return}
  S.runs.unshift(result);S.runId=result.id;S.rfilter='all';renderTests();
  const s=stats(result);toast(s.fail?`${s.fail} of ${s.files} files failed`:`All ${s.files} files passed`,!!s.fail);
 }catch(e){S.running=null;toast('Run failed: '+(e.message||String(e)),true);renderTests();}
}
// View the HTML report Hurl produced in an iframe.
function viewReport(run){
 const url=run.htmlFile||run.jsonFile;
 if(!url){toast('No report file available',true);return}
 window.open(url,'_blank');
}

export const actions={
 tview:t=>{S.tview=t.dataset.v;renderTests()},
 selFile:t=>{S.sel=t.dataset.p;if(isMobile())S.tview='report';renderTests();
  const el=$('.rf.hl');if(el&&S.tview==='report')el.scrollIntoView({block:'nearest',behavior:'smooth'})},
 allChk:()=>{const all=S.files.map(f=>f.path);if(checkState(all)==='on')S.checked.clear();else all.forEach(p=>S.checked.add(p));renderTHead();renderFiles()},
 grpChk:(t,e)=>{
  e.stopPropagation();const g=groupByKey(t.dataset.g);if(!g)return;
  const paths=g.files.map(f=>f.path),on=checkState(paths)==='on';
  paths.forEach(p=>on?S.checked.delete(p):S.checked.add(p));renderTHead();renderFiles();
 },
 grpToggle:t=>{const k=t.dataset.g;S.collapsed.has(k)?S.collapsed.delete(k):S.collapsed.add(k);renderFiles()},
 runGroup:(t,e)=>{e.stopPropagation();const g=groupByKey(t.dataset.g);if(g)runSuite(g.files.map(f=>f.path))},
 chk:(t,e)=>{e.stopPropagation();const p=t.dataset.p;S.checked.has(p)?S.checked.delete(p):S.checked.add(p);renderTHead();renderFiles()},
 runOne:(t,e)=>{e.stopPropagation();S.sel=t.dataset.p;runSuite([t.dataset.p])},
 runAll:()=>runSuite(S.files.map(f=>f.path)),
 runSel:()=>runSuite([...S.checked]),
 tog:t=>{const k=t.dataset.k,def=t.dataset.d==='1',cur=S.open.has(k)?S.open.get(k):def;S.open.set(k,!cur);renderMain()},
 rfilter:t=>{S.rfilter=t.dataset.v;renderMain()},
 viewReport:()=>{const r=curRun();if(r)viewReport(r)},
 copySrc:()=>{const f=S.files.find(x=>x.path===S.sel);try{navigator.clipboard.writeText(f.src).then(()=>toast('Copied'),()=>toast('Copy blocked by browser',true))}catch(e){toast('Copy blocked by browser',true)}}
};

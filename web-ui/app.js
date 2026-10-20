/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P={
 chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
 spec:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 providers:'<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
 prompts:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
 tests:'<path d="M9 3h6M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M7.5 15h9"/>',
 read:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 write:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 bash:'<path d="M4 17l6-5-6-5M12 19h8"/>',
 send:'<path d="M12 19V5M5 12l7-7 7 7"/>',
 stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
 upload:'<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
 chev:'<path d="M6 9l6 6 6-6"/>',
 play:'<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
 check:'<path d="M5 12l5 5 9-10"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 eyeoff:'<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A17 17 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
 spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h0"/>',
 skip:'<path d="M6 12h12"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 unfold:'<path d="M7 9l5-5 5 5M7 15l5 5 5-5"/>',
 fold:'<path d="M7 4l5 5 5-5M7 20l5-5 5 5"/>'
};
const I=(n,c='')=>`<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
const fmtMs=ms=>ms>=1000?(ms/1000).toFixed(2)+' s':Math.round(ms)+' ms';
const ago=t=>{const s=(Date.now()-t)/1000;if(s<45)return'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';return Math.round(s/86400)+' d ago'};
// Agent text is Markdown (markdown.js). Code blocks get the same highlighting as the Source view.
const md=t=>renderMarkdown(t,{highlight:(lang,code)=>{
 if(/^(hurl|http)$/.test(lang))return code.split('\n').map(l=>hlLine(l)||' ').join('\n');
 if(lang==='json')return tok(esc(code));
 return null;
}});
let toastT;function toast(msg,err){const t=$('#toast');t.className='toast'+(err?' err':'');t.innerHTML=I(err?'x':'check')+'<span>'+esc(msg)+'</span>';requestAnimationFrame(()=>t.classList.add('show'));clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600)}
const tokens=s=>Math.ceil((s||'').length/4);

/* ---------- preferences (per browser) ---------- */
const PREF_DEFAULTS={toolCards:'auto',sendKey:'enter'};
const PREFS=(()=>{let p={};try{p=JSON.parse(localStorage.getItem('pihurl.prefs')||'{}')}catch(e){}return{...PREF_DEFAULTS,...p}})();
function setPref(k,v){PREFS[k]=v;try{localStorage.setItem('pihurl.prefs',JSON.stringify(PREFS))}catch(e){}}

/* ---------- backend API ---------- */
// Every screen here talks to the Node backend; nothing is simulated client-side.
async function api(path, opts){
 const res=await fetch(path,{headers:opts?.headers||{},...opts});
 const ct=res.headers.get('content-type')||'';
 const body=/json/.test(ct)?await res.json().catch(()=>null):await res.text().catch(()=>null);
 if(!res.ok){throw new Error((body&&body.detail)||(body&&body.error)||res.statusText)}
 return body;
}
const API=async(path,opts)=>api(path,{...opts});

/* ---------- Hurl syntax highlighting ---------- */
function tok(e){
 return e.replace(/(&quot;(?:(?!&quot;).)*&quot;)(\s*:)?|(\{\{\w+\}\})|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b|\b(exists|is[A-Z]\w+|count|contains|startsWith|endsWith|matches|includes)\b/g,
 (m,s,colon,v,n,k,f)=>{
  if(s!==undefined){const c=colon?'c-key':'c-str';return `<span class="${c}">`+s.replace(/\{\{\w+\}\}/g,x=>`</span><span class="c-var">${x}</span><span class="${c}">`)+'</span>'+(colon||'')}
  if(v)return `<span class="c-var">${v}</span>`;
  if(n)return `<span class="c-num">${n}</span>`;
  if(k)return `<span class="c-kw2">${k}</span>`;
  return `<span class="c-fn">${f}</span>`;
 });
}
function hlLine(l){
 let m;
 if(/^\s*#/.test(l))return `<span class="c-cm">${esc(l)}</span>`;
 if(/^\[\w+\]\s*$/.test(l))return `<span class="c-sec">${esc(l)}</span>`;
 if((m=l.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(\s+)(.*)$/)))return `<span class="c-m">${m[1]}</span>${m[2]}`+esc(m[3]).replace(/\{\{\w+\}\}/g,x=>`<span class="c-var">${x}</span>`);
 if((m=l.match(/^(HTTP)(\s+)(\S+)(.*)$/)))return `<span class="c-m">HTTP</span>${m[2]}<span class="c-num">${esc(m[3])}</span>${esc(m[4])}`;
 if((m=l.match(/^(jsonpath|header|duration|status|body|xpath)\b(.*)$/)))return `<span class="c-kw">${m[1]}</span>`+tok(esc(m[2]));
 if((m=l.match(/^([A-Za-z][\w-]*)(:\s*)(.*)$/)))return `<span class="c-hk">${esc(m[1])}</span>${m[2]}`+tok(esc(m[3]));
 return tok(esc(l));
}
const codeBlock=src=>`<div class="code">${src.split('\n').map((l,i)=>`<div class="cl"><span class="ln">${i+1}</span><span class="lc">${hlLine(l)||' '}</span></div>`).join('')}</div>`;
const jsonHL=o=>tok(esc(typeof o==='string'?o:JSON.stringify(o,null,2)));

/* ---------- data ---------- */
const PRESETS={
 anthropic:{name:'Anthropic',url:'https://api.anthropic.com',models:['claude-sonnet-4-5','claude-opus-4-1','claude-haiku-4-5']},
 openai:{name:'OpenAI',url:'https://api.openai.com/v1',models:['gpt-4.1','gpt-4.1-mini','o4-mini']},
 openrouter:{name:'OpenRouter',url:'https://openrouter.ai/api/v1',models:['anthropic/claude-sonnet-4.5','deepseek/deepseek-chat-v3','google/gemini-2.5-pro']},
 ollama:{name:'Ollama (local)',url:'http://localhost:11434/v1',models:['qwen2.5-coder:14b','llama3.1:8b','mistral-nemo'],nokey:true},
 custom:{name:'Custom',url:'',models:[]}
};
/* ---------- project instructions as last saved on the server (the Reset target) ---------- */
let INSTR='';

const EMPTY_SPEC={path:'',name:'',title:'',version:'',server:'',size:'',updated:'',endpoints:[]};
/* ---------- state ---------- */
const S={
 view:'chat',
 spec:{...EMPTY_SPEC},specs:[],specsLoaded:false,
 q:'',mf:'ALL',openEp:new Set(),
 files:[],runs:[],runId:null,sel:null,checked:new Set(),tview:'report',running:null,open:new Map(),rfilter:'all',host:'',
 providers:[],
 active:null,editId:'new',
 templates:[],tpl:'',ptab:'templates',instr:'',instrOn:true,
 busy:false,
 chats:[],chatId:'',collapsed:new Set()
};
let COV=new Map();

/* ---------- Hurl source parsing (endpoint coverage, Source view) ---------- */
function parseHurl(src){
 const out=[];let cur=null,phase='',sec='',comment='';
 src.split('\n').forEach((raw,i)=>{
  const l=raw.replace(/\s+$/,'');let m;
  if(/^#/.test(l)){comment=l.replace(/^#\s*/,'');return}
  if((m=l.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/))){
   cur={name:comment||m[1]+' '+m[2].replace('{{host}}',''),method:m[1],url:m[2],line:i+1,headers:[],body:[],status:'*',statusLine:0,captures:[],asserts:[]};
   out.push(cur);comment='';phase='req';sec='';return}
  if(!cur)return;
  if((m=l.match(/^HTTP\s+(\d+|\*)/))){cur.status=m[1];cur.statusLine=i+1;phase='res';return}
  if(phase==='req'){
   if(!l.trim()){if(cur.body.length)cur.body.push('');return}
   if(!cur.body.length&&(m=l.match(/^([A-Za-z][\w-]*):\s*(.*)$/))){cur.headers.push([m[1],m[2]]);return}
   cur.body.push(l);
  }else if(phase==='res'){
   if(/^\[Captures\]/.test(l)){sec='cap';return}
   if(/^\[Asserts\]/.test(l)){sec='as';return}
   if(!l.trim())return;
   if(sec==='cap'&&(m=l.match(/^(\w+):\s*jsonpath\s+"([^"]+)"/)))cur.captures.push([m[1],m[2]]);
   else if(sec==='as')cur.asserts.push({l,n:i+1});
  }
 });
 return out;
}
function computeCov(){
 COV=new Map();
 const ents=S.files.flatMap(f=>parseHurl(f.src));
 S.spec.endpoints.forEach(ep=>{
  const re=new RegExp('^'+ep.p.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{[^}]+\}/g,'[^/]+')+'$');
  COV.set(ep.m+' '+ep.p,ents.filter(e=>e.method===ep.m&&re.test(e.url.replace('{{host}}','').split('?')[0])).length);
 });
}

/* ---------- navigation ---------- */
const NAV=[['chat','Chat','Chat'],['spec','Spec','Spec'],['providers','Providers','Providers'],['prompts','Prompts','Prompts'],['tests','Tests & Reports','Tests'],['settings','Settings','Settings']];
function go(v){
 S.view=v;
 $$('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
 $$('#nav button,#tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 try{history.replaceState(null,'','#'+v)}catch(e){}
 if(v==='spec'){renderSpec();refreshTests();refreshSpecs()}if(v==='tests'){renderTests();refreshTests()}if(v==='providers')renderProviders();if(v==='prompts')renderPrompts();if(v==='settings')renderSettings();
 if(v==='chat')setTimeout(()=>{$('#msgs').scrollTop=1e9},20);
}
function updateBadges(){
 const r=S.runs.find(x=>x.id===S.runId)||S.runs[0];const bad=r?stats(r).fail:0;
 $$('.nb').forEach(n=>n.remove());
 if(bad){$$('[data-v="tests"]').forEach(b=>{if(b.closest('#nav,#tabbar'))b.insertAdjacentHTML('beforeend',`<span class="nb">${bad}</span>`)})}
}
function renderChrome(){
 $('#nav').innerHTML=NAV.map(([v,l])=>`<button data-act="go" data-v="${v}">${I(v)}<span>${l}</span></button>`).join('');
 $('#tabbar').innerHTML=NAV.map(([v,,s])=>`<button data-act="go" data-v="${v}">${I(v)}<span>${s}</span></button>`).join('');
 $$('[data-i]').forEach(e=>e.innerHTML=I(e.dataset.i));
 $('#sendBtn').innerHTML=I('send');$('#upIc').innerHTML=I('upload');$('#seIc').innerHTML=I('search');$('#genIc').innerHTML=I('spark');
 refreshProvChips();
}
function refreshProvChips(){
 const p=S.providers.find(x=>x.id===S.active);
 const t=p?`<span class="dot ok"></span><span class="mono">${esc(p.model)}</span>`:'<span class="dot off"></span><span>no provider</span>';
 $('#sfProv').innerHTML=p?`<span class="dot ok"></span>${esc(p.name)} · ${esc(p.model)}`:'<span class="dot off"></span>not connected';
 $('#sfSpec').innerHTML=S.spec.endpoints.length?`<span class="dot ok"></span>${esc(S.spec.title)} ${esc(S.spec.version)}`:'<span class="dot off"></span>no spec loaded';
 $('#modelChip').innerHTML=t;$('#tbProv').innerHTML=t;
 computeCov();const cov=[...COV.values()].filter(x=>x>0).length;
 $('#ctx').innerHTML=`<span class="chip">${I('spec')} ${esc(S.spec.name)}</span><span class="chip">${I('tests')} ${S.files.length} files</span><span class="chip">${cov}/${S.spec.endpoints.length} endpoints covered</span>`;
}

/* ---------- CHAT ---------- */
const nearBottom=()=>{const m=$('#msgs');return m.scrollHeight-m.scrollTop-m.clientHeight<220};
const scrollDown=f=>{const m=$('#msgs');if(f||nearBottom()){m.style.scrollBehavior='auto';m.scrollTop=m.scrollHeight}};
function addUser(t){const d=document.createElement('div');d.className='msg user';d.innerHTML=`<div class="ub">${esc(t)}</div>`;$('#msgsIn').append(d);scrollDown(true)}
function newAgentMsg(){
 const el=document.createElement('div');el.className='msg agent';el.innerHTML='<div class="av">π</div><div class="mb"></div>';
 $('#msgsIn').append(el);
 return{el,mb:$('.mb',el)};
}
/* ---------- chat (real pi over SSE) ---------- */
// The agent is `pi` running in RPC mode on the backend. We POST the prompt and
// stream session events from `/api/chat` (SSE), rendering them live: assistant
// text deltas become a message, tool_execution_* events become tool cards.
let chatAbort=null;   // AbortController for the current SSE stream
let curCard=null;     // {msg, textEl, raw, tools: Map<toolCallId, tool>} for the active agent turn
const TOOL_LABEL={read:'Read',write:'Write',bash:'Bash'};

// pi's tools: read, bash, edit, write, grep, find, ls. The card styles/icons only
// know three families, so map the rest onto them.
const TOOL_FAMILY={read:'read',grep:'read',find:'read',ls:'read',write:'write',edit:'write',bash:'bash'};
// One-line summary of a tool call: the command, or the path it works on.
function toolArg(name,args){
 if(!args||typeof args!=='object')return name;
 return String(args.command||args.path||args.file_path||args.pattern||JSON.stringify(args));
}
const resultText=r=>((r&&r.content)||[]).map(c=>c.text||'').join('');
// Build a tool card inside `mb` (the body of an agent message).
function mkToolCard(mb,name,arg){
 name=name||'bash';
 const fam=TOOL_FAMILY[name]||'read';
 const card=document.createElement('div');card.className='tool '+fam+(PREFS.toolCards==='collapsed'?'':' open');
 card.innerHTML=`<button class="th" data-act="toggleTool"><span class="ti">${I(fam)}</span><span class="tk">${esc(TOOL_LABEL[name]||name)}</span><span class="ta">${esc(arg)}</span><span class="ts"><i class="spin"></i></span><span class="chev">${I('chev')}</span></button><div class="tb"><pre class="out"></pre></div>`;
 mb.append(card);
 const out=$('.out',card),st=$('.ts',card);
 // Tool output is untrusted (API responses, file contents): text only, never HTML.
 // Updates carry the output so far, so each one replaces the previous.
 const set=t=>{out.textContent=t.length>20000?'…'+t.slice(-20000):t;out.scrollTop=out.scrollHeight};
 return {card,out,st,set,kind:fam,args:arg||'',_t0:performance.now()};
}
function openTool(name,arg,id){
 const tool=mkToolCard(curCard.msg.mb,name,arg);
 curCard.tools.set(id,tool);
 return tool;
}
function closeTool(tool,err,text){
 // A card redrawn from history has no start time: show no duration.
 const st=tool.st,n=tool._t0?((performance.now()-tool._t0)/1000).toFixed(1)+'s':'';
 const bad=!!err;
 tool.done=true;
 if(text)tool.set(text);
 st.innerHTML=(bad?`<span class="exit">error</span>`:'')+(bad?I('x','bd'):I('check','okk'))+(n?`<span>${n}</span>`:'');
 settleTool(tool.card,bad);
}
// 'auto': open while running, folded when done (a failed call stays open);
// 'expanded': never folded automatically; 'collapsed': folded from the start.
function settleTool(card,failed){
 if(PREFS.toolCards==='expanded'||(PREFS.toolCards==='auto'&&failed))return;
 card.classList.remove('open');
}
// Apply a changed preference to the cards already on screen.
function applyToolPref(){
 $$('.tool').forEach(c=>{
  const running=!!c.querySelector('.ts .spin'),failed=!!c.querySelector('.ts .bd');
  if(PREFS.toolCards==='expanded')c.classList.add('open');
  else if(PREFS.toolCards==='collapsed'||(!running&&!failed))c.classList.remove('open');
 });
}
function toolsAll(){
 const cards=$$('.tool');if(!cards.length)return;
 const anyOpen=cards.some(c=>c.classList.contains('open'));
 cards.forEach(c=>c.classList.toggle('open',!anyOpen));
 $('#toolsBtn').innerHTML=I(anyOpen?'unfold':'fold');
}

function connectStream(){
 if(chatAbort)return;
 // The backend sends SSE frames (`data: {...}\n\n`); strip the prefix before
 // parsing, and skip blank separator lines — JSON.parse of `data:` throws.
 const ac=chatAbort=new AbortController();
 fetch('/api/chat',{signal:ac.signal}).then(async res=>{
  const stream=res.body;if(!stream)return;
  const reader=stream.getReader();const dec=new TextDecoder();let buf='';
  const frame=d=>{buf+=dec.decode(d,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.trim())continue;const json=line.replace(/^data:\s?/,'').trim();if(!json)continue;let ev;try{ev=JSON.parse(json)}catch{return}onFrame(ev)}};
  try{while(true){const {done,value}=await reader.read();if(done)break;frame(value)}}
  catch(e){if(ac.signal.aborted)return;toast('Stream error: '+(e.message||String(e)),true)}
  finally{if(chatAbort===ac)chatAbort=null}
 }).catch(e=>{if(chatAbort===ac)chatAbort=null;if(!ac.signal.aborted)toast('Stream error: '+(e.message||String(e)),true)});
}

function agentNote(text){
 if(!curCard)return;
 const n=document.createElement('div');n.className='stopnote';n.textContent=text;curCard.msg.mb.append(n);scrollDown();
}
function onFrame(ev){
 const t=ev.type;
 // Track agent liveness beyond the current card: a prompt sent while the
 // agent streams is rejected by pi, so send() must route it as a steer.
 if(t==='agent_start'){S.agentRunning=true;return}
 if(t==='agent_settled'){
  S.agentRunning=false;
  flushRender();
  if(curCard){curCard.tools.forEach(tl=>{if(!tl.done)closeTool(tl,false)});curCard=null;}
  S.busy=false;setBusy();scrollDown(true);
  // The agent may have written or changed test files during the turn.
  refreshTests();refreshSpecs(true);
  return;
 }
 if(!curCard)return;
 // Assistant text arrives as text_delta; thinking_delta and toolcall_delta are
 // other content blocks of the same message and are not shown.
 if(t==='message_update'){
  const a=ev.assistantMessageEvent;
  if(a&&a.type==='text_delta'&&a.delta){
   ensureTextEl();curCard.raw+=a.delta;scheduleRender();
  }
  return;
 }
 // A provider failure (bad key, unknown model, endpoint down) is not an `error`
 // event: it ends the assistant message with stopReason "error".
 if(t==='message_end'){
  const m=ev.message;
  if(m&&m.role==='assistant'&&m.stopReason==='error')agentNote('⚠ model error: '+(m.errorMessage||'unknown'));
  return;
 }
 if(t==='auto_retry_start'){agentNote(`⟳ retrying (${ev.attempt}/${ev.maxAttempts}): ${ev.errorMessage||''}`);return}
 if(t==='tool_execution_start'){
  // Text after a tool call belongs below its card, in a new paragraph.
  flushRender();
  curCard.textEl=null;curCard.raw='';curCard.shown='';
  openTool(ev.toolName||'bash',toolArg(ev.toolName,ev.args),ev.toolCallId);
  return;
 }
 // The agent runs several tool calls at once: pair every event with its card by id.
 if(t==='tool_execution_update'){
  const tl=curCard.tools.get(ev.toolCallId),txt=resultText(ev.partialResult);
  if(tl&&txt)tl.set(txt);
  return;
 }
 if(t==='tool_execution_end'){
  const tl=curCard.tools.get(ev.toolCallId);
  if(tl){closeTool(tl,ev.isError,resultText(ev.result));scrollDown();}
  return;
 }
 if(t==='error'){
  curCard.tools.forEach(tl=>{if(!tl.done)closeTool(tl,true)});
  agentNote('⚠ agent error: '+(ev.error||'unknown'));return;
 }
}
function ensureTextEl(){ if(!curCard.textEl){const p=document.createElement('div');p.className='ptxt';curCard.msg.mb.append(p);curCard.textEl=p;curCard.raw='';curCard.shown=''} }
// Re-render the growing answer at most once per frame: parsing the whole text on
// every token would make long answers sluggish.
let renderQueued=false;
// Draw the pending text now. Also called before anything that ends or moves on from
// the current text block (a tool call, the end of the turn), so its tail is never lost
// to a frame that has not run yet.
function flushRender(){
 if(curCard&&curCard.textEl&&curCard.shown!==curCard.raw){curCard.textEl.innerHTML=md(curCard.raw);curCard.shown=curCard.raw;scrollDown()}
}
function scheduleRender(){
 if(renderQueued)return;renderQueued=true;
 requestAnimationFrame(()=>{renderQueued=false;flushRender()});
}

function chatTitle(){const c=S.chats.find(x=>x.id===S.chatId);return(c&&c.title)||'New chat'}
function emptyState(){
 $('#msgsIn').innerHTML=`<div class="empty"><div class="logo">π</div><h2>What should we test?</h2><p>The agent reads your spec, writes Hurl files and runs them for you.</p>
 <div class="grid"><button data-act="ask" data-q="Cover the uncovered endpoints in {{spec.path}}">Cover uncovered endpoints<small>Find gaps, write tests, run them</small></button><button data-act="ask" data-q="Run the failing tests again and tell me why they fail">Why do tests fail?<small>Re-run and diagnose</small></button><button data-act="ask" data-q="Run the full suite and summarise">Run the full suite<small>hurl --test tests/</small></button><button data-act="ask" data-q="Add negative cases to the existing tests of {{spec.path}}: auth, validation, unknown ids">Add negative cases<small>Auth, validation, unknown IDs</small></button></div></div>`;
 $('#chatTitle').textContent='New chat';
}
async function send(text){
 text=text.trim();if(!text||S.busy)return;
 const emp=$('.empty');if(emp){emp.remove();$('#chatTitle').textContent=text.slice(0,60)}
 S.busy=true;setBusy();addUser(text);
 const msg=newAgentMsg();
 $('#msgsIn').append(msg.el);
 curCard={msg,tools:new Map(),kind:'agent',textEl:null,raw:''};
 // Attach the SSE stream BEFORE the POST: the POST only resolves when the turn
 // ends, so attaching afterwards drops every event of the current turn.
 if(!chatAbort){connectStream();await sleep(80)}
 const post=async(kind)=>{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,message:text})});return r.json().catch(()=>null)};
 // Anything but an explicit success is a rejection: pi refusing the prompt
 // (success:false) and the backend failing to reach pi (error/detail) alike.
 const denied=j=>!j||j.success===false||!!j.error;
 try{
  // pi rejects a plain prompt while the agent streams ("use streamingBehavior");
  // steering is how user messages join a running turn. One retry flips the
  // kind to cover the agent_start/agent_settled race between check and POST.
  let kind=S.agentRunning?'steer':'prompt';
  let j=await post(kind);
  if(denied(j)){kind=kind==='steer'?'prompt':'steer';j=await post(kind)}
  if(denied(j)){toast((j&&(j.detail||j.error))||'Agent rejected the message',true);S.busy=false;setBusy();}
  // On acceptance busy stays lit until agent_settled arrives over SSE.
  refreshChats();
 }catch(e){toast('Agent error: '+(e.message||String(e)),true);S.busy=false;setBusy();}
}
async function abortChat(){
 // Cancel the current run on the backend; the agent and the conversation stay,
 // so the stream is left open and the next message continues the chat.
 try{
  await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'stop'})});
  agentNote('■ stopped');
 }catch(e){toast('Stop failed: '+(e.message||String(e)),true)}
 S.busy=false;setBusy();
}
function setBusy(){const b=$('#sendBtn');b.className='send'+(S.busy?' stop':'');b.innerHTML=I(S.busy?'stop':'send');$('#sugg').style.display=S.busy?'none':'flex'}
const SUGG={'Cover uncovered endpoints':'Cover the uncovered endpoints in {{spec.path}}','Why do tests fail?':'Run the failing tests again and tell me why they fail','Run the full suite':'Run the full suite and summarise','Add negative cases':'Add negative cases to the existing tests of {{spec.path}}: auth, validation, unknown ids'};
function renderSugg(){$('#sugg').innerHTML=['Cover uncovered endpoints','Why do tests fail?','Run the full suite','Add negative cases'].map(s=>`<button class="chip" data-act="ask" data-q="${esc(SUGG[s])}">${esc(s)}</button>`).join('')}
/* ---------- chat list ---------- */
const chatsApi=body=>API('/api/chats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function applyChats(r){S.chats=r.chats||[];S.chatId=r.current||''}
async function refreshChats(){try{applyChats(await API('/api/chats'))}catch(e){console.error('chats failed',e)}}
function renderChatMenu(){
 const m=$('#chatMenu');
 m.innerHTML=`<button class="btn sm cm-new" data-act="newChat">${I('plus')}New chat</button>`+(S.chats.length?S.chats.map(c=>`<div class="cm-row ${c.id===S.chatId?'cur':''}"><button class="cm-main" data-act="chatSwitch" data-id="${esc(c.id)}"><b>${esc(c.title||'New chat')}</b><small>${c.title?ago(c.updatedAt):'empty'}</small></button><button class="cm-ic" data-act="chatRename" data-id="${esc(c.id)}" aria-label="Rename">${I('write')}</button><button class="cm-ic del" data-act="chatDelete" data-id="${esc(c.id)}" aria-label="Delete">${I('trash')}</button></div>`).join(''):'<div class="cm-empty">No chats yet.</div>');
}
function closeChatMenu(){$('#chatMenu').hidden=true}
async function toggleChatMenu(){
 const m=$('#chatMenu');
 if(!m.hidden){closeChatMenu();return}
 await refreshChats();renderChatMenu();m.hidden=false;
}
// Run a chat action on the backend (new/switch/delete drop the agent process,
// whose session is then reopened for the chat that is current afterwards) and redraw.
async function chatAction(action,id){
 if(S.busy&&action!=='rename'&&!confirm('The agent is still working. Stop it and leave this chat?'))return;
 closeChatMenu();
 try{applyChats(await chatsApi({action,id}))}catch(e){toast('Chat action failed: '+(e.message||String(e)),true);return}
 if(chatAbort){chatAbort.abort();chatAbort=null}
 curCard=null;S.busy=false;S.agentRunning=false;setBusy();
 connectStream();
 await initChat();
}
const textOf=c=>(c||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
// Redraw a stored conversation. Consecutive assistant messages and their tool
// calls form one agent block, as they do while streaming. Returns the last
// block, the open tool cards (by call id) and whether it ends mid-turn.
function renderHistory(messages){
 $('#msgsIn').innerHTML='';
 let agent=null;const tools=new Map();
 const note=(mb,t)=>{const n=document.createElement('div');n.className='stopnote';n.textContent=t;mb.append(n)};
 for(const m of messages){
  if(m.role==='user'){agent=null;addUser(textOf(m.content));continue}
  if(m.role==='assistant'){
   agent=agent||newAgentMsg();
   for(const b of m.content){
    if(b.type==='text'&&b.text.trim()){const p=document.createElement('div');p.className='ptxt';p.innerHTML=md(b.text);agent.mb.append(p)}
    else if(b.type==='toolCall'){const t=mkToolCard(agent.mb,b.name,toolArg(b.name,b.arguments));t._t0=0;tools.set(b.id,t)}
   }
   if(m.stopReason==='error')note(agent.mb,'⚠ model error: '+(m.errorMessage||'unknown'));
   continue;
  }
  if(m.role==='toolResult'){const t=tools.get(m.toolCallId);if(t){closeTool(t,m.isError,textOf(m.content))}}
 }
 return{agent,tools};
}
// Restore the conversation from the backend (pi's session on disk) so a reload,
// a restart of the container or a second browser sees the same chat.
async function initChat(){
 let h=null;
 try{h=await API('/api/chat/history')}catch(e){console.error('chat history failed',e)}
 await refreshChats();
 if(!h||!h.messages.length){emptyState();return}
 $('#chatTitle').textContent=chatTitle();
 const {agent,tools}=renderHistory(h.messages);
 scrollDown(true);
 if(h.running){
  // The agent is mid-turn: events that follow over SSE continue the last block.
  S.busy=true;S.agentRunning=true;setBusy();
  const msg=agent||newAgentMsg();
  curCard={msg,tools,kind:'agent',textEl:null,raw:''};
 }
}
const inp=$('#inp');
inp.addEventListener('input',()=>{inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,160)+'px'});
inp.addEventListener('keydown',e=>{
 if(e.key!=='Enter'||e.isComposing)return;
 // 'enter': Enter sends, Shift+Enter breaks the line. 'mod-enter': Ctrl/Cmd+Enter sends, Enter breaks the line.
 const send=PREFS.sendKey==='mod-enter'?(e.ctrlKey||e.metaKey):!e.shiftKey;
 if(send){e.preventDefault();$('#form').requestSubmit()}
});
function updateHint(){
 const h=$('.hint');if(h)h.textContent=(PREFS.sendKey==='mod-enter'?'Ctrl/Cmd+Enter to send · Enter for a new line':'Enter to send · Shift+Enter for a new line')+' · the agent can read, write and run commands in your project';
}
$('#form').addEventListener('submit',e=>{e.preventDefault();if(S.busy)return;const t=inp.value;inp.value='';inp.style.height='auto';send(t)});
// The sendBtn toggles to a stop icon while busy — wire it directly, since it
// carries no data-act and the delegated handler above ignores it.
$('#sendBtn').addEventListener('click',()=>{if(S.busy)abortChat()});

/* ---------- SPEC ---------- */
function pathHTML(p){return esc(p).replace(/\{[^}]+\}/g,x=>`<em>${x}</em>`)}
function renderSpec(){
 computeCov();
 renderSpecPick();
 const sp=S.spec,eps=sp.endpoints,cov=eps.filter(e=>COV.get(e.m+' '+e.p)>0).length,pct=eps.length?Math.round(cov/eps.length*100):0;
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
function renderEps(){
 const q=S.q.toLowerCase();
 const list=S.spec.endpoints.filter(e=>(S.mf==='ALL'||e.m===S.mf)&&(!q||(e.p+' '+e.sum+' '+e.tag).toLowerCase().includes(q)));
 if(!list.length){$('#epList').innerHTML='<div class="empty-s">No endpoints match.</div>';return}
 const tags=[...new Set(list.map(e=>e.tag))];
 $('#epList').innerHTML=tags.map(t=>{const g=list.filter(e=>e.tag===t);return `<div class="tag-h"><span>${esc(t)}</span><span>${g.length}</span></div>`+g.map(e=>{
  const key=e.m+' '+e.p,c=COV.get(key)||0,open=S.openEp.has(key);
  return `<div class="ep ${open?'open':''}"><button class="eph" data-act="ep" data-k="${esc(key)}"><span class="mt m-${e.m}">${e.m}</span><span class="ep-p">${pathHTML(e.p)}</span><span class="ep-s">${esc(e.sum)}</span>${e.auth?`<span class="lock" title="Requires auth">${I('lock')}</span>`:''}<span class="cov ${c?'y':'n'}">${c?c+' test'+(c>1?'s':''):'no tests'}</span><span class="chev">${I('chev')}</span></button>
  <div class="epb"><div class="muted">${esc(e.sum)}</div>
  <div class="row wrap">${e.params.length?e.params.map(p=>{const[a,b]=p.split(':');return `<span class="chip mono">${esc(a)} <span class="dim">${esc(b||'')}</span></span>`}).join(''):'<span class="dim">no parameters</span>'}</div>
  <div class="row wrap">${e.resp.map(r=>`<span class="sc ${'s'+r[0]}">${r}</span>`).join('')}${e.auth?'<span class="chip">bearer auth</span>':''}</div>
  <div class="row"><button class="btn sm primary" data-act="genEp" data-k="${esc(key)}">${I('spark')}Write tests</button></div></div></div>`}).join('')}).join('');
}
/* ---------- specs (parsed by the backend; the agent writes them too) ---------- */
const specStore={get(){try{return localStorage.getItem('pihurl.spec')||''}catch(e){return ''}},set(v){try{localStorage.setItem('pihurl.spec',v)}catch(e){}}};
function pickSpec(path){
 S.spec=S.specs.find(x=>x.path===path)||{...EMPTY_SPEC};
 if(S.spec.path)specStore.set(S.spec.path);
 S.openEp.clear();S.mf='ALL';
}
// Re-read the specs on disk. `fromAgent`: a spec that appeared meanwhile was written
// by the agent, so show it.
async function refreshSpecs(fromAgent){
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
function useSpecHost(){
 const srv=S.spec.server;
 if(!srv||srv===S.host)return;
 S.host=srv;const hi=$('#hostInp');if(hi)hi.value=srv;
 API('/api/hosts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',baseUrl:srv})}).catch(()=>{});
 toast('Target host set to '+srv);
}
function loadFile(file){
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
function askChat(text){go('chat');inp.value=text;inp.focus();inp.dispatchEvent(new Event('input'))}
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
function fillTpl(body){
 computeCov();const u=S.spec.endpoints.find(e=>!COV.get(e.m+' '+e.p))||S.spec.endpoints[0];
 return body.replace(/\{\{endpoint\}\}/g,u?u.m+' '+u.p:'the API').replace(/\{\{spec\.title\}\}/g,S.spec.title||'the spec').replace(/\{\{spec\.path\}\}/g,S.spec.path||'the spec')
  .replace(/\{\{base_url\}\}/g,S.host).replace(/\{\{existing_tests\}\}/g,S.files.map(f=>f.path).join(', ')||'none yet')
  .replace(/\{\{last_report\}\}/g,failuresText(curRun()));
}

/* ---------- PROVIDERS ---------- */
const isActive=p=>p.id===S.active;
function renderProviders(){
 $('#provList').innerHTML=S.providers.map(p=>{let host=p.url;try{host=new URL(p.url).host}catch(e){}
  return `<button class="prov ${S.editId===p.id?'sel':''}" data-act="editProv" data-id="${p.id}"><div class="pv-ic">${esc(p.name[0]||'?')}</div><div class="pv-t"><b>${esc(p.name)} ${isActive(p)?'<span class="badge">active</span>':''}</b><small>${esc(host)} · ${esc(p.model)}</small></div><span class="dot ${p.status==='ok'?'ok':p.status==='bad'?'bad':'off'}"></span></button>`}).join('')||'<div class="note">No providers yet. Add one to start chatting.</div>';
 const p=S.editId==='new'?{id:'new',kind:'custom',name:'',url:'',key:'',model:'',temp:.2}:S.providers.find(x=>x.id===S.editId);
 if(!p){$('#provForm').innerHTML='<div class="empty-s">Select or add a provider.</div>';return}
 const pr=PRESETS[p.kind]||PRESETS.custom;
 $('#provForm').innerHTML=`<div class="row" style="margin-bottom:14px"><h3 style="font-size:15px;flex:1">${p.id==='new'?'New provider':'Edit '+esc(p.name)}</h3>${p.id!=='new'&&!isActive(p)?'<button class="btn sm" data-act="activate">Make active</button>':''}</div>
 <div class="field"><label class="lbl">Preset</label><div class="row wrap">${Object.entries(PRESETS).map(([k,v])=>`<button class="chip ${p.kind===k?'on':''}" data-act="preset" data-k="${k}">${v.name.replace(' (local)','')}</button>`).join('')}</div></div>
 <div class="field"><label class="lbl" for="pf-name">Name</label><input class="inp" id="pf-name" value="${esc(p.name)}" placeholder="My provider"></div>
 <div class="field"><label class="lbl" for="pf-url">Base URL</label><input class="inp mono" id="pf-url" value="${esc(p.url)}" placeholder="https://api.example.com/v1" inputmode="url" autocapitalize="off" spellcheck="false"></div>
 <div class="field"><label class="lbl" for="pf-key">API key ${pr.nokey?'<span class="dim" style="text-transform:none;letter-spacing:0;font-weight:400">· optional for local models</span>':''}</label><div class="keywrap"><input class="inp mono" id="pf-key" type="password" value="" placeholder="${p.key?esc(p.key)+'  (saved)':'sk-…'}" autocomplete="off" style="padding-right:42px"><button type="button" data-act="eye" aria-label="Show key" id="eyeBtn">${I('read')}</button></div></div>
 <div class="field"><label class="lbl" for="pf-model">Model</label><input class="inp mono" id="pf-model" list="models" value="${esc(p.model)}" placeholder="model-id" autocapitalize="off" spellcheck="false"><datalist id="models">${pr.models.map(m=>`<option value="${esc(m)}">`).join('')}</datalist></div>
 <div class="field"><label class="lbl">Temperature <span class="mono" id="tv" style="text-transform:none;color:var(--tx)">${p.temp}</span></label><input type="range" id="pf-temp" min="0" max="1" step=".05" value="${p.temp}"></div>
 <div class="row wrap"><button class="btn" data-act="testProv">${I('bash')}Test connection</button><button class="btn primary" data-act="saveProv">${I('check')}Save</button><span class="spacer"></span>${p.id!=='new'?'<button class="btn danger" data-act="delProv">'+I('trash')+'Remove</button>':''}</div>
 <div class="test-res" id="pf-test"></div>
 <div class="note" style="margin-top:16px">${I('lock')}<span>Keys are stored on this server (in <code>providers.json</code> and the agent's <code>models.json</code>, both in the volume) and are never sent back to the browser after saving.</span></div>`;
 $('#pf-temp').addEventListener('input',e=>$('#tv').textContent=e.target.value);
}
function formVals(){return{name:$('#pf-name').value.trim(),url:$('#pf-url').value.trim(),key:$('#pf-key').value.trim(),model:$('#pf-model').value.trim(),temp:+$('#pf-temp').value}}
// Backend stores providers as {baseUrl,apiKey,temperature}; the UI model uses
// {url,key,temp}. Normalize backend responses into the UI shape so the list and
// editor always read url/key/temp even though the API returns baseUrl/apiKey.
function normProv(p){return{id:p.id,kind:p.kind,name:p.name,url:p.baseUrl||'',key:p.apiKey||'',model:p.model,temp:p.temperature??0,active:!!p.active}}
async function testProv(){
 const v=formVals(),r=$('#pf-test');
 r.className='test-res run';r.innerHTML='<i class="spin"></i><span>Connecting to '+esc(v.url||'…')+'</span>';
 try{
  const res=await API('/api/providers/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:(S._draft&&S._draft.kind)||(S.providers.find(x=>x.id===S.editId)||{}).kind||'custom',baseUrl:v.url,id:S.editId==='new'?undefined:S.editId,apiKey:v.key})});
  if(res.ok){r.className='test-res ok';r.innerHTML=I('check')+`<span>Connected · ${res.ms} ms · ${res.models} model(s) reachable</span>`}
  else{r.className='test-res bad';r.innerHTML=I('x')+'<span>Connection failed: '+esc(res.error||'unknown')+'</span>'}
 }catch(e){r.className='test-res bad';r.innerHTML=I('x')+'<span>Error: '+esc(e.message||String(e))+'</span>'}
}
function renderProvList(){const f=$('#pf-test'),cls=f&&f.className,html=f&&f.innerHTML;renderProviders();const g=$('#pf-test');if(g&&cls){g.className=cls;g.innerHTML=html}}

/* ---------- PROMPTS ---------- */
function renderPrompts(){
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
function updCtx(){
 const t0=S.templates[0];const sys=t0?tokens(t0.body):0,ins=S.instrOn?tokens($('#instr')?$('#instr').value:S.instr):0,spec=60+S.spec.endpoints.length*28,idx=S.files.length*18;
 const tot=sys+ins+spec+idx,budget=8000;
 const seg=[['System prompt',sys,'var(--acc)'],['Project instructions',ins,'var(--vio)'],['Spec summary',spec,'var(--blue)'],['Test index',idx,'var(--pink)']];
 const el=$('#ctxPrev');if(el)el.innerHTML=`<div class="stack">${seg.map(s=>`<i style="width:${s[1]/budget*100}%;background:${s[2]}"></i>`).join('')}</div><div class="lg">${seg.map(s=>`<div><i style="background:${s[2]}"></i><span>${s[0]}</span><span>~${s[1]}</span></div>`).join('')}<div style="border-top:1px solid var(--line);padding-top:7px;margin-top:2px"><span>Total</span><span style="color:var(--tx)">~${tot} / ${budget/1000}k</span></div></div>`;
 const it=$('#instr-tok');if(it)it.textContent='~'+tokens($('#instr').value)+' tokens · '+$('#instr').value.split('\n').length+' lines';
}

/* ---------- SETTINGS ---------- */
const SETTINGS=[
 {k:'toolCards',title:'Tool calls',desc:'How the cards for the agent\'s tool calls (read, write, bash, …) are shown in the chat.',opts:[['auto','Fold when done'],['collapsed','Always folded'],['expanded','Always open']]},
 {k:'sendKey',title:'Send message with',desc:'The key that sends the message from the chat box.',opts:[['enter','Enter'],['mod-enter','Ctrl/Cmd+Enter']]},
];
let INFO=null;
async function renderSettings(){
 const row=d=>`<div class="srow"><div class="min"><b>${esc(d.title)}</b><div class="muted">${d.desc}</div></div><div class="seg">${d.opts.map(([v,l])=>`<button class="${PREFS[d.k]===v?'on':''}" data-act="setPref" data-k="${d.k}" data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`;
 const about=INFO?`<dl class="kv">${[['pihurl',INFO.version||'—'],['Hurl',INFO.hurl],['Node',INFO.node],['Workspace',INFO.workspace],['State',INFO.state],['Log file',INFO.log],['Chat sessions',INFO.sessions]].map(([k,v])=>`<dt>${esc(k)}</dt><dd title="${esc(v)}">${esc(v)}</dd>`).join('')}</dl>`:'<div class="muted">Loading…</div>';
 $('#settingsBody').innerHTML=`<div class="card cp"><h3 style="margin-bottom:6px">Chat</h3>${SETTINGS.map(row).join('')}</div><div class="card cp" style="margin-top:14px"><h3 style="margin-bottom:6px">About this server</h3>${about}</div>`;
 if(!INFO){try{INFO=await API('/api/info');if(S.view==='settings')renderSettings()}catch(e){INFO={version:'',hurl:'unknown',node:'',workspace:'',state:'',log:'',sessions:''};console.error('info failed',e)}}
}

/* ---------- TESTS & REPORTS ---------- */
const isMobile=()=>matchMedia('(max-width:860px)').matches;
// The agent creates and edits test files on the backend; re-read them when it
// finishes a turn and whenever a view that shows them opens.
async function refreshTests(){
 try{
  const t=await API('/api/tests');S.files=t.files.map(f=>({...f}));
  computeCov();refreshProvChips();
  if(S.view==='tests')renderTests();if(S.view==='spec')renderSpec();
 }catch(e){console.error('refreshTests failed',e)}
}
function curRun(){return S.runs.find(r=>r.id===S.runId)||S.runs[0]}
function renderTests(){
 const hi=$('#hostInp');if(hi){if(!S.host)S.host=hi.value.trim();hi.value=S.host||''}
 renderTHead();renderFiles();renderMain();
 const el=$('#tests');el.classList.toggle('files-on',S.tview==='files');
 $$('#tseg button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.tview||(S.tview==='files'&&!isMobile()&&b.dataset.v==='report')));
}
function renderTHead(){
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
// Which spec a run result file belongs to, for the report (files that no longer exist are unassigned).
function specOfPath(path){const g=fileGroups().find(x=>x.files.some(f=>f.path===path));return g?g.specPath:''}
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
function renderMain(){
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
function stats(run){
 let files=run.files.length,pass=0,reqs=0,asOk=0,as=0;
 run.files.forEach(f=>{if(f.status==='pass')pass++;reqs+=f.reqs;f.entries.forEach(e=>{e.asserts.forEach(a=>{as++;if(a.ok)asOk++})})});
 return{files,pass,fail:files-pass,reqs,as,asOk,dur:run.duration||0};
}
const latest=p=>{for(const r of S.runs){const f=r.files.find(x=>x.path===p);if(f)return{run:r,f}}return null};
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

/* ---------- events ---------- */
const A={
 go:t=>go(t.dataset.v),
 toggleTool:t=>t.closest('.tool').classList.toggle('open'),
 ask:t=>{if(S.busy)return;go('chat');send(fillTpl(t.dataset.q))},
 newChat:()=>chatAction('new'),
 chatMenu:()=>toggleChatMenu(),
 chatSwitch:t=>{if(t.dataset.id!==S.chatId)chatAction('switch',t.dataset.id);else closeChatMenu()},
 chatRename:async t=>{
  const c=S.chats.find(x=>x.id===t.dataset.id);const v=prompt('Rename chat',c?c.title:'');
  if(v&&v.trim()){try{applyChats(await chatsApi({action:'rename',id:t.dataset.id,title:v.trim()}));renderChatMenu();if(t.dataset.id===S.chatId)$('#chatTitle').textContent=v.trim().slice(0,60)}catch(e){toast('Rename failed: '+e.message,true)}}
 },
 chatDelete:t=>{
  const c=S.chats.find(x=>x.id===t.dataset.id);
  if(!confirm('Delete chat "'+(c?c.title||'New chat':'')+'"? Its transcript is removed.'))return;
  chatAction('delete',t.dataset.id);
 },
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
 genUncovered:()=>{if(!S.spec.endpoints.length)return toast('Select a spec with endpoints first',true);computeCov();const u=S.spec.endpoints.filter(e=>!COV.get(e.m+' '+e.p));if(!u.length)return toast('Every endpoint already has a test');askChat(`Cover the uncovered endpoints in ${S.spec.path}: `+u.slice(0,4).map(e=>e.m+' '+e.p).join(', '))},

 editProv:t=>{S.editId=t.dataset.id;renderProviders()},
 newProv:()=>{S.editId='new';S._draft=null;go('providers');renderProviders();setTimeout(()=>$('#pf-name')&&$('#pf-name').focus(),50)},
 preset:t=>{const k=t.dataset.k,pr=PRESETS[k],cur=S.editId==='new'?null:S.providers.find(x=>x.id===S.editId);
  const v=formVals();
  if(cur){cur.kind=k}
  const tmp={id:S.editId,kind:k,name:k==='custom'?v.name:pr.name,url:pr.url||v.url,key:cur?cur.key:'',model:pr.models[0]||v.model,temp:v.temp};
  if(cur){Object.assign(cur,{name:tmp.name,url:tmp.url,model:tmp.model,temp:tmp.temp});renderProviders()}else{S._draft=tmp;renderDraft(tmp)}},
 eye:()=>{const i=$('#pf-key'),show=i.type==='password';i.type=show?'text':'password';$('#eyeBtn').innerHTML=I(show?'eyeoff':'read')},
 testProv:()=>testProv(),
 saveProv:async()=>{const v=formVals();if(!v.name||!v.url||!v.model)return toast('Name, URL and model are required',true);
  const cur=S.providers.find(x=>x.id===S.editId);
  try{
   const {providers,saved}=await API('/api/providers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:S.editId==='new'?undefined:S.editId,kind:(S._draft&&S._draft.kind)||(cur&&cur.kind)||'custom',name:v.name,baseUrl:v.url,model:v.model,temperature:v.temp,apiKey:v.key})});
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
  }catch(e){toast('Could not activate provider: '+(e.message||String(e)),true)}},
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
 instrToggle:()=>{S.instrOn=!S.instrOn;S.instr=$('#instr')?$('#instr').value:S.instr;renderPrompts()},
 tview:t=>{S.tview=t.dataset.v;renderTests()},
 selFile:t=>{S.sel=t.dataset.p;if(isMobile())S.tview='report';renderTests();
  const el=$('.rf.hl');if(el&&S.tview==='report')el.scrollIntoView({block:'nearest',behavior:'smooth'})},
 setPref:t=>{setPref(t.dataset.k,t.dataset.v);if(t.dataset.k==='toolCards')applyToolPref();if(t.dataset.k==='sendKey')updateHint();renderSettings()},
 resetPrefs:()=>{Object.keys(PREF_DEFAULTS).forEach(k=>setPref(k,PREF_DEFAULTS[k]));applyToolPref();updateHint();renderSettings();toast('Settings reset')},
 toolsAll:()=>toolsAll(),
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
function renderDraft(d){ // preset click while creating a new provider
 const keep=$('#pf-key').value;S.editId='new';
 const pr=PRESETS[d.kind];
 renderProviders();
 $('#pf-name').value=d.name;$('#pf-url').value=d.url;$('#pf-model').value=d.model;$('#pf-temp').value=d.temp;$('#tv').textContent=d.temp;$('#pf-key').value=keep;
 $$('#provForm [data-act=preset]').forEach(b=>b.classList.toggle('on',b.dataset.k===d.kind));
 $('#models').innerHTML=pr.models.map(m=>`<option value="${esc(m)}">`).join('');
}
document.addEventListener('click',e=>{
 if(!e.target.closest('#chatMenu,#chatsBtn'))closeChatMenu();
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

/* ---------- boot ---------- */
// Load everything real from the backend: providers, spec, test files and run
// history. Nothing is seeded client-side.
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
async function loadPrompts(){
 try{
  const res=await API('/api/prompts');
  S.templates=(res.templates||[]).map(t=>({...t,builtin:!!t.builtin}));
  INSTR=S.instr=res.instructions||'';
 }catch(e){console.error('loadPrompts failed',e)}
}
(function boot(){
 loadState();
 loadPrompts();
 renderChrome();renderSugg();setBusy();updateBadges();updateHint();
 // Open the SSE stream up front so the agent's very first (seeded) turn
 // renders live instead of arriving all at once.
 connectStream();
 initChat();
 const h=(location.hash||'').slice(1);
 go(NAV.some(n=>n[0]===h)?h:'chat');
})();

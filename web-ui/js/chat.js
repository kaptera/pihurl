import {API} from './api.js';
import {$, $$, I, PREFS, S, ago, esc, sleep, toast} from './core.js';
import {md} from './hurl.js';
import {go} from './nav.js';
import {fillTpl} from './prompts.js';
import {refreshSpecs} from './spec.js';
import {refreshTests} from './tests.js';

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
export function applyToolPref(){
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

export function connectStream(){
 if(chatAbort)return;
 // The backend sends SSE frames (`data: {...}\n\n`); strip the prefix before
 // parsing, and skip blank separator lines — JSON.parse of `data:` throws.
 const ac=chatAbort=new AbortController();
 fetch('/api/chat?project='+encodeURIComponent(S.proj),{signal:ac.signal}).then(async res=>{
  const stream=res.body;if(!stream)return;
  const reader=stream.getReader();const dec=new TextDecoder();let buf='';
  const frame=d=>{buf+=dec.decode(d,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.trim())continue;const json=line.replace(/^data:\s?/,'').trim();if(!json)continue;let ev;try{ev=JSON.parse(json)}catch{return}onFrame(ev)}};
  try{while(true){const {done,value}=await reader.read();if(done)break;frame(value)}}
  catch(e){if(ac.signal.aborted)return;toast('Stream error: '+(e.message||String(e)),true)}
  finally{if(chatAbort===ac){chatAbort=null;if(!ac.signal.aborted)setTimeout(connectStream,2000)}}
 }).catch(e=>{if(chatAbort===ac){chatAbort=null;if(!ac.signal.aborted)setTimeout(connectStream,3000)}});
}

function agentNote(text){
 if(!curCard)return;
 const n=document.createElement('div');n.className='stopnote';n.textContent=text;curCard.msg.mb.append(n);scrollDown();
}
// One stream carries the events of every chat of the project, each tagged with its chat id. Events
// of the chat on screen are drawn; for the others only the "working" state is kept (badges).
function ensureCard(){
 if(!curCard&&S.agentRunning){curCard={msg:newAgentMsg(),tools:new Map(),kind:'agent',textEl:null,raw:'',shown:''}}
 return curCard;
}
function onFrame(ev){
 const t=ev.type;
 if(t==='pihurl_running'){S.runningChats=new Set(ev.chats||[]);syncChatBadges();return}
 if(t==='pihurl_busy'){
  if(ev.busy)S.runningChats.add(ev.chat);else S.runningChats.delete(ev.chat);
  syncChatBadges();
  if(!ev.busy&&ev.chat!==S.chatId){const c=S.chats.find(x=>x.id===ev.chat);toast((c?'\u201c'+c.title+'\u201d':'A chat')+' finished');refreshChats()}
  return;
 }
 if(ev.chat&&ev.chat!==S.chatId)return;
 // Track agent liveness beyond the current card: a prompt sent while the
 // agent streams is rejected by pi, so send() must route it as a steer.
 // (Another tab can have started the turn: then this tab is busy too.)
 if(t==='agent_start'){S.agentRunning=true;if(!S.busy){S.busy=true;setBusy()}return}
 // A user message this tab did not type (another tab on the same chat): draw it.
 if(t==='message_end'&&ev.message&&ev.message.role==='user'){
  if(S.echo>0){S.echo--;return}
  const emp=$('.empty');if(emp)emp.remove();
  addUser(textOf(typeof ev.message.content==='string'?[{type:'text',text:ev.message.content}]:ev.message.content));
  curCard=null;
  return;
 }
 if(t==='agent_settled'){
  S.agentRunning=false;S.echo=0;
  flushRender();
  if(curCard){curCard.tools.forEach(tl=>{if(!tl.done)closeTool(tl,false)});curCard=null;}
  S.busy=false;setBusy();scrollDown(true);
  // The agent may have written or changed test files during the turn.
  refreshTests();refreshSpecs(true);
  return;
 }
 if(!ensureCard())return;
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
export async function send(text){
 text=text.trim();if(!text||S.busy)return;
 const emp=$('.empty');if(emp){emp.remove();$('#chatTitle').textContent=text.slice(0,60)}
 S.busy=true;S.echo=1;setBusy();addUser(text);
 const msg=newAgentMsg();
 $('#msgsIn').append(msg.el);
 curCard={msg,tools:new Map(),kind:'agent',textEl:null,raw:''};
 // Attach the SSE stream BEFORE the POST: the POST only resolves when the turn
 // ends, so attaching afterwards drops every event of the current turn.
 if(!chatAbort){connectStream();await sleep(80)}
 const post=async(kind)=>{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat:S.chatId,kind,message:text})});return r.json().catch(()=>null)};
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
  if(denied(j)){toast((j&&(j.detail||j.error))||'Agent rejected the message',true);S.busy=false;S.echo=0;setBusy();}
  // On acceptance busy stays lit until agent_settled arrives over SSE.
  refreshChats();
 }catch(e){toast('Agent error: '+(e.message||String(e)),true);S.busy=false;setBusy();}
}
async function abortChat(){
 // Cancel the current run on the backend; the agent and the conversation stay,
 // so the stream is left open and the next message continues the chat.
 try{
  await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat:S.chatId,kind:'stop'})});
  agentNote('■ stopped');
 }catch(e){toast('Stop failed: '+(e.message||String(e)),true)}
 S.busy=false;setBusy();
}
export function setBusy(){const b=$('#sendBtn');b.className='send'+(S.busy?' stop':'');b.innerHTML=I(S.busy?'stop':'send');$('#sugg').style.display=S.busy?'none':'flex'}
const SUGG={'Cover uncovered endpoints':'Cover the uncovered endpoints in {{spec.path}}','Why do tests fail?':'Run the failing tests again and tell me why they fail','Run the full suite':'Run the full suite and summarise','Add negative cases':'Add negative cases to the existing tests of {{spec.path}}: auth, validation, unknown ids'};
export function renderSugg(){$('#sugg').innerHTML=['Cover uncovered endpoints','Why do tests fail?','Run the full suite','Add negative cases'].map(s=>`<button class="chip" data-act="ask" data-q="${esc(SUGG[s])}">${esc(s)}</button>`).join('')}

/* ---------- chat list ---------- */
// Chats belong to a project and several can work at once; this tab shows one of them (S.chatId,
// remembered per project). The server has no "current chat".
const chatsApi=body=>API('/api/chats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const chatKey=()=>'pihurl.chat.'+S.proj;
function persistChat(){try{sessionStorage.setItem(chatKey(),S.chatId);localStorage.setItem(chatKey(),S.chatId)}catch(e){}}
function applyChats(r){
 S.chats=r.chats||[];
 for(const c of S.chats){if(c.running)S.runningChats.add(c.id)}
 syncChatBadges();
}
async function refreshChats(){try{applyChats(await API('/api/chats'))}catch(e){console.error('chats failed',e)}}
function syncChatBadges(){
 const others=[...S.runningChats].filter(id=>id!==S.chatId).length;
 const b=$('#chatsBtn');if(b)b.classList.toggle('busy-others',others>0);
 let n=$('#chatsBtn .nb');if(others){if(!n){n=document.createElement('span');n.className='nb';b.append(n)}n.textContent=others}else if(n)n.remove();
 if(!$('#chatMenu').hidden)renderChatMenu();
}
function renderChatMenu(){
 const m=$('#chatMenu');
 m.innerHTML=`<button class="btn sm cm-new" data-act="newChat">${I('plus')}New chat</button>`+(S.chats.length?S.chats.map(c=>`<div class="cm-row ${c.id===S.chatId?'cur':''}"><button class="cm-main" data-act="chatSwitch" data-id="${esc(c.id)}"><b>${S.runningChats.has(c.id)?'<i class="spin"></i> ':''}${esc(c.title||'New chat')}</b><small>${S.runningChats.has(c.id)?'working…':(c.title?ago(c.updatedAt):'empty')}</small></button><button class="cm-ic" data-act="chatRename" data-id="${esc(c.id)}" aria-label="Rename">${I('write')}</button><button class="cm-ic del" data-act="chatDelete" data-id="${esc(c.id)}" aria-label="Delete">${I('trash')}</button></div>`).join(''):'<div class="cm-empty">No chats yet.</div>');
}
export function closeChatMenu(){$('#chatMenu').hidden=true}
async function toggleChatMenu(){
 const m=$('#chatMenu');
 if(!m.hidden){closeChatMenu();return}
 await refreshChats();renderChatMenu();m.hidden=false;
}
// What this tab shows when it moves to another chat. The agents of the other chats keep working.
function resetChatView(){curCard=null;S.busy=false;S.agentRunning=false;S.echo=0;setBusy()}
async function chatAction(action,id){
 closeChatMenu();
 try{
  if(action==='new'){
   const r=await chatsApi({action:'new'});S.chatId=r.id;persistChat();applyChats(r);resetChatView();emptyState();syncChatBadges();return;
  }
  if(action==='switch'){S.chatId=id;persistChat();resetChatView();await initChat();return}
  if(action==='delete'){
   const r=await chatsApi({action:'delete',id});applyChats(r);S.runningChats.delete(id);
   if(id===S.chatId){
    const next=S.chats[0];
    if(next){S.chatId=next.id;persistChat();resetChatView();await initChat()}
    else await chatAction('new');
   }
  }
 }catch(e){toast('Chat action failed: '+(e.message||String(e)),true)}
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
export async function initChat(){
 await refreshChats();
 if(!S.chatId){
  // the chat this tab had in this project, else the newest one, else a fresh one
  let saved='';try{saved=sessionStorage.getItem(chatKey())||localStorage.getItem(chatKey())||''}catch(e){}
  S.chatId=S.chats.some(c=>c.id===saved)?saved:(S.chats[0]?S.chats[0].id:'');
  if(!S.chatId){const r=await chatsApi({action:'new'});S.chatId=r.id}
  persistChat();
 }
 const id=S.chatId;
 let h=null;
 try{h=await API('/api/chat/history?chat='+encodeURIComponent(id))}catch(e){toast(e.message||'Could not open the chat',true)}
 if(S.chatId!==id)return; // the user moved to another chat while this one loaded
 if(!h||!h.messages.length){emptyState();if(h&&h.running){S.busy=true;S.agentRunning=true;setBusy()}return}
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
export function updateHint(){
 const h=$('.hint');if(h)h.textContent=(PREFS.sendKey==='mod-enter'?'Ctrl/Cmd+Enter to send · Enter for a new line':'Enter to send · Shift+Enter for a new line')+' · the agent can read, write and run commands in your project';
}
$('#form').addEventListener('submit',e=>{e.preventDefault();if(S.busy)return;const t=inp.value;inp.value='';inp.style.height='auto';send(t)});
// The sendBtn toggles to a stop icon while busy — wire it directly, since it
// carries no data-act and the delegated handler above ignores it.
$('#sendBtn').addEventListener('click',()=>{if(S.busy)abortChat()});

export function askChat(text){go('chat');inp.value=text;inp.focus();inp.dispatchEvent(new Event('input'))}

export const actions={
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
 toolsAll:()=>toolsAll()
};

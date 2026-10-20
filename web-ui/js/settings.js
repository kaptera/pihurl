import {API, rawFetch} from './api.js';
import {applyToolPref, updateHint} from './chat.js';
import {$, PREFS, PREF_DEFAULTS, S, esc, setPref, toast} from './core.js';

/* ---------- SETTINGS ---------- */
const SETTINGS=[
 {k:'toolCards',title:'Tool calls',desc:'How the cards for the agent\'s tool calls (read, write, bash, …) are shown in the chat.',opts:[['auto','Fold when done'],['collapsed','Always folded'],['expanded','Always open']]},
 {k:'sendKey',title:'Send message with',desc:'The key that sends the message from the chat box.',opts:[['enter','Enter'],['mod-enter','Ctrl/Cmd+Enter']]},
];
let INFO=null;
export async function renderSettings(){
 const row=d=>`<div class="srow"><div class="min"><b>${esc(d.title)}</b><div class="muted">${d.desc}</div></div><div class="seg">${d.opts.map(([v,l])=>`<button class="${PREFS[d.k]===v?'on':''}" data-act="setPref" data-k="${d.k}" data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`;
 const about=INFO?`<dl class="kv">${[['pihurl',INFO.version||'—'],['Hurl',INFO.hurl],['Node',INFO.node],['Workspace',INFO.workspace],['State',INFO.state],['Log file',INFO.log],['Project',INFO.project],['Chat sessions',INFO.sessions],['Chats at once','up to '+INFO.agentsMax],['Access token',INFO.auth?'required':'off (local use only)'],['Agent runs as',INFO.agentIsolated?'an unprivileged user':'the same user as the server']].map(([k,v])=>`<dt>${esc(k)}</dt><dd title="${esc(v)}">${esc(v)}</dd>`).join('')}</dl>`:'<div class="muted">Loading…</div>';
 $('#settingsBody').innerHTML=`<div class="card cp"><h3 style="margin-bottom:6px">Chat</h3>${SETTINGS.map(row).join('')}</div>${S.authOn?`<div class="card cp" style="margin-top:14px"><div class="srow"><div class="min"><b>Session</b><div class="muted">You are signed in with the access token. Signing out asks for it again.</div></div><button class="btn sm" data-act="signOut">Sign out</button></div></div>`:''}<div class="card cp" style="margin-top:14px"><h3 style="margin-bottom:6px">About this server</h3>${about}</div>`;
 if(!INFO){try{INFO=await API('/api/info');if(S.view==='settings')renderSettings()}catch(e){INFO={version:'',hurl:'unknown',node:'',workspace:'',state:'',log:'',sessions:''};console.error('info failed',e)}}
}

export const actions={
 setPref:t=>{setPref(t.dataset.k,t.dataset.v);if(t.dataset.k==='toolCards')applyToolPref();if(t.dataset.k==='sendKey')updateHint();renderSettings()},
 resetPrefs:()=>{Object.keys(PREF_DEFAULTS).forEach(k=>setPref(k,PREF_DEFAULTS[k]));applyToolPref();updateHint();renderSettings();toast('Settings reset')},
 signOut:async()=>{try{await rawFetch('/api/session',{method:'DELETE'})}finally{location.reload()}}
};

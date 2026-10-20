export const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
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
export const I=(n,c='')=>`<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
export const fmtMs=ms=>ms>=1000?(ms/1000).toFixed(2)+' s':Math.round(ms)+' ms';
export const ago=t=>{const s=(Date.now()-t)/1000;if(s<45)return'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';return Math.round(s/86400)+' d ago'};
let toastT;
export function toast(msg,err){const t=$('#toast');t.className='toast'+(err?' err':'');t.innerHTML=I(err?'x':'check')+'<span>'+esc(msg)+'</span>';requestAnimationFrame(()=>t.classList.add('show'));clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600)}
export const tokens=s=>Math.ceil((s||'').length/4);

/* ---------- preferences (per browser) ---------- */
export const PREF_DEFAULTS={toolCards:'auto',sendKey:'enter'};
export const PREFS=(()=>{let p={};try{p=JSON.parse(localStorage.getItem('pihurl.prefs')||'{}')}catch(e){}return{...PREF_DEFAULTS,...p}})();
export function setPref(k,v){PREFS[k]=v;try{localStorage.setItem('pihurl.prefs',JSON.stringify(PREFS))}catch(e){}}

// The project this tab works on: the one it had before, else the default.
function storedProject(){try{return sessionStorage.getItem('pihurl.project')||localStorage.getItem('pihurl.project')||'default'}catch(e){return 'default'}}
export const EMPTY_SPEC={path:'',name:'',title:'',version:'',server:'',size:'',updated:'',endpoints:[]};
/* ---------- state ---------- */
export const S={
 view:'chat',authOn:false,proj:storedProject(),cov:new Map(),
 spec:{...EMPTY_SPEC},specs:[],specsLoaded:false,
 q:'',mf:'ALL',openEp:new Set(),
 files:[],runs:[],runId:null,sel:null,checked:new Set(),tview:'report',running:null,open:new Map(),rfilter:'all',host:'',
 providers:[],
 active:null,editId:'new',
 templates:[],tpl:'',ptab:'templates',instr:'',instrOn:true,
 busy:false,
 chats:[],chatId:'',collapsed:new Set(),projects:[],runningChats:new Set(),echo:0
};

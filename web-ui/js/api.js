import {$, S} from './core.js';

// With PIHURL_TOKEN set the server answers 401 until the browser has signed in; any 401 after
// that (the cookie expired, the token was changed) sends the page back to the sign-in screen.

// The project this tab works on (several tabs can work on different projects). The server learns it
// from a header on every API call, and from ?project= on the event stream.

export function rememberProject(id){S.proj=id;try{sessionStorage.setItem('pihurl.project',id);localStorage.setItem('pihurl.project',id)}catch(e){}}
export const rawFetch=window.fetch.bind(window);
window.fetch=async(url,init={})=>{
 const api=typeof url==='string'&&url.startsWith('/api/');
 if(api){const h=new Headers(init.headers||{});if(!h.has('X-Pihurl-Project'))h.set('X-Pihurl-Project',S.proj);init={...init,headers:h}}
 const r=await rawFetch(url,init);
 if(r.status===401&&S.authOn)location.reload();
 // the project was deleted elsewhere: fall back to the default one
 if(api&&r.status===404)r.clone().json().then(j=>{if(j&&j.error==='unknown_project'){rememberProject('default');location.reload()}}).catch(()=>{});
 return r;
};
export function signIn(){
 return new Promise(resolve=>{
  const box=$('#login'),form=$('#loginForm'),inp=$('#loginToken'),err=$('#loginErr');
  box.hidden=false;inp.focus();
  form.onsubmit=async e=>{
   e.preventDefault();err.textContent='';
   try{
    const r=await rawFetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:inp.value})});
    const j=await r.json().catch(()=>({}));
    if(r.ok){box.hidden=true;inp.value='';resolve();return}
    err.textContent=j.detail||'Could not sign in';
   }catch(x){err.textContent='Server not reachable'}
   inp.select();
  };
 });
}

/* ---------- backend API ---------- */
// Every screen here talks to the Node backend; nothing is simulated client-side.
export async function api(path, opts){
 const res=await fetch(path,{headers:opts?.headers||{},...opts});
 const ct=res.headers.get('content-type')||'';
 const body=/json/.test(ct)?await res.json().catch(()=>null):await res.text().catch(()=>null);
 if(!res.ok){throw new Error((body&&body.detail)||(body&&body.error)||res.statusText)}
 return body;
}
export const API=async(path,opts)=>api(path,{...opts});

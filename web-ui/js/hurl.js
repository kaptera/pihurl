import {S, esc} from './core.js';

// Agent text is Markdown (markdown.js). Code blocks get the same highlighting as the Source view.
export const md=t=>renderMarkdown(t,{highlight:(lang,code)=>{
 if(/^(hurl|http)$/.test(lang))return code.split('\n').map(l=>hlLine(l)||' ').join('\n');
 if(lang==='json')return tok(esc(code));
 return null;
}});

/* ---------- Hurl syntax highlighting ---------- */
export function tok(e){
 return e.replace(/(&quot;(?:(?!&quot;).)*&quot;)(\s*:)?|(\{\{\w+\}\})|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b|\b(exists|is[A-Z]\w+|count|contains|startsWith|endsWith|matches|includes)\b/g,
 (m,s,colon,v,n,k,f)=>{
  if(s!==undefined){const c=colon?'c-key':'c-str';return `<span class="${c}">`+s.replace(/\{\{\w+\}\}/g,x=>`</span><span class="c-var">${x}</span><span class="${c}">`)+'</span>'+(colon||'')}
  if(v)return `<span class="c-var">${v}</span>`;
  if(n)return `<span class="c-num">${n}</span>`;
  if(k)return `<span class="c-kw2">${k}</span>`;
  return `<span class="c-fn">${f}</span>`;
 });
}
export function hlLine(l){
 let m;
 if(/^\s*#/.test(l))return `<span class="c-cm">${esc(l)}</span>`;
 if(/^\[\w+\]\s*$/.test(l))return `<span class="c-sec">${esc(l)}</span>`;
 if((m=l.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(\s+)(.*)$/)))return `<span class="c-m">${m[1]}</span>${m[2]}`+esc(m[3]).replace(/\{\{\w+\}\}/g,x=>`<span class="c-var">${x}</span>`);
 if((m=l.match(/^(HTTP)(\s+)(\S+)(.*)$/)))return `<span class="c-m">HTTP</span>${m[2]}<span class="c-num">${esc(m[3])}</span>${esc(m[4])}`;
 if((m=l.match(/^(jsonpath|header|duration|status|body|xpath)\b(.*)$/)))return `<span class="c-kw">${m[1]}</span>`+tok(esc(m[2]));
 if((m=l.match(/^([A-Za-z][\w-]*)(:\s*)(.*)$/)))return `<span class="c-hk">${esc(m[1])}</span>${m[2]}`+tok(esc(m[3]));
 return tok(esc(l));
}
export const codeBlock=src=>`<div class="code">${src.split('\n').map((l,i)=>`<div class="cl"><span class="ln">${i+1}</span><span class="lc">${hlLine(l)||' '}</span></div>`).join('')}</div>`;
export const jsonHL=o=>tok(esc(typeof o==='string'?o:JSON.stringify(o,null,2)));

/* ---------- Hurl source parsing (endpoint coverage, Source view) ---------- */
export function parseHurl(src){
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
export function computeCov(){
 S.cov=new Map();
 const ents=S.files.flatMap(f=>parseHurl(f.src));
 S.spec.endpoints.forEach(ep=>{
  const re=new RegExp('^'+ep.p.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{[^}]+\}/g,'[^/]+')+'$');
  S.cov.set(ep.m+' '+ep.p,ents.filter(e=>e.method===ep.m&&re.test(e.url.replace('{{host}}','').split('?')[0])).length);
 });
}

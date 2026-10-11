const FALLBACK_ORIGIN = "https://supabase-phi-brown.vercel.app";
export const BRAND = "https://layrgolf.andmellow.jp";
export const SITE_NAME = "全国ゴルフ場検索 powered by LAYR GOLF";
export const AREA_NAMES = "北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split(" ");
export const AREA_SLUGS = "hokkaido aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma saitama chiba tokyo kanagawa niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi mie shiga kyoto osaka hyogo nara wakayama tottori shimane okayama hiroshima yamaguchi tokushima kagawa ehime kochi fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa".split(" ");
export function areaLink(name) { const n=AREA_NAMES.indexOf(name); return n>=0 ? "/prefecture/"+AREA_SLUGS[n] : "/courses"; }
export function areaFromSlug(slug) { const n=AREA_SLUGS.indexOf(slug); return n>=0 ? AREA_NAMES[n] : null; }
export function origin() { try { const u=new URL(process.env.SITE_URL||FALLBACK_ORIGIN); return u.protocol==="https:" ? u.origin : FALLBACK_ORIGIN; } catch { return FALLBACK_ORIGIN; } }
export function escapeHTML(value) { return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
export function plain(value) { return String(value??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(); }
export function yen(value) { return Number(value)>0 ? "¥"+Number(value).toLocaleString("ja-JP") : "要確認"; }
export function safeUrl(value) { try { const u=new URL(value); return u.protocol==="https:"&&!u.username&&!u.password ? u.href : ""; } catch { return ""; } }
export function goraLink(value) { const u=safeUrl(value); if(!u)return ""; const h=new URL(u).hostname; return h==="rakuten.co.jp"||h.endsWith(".rakuten.co.jp")||h.endsWith(".rakuten.ne.jp") ? u : ""; }
export function courseImages(c) { return [...new Set([1,2,3,4,5].map(n=>safeUrl(c["image_url_"+n])).filter(Boolean))]; }
export function validId(id) { return /^\d{1,12}$/.test(String(id||"")); }
export function dateISO(value) { if(!value)return ""; const n=Date.parse(value); return Number.isFinite(n)&&n<=Date.now()+86400000 ? new Date(n).toISOString().slice(0,10) : ""; }
export function jsonScript(value) { return JSON.stringify(value).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029"); }

function config() {
  const base=process.env.COURSE_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.COURSE_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
  if(!base||!key)throw new Error("Database is not configured");
  const u=new URL(base);
  if(u.protocol!=="https:"||u.search||u.hash||u.username||u.password||!u.hostname.endsWith(".supabase.co"))throw new Error("Invalid public database origin");
  return {url:u.origin,key};
}
export async function queryPublic(table,params={},count=false) {
  if(!["courses","seasonal_guides","affiliate_slots"].includes(table))throw new Error("Invalid table");
  const {url,key}=config();
  const u=new URL("/rest/v1/"+table,url);
  for(const [k,v] of Object.entries(params))if(v!=null)u.searchParams.set(k,String(v));
  const headers={apikey:key,Accept:"application/json"};
  if(!key.startsWith("sb_publishable_"))headers.Authorization="Bearer "+key;
  if(count)headers.Prefer="count=exact";
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),12000);
  try{
    const r=await fetch(u.href,{headers,signal:abort.signal});
    if(!r.ok)throw new Error("Database HTTP "+r.status);
    const rows=await r.json();
    if(!Array.isArray(rows))throw new Error("Malformed database response");
    const total=Number((r.headers.get("content-range")||"").split("/")[1]);
    return {rows,total:Number.isFinite(total)?total:null};
  }finally{clearTimeout(timer);}
}
export async function courseById(id) {
  if(!validId(id))return null;
  const c=await queryPublic("courses",{select:"*",gora_course_id:"eq."+id,active:"eq.true",detail_ready:"eq.true",limit:1});
  if(!c.rows.length)return null;
  const extra=await Promise.allSettled([
    queryPublic("seasonal_guides",{select:"*",gora_course_id:"eq."+id}),
    queryPublic("affiliate_slots",{select:"*",gora_course_id:"eq."+id})
  ]);
  return {course:c.rows[0],seasons:extra[0].status==="fulfilled"?extra[0].value.rows:[],ads:extra[1].status==="fulfilled"?extra[1].value.rows:[]};
}
const PUBLIC_FIELDS="gora_course_id,prefecture,course_name,course_caption,image_url_1,weekday_min_price_yen,holiday_min_price_yen,hole_count,evaluation,review_count,dress_code_raw,editorial_feature_summary,fetched_at,record_updated_at";
export async function courseListing(pref="",page=1,limit=24) {
  const q={select:PUBLIC_FIELDS,active:"eq.true",detail_ready:"eq.true",order:"evaluation.desc.nullslast,gora_course_id.asc",limit,offset:(page-1)*limit};
  if(pref)q.prefecture="eq."+pref;
  return queryPublic("courses",q,true);
}
export async function sitemapCourses() {
  const fields="gora_course_id,prefecture,fetched_at,image_url_1";
  let offset=0,all=[];
  for(let i=0;i<20;i++){
    const r=await queryPublic("courses",{select:fields,active:"eq.true",detail_ready:"eq.true",order:"gora_course_id.asc",limit:500,offset},true);
    all.push(...r.rows);offset+=r.rows.length;
    if((r.total!==null&&offset>=r.total)||(r.total===null&&r.rows.length<500))break;
    if(!r.rows.length)throw new Error("Incomplete public course list");
  }
  if(new Set(all.map(r=>String(r.gora_course_id))).size!==all.length)throw new Error("Duplicate IDs");
  return all;
}

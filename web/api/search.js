import {searchCourses,parseQuery,evaluateCourse} from "../lib/course-matcher.js";
export {parseQuery,evaluateCourse};
export function filterCourse(course,parsed){
 return evaluateCourse(course,parsed)!==null;
}
let cache=null,expires=0,pending=null;
async function loadCourses(){
 if(cache&&Date.now()<expires)return cache;
 if(pending)return pending;
 pending=(async()=>{
  const base=process.env.COURSE_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.COURSE_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
  if(!base||!key)throw new Error("Database not configured");
  const u=new URL(base);
  if(u.protocol!=="https:"||!u.hostname.endsWith(".supabase.co"))throw new Error("Invalid database URL");
  const rows=[],headers={apikey:key,Accept:"application/json"};
  if(!key.startsWith("sb_publishable_"))headers.Authorization="Bearer "+key;
  for(let i=0;i<20;i++){
   const start=rows.length;
   const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
   try{
    const r=await fetch(u.origin+"/rest/v1/course_catalog_public?select=*",{
     headers:{...headers,Range:String(start)+"-"+String(start+499)},signal:c.signal
    });
    if(!r.ok)throw new Error("Catalog HTTP "+r.status);
    const batch=await r.json();
    if(!Array.isArray(batch))throw new Error("Invalid catalog page");
    rows.push(...batch);
    if(batch.length<500)break;
   }finally{clearTimeout(timer);}
   if(i===19)throw new Error("Catalog too large");
  }
  if(!rows.length)throw new Error("Empty catalog");
  if(new Set(rows.map(x=>String(x.gora_course_id))).size!==rows.length)throw new Error("Duplicate catalog page");
  cache=rows;expires=Date.now()+60000;
  return rows;
 })().finally(()=>{pending=null});
 return pending;
}
export default async function handler(req,res){
 res.setHeader("X-Robots-Tag","noindex");
 if(req.method&&req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"method_not_allowed"});}
 try{
  const u=new URL(req.url,"https://local.invalid");
  const q=u.searchParams.get("q")||"";
  if(q.length>500)return res.status(400).json({error:"query_too_long"});
  const result=searchCourses(await loadCourses(),u.searchParams);
  res.setHeader("Cache-Control","public, s-maxage=30, stale-while-revalidate=60");
  return res.status(200).json(result);
 }catch(e){
  console.error("Course search failed:",e.name);
  res.setHeader("Cache-Control","no-store");
  return res.status(503).json({error:"search_unavailable",message:"検索結果を読み込めません。少し待ってお試しください。"});
 }
}

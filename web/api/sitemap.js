import {AREA_NAMES,areaLink,origin,escapeHTML as e,validId,dateISO,sitemapCourses,safeUrl} from "../lib/site-server.js";
export function buildSitemap(rows){
 const base=origin(),n=new Map(),items=[];
 const add=(path,date="",image="")=>{
   const imageTag=image?"<image:image><image:loc>"+e(image)+"</image:loc></image:image>":"";
   items.push("<url><loc>"+e(base+path)+"</loc>"+(date?"<lastmod>"+e(date)+"</lastmod>":"")+imageTag+"</url>");
 };
 add("/");add("/courses");add("/guide");
 for(const r of rows)n.set(r.prefecture,(n.get(r.prefecture)||0)+1);
 for(const name of AREA_NAMES){
   const count=n.get(name)||0;
   if(!count)continue;
   add(areaLink(name));
   for(let p=2;p<=Math.ceil(count/24);p++)add(areaLink(name)+"?page="+p);
 }
 for(let p=2;p<=Math.ceil(rows.length/24);p++)add("/courses?page="+p);
 for(const r of rows)if(validId(r.gora_course_id))add("/course/"+r.gora_course_id,dateISO(r.fetched_at),safeUrl(r.image_url_1));
 return "<?xml version='1.0' encoding='UTF-8'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9' xmlns:image='http://www.google.com/schemas/sitemap-image/1.1'>"+items.join("")+"</urlset>";
}
export default async function handler(req,res){
 res.setHeader("Content-Type","application/xml; charset=utf-8");
 if(process.env.VERCEL_ENV==="preview"){res.setHeader("X-Robots-Tag","noindex");return res.status(404).send("");}
 try{
  const rows=await sitemapCourses();
  if(!rows.length)throw new Error("No courses");
  res.setHeader("Cache-Control","public, max-age=0, s-maxage=3600, stale-while-revalidate=3600");
  return res.status(200).send(buildSitemap(rows));
 }catch(err){
  console.error("Sitemap temporarily unavailable:",err.name);
  res.setHeader("Retry-After","300");
  res.setHeader("Cache-Control","no-store");
  return res.status(503).send("<?xml version='1.0' encoding='UTF-8'?><error>Temporarily unavailable</error>");
 }
}

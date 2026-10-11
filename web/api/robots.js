import {origin} from "../lib/site-server.js";
export default function handler(req,res){
 res.setHeader("Content-Type","text/plain; charset=utf-8");
 res.setHeader("Cache-Control","public, max-age=0, s-maxage=3600");
 if(process.env.VERCEL_ENV==="preview")return res.status(200).send("User-agent: *\nDisallow: /\n");
 return res.status(200).send("User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: "+origin()+"/sitemap.xml\n");
}

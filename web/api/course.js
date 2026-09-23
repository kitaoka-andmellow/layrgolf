function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}
async function sb(path) {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY is not configured");
  const r = await fetch(`${base}/rest/v1/${path}`, {headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}
export default async function handler(req,res) {
  try {
    const url = new URL(req.url, "https://local.invalid");
    const id = (url.searchParams.get("id") || "").replace(/[^0-9]/g, "");
    if (!id) return res.status(400).json({error:"invalid_id"});
    const [courses,seasons,ads] = await Promise.all([
      sb(`courses?select=*&gora_course_id=eq.${id}&active=eq.true&limit=1`),
      sb(`seasonal_guides?select=*&gora_course_id=eq.${id}&order=season.asc`),
      sb(`affiliate_slots?select=*&gora_course_id=eq.${id}`)
    ]);
    if (!courses.length) return res.status(404).json({error:"not_found"});
    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json({course:courses[0],seasons,ads});
  } catch (e) {
    res.status(500).json({error:"course_failed",message:e.message});
  }
}

export default async function handler(req,res) {
  const url = process.env.COURSE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.COURSE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const configured = Boolean(url && key);
  res.status(configured ? 200 : 503).json({
    ok: configured,
    service: "course-code-web",
    source: process.env.COURSE_SUPABASE_URL ? "course_override" : "integration_default",
    time: new Date().toISOString()
  });
}

export default async function handler(req,res) {
  const configured = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY));
  res.status(configured ? 200 : 503).json({ok:configured, service:"course-code-web", time:new Date().toISOString()});
}

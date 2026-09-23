const PREFS = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];
const REGION_MAP = {
  "北海道":["北海道"],
  "東北":["青森県","岩手県","宮城県","秋田県","山形県","福島県"],
  "関東":["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"],
  "甲信越":["新潟県","山梨県","長野県"],
  "北陸":["富山県","石川県","福井県"],
  "東海":["岐阜県","静岡県","愛知県","三重県"],
  "関西":["滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"],
  "近畿":["滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"],
  "中国":["鳥取県","島根県","岡山県","広島県","山口県"],
  "四国":["徳島県","香川県","愛媛県","高知県"],
  "九州":["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県"],
  "沖縄":["沖縄県"]
};

const ORIGIN_MAP = {
  "大阪":["大阪府","兵庫県","京都府","奈良県","滋賀県","和歌山県"],
  "東京":["東京都","神奈川県","千葉県","埼玉県","茨城県"],
  "名古屋":["愛知県","岐阜県","三重県","滋賀県"],
  "福岡":["福岡県","佐賀県","大分県","熊本県"],
  "札幌":["北海道"],
  "仙台":["宮城県","福島県","山形県"],
  "広島":["広島県","山口県","岡山県"],
};
const COOL_SUMMER = new Set(["北海道","青森県","岩手県","秋田県","山形県","新潟県","長野県","宮城県","福島県","栃木県","群馬県","山梨県","富山県","石川県","福井県","岐阜県"]);

let CACHE = { rows: null, expires: 0 };
const CACHE_MS = 10 * 60 * 1000;

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

async function fetchAllCourses() {
  if (CACHE.rows && CACHE.expires > Date.now()) return CACHE.rows;
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY is not configured");
  const rows = [];
  const page = 1000;
  for (let start = 0; ; start += page) {
    const r = await fetch(`${base}/rest/v1/course_catalog_public?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${start}-${start + page - 1}` }
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < page) break;
  }
  CACHE = { rows, expires: Date.now() + CACHE_MS };
  return rows;
}

function yenFromQuery(q) {
  let m = q.match(/([0-9]+(?:\.[0-9]+)?)\s*万\s*円?\s*(?:以下|以内|まで)/);
  if (m) return Math.round(parseFloat(m[1]) * 10000);
  m = q.match(/([0-9]{4,6})\s*円\s*(?:以下|以内|まで)/);
  return m ? parseInt(m[1], 10) : null;
}

export function parseQuery(raw) {
  const q = (raw || "").normalize("NFKC").trim();
  const parsed = { raw: q, prefectures: [], tags: [], budget: yenFromQuery(q), terms: [] };
  if (/土日|休日|週末/.test(q)) parsed.priceMode = "holiday";
  else if (/平日/.test(q)) parsed.priceMode = "weekday";
  else parsed.priceMode = "weekday";

  for (const p of PREFS) {
    const short = p.replace(/[都道府県]$/, "");
    if (q.includes(p) || (short.length >= 2 && q.includes(short))) parsed.prefectures.push(p);
  }
  for (const [name, list] of Object.entries(REGION_MAP)) {
    if (q.includes(name)) parsed.prefectures.push(...list);
  }
  // Pseudo travel-radius search. It intentionally does not claim actual drive time.
  for (const [origin, list] of Object.entries(ORIGIN_MAP)) {
    const m = q.match(new RegExp(`${origin}から[^\n]{0,16}?([0-9]+(?:\.[0-9]+)?)\s*時間`));
    if (m) {
      parsed.originApprox = `${origin}起点・約${m[1]}時間`;
      parsed.prefectures.push(...list);
    }
  }
  parsed.prefectures = [...new Set(parsed.prefectures)];

  if (/初心者|やさしい|優しい|ビギナー/.test(q)) parsed.maxDifficulty = 54;
  if (/戦略的|テクニカル/.test(q)) parsed.minDifficulty = 55;
  if (/難しい|難関|チャレンジ/.test(q)) parsed.minDifficulty = Math.max(parsed.minDifficulty || 0, 70);
  if (/ジャケット(?:不要|なし|無し)|上着(?:不要|なし)/.test(q)) parsed.jacketRequired = false;
  if (/ジャケット(?:必須|必要)|上着(?:必須|必要)/.test(q)) parsed.jacketRequired = true;
  if (/フォーマル|格式|厳格/.test(q)) parsed.dressLevel = "FORMAL";
  if (/カジュアル|気軽|服装ゆる/.test(q)) parsed.dressLevel = "RELAXED";
  if (/デニム(?:禁止|不可|NG)|ジーンズ(?:禁止|不可|NG)/i.test(q)) parsed.denimBanned = true;
  if (/サンダル(?:禁止|不可|NG)/i.test(q)) parsed.sandalsBanned = true;
  if (/夏.*(?:涼しい|涼しめ)|避暑|高原/.test(q)) parsed.coolSummer = true;

  const evalMatch = q.match(/(?:評価|口コミ)\s*([0-5](?:\.[0-9])?)\s*(?:以上|超)/);
  if (evalMatch) parsed.minEvaluation = parseFloat(evalMatch[1]);
  const holesMatch = q.match(/([0-9]{1,2})\s*ホール\s*(?:以上|超)/);
  if (holesMatch) parsed.minHoles = parseInt(holesMatch[1], 10);

  const stop = new Set(["ゴルフ","ゴルフ場","コース","から","以内","以下","まで","おすすめ","探して","行きたい","春","夏","秋","冬","円","万円"]);
  parsed.terms = q.split(/[\s、,。・/]+/).map(x => x.trim()).filter(x => x.length >= 2 && !stop.has(x));
  return parsed;
}

function number(v) { return v == null || v === "" ? null : Number(v); }

function scoreCourse(c, p) {
  let score = 0;
  const text = [c.course_name,c.course_name_abbr,c.course_caption,c.address,c.editorial_nickname,c.editorial_feature_summary,c.course_type,c.highway].filter(Boolean).join(" ").toLowerCase();
  for (const term of p.terms) if (text.includes(term.toLowerCase())) score += 9;
  if (p.prefectures.includes(c.prefecture)) score += 12;
  if (p.budget && number(c.weekday_min_price_yen) && number(c.weekday_min_price_yen) <= p.budget) score += 6;
  if (c.evaluation) score += Math.min(10, Number(c.evaluation) * 1.5);
  if (c.review_count) score += Math.min(5, Math.log10(Number(c.review_count) + 1));
  return score;
}

export function filterCourse(c, p) {
  if (p.prefectures.length && !p.prefectures.includes(c.prefecture)) return false;
  if (p.budget) {
    const price = p.priceMode === "holiday"
      ? (number(c.holiday_min_price_yen) ?? number(c.weekday_min_price_yen))
      : (number(c.weekday_min_price_yen) ?? number(c.holiday_min_price_yen));
    if (!price || price > p.budget) return false;
  }
  const diff = number(c.difficulty_index);
  if (p.maxDifficulty != null && diff != null && diff > p.maxDifficulty) return false;
  if (p.minDifficulty != null && diff != null && diff < p.minDifficulty) return false;
  if (p.jacketRequired !== undefined && Boolean(c.jacket_required) !== p.jacketRequired) return false;
  if (p.dressLevel && c.dress_level !== p.dressLevel) return false;
  if (p.denimBanned && !c.denim_banned) return false;
  if (p.sandalsBanned && !c.sandals_banned) return false;
  if (p.coolSummer && !COOL_SUMMER.has(c.prefecture)) return false;
  if (p.minEvaluation != null && number(c.evaluation) != null && number(c.evaluation) < p.minEvaluation) return false;
  if (p.minHoles != null && number(c.hole_count) != null && number(c.hole_count) < p.minHoles) return false;
  return true;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "https://local.invalid");
    const q = url.searchParams.get("q") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(48, Math.max(6, parseInt(url.searchParams.get("limit") || "24", 10)));
    const parsed = parseQuery(q);
    const all = await fetchAllCourses();
    const filtered = all.filter(c => filterCourse(c, parsed));
    filtered.sort((a,b) => {
      const d = scoreCourse(b, parsed) - scoreCourse(a, parsed);
      if (d) return d;
      return (Number(b.evaluation)||0) - (Number(a.evaluation)||0);
    });
    const start = (page - 1) * limit;
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({
      query: q,
      parsed,
      total: filtered.length,
      page,
      limit,
      items: filtered.slice(start, start + limit)
    });
  } catch (e) {
    res.status(500).json({ error: "search_failed", message: e.message });
  }
}

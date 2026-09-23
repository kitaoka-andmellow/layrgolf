const $ = s => document.querySelector(s);
const results = $("#results");
const form = $("#searchForm");
const query = $("#query");
const count = $("#resultCount");
const title = $("#resultTitle");
const filters = $("#activeFilters");
const pager = $("#pager");
let currentPage = 1;

function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function yen(v){return v?`¥${Number(v).toLocaleString("ja-JP")}`:"—"}
function img(c){return c.image_url_1 || "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="100%" height="100%" fill="#e9e9e5"/><text x="50%" y="50%" text-anchor="middle" fill="#888" font-family="sans-serif" font-size="22">COURSE CODE</text></svg>')}

function card(c){
  return `<a class="course-card" href="/course/${c.gora_course_id}">
    <div class="course-thumb"><img loading="lazy" src="${esc(img(c))}" alt="${esc(c.course_name)}"><span class="dress-badge">${esc(c.dress_level||"DRESS N/A")}</span></div>
    <div class="course-body">
      <div class="course-pref">${esc(c.prefecture)} / ${esc(c.course_type||"GOLF COURSE")}</div>
      <h3>${esc(c.course_name)}</h3>
      <div class="nickname">${esc(c.editorial_nickname||"")}</div>
      <div class="stats">
        <div class="stat"><small>WEEKDAY</small><b>${yen(c.weekday_min_price_yen)}</b></div>
        <div class="stat"><small>HOLES</small><b>${c.hole_count??"—"}</b></div>
        <div class="stat"><small>DIFFICULTY</small><b>${esc(c.difficulty_label||"—")}</b></div>
      </div>
    </div>
  </a>`;
}
function chips(p){
  const xs=[];
  if(p.originApprox) xs.push(`${p.originApprox}（概算）`);
  else if(p.prefectures?.length) xs.push(p.prefectures.join(" / "));
  if(p.budget) xs.push(`${p.priceMode==='holiday'?'休日':'平日'} ${yen(p.budget)}以下`);
  if(p.maxDifficulty!=null) xs.push("初心者向け難易度");
  if(p.minDifficulty>=70) xs.push("難関"); else if(p.minDifficulty) xs.push("戦略的");
  if(p.jacketRequired===false) xs.push("JACKET FREE");
  if(p.jacketRequired===true) xs.push("JACKET REQUIRED");
  if(p.dressLevel) xs.push(p.dressLevel);
  if(p.coolSummer) xs.push("COOL SUMMER");
  filters.innerHTML=xs.map(x=>`<span class="filter-chip">${esc(x)}</span>`).join("");
}
function renderPager(total, limit, page){
  const pages=Math.ceil(total/limit); if(pages<=1){pager.innerHTML="";return}
  const btn=[]; for(let p=Math.max(1,page-2);p<=Math.min(pages,page+2);p++) btn.push(`<button data-page="${p}" class="${p===page?'current':''}">${p}</button>`);
  pager.innerHTML=btn.join("");
  pager.querySelectorAll("button").forEach(b=>b.onclick=()=>load(Number(b.dataset.page)));
}
async function load(page=1){
  currentPage=page; results.innerHTML='<div class="loading">Searching courses…</div>'; pager.innerHTML="";
  const q=query.value.trim();
  const r=await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=24`);
  const data=await r.json();
  if(!r.ok){results.innerHTML=`<div class="empty">検索APIエラー: ${esc(data.message||data.error)}</div>`;return}
  count.textContent=`${data.total.toLocaleString("ja-JP")} COURSES`;
  title.textContent=q?`「${q}」の検索結果`:"全国のゴルフ場";
  chips(data.parsed);
  results.innerHTML=data.items.length?data.items.map(card).join(""):'<div class="empty">条件に合うコースがありません。条件を少し緩めて検索してください。</div>';
  renderPager(data.total,data.limit,data.page);
  if(page>1) document.querySelector('.catalog').scrollIntoView({behavior:'smooth'});
}
form.addEventListener("submit",e=>{e.preventDefault();load(1)});
document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{query.value=b.dataset.q;load(1)}));
load();

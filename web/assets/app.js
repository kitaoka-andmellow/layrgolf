const $ = s => document.querySelector(s);
const results = $("#results");
const form = $("#searchForm");
const query = $("#query");
const prefSelect = $("#prefectureSelect");
const sortSelect = $("#sortSelect");
const regionGroups = $("#regionGroups");
const count = $("#resultCount");
const title = $("#resultTitle");
const filters = $("#activeFilters");
const pager = $("#pager");
let currentPage = 1;

const REGIONS = {
  "北海道":["北海道"],
  "東北":["青森県","岩手県","宮城県","秋田県","山形県","福島県"],
  "関東":["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"],
  "甲信越":["新潟県","山梨県","長野県"],
  "北陸":["富山県","石川県","福井県"],
  "東海":["岐阜県","静岡県","愛知県","三重県"],
  "関西":["滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"],
  "中国":["鳥取県","島根県","岡山県","広島県","山口県"],
  "四国":["徳島県","香川県","愛媛県","高知県"],
  "九州":["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県"],
  "沖縄":["沖縄県"]
};

function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function yen(v){return v?`¥${Number(v).toLocaleString("ja-JP")}`:"—"}
function img(c){return c.image_url_1 || "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="100%" height="100%" fill="#e9e9e5"/><text x="50%" y="50%" text-anchor="middle" fill="#888" font-family="sans-serif" font-size="22">全国ゴルフ場検索 powered by LAYR GOLF</text></svg>')}

function card(c){
  const difficulty = esc(c.difficulty_label||"STANDARD");
  return `<a class="course-card" href="/course/${c.gora_course_id}">
    <div class="course-thumb"><img loading="lazy" src="${esc(img(c))}" alt="${esc(c.course_name)}"><div class="course-overlay"></div><span class="dress-badge">${esc(c.dress_level||"DRESS N/A")}</span><span class="course-level">${difficulty}</span></div>
    <div class="course-body">
      <div class="course-pref">${esc(c.prefecture)} / ${esc(c.course_type||"GOLF COURSE")}</div>
      <h3>${esc(c.course_name)}</h3>
      <div class="nickname">${esc(c.editorial_nickname||"")}</div>
      <div class="stats">
        <div class="stat"><small>RATING</small><b>${c.evaluation?`★ ${Number(c.evaluation).toFixed(1)}`:"—"}</b></div>
        <div class="stat"><small>WEEKDAY</small><b>${yen(c.weekday_min_price_yen)}</b></div>
        <div class="stat"><small>HOLES</small><b>${c.hole_count??"—"}</b></div>
      </div><div class="card-cta"><span>COURSE DETAIL</span><b>↗</b></div>
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
function buildPrefectureUI(facets={}){
  const prefs=Object.values(REGIONS).flat();
  if(prefSelect.options.length===1){
    prefs.forEach(p=>{
      const o=document.createElement("option");
      o.value=p;
      o.textContent=p;
      prefSelect.appendChild(o);
    });
  }
  regionGroups.innerHTML=Object.entries(REGIONS).map(([region,list])=>{
    const buttons=list.map(p=>{
      const short=p.replace(/[都道府県]$/,"");
      const active=prefSelect.value===p?" active":"";
      return '<button type="button" class="pref-button'+active+'" data-pref="'+esc(p)+'"><span>'+esc(short)+'</span><small>'+Number(facets[p]||0).toLocaleString("ja-JP")+'</small></button>';
    }).join("");
    return '<div class="region-group"><div class="region-name">'+esc(region)+'</div><div class="pref-buttons">'+buttons+'</div></div>';
  }).join("");
  regionGroups.querySelectorAll("[data-pref]").forEach(b=>b.addEventListener("click",()=>{
    prefSelect.value=b.dataset.pref;
    load(1,true);
  }));
}

function syncUrl(page){
  const u=new URL(location.href);
  const q=query.value.trim();
  const pref=prefSelect.value;
  const sort=sortSelect.value;
  q?u.searchParams.set("q",q):u.searchParams.delete("q");
  pref?u.searchParams.set("prefecture",pref):u.searchParams.delete("prefecture");
  sort!=="recommended"?u.searchParams.set("sort",sort):u.searchParams.delete("sort");
  page>1?u.searchParams.set("page",String(page)):u.searchParams.delete("page");
  history.replaceState(null,"",u);
}

function renderPager(total, limit, page){
  const pages=Math.ceil(total/limit); if(pages<=1){pager.innerHTML="";return}
  const btn=[]; for(let p=Math.max(1,page-2);p<=Math.min(pages,page+2);p++) btn.push(`<button data-page="${p}" class="${p===page?'current':''}">${p}</button>`);
  pager.innerHTML=btn.join("");
  pager.querySelectorAll("button").forEach(b=>b.onclick=()=>load(Number(b.dataset.page),true));
}
async function load(page=1, updateUrl=false){
  currentPage=page; results.innerHTML='<div class="loading">ゴルフ場を検索しています…</div>'; pager.innerHTML="";
  const q=query.value.trim();
  const pref=prefSelect.value;
  const sort=sortSelect.value;
  const params=new URLSearchParams({q,page:String(page),limit:"24",sort});
  if(pref) params.set("prefecture",pref);
  const r=await fetch("/api/search?"+params.toString());
  const data=await r.json();
  if(!r.ok){results.innerHTML=`<div class="empty">検索APIエラー: ${esc(data.message||data.error)}</div>`;return}
  if(updateUrl) syncUrl(page);
  buildPrefectureUI(data.facets?.prefectures||{});
  const heroCount=$("#heroCourseCount"); if(heroCount && data.totalCourses) heroCount.textContent=data.totalCourses.toLocaleString("ja-JP");
  count.innerHTML='<strong>'+data.total.toLocaleString("ja-JP")+'</strong><span>件</span>';
  title.textContent=pref?(pref+"のゴルフ場"):q?(`「${q}」の検索結果`):"全国のゴルフ場";
  chips(data.parsed);
  results.innerHTML=data.items.length?data.items.map(card).join(""):'<div class="empty"><b>条件に一致するゴルフ場がありません</b><p>都道府県やキーワードを少し緩めて検索してください。</p><button id="resetEmpty" class="reset-button">条件をリセット</button></div>';
  const reset=$("#resetEmpty");
  if(reset) reset.onclick=()=>{query.value="";prefSelect.value="";sortSelect.value="recommended";load(1,true)};
  renderPager(data.total,data.limit,data.page);
  if(page>1) document.querySelector('.catalog').scrollIntoView({behavior:'smooth'});
}
form.addEventListener("submit",e=>{e.preventDefault();load(1,true)});
prefSelect.addEventListener("change",()=>load(1,true));
sortSelect.addEventListener("change",()=>load(1,true));
$("#clearPrefecture").addEventListener("click",()=>{prefSelect.value="";load(1,true)});
document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{query.value=b.dataset.q;load(1,true)}));

const initial=new URL(location.href);
query.value=initial.searchParams.get("q")||"";
sortSelect.value=initial.searchParams.get("sort")||"recommended";
const initialPref=initial.searchParams.get("prefecture")||"";
const initialPage=Math.max(1,Number(initial.searchParams.get("page")||1));
load(initialPage,false).then(()=>{
  if(initialPref){prefSelect.value=initialPref;load(initialPage,false)}
});

const $ = s => document.querySelector(s);
const results = $("#results");
const form = $("#searchForm");
const query = $("#query");
const sortSelect = $("#sortSelect");
const count = $("#resultCount");
const title = $("#resultTitle");
const filters = $("#activeFilters");
const pager = $("#pager");
let currentPage = 1;
let expanded = false;
let lastData = null;

function esc(s=""){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function yen(v){return Number(v)>0?`¥${Number(v).toLocaleString("ja-JP")}`:"要確認"}
function idOf(c){return String(c.gora_course_id||"").replace(/\D/g,"").slice(0,12)}
function clean(s=""){return String(s||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
function image(c){return c.image_url_1||c.image_url_2||""}

function dress(c){
  const raw=clean(c.dress_code_raw);
  if(raw) return {label:"服装ルールあり",detail:raw};
  return {label:"服装は要確認",detail:"掲載情報では服装指定を確認できません。服装自由を意味しません。"};
}
function reason(c,data){
  const p=data?.parsed||{};
  const xs=[];
  if(p.prefectures?.includes(c.prefecture)) xs.push(c.prefecture);
  if(p.budget){
    const v=p.priceMode==="holiday"?c.holiday_min_price_yen:c.weekday_min_price_yen;
    if(Number(v)>0&&Number(v)<=p.budget) xs.push(`${p.priceMode==="holiday"?"土日祝":"平日"} ${yen(v)}〜`);
  }
  if(p.maxDifficulty!=null&&c.difficulty_label) xs.push(`難易度 ${c.difficulty_label}`);
  if(p.minEvaluation!=null&&Number(c.evaluation)>=p.minEvaluation) xs.push(`評価 ★${Number(c.evaluation).toFixed(1)}`);
  if(!xs.length){
    const caption=clean(c.editorial_feature_summary||c.course_caption);
    if(caption) xs.push(caption.slice(0,48)+(caption.length>48?"…":""));
  }
  return xs.join(" / ");
}
function row(c,index,data){
  const src=image(c), d=dress(c);
  return `<article class="course-row">
    <a class="row-photo" href="/course/${idOf(c)}">
      ${src?`<img src="${esc(src)}" alt="${esc(c.course_name)}" loading="lazy">`:'<div class="row-photo-empty">NO IMAGE</div>'}
      <span class="row-index">${String(index+1+(currentPage-1)*24).padStart(2,"0")}</span>
    </a>
    <div class="row-main">
      <div class="row-meta">${esc(c.prefecture)}${c.course_type?` · ${esc(c.course_type)}`:""}</div>
      <h3><a href="/course/${idOf(c)}">${esc(c.course_name)}</a></h3>
      <p class="row-reason">${esc(reason(c,data)||"コース詳細から特徴を確認できます。")}</p>
      <div class="row-data">
        <span><small>評価</small><b>${Number(c.evaluation)>0?Number(c.evaluation).toFixed(1):"—"}</b></span>
        <span><small>平日</small><b>${yen(c.weekday_min_price_yen)}</b></span>
        <span><small>土日祝</small><b>${yen(c.holiday_min_price_yen)}</b></span>
        <span><small>ホール</small><b>${esc(c.hole_count||"—")}</b></span>
      </div>
      <p class="row-dress ${d.label==="服装は要確認"?"unconfirmed":""}">${esc(d.label)}</p>
    </div>
    <a class="row-open" href="/course/${idOf(c)}" aria-label="${esc(c.course_name)}の詳細を見る">詳細を見る <span>→</span></a>
  </article>`;
}
function chips(p={}){
  const xs=[];
  if(p.prefectures?.length) xs.push(...p.prefectures.slice(0,4));
  if(p.budget) xs.push(`${p.priceMode==="holiday"?"土日祝":"平日"} ${yen(p.budget)}以内`);
  if(p.maxDifficulty!=null) xs.push("初心者向け");
  if(p.minDifficulty>=70) xs.push("難関");
  else if(p.minDifficulty) xs.push("戦略的");
  if(p.jacketRequired===false) xs.push("ジャケット不要");
  if(p.jacketRequired===true) xs.push("ジャケット必須");
  if(p.coolSummer) xs.push("夏涼しい");
  if(p.minEvaluation!=null) xs.push(`評価${p.minEvaluation}以上`);
  return xs.join(" / ");
}
function syncUrl(){
  const u=new URL(location.href);
  const q=query.value.trim();
  q?u.searchParams.set("q",q):u.searchParams.delete("q");
  sortSelect.value!=="recommended"?u.searchParams.set("sort",sortSelect.value):u.searchParams.delete("sort");
  currentPage>1?u.searchParams.set("page",String(currentPage)):u.searchParams.delete("page");
  history.replaceState(null,"",u);
}
function renderPager(total,limit,page){
  const pages=Math.ceil(total/limit);
  if(!expanded||pages<=1){pager.innerHTML="";return}
  pager.innerHTML=`<button data-page="${page-1}" ${page<=1?"disabled":""}>← 前へ</button><span>${page} / ${pages}</span><button data-page="${page+1}" ${page>=pages?"disabled":""}>次へ →</button>`;
}
function render(data){
  lastData=data;
  const searched=Boolean(query.value.trim());
  const visible=expanded?data.items:data.items.slice(0,searched?5:8);
  results.innerHTML=visible.length?visible.map((c,i)=>row(c,i,data)).join(""):'<div class="empty"><h3>候補が見つかりませんでした。</h3><p>地域や予算を少し広げて、文章を書き直してみてください。</p></div>';
  title.textContent=searched?"この条件で選ぶ。":"ゴルフ場を選ぶ。";
  $("#resultEyebrow").textContent=searched?"SEARCH RESULT":"COURSE LIST";
  count.textContent=`${data.total.toLocaleString("ja-JP")}件`;
  filters.textContent=chips(data.parsed);
  $("#moreArea").hidden=expanded||data.items.length<=visible.length;
  renderPager(data.total,data.limit,data.page);
}
async function load(page=1,scroll=false){
  currentPage=page;
  results.innerHTML='<div class="loading">ゴルフ場を探しています…</div>';
  pager.innerHTML="";
  const params=new URLSearchParams({q:query.value.trim(),page:String(page),limit:"24",sort:sortSelect.value});
  try{
    const r=await fetch("/api/search?"+params.toString());
    const data=await r.json();
    if(!r.ok) throw new Error(data.message||"search");
    syncUrl();render(data);
    if(scroll)$("#catalog").scrollIntoView({behavior:"smooth",block:"start"});
  }catch{
    results.innerHTML='<div class="empty"><h3>読み込みに失敗しました。</h3><p>少し待って、もう一度お試しください。</p></div>';
    count.textContent="";
  }
}
form.addEventListener("submit",e=>{e.preventDefault();expanded=false;load(1,true)});
sortSelect.addEventListener("change",()=>{expanded=true;load(1,false)});
$("#showAll").addEventListener("click",()=>{expanded=true;if(lastData)render(lastData)});
document.addEventListener("click",e=>{
  const p=e.target.closest("[data-page]");
  if(p&&!p.disabled) load(Number(p.dataset.page),true);
});
const initial=new URL(location.href);
query.value=initial.searchParams.get("q")||"";
sortSelect.value=initial.searchParams.get("sort")||"recommended";
currentPage=Math.max(1,Number(initial.searchParams.get("page")||1));
expanded=currentPage>1;
load(currentPage,false);

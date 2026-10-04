const $ = s => document.querySelector(s);
const results = $("#results");
const form = $("#searchForm");
const query = $("#query");
const sortSelect = $("#sortSelect");
const count = $("#resultCount");
const title = $("#resultTitle");
const filters = $("#activeFilters");
const pager = $("#pager");
const dialog = $("#compareDialog");
const STORAGE = "layr-shortlist-v2";
let currentPage = 1;
let expanded = false;
let lastData = null;
let heroSet = false;
let shortlist = [];

function esc(s=""){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function yen(v){return Number(v)>0?`¥${Number(v).toLocaleString("ja-JP")}`:"要確認"}
function img(c){return c.image_url_1 || ""}
function idOf(c){return String(c.gora_course_id||"").replace(/\D/g,"").slice(0,12)}
function safeText(s=""){return String(s||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
function icon(name){
  const map={
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    bookmark:'<path d="M6 3h12v19l-6-4-6 4Z"/>',
    shirt:'<path d="m8 3-5 3-2 6 5 2v7h12v-7l5-2-2-6-5-3-4 4Z"/>'
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${map[name]||map.pin}</svg>`;
}
function dressLabel(c){
  const raw=safeText(c.dress_code_raw);
  return raw?{known:true,label:"服装ルールあり",raw}:{known:false,label:"服装は要確認",raw:""};
}
function loadSaved(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE)||"[]");
    if(Array.isArray(raw)) shortlist=raw.filter(x=>idOf(x)).slice(0,3);
  }catch{}
}
function persist(){
  try{localStorage.setItem(STORAGE,JSON.stringify(shortlist))}catch{}
  $("#savedCount").textContent=String(shortlist.length);
  $("#compareTray").hidden=!shortlist.length;
  $("#trayNames").innerHTML=shortlist.map(c=>`<button type="button" data-remove="${idOf(c)}" title="${esc(c.course_name)}">${esc(c.course_name)} <span>×</span></button>`).join("");
  document.querySelectorAll("[data-save]").forEach(b=>{
    const on=shortlist.some(c=>idOf(c)===b.dataset.save);
    b.classList.toggle("selected",on);
    b.setAttribute("aria-pressed",String(on));
    b.innerHTML=icon("bookmark")+(on?"候補に追加済み":"候補に残す");
  });
}
function toggleSave(c){
  const id=idOf(c);
  const has=shortlist.some(x=>idOf(x)===id);
  if(has) shortlist=shortlist.filter(x=>idOf(x)!==id);
  else if(shortlist.length<3) shortlist.push(c);
  else {
    showToast("比較する候補は3つまでです。");
    return;
  }
  persist();
}
function showToast(text){
  const t=$("#toast"); t.textContent=text; t.classList.add("visible");
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>t.classList.remove("visible"),2600);
}
function reasons(c,data){
  const out=[];
  const p=data?.parsed||{};
  if(p.prefectures?.includes(c.prefecture)) out.push(`${c.prefecture}のコース`);
  if(p.budget){
    const v=p.priceMode==="holiday"?c.holiday_min_price_yen:c.weekday_min_price_yen;
    if(Number(v)>0&&Number(v)<=p.budget) out.push(`${p.priceMode==="holiday"?"土日祝":"平日"} ${yen(v)}〜`);
  }
  if(p.maxDifficulty!=null&&c.difficulty_label) out.push(`難易度：${c.difficulty_label}`);
  if(p.minEvaluation!=null&&Number(c.evaluation)>=p.minEvaluation) out.push(`評価 ★ ${Number(c.evaluation).toFixed(1)}`);
  const caption=safeText(c.editorial_feature_summary||c.course_caption);
  if(!out.length&&caption) out.push(caption.slice(0,70)+(caption.length>70?"…":""));
  if(out.length<2&&Number(c.evaluation)>0) out.push(`総合評価 ★ ${Number(c.evaluation).toFixed(1)}`);
  return out.slice(0,3);
}
function card(c,index,data){
  const src=img(c), dr=dressLabel(c), rs=reasons(c,data);
  return `<article class="course-card">
    <a class="course-thumb ${src?"":"image-missing"}" href="/course/${idOf(c)}">
      ${src?`<img src="${esc(src)}" alt="${esc(c.course_name)}" loading="lazy">`:"<span class=\"photo-placeholder\">写真は準備中です</span>"}
      <span class="course-place">${icon("pin")}${esc(c.prefecture)}</span>
      <span class="course-number">${String(index+1+(currentPage-1)*24).padStart(2,"0")}</span>
    </a>
    <div class="course-body">
      <p class="course-type">${esc(c.course_type||"")}${c.hole_count?` · ${esc(c.hole_count)}ホール`:""}</p>
      <h3><a href="/course/${idOf(c)}">${esc(c.course_name)}</a></h3>
      <p class="course-caption">${esc(rs[0]||"詳細情報からコースの特徴を確認できます。")}</p>
      <ul class="match-reasons">${rs.slice(1).map(x=>`<li>✓ ${esc(x)}</li>`).join("")}</ul>
      <div class="card-price">
        <div><small>平日</small><strong>${yen(c.weekday_min_price_yen)}${Number(c.weekday_min_price_yen)>0?"<small>〜</small>":""}</strong></div>
        <div><small>土日祝</small><strong>${yen(c.holiday_min_price_yen)}${Number(c.holiday_min_price_yen)>0?"<small>〜</small>":""}</strong></div>
        <span class="rating">${Number(c.evaluation)>0?`★ ${Number(c.evaluation).toFixed(1)}`:"評価なし"}</span>
      </div>
      <p class="dress-line ${dr.known?"":"unconfirmed"}">${icon("shirt")}${dr.label}</p>
      <div class="card-actions">
        <a class="detail-link" href="/course/${idOf(c)}">雰囲気と服装を見る <span>↗</span></a>
        <button type="button" data-save="${idOf(c)}" aria-pressed="false">${icon("bookmark")}候補に残す</button>
      </div>
    </div>
  </article>`;
}
function syncUrl(){
  const u=new URL(location.href);
  const q=query.value.trim();
  q?u.searchParams.set("q",q):u.searchParams.delete("q");
  sortSelect.value!=="recommended"?u.searchParams.set("sort",sortSelect.value):u.searchParams.delete("sort");
  currentPage>1?u.searchParams.set("page",String(currentPage)):u.searchParams.delete("page");
  u.searchParams.delete("courses");
  history.replaceState(null,"",u);
}
function renderPager(total,limit,page){
  const pages=Math.ceil(total/limit);
  if(!expanded||pages<=1){pager.innerHTML="";return}
  pager.innerHTML=`<button data-page="${page-1}" ${page<=1?"disabled":""}>← 前へ</button><span>${page} / ${pages}</span><button data-page="${page+1}" ${page>=pages?"disabled":""}>次へ →</button>`;
}
function setHero(data){
  if(heroSet)return;
  const c=data.items.find(x=>img(x));
  if(!c)return;
  heroSet=true;
  const im=$("#heroImage"), cap=$("#heroCaption");
  im.onload=()=>{im.hidden=false;cap.hidden=false;cap.textContent=`${c.prefecture} · ${c.course_name}`};
  im.onerror=()=>{im.hidden=true;cap.hidden=true};
  im.alt=c.course_name; im.src=img(c);
}
function render(data){
  lastData=data;
  const searched=Boolean(query.value.trim());
  const visible=expanded?data.items:data.items.slice(0,searched?3:6);
  results.innerHTML=visible.length?visible.map((c,i)=>card(c,i,data)).join(""):`<div class="empty"><h3>その希望に合う候補が見つかりませんでした。</h3><p>地域や予算の条件を少し広げてみてください。</p><button type="button" id="editEmpty" class="secondary-button">希望を書き直す</button></div>`;
  title.textContent=!data.total?"希望を、少し変えてみる。":searched?(expanded?"ほかの候補も、見てみる。":data.total<3?`見つかった${data.total}コース。`:"まずは、この3コースから。"):"次の一日を見つける。";
  $("#resultEyebrow").textContent=searched?"写真と、希望に合う理由。":"写真から、気になるコースへ。";
  count.textContent=`候補 ${data.total.toLocaleString("ja-JP")}件`;
  filters.innerHTML=chips(data.parsed);
  $("#brief").hidden=!searched;
  $("#searchNotes").hidden=true;
  $("#moreArea").hidden=expanded||data.items.length<=visible.length;
  $("#showAll").textContent=`ほかの候補も見る（全${data.total.toLocaleString("ja-JP")}件）`;
  renderPager(data.total,data.limit,data.page);
  persist(); setHero(data);
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
  return xs.map(x=>`<span>${esc(x)}</span>`).join("");
}
async function load(page=1,scroll=false){
  currentPage=page;
  results.innerHTML='<div class="loading">ゴルフ場を探しています…</div>';
  pager.innerHTML="";
  const q=query.value.trim();
  const params=new URLSearchParams({q,page:String(page),limit:"24",sort:sortSelect.value});
  try{
    const r=await fetch("/api/search?"+params.toString());
    const data=await r.json();
    if(!r.ok)throw new Error(data.message||"search");
    syncUrl(); render(data);
    if(scroll)$("#catalog").scrollIntoView({behavior:"smooth",block:"start"});
  }catch{
    results.innerHTML='<div class="empty"><h3>読み込みができませんでした。</h3><p>入力した希望は残っています。</p><button id="retrySearch" class="primary-button" type="button">もう一度探す</button></div>';
    count.textContent="";
  }
}
function compare(){
  $("#compareBody").innerHTML=shortlist.length?`<div class="comparison-grid" style="--cols:${shortlist.length}">${shortlist.map(c=>{
    const dr=dressLabel(c),src=img(c);
    return `<article><div class="compare-image">${src?`<img src="${esc(src)}" alt="">`:""}</div><p class="eyebrow">${esc(c.prefecture)}</p><h3>${esc(c.course_name)}</h3><dl><dt>平日 / 土日祝</dt><dd>${yen(c.weekday_min_price_yen)} / ${yen(c.holiday_min_price_yen)}</dd><dt>評価 / ホール</dt><dd>${Number(c.evaluation)>0?Number(c.evaluation).toFixed(1):"—"} / ${esc(c.hole_count||"—")}</dd><dt>服装・来場時の注意</dt><dd>${esc(dr.raw||"掲載情報では服装指定を確認できません。服装自由を意味しません。")}</dd></dl><a class="secondary-button" href="/course/${idOf(c)}">詳細・予約先を見る ↗</a><button class="text-button" type="button" data-remove="${idOf(c)}">候補から外す</button></article>`;
  }).join("")}</div>`:'<div class="empty"><h3>気になるコースを3つまで。</h3><p>「候補に残す」を押すと、ここで比較できます。</p></div>';
  $("#shareButton").disabled=!shortlist.length;
  if(!dialog.open)dialog.showModal();
}
async function share(){
  const u=new URL("/",location.origin);
  u.searchParams.set("courses",shortlist.map(idOf).join(","));
  try{
    if(navigator.share) await navigator.share({title:"次のゴルフ、どこにする？",text:"気になるコースを選びました。",url:u.href});
    else {await navigator.clipboard.writeText(u.href);showToast("共有リンクをコピーしました。")}
  }catch{}
}
async function loadShared(){
  const ids=(new URLSearchParams(location.search).get("courses")||"").split(",").filter(x=>/^\d{1,12}$/.test(x)).slice(0,3);
  if(!ids.length)return;
  const xs=await Promise.all(ids.map(async id=>{try{const r=await fetch(`/api/course?id=${id}`);if(!r.ok)return null;return (await r.json()).course}catch{return null}}));
  shortlist=xs.filter(Boolean);persist();if(shortlist.length)compare();
}
form.addEventListener("submit",e=>{e.preventDefault();expanded=false;load(1,true)});
query.addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();form.requestSubmit()}});
sortSelect.addEventListener("change",()=>{expanded=true;load(1,false)});
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{query.value=b.dataset.prompt;query.focus()}));
$("#clearQuery").onclick=()=>{query.focus();query.scrollIntoView({behavior:"smooth",block:"center"})};
$("#showAll").onclick=()=>{expanded=true;if(lastData)render(lastData)};
$("#openSaved").onclick=compare; $("#compareButton").onclick=compare; $("#closeCompare").onclick=()=>dialog.close(); $("#shareButton").onclick=share;
document.addEventListener("click",e=>{
  const s=e.target.closest("[data-save]");
  if(s&&lastData){const c=lastData.items.find(x=>idOf(x)===s.dataset.save);if(c)toggleSave(c);return}
  const rm=e.target.closest("[data-remove]");
  if(rm){shortlist=shortlist.filter(x=>idOf(x)!==rm.dataset.remove);persist();if(dialog.open)compare();return}
  const p=e.target.closest("[data-page]");
  if(p&&!p.disabled){load(Number(p.dataset.page),true);return}
  if(e.target.closest("#editEmpty"))query.focus();
  if(e.target.closest("#retrySearch"))load(currentPage,false);
});
loadSaved();
const initial=new URL(location.href);
query.value=initial.searchParams.get("q")||"";
sortSelect.value=initial.searchParams.get("sort")||"recommended";
currentPage=Math.max(1,Number(initial.searchParams.get("page")||1));
expanded=currentPage>1;
persist();
loadShared();
load(currentPage,false);

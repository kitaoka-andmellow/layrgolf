import {AREA_NAMES,AREA_SLUGS,BRAND,SITE_NAME,areaFromSlug,areaLink,origin,escapeHTML as e,plain,yen,safeUrl,goraLink,courseImages,validId,dateISO,jsonScript,queryPublic,courseById,courseListing} from "../lib/site-server.js";
import {parseJapaneseDate} from "../assets/round-date.js";
import {renderDressStickers} from "../lib/dress-stickers.js";
const E=e;
const GORA_LOGO="/assets/rakuten-gora.png";
const BRAND_ASSETS=BRAND+"/assets/";
const LAYR_PHOTO=BRAND_ASSETS+"core-long-shorts.webp";
const LAYR_LOGO=BRAND_ASSETS+"layr-wordmark.png";
const escAttr=v=>E(v);
function head(title,description,path,image="",ld=[],noindex=false){
  const url=origin()+path;
  const og=safeUrl(image)||BRAND_ASSETS+'hero_01_main.png';
  let out="<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  out+="<title>"+E(title)+"</title><meta name='description' content='"+escAttr(description)+"'>";
  out+="<link rel='canonical' href='"+escAttr(url)+"'>";
  out+="<meta property='og:locale' content='ja_JP'><meta property='og:type' content='website'>";
  out+="<meta property='og:site_name' content='"+E(SITE_NAME)+"'>";
  out+="<meta property='og:title' content='"+E(title)+"'><meta property='og:description' content='"+E(description)+"'>";
  out+="<meta property='og:url' content='"+E(url)+"'><meta property='og:image' content='"+escAttr(og)+"'>";
  out+="<meta name='twitter:card' content='summary_large_image'>";
  if(noindex||process.env.VERCEL_ENV==="preview")out+="<meta name='robots' content='noindex,follow'>";
  out+="<link rel='icon' href='"+BRAND_ASSETS+"brand_01_layr-symbol.png'><link rel='stylesheet' href='/assets/finish.css?v=20261011b'>";
  out+="<script src='/assets/brand-images.js?v=20261011b' defer></script>";
  for(const d of ld)out+="<script type='application/ld+json'>"+jsonScript(d)+"</script>";
  return out;
}
function topbar(){
  return "<header class='site-header'><a class='site-brand' href='/' aria-label='全国ゴルフ場検索トップ'><img src='"+LAYR_LOGO+"' data-fallback-sources='"+BRAND_ASSETS+"brand_02_layr-wordmark.png|/assets/layrgolf-logo-black.png' alt='LAYR GOLF' width='2048' height='682'><small>全国ゴルフ場検索</small></a>"+
    "<nav aria-label='メインナビゲーション' class='site-nav'><a href='/'>文章で探す</a><a href='/courses'>全国のゴルフ場</a><a href='/guide'>服装ガイド</a><a href='"+BRAND+"/' target='_blank' rel='noopener'>LAYR GOLF公式 ↗</a></nav></header>";
}
function footer(){
  return "<footer class='site-footer'><div><strong>全国ゴルフ場検索</strong><span>powered by LAYR GOLF</span></div>"+
  "<nav aria-label='フッターナビゲーション'><a href='/'>ゴルフ場を探す</a><a href='/courses'>全国のゴルフ場</a><a href='/guide'>服装の基礎</a><a href='"+BRAND+"/'>LAYR GOLFブランド</a><a href='"+BRAND+"/#collection'>商品一覧 ↗</a></nav>"+
  "<div class='footer-source'><span>ゴルフ場のデータ・写真</span><img src='"+GORA_LOGO+"' alt='楽天GORA' width='92' height='49'><span>掲載料金や服装ルールは変わる場合があります。予約前に公式情報をご確認ください。</span></div>"+
  "<small>運営：株式会社アンドメロウ　｜　<a href='https://andmellow.jp/#about' target='_blank' rel='noopener'>運営会社</a>　｜　<a href='mailto:support@andmellow.jp'>お問い合わせ</a>　｜　<a href='https://andmellow.jp/privacy' target='_blank' rel='noopener'>プライバシーポリシー</a><span> © 2026 LAYR GOLF. 掲載情報の正確性・最新性は各施設の公式案内をご確認ください。</span></small></footer>";
}
function wrap(title,description,path,content,image="",ld=[],noindex=false){
  return "<!doctype html><html lang='ja'><head>"+head(title,description,path,image,ld,noindex)+"</head><body>"+topbar()+content+footer()+"</body></html>";
}
function breadcrumbs(parts) {
 return {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":parts.map(([label,path],i)=>({"@type":"ListItem",position:i+1,name:label,item:origin()+path}))};
}
function crumb(parts){
  return "<nav class='crumbs' aria-label='パンくずリスト'>"+parts.map(([name,path],i)=>i<parts.length-1?"<a href='"+E(path)+"'>"+E(name)+"</a>":"<span aria-current='page'>"+E(name)+"</span>").join("<span aria-hidden='true'> / </span>")+"</nav>";
}
function booking(c){
  const url=goraLink(c.gora_reserve_url)||goraLink(c.gora_detail_url);
  if(!url)return "<p class='booking-unavailable'>このコースの予約リンクは現在確認できません。ゴルフ場の公式情報をご確認ください。</p>";
  return "<a class='book-btn' href='"+E(url)+"' rel='sponsored nofollow noopener noreferrer' target='_blank'><span class='gora-reserve-brand'><img src='"+GORA_LOGO+"' alt='楽天GORA' width='100' height='53'></span><span><strong>楽天GORAで空き枠・プランを見る</strong><small>プレー日・人数・最終料金は予約先で確認</small></span><b aria-hidden='true'>↗</b><span class='pr-label'>PR</span></a>";
}
function promo(){
 return "<aside class='layr-promo' aria-label='LAYR GOLFのご案内'><a class='promo-photo' href='"+BRAND+"/#collection' aria-label='LAYR GOLFのインナー一覧を見る'><img loading='lazy' src='"+LAYR_PHOTO+"' data-fallback-sources='"+BRAND_ASSETS+"prod_01_long-fit.png|"+BRAND_ASSETS+"1.png' alt='LAYR GOLF ゴルフに特化したインナー'></a>"+
 "<div><p class='overline'>LAYR GOLF / BASEWEAR</p><h2>ゴルフの一日を、<br>肌に近い一枚から。</h2><p>動きやすさと、長いラウンドの快適さを考えたゴルフ専用ベースウェア。</p><a class='line-link' href='"+BRAND+"/#collection' target='_blank' rel='noopener'>LAYR GOLFの商品を見る ↗</a><small class='pr-inline'>自社ブランドのご案内</small></div></aside>";
}
function gallery(c){
 const images=courseImages(c);
 if(!images.length)return "<div class='photo-empty'>コース画像は準備中です</div>";
 return "<div class='course-gallery'><figure class='gallery-main'><img src='"+E(images[0])+"' alt='"+E(c.course_name)+"のコース写真' fetchpriority='high'></figure>"+
 (images.length>1?"<div class='gallery-extra gallery-count-"+Math.min(4,images.length-1)+"'>"+images.slice(1,5).map((url,i)=>"<figure><img src='"+E(url)+"' alt='"+E(c.course_name)+"の写真 "+(i+2)+"' loading='lazy'></figure>").join("")+"</div>":"")+"</div>";
}
function facts(c){
 const values=[["評価",Number(c.evaluation)>0?Number(c.evaluation).toFixed(1)+" / 5":"—"],["平日料金の目安",yen(c.weekday_min_price_yen)],["土日祝の目安",yen(c.holiday_min_price_yen)],["ホール数",c.hole_count||"—"]];
 return "<dl class='course-facts'>"+values.map(([k,v])=>"<div><dt>"+E(k)+"</dt><dd>"+E(v)+"</dd></div>").join("")+"</dl>";
}
function courseSchema(c,path){
 const images=courseImages(c);
 const s={"@context":"https://schema.org","@type":"GolfCourse","@id":origin()+path+"#course",name:c.course_name,url:origin()+path};
 if(c.address)s.address={"@type":"PostalAddress",addressCountry:"JP",addressRegion:c.prefecture,streetAddress:plain(c.address)};
 if(images.length)s.image=images;
 if(c.latitude!=null&&c.longitude!=null&&Number.isFinite(Number(c.latitude))&&Number.isFinite(Number(c.longitude)))s.geo={"@type":"GeoCoordinates",latitude:Number(c.latitude),longitude:Number(c.longitude)};
 if(c.course_caption)s.description=plain(c.course_caption).slice(0,1000);
 if(Number(c.evaluation)>0&&Number(c.review_count)>0)s.aggregateRating={"@type":"AggregateRating",ratingValue:Number(c.evaluation),ratingCount:Number(c.review_count),bestRating:5};
 return s;
}
function dress(c){
 const official=plain(c.dress_code_raw);
 return "<section class='editorial-section' id='dress'><div class='section-label'>02 / DRESS CODE</div><div><h2>当日の服装を確認する。</h2>"+
  renderDressStickers(c)+"<div class='dress-source-label'>楽天GORA掲載の原文</div><p class='content-copy dress-original'>"+E(official||"楽天GORAの掲載情報では服装規定を確認できませんでした。「服装自由」を意味するものではありません。来場前にゴルフ場の公式情報をご確認ください。")+"</p>"+
  (plain(c.shoes_raw)?"<h3>シューズに関する記載</h3><p class='content-copy'>"+E(plain(c.shoes_raw))+"</p>":"")+
  "<p class='small-note'>来場時とプレー中で規定が異なる場合があります。季節による例外を含め、予約前に各施設の最新情報をご確認ください。</p>"+
  "<a href='/guide' class='line-link'>服装ルールの見方を知る →</a></div></section>";
}
function terrainView(c){
 const lat=Number(c.latitude),lon=Number(c.longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>50||lon<122||lon>155)return "";
 const mapUrl="https://www.openstreetmap.org/?mlat="+encodeURIComponent(lat)+"&mlon="+encodeURIComponent(lon)+"#map=14/"+encodeURIComponent(lat)+"/"+encodeURIComponent(lon);
 return "<section class='terrain-section' id='terrain'><div class='terrain-topline'><div><p class='section-label'>EXPLORE THE LANDSCAPE / 03</p>"+
  "<h2>この場所を、立体で見る。</h2><p>実際の地形の起伏や、周囲との位置関係を眺めてみよう。</p></div><div class='terrain-stamp'>3D<br>FIELD</div></div>"+
  "<div class='terrain-view' data-lat='"+E(lat)+"' data-lon='"+E(lon)+"' aria-label='ゴルフ場周辺の3D地形ビュー'>"+
    "<div class='terrain-cover'><span class='terrain-cover-art' aria-hidden='true'>⌁</span><b>THE TERRAIN<br>OF THIS PLACE.</b>"+
      "<button type='button' class='terrain-launch'>3D地形を開く ↗</button></div>"+
    "<div class='terrain-canvas' hidden></div>"+
    "<div class='terrain-bottom'><p class='terrain-status' role='status'>地形データを読み込むと地図を操作できます。</p>"+
      "<button type='button' class='terrain-mode' hidden>2D 地図で見る</button>"+
      "<a class='terrain-fallback' href='"+E(mapUrl)+"' target='_blank' rel='noopener noreferrer'>通常の地図 ↗</a></div>"+
    "</div><p class='small-note'>所在地周辺の実際の標高・地図を使用しています。各ホールの設計・グリーン形状を正確に再現した3Dモデルではありません。地図データ：OpenFreeMap / OpenStreetMap、地形：Mapterhorn。</p></section>";
}
function seasons(items){
 const season={"spring":"春","summer":"夏","autumn":"秋","winter":"冬"};
 const ordered=[...items].filter(s=>season[s.season]).sort((a,b)=>Object.keys(season).indexOf(a.season)-Object.keys(season).indexOf(b.season));
 return "<section class='editorial-section' id='season'><div class='section-label'>03 / SEASON</div><div><h2>季節に合わせた準備。</h2>"+
 (ordered.length?"<div class='season-list'>"+ordered.map(s=>"<div><b>"+season[s.season]+"</b><p>"+E(plain(s.wear_recommendation)||"季節に合う装備をご確認ください。")+"</p>"+(s.etiquette_note?"<small>"+E(plain(s.etiquette_note))+"</small>":"")+"</div>").join("")+"</div>":"<p class='content-copy'>季節ごとの服装目安は準備中です。</p>")+
 "<p class='small-note'>服装の目安であり、当日の天気予報やゴルフ場の規定を保証するものではありません。</p></div></section>";
}
function gear(items,wishedDate=""){
 const month=Number((wishedDate||"").split("-")[1])||Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",month:"numeric"}).format(new Date()));
 const season=month===12||month<=2?"winter":month>=6&&month<=9?"summer":month>=3&&month<=5?"spring":"autumn";
 const scoped=items.filter(a=>safeUrl(a.target_url)&&(a.season==="all"||!a.season||a.season===season));
 const priority=a=>a.slot?.includes("accessory_glove")?0:a.slot?.includes("accessory_ball")?1:a.category==="footwear"?2:a.season===season?3:4;
 scoped.sort((a,b)=>priority(a)-priority(b));
 const unique=new Set();
 const filtered=scoped.filter(a=>{const key=a.item_code||a.target_url;if(unique.has(key))return false;unique.add(key);return true;}).slice(0,4);
 if(!filtered.length)return "";
 return "<section class='editorial-section' id='gear'><div class='section-label'>04 / GEAR</div><div><h2>ラウンドの準備に。</h2><div class='gear-items'>"+
 filtered.map(a=>"<a href='"+E(safeUrl(a.target_url))+"' target='_blank' rel='sponsored nofollow noopener noreferrer'>"+
 (safeUrl(a.item_image_url)?"<img loading='lazy' src='"+E(safeUrl(a.item_image_url))+"' alt=''>":"")+
 "<span><small>楽天市場 / PR</small><b>"+E(plain(a.item_name||a.rakuten_search_keyword||"関連用品"))+"</b></span><span aria-hidden='true'>↗</span></a>").join("")+"</div></div></section>";
}
function related(rows,id){
 const filtered=rows.filter(c=>String(c.gora_course_id)!==String(id)).slice(0,3);
 if(!filtered.length)return "";
 return "<section class='related section-width'><div class='section-heading'><p class='overline'>NEXT COURSE</p><h2>近くのゴルフ場も見てみる。</h2></div><div class='related-grid'>"+filtered.map(c=>card(c)).join("")+"</div></section>";
}
function card(c){
 const image=safeUrl(c.image_url_1);
 const href="/course/"+E(c.gora_course_id);
 return "<article class='directory-card'><a class='directory-photo' href='"+href+"'>"+(image?"<img src='"+E(image)+"' alt='"+E(c.course_name)+"' loading='lazy'>":"<div class='photo-empty'>写真は準備中</div>")+"</a><div><p class='overline'>"+E(c.prefecture)+"</p><h3><a href='"+href+"'>"+E(c.course_name)+"</a></h3>"+
 "<p>"+E(plain(c.editorial_feature_summary||c.course_caption).slice(0,80))+"</p><div class='card-facts'><span>評価 "+E(Number(c.evaluation)>0?Number(c.evaluation).toFixed(1):"—")+"</span><span>平日 "+E(yen(c.weekday_min_price_yen))+"</span></div><a class='line-link' href='"+href+"'>コースの詳細を見る →</a></div></article>";
}
export function detailHTML(data,nearby=[],wishedDate=""){
 const c=data.course,id=String(c.gora_course_id),path="/course/"+id,pre=c.prefecture;
 const selectedDate=parseJapaneseDate(wishedDate);
 const playDate=selectedDate&&!selectedDate.past?selectedDate:null;
 const dateHTML=playDate?"<p class='booking-wished-date'>希望日："+E(playDate.label)+"<small>この日の空き枠・プラン・料金は楽天GORAで確認してください。</small></p>":"";
 const title=c.course_name+"（"+pre+"）｜料金・口コミ・服装・予約 | LAYR GOLF";
 const description=plain(c.course_caption).slice(0,86)||c.course_name+"のコース概要";
 const intro=description+"。平日・休日の料金目安、口コミ評価、ドレスコード、楽天GORAでの予約先を確認。";
 const breadcrumb=[["全国のゴルフ場","/courses"],[pre,areaLink(pre)],[c.course_name,path]];
 const content="<main class='detail-page'>"+crumb(breadcrumb)+"<div class='course-title'><p class='overline'>"+E(pre)+" / GOLF COURSE</p><h1>"+E(c.course_name)+"</h1><p>"+E(plain(c.editorial_nickname||c.course_caption).slice(0,180))+"</p><div class='course-quip'><span>THE COURSE SAYS...</span><strong>"+E(plain(c.course_caption||"このコースを詳しく見てみよう。").slice(0,70))+"</strong></div></div>"+
 gallery(c)+"<div class='summary-layout'><div>"+facts(c)+"</div><aside class='booking-aside'><p>気になるコースが決まったら。</p>"+dateHTML+booking(c)+"<small>表示料金は参考価格。空き枠・プラン・最終料金は楽天GORAでご確認ください。</small></aside></div>"+
 "<div class='detail-content'><section class='editorial-section' id='about-course'><div class='section-label'>01 / COURSE</div><div><h2>どんなゴルフ場？</h2><p class='content-copy'>"+E(plain(c.course_caption||c.information||"詳細は楽天GORAの施設情報をご確認ください。"))+"</p><dl class='facts-plain'><div><dt>所在地</dt><dd>"+E(c.address||pre)+"</dd></div><div><dt>ホール / PAR</dt><dd>"+E(c.hole_count||"—")+" / "+E(c.par_count||"—")+"</dd></div><div><dt>コースタイプ</dt><dd>"+E(c.course_type||"—")+"</dd></div>"+(c.highway?"<div><dt>周辺の高速道路</dt><dd>"+E(c.highway)+"</dd></div>":"")+"</dl></div></section>"+
 dress(c)+terrainView(c)+seasons(data.seasons)+gear(data.ads,playDate?.iso||"")+"</div>"+
 "<div class='detail-bottom-booking'><h2>次のラウンドを予約する。</h2>"+dateHTML+booking(c)+"</div>"+promo()+"<script src='/assets/terrain-view.js?v=20261011' defer></script></main>"+related(nearby,id);
 const ld=[breadcrumbs(breadcrumb),courseSchema(c,path)];
 return wrap(title,intro,path,content,courseImages(c)[0],ld);
}
export function directoryHTML(rows,total,pref="",page=1){
 const path=(pref?areaLink(pref):"/courses")+(page>1?"?page="+page:"");
 const title=(pref?pref+"のゴルフ場一覧":"全国のゴルフ場一覧")+"・料金・服装 | LAYR GOLF";
 const intro=(pref?pref+"の":"全国の")+"ゴルフ場を写真・料金目安・評価から探せます。掲載コースの服装や特徴も個別ページで確認できます。";
 const pages=Math.ceil((total||rows.length)/24);
 const links=AREA_NAMES.map(n=>"<a href='"+areaLink(n)+"'"+(pref===n?" aria-current='page'":"")+">"+E(n)+"</a>").join("");
 const nav="<nav class='areas-inline' aria-label='都道府県からゴルフ場を探す'>"+links+"</nav>";
 const crumbArr=pref?[["全国のゴルフ場","/courses"],[pref,path]]:[["全国のゴルフ場","/courses"]];
 const pageLink=n=>(pref?areaLink(pref):"/courses")+(n===1?"":"?page="+n);
 const pagination="<nav class='paging' aria-label='ページ送り'>"+(page>1?"<a href='"+pageLink(page-1)+"'>← 前へ</a>":"")+
 "<span>"+page+" / "+Math.max(1,pages)+"</span>"+(page<pages?"<a href='"+pageLink(page+1)+"'>次へ →</a>":"")+"</nav>";
 const content="<main class='directory-page'>"+crumb(crumbArr)+"<div class='directory-intro'><p class='overline'>GOLF COURSES</p><h1>"+E(pref||"全国")+"のゴルフ場。</h1><p>"+E(intro)+"</p><strong>"+E(total??rows.length)+"件</strong></div>"+
 nav+"<div class='directory-grid'>"+rows.map(card).join("")+"</div>"+pagination+promo()+"</main>";
 const ld=[breadcrumbs(crumbArr),{"@context":"https://schema.org","@type":"ItemList","itemListElement":rows.map((c,i)=>({"@type":"ListItem",position:(page-1)*24+i+1,url:origin()+"/course/"+c.gora_course_id,name:c.course_name}))}];
 return wrap(title,intro,path,content,rows[0]?.image_url_1,ld);
}
export function guideHTML(){
 const path="/guide";
 const content="<main class='guide-page'>"+crumb([["全国のゴルフ場","/courses"],["服装ガイド",path]])+
 "<p class='overline'>GOLF DRESS CODE</p><h1>ゴルフ場の服装。<br>予約前に確認したいこと。</h1><p class='lead'>同じゴルフでも、クラブハウスへの入場とプレー中では服装規定が異なることがあります。</p>"+
 "<section class='guide-chapter'><span>01</span><div><h2>来場時のジャケット</h2><p>クラブハウスへ入るときの上着が求められる場合があります。夏季の着用省略など、期間による例外もあります。ゴルフ場の公式案内を確認してください。</p></div></section>"+
 "<section class='guide-chapter'><span>02</span><div><h2>プレー中のトップス・パンツ</h2><p>襟付き、モックネック、ショートパンツ、ソックスなどの扱いは施設によって異なります。特にデニム、Tシャツ、サンダルなどは注意が必要です。</p></div></section>"+
 "<section class='guide-chapter'><span>03</span><div><h2>季節と快適さ</h2><p>紫外線、汗、冷えを考慮して装いを調整しましょう。下に着るインナーも、動きやすさと快適さを助けます。コース別の記載がない場合は直接確認が確実です。</p></div></section>"+
 "<p class='guide-disclosure'>本ページは一般的な確認事項です。特定のゴルフ場での服装許可を保証するものではありません。</p><a class='line-link' href='/courses'>ゴルフ場一覧から確認する →</a>"+promo()+"</main>";
 return wrap("ゴルフ場の服装・ドレスコードガイド | LAYR GOLF","ジャケット、襟付きウェア、ゴルフシューズなど、ゴルフ場へ行く前に確認したい服装ルールをわかりやすく整理。",path,content,"", [breadcrumbs([["全国のゴルフ場","/courses"],["服装ガイド",path]])]);
}
export function errorHTML(code){
 const msg=code===404?"お探しのページが見つかりません。":"ただいまコース情報を読み込めません。しばらくしてからもう一度お試しください。";
 return wrap(code===404?"ページが見つかりません | LAYR GOLF":"一時的に利用できません | LAYR GOLF",msg,"/", "<main class='error-view'><p>"+E(code)+"</p><h1>"+E(msg)+"</h1><a href='/' class='line-link'>検索に戻る →</a></main>","",[],true);
}
export default async function handler(req,res) {
 if(!["GET","HEAD"].includes(req.method||"GET")){res.setHeader("Allow","GET, HEAD");return res.status(405).send("");}
 res.setHeader("Content-Type","text/html; charset=utf-8");
 const url=new URL(req.url||"/","https://example.invalid");
 // Vercel rewrites may expose params either in req.query or the original pathname.
 const rq=req.query||{};
 const fallbackCourse=url.pathname.match(/^\/course\/(\d{1,12})\/?$/);
 const fallbackPref=url.pathname.match(/^\/prefecture\/([a-z]+)\/?$/);
 const readParam=name=>typeof rq[name]==="string"?rq[name]:url.searchParams.get(name);
 const kind=readParam("view")||(fallbackCourse?"detail":fallbackPref?"prefecture":url.pathname==="/courses"?"directory":url.pathname==="/guide"?"guide":"detail");
 let code=200,html;
 try{
  if(kind==="detail"){
   const id=readParam("id")||fallbackCourse?.[1];
   if(!validId(id)){code=404;html=errorHTML(404);}
   else{
    const data=await courseById(id);
    if(!data){code=404;html=errorHTML(404);}
    else{
     let nearby=[];
     try{
      const q=await courseListing(data.course.prefecture,1,5);
      nearby=q.rows;
     }catch{}
     html=detailHTML(data,nearby,readParam("date")||"");
    }
   }
  }else if(kind==="directory"||kind==="prefecture"){
   const slug=readParam("slug")||fallbackPref?.[1]||"";
   const pref=kind==="prefecture"?areaFromSlug(slug):"";
   const p=readParam("page")||"1";
   if((kind==="prefecture"&&!pref)||!/^[1-9]\d{0,3}$/.test(p)){code=404;html=errorHTML(404);}
   else{
    const page=Number(p),result=await courseListing(pref,page,24);
    if(!result.rows.length){code=404;html=errorHTML(404);}
    else html=directoryHTML(result.rows,result.total,pref,page);
   }
  }else if(kind==="guide")html=guideHTML();
  else{code=404;html=errorHTML(404);}
 }catch(err){
  code=503;html=errorHTML(503);res.setHeader("Retry-After","120");
  console.error("SEO page temporary unavailable:",err.name);
 }
 if(code!==200)res.setHeader("X-Robots-Tag","noindex, nofollow");
 else if(process.env.VERCEL_ENV==="preview")res.setHeader("X-Robots-Tag","noindex,follow");
 res.setHeader("Cache-Control",code===200?"public, max-age=0, s-maxage=120, stale-while-revalidate=600":"no-store");
 return res.status(code).send(req.method==="HEAD"?"":html);
}

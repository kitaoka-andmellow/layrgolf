const root=document.querySelector('#detailRoot');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const yen=v=>v?`¥${Number(v).toLocaleString('ja-JP')}`:'—';
const yes=v=>Boolean(v);
const id=new URLSearchParams(location.search).get('id');

function icon(label,value,glyph,yesLabel='YES',noLabel='NO'){
  return `<div class="dress-icon"><div class="glyph">${glyph}</div><small>${esc(label)}</small><strong class="${value?'yes':''}">${value?yesLabel:noLabel}</strong></div>`
}
function seasonName(s){return ({spring:'SPRING',summer:'SUMMER',autumn:'AUTUMN',winter:'WINTER'})[s]||s}
function adCard(a){
  if(!a.target_url) return '';
  return `<a class="ad-card" href="${esc(a.target_url)}" target="_blank" rel="nofollow sponsored noopener">
    <img src="${esc(a.item_image_url||'')}" alt=""><div><div class="ad-kicker">RAKUTEN AFFILIATE</div><h4>${esc(a.item_name||a.rakuten_search_keyword)}</h4><div class="price">${yen(a.item_price_yen)}</div></div>
  </a>`;
}
async function main(){
  if(!id){root.innerHTML='<div class="detail-loading">Invalid course ID</div>';return}
  const r=await fetch(`/api/course?id=${encodeURIComponent(id)}`); const d=await r.json();
  if(!r.ok){root.innerHTML=`<div class="detail-loading">${esc(d.message||d.error)}</div>`;return}
  const c=d.course; document.title=`${c.course_name} | COURSE CODE`;
  const img=c.image_url_1||c.image_url_2||'';
  const official=c.dress_code_raw||'楽天GORA上の服装指定は空欄です。服装自由を意味しません。予約前にゴルフ場公式情報をご確認ください。';
  const seasonOrder={spring:1,summer:2,autumn:3,winter:4}; d.seasons.sort((a,b)=>(seasonOrder[a.season]||9)-(seasonOrder[b.season]||9));
  const ads=d.ads.filter(a=>a.target_url).slice(0,4);
  root.innerHTML=`
    <section class="course-hero">
      <div class="course-hero-image">${img?`<img src="${esc(img)}" alt="${esc(c.course_name)}">`:''}</div>
      <div class="course-hero-copy">
        <div class="eyebrow">${esc(c.prefecture)} / ${esc(c.course_type||'GOLF COURSE')}</div>
        <h1>${esc(c.course_name)}</h1>
        <div class="hero-nickname">“${esc(c.editorial_nickname||'地形と戦略を楽しむ一日')}”</div>
        <div class="source-note">COURSE CODE独自編集 / 公式愛称ではありません</div>
        <div class="facts-row">
          <div class="fact"><small>HOLES</small><strong>${c.hole_count??'—'}</strong></div>
          <div class="fact"><small>PAR</small><strong>${c.par_count??'—'}</strong></div>
          <div class="fact"><small>WEEKDAY FROM</small><strong>${yen(c.weekday_min_price_yen)}</strong></div>
          <div class="fact"><small>DIFFICULTY</small><strong>${esc(c.difficulty_label||'—')}</strong></div>
        </div>
      </div>
    </section>
    <div class="detail-shell">
      <div class="detail-main">
        <section>
          <div class="section-title"><h2>ドレスコードを、先に読む。</h2><span>DRESS CODE / PRIORITY</span></div>
          <div class="dress-lead">
            <div class="dress-level"><small>COURSE CODE INDEX</small><b>${esc(c.dress_level||'N/A')}</b></div>
            <div class="official-rule"><b>RAKUTEN GORA / OFFICIAL DATA FIELD</b>${esc(official)}</div>
          </div>
          <div class="dress-icons">
            ${icon('JACKET',yes(c.jacket_required),'◩','REQUIRED','NOT REQUIRED')}
            ${icon('COLLAR',yes(c.collar_mentioned),'⌁','MENTIONED','NO NOTE')}
            ${icon('DENIM',yes(c.denim_banned),'▥','BANNED','NO NOTE')}
            ${icon('T-SHIRT',yes(c.tshirt_banned),'T','BANNED','NO NOTE')}
            ${icon('SANDAL',yes(c.sandals_banned),'⌇','BANNED','NO NOTE')}
            ${icon('GOLF SHOES',yes(c.golf_shoes_mentioned),'◒','MENTIONED','NO NOTE')}
          </div>
          ${c.shoes_raw?`<div class="source-note">シューズ指定：${esc(c.shoes_raw)}</div>`:''}
        </section>
        <section>
          <div class="section-title"><h2>季節で、装いを変える。</h2><span>SEASONAL GUIDE / EDITORIAL</span></div>
          <div class="season-grid">
            ${d.seasons.map(s=>`<div class="season-card"><div class="season">${seasonName(s.season)}</div><h3>${esc(s.regional_condition)}</h3><p><b>${esc(s.wear_recommendation)}</b></p><p>${esc(s.etiquette_note)}</p></div>`).join('')}
          </div>
          <div class="source-note">地域気候帯と服装規定を基にしたCOURSE CODE独自ガイドです。天候予報・公式規定を優先してください。</div>
        </section>
        <section>
          <div class="section-title"><h2>このコースらしさ。</h2><span>COURSE CHARACTER</span></div>
          <div class="course-copy">${esc(c.course_caption||c.information||'')}</div>
          <div class="source-note">コース説明・基本情報は楽天GORA API取得値を使用。独自難易度は総距離・地形等から算出した参考指標です。</div>
        </section>
      </div>
      <aside class="sidebar"><div class="sidebar-inner">
        <div class="booking-card"><h3>${yen(c.weekday_min_price_yen)}〜</h3><p>表示価格はAPI取得時点の目安です。最新料金・空き枠は楽天GORAで確認してください。</p>${c.gora_reserve_url?`<a class="booking-btn" href="${esc(c.gora_reserve_url)}" target="_blank" rel="nofollow sponsored noopener">楽天GORAで予約する</a>`:''}</div>
        <div class="ad-title">GEAR FOR THIS COURSE</div>
        ${ads.length?ads.map(adCard).join(''):'<div class="ad-placeholder">楽天市場アフィリエイト商品は、VPS側の広告同期後にここへ自動表示されます。</div>'}
      </div></aside>
    </div>`;
}
main();

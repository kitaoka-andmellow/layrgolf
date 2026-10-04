const root=document.querySelector('#detailRoot');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const yen=v=>Number(v)>0?`¥${Number(v).toLocaleString('ja-JP')}`:'要確認';
const id=new URLSearchParams(location.search).get('id');

function seasonName(s){return ({spring:'春',summer:'夏',autumn:'秋',winter:'冬'})[s]||s}
function rule(label,value,positive,negative){
  return `<div class="rule-row"><span>${esc(label)}</span><b class="${value?'is-on':''}">${value?esc(positive):esc(negative)}</b></div>`;
}
function adCard(a){
  if(!a.target_url) return '';
  return `<a class="gear-row" href="${esc(a.target_url)}" target="_blank" rel="nofollow sponsored noopener">
    ${a.item_image_url?`<img src="${esc(a.item_image_url)}" alt="">`:''}
    <span><small>楽天市場</small><b>${esc(a.item_name||a.rakuten_search_keyword||'おすすめ用品')}</b><em>${yen(a.item_price_yen)}</em></span>
    <strong>→</strong>
  </a>`;
}
async function main(){
  if(!/^\d{1,12}$/.test(id||'')){root.innerHTML='<div class="detail-loading">コース情報を開けませんでした。</div>';return}
  try{
    const r=await fetch(`/api/course?id=${encodeURIComponent(id)}`);
    const d=await r.json();
    if(!r.ok)throw new Error('detail');
    const c=d.course;
    document.title=`${c.course_name} | 全国ゴルフ場検索 powered by LAYR GOLF`;
    const hero=c.image_url_1||c.image_url_2||'';
    const sub=c.image_url_2&&c.image_url_2!==hero?c.image_url_2:(c.image_url_3||'');
    const official=c.dress_code_raw||'掲載情報では服装指定を確認できません。服装自由を意味しません。予約前にゴルフ場公式情報をご確認ください。';
    const seasons=[...(d.seasons||[])].sort((a,b)=>({spring:1,summer:2,autumn:3,winter:4}[a.season]||9)-({spring:1,summer:2,autumn:3,winter:4}[b.season]||9));
    const ads=(d.ads||[]).filter(a=>a.target_url).slice(0,4);
    root.innerHTML=`
      <section class="detail-hero">
        <div class="detail-photo">${hero?`<img src="${esc(hero)}" alt="${esc(c.course_name)}">`:'<div class="detail-photo-empty">NO IMAGE</div>'}</div>
        <div class="detail-intro">
          <p class="detail-place">${esc(c.prefecture)}${c.course_type?` · ${esc(c.course_type)}`:''}</p>
          <h1>${esc(c.course_name)}</h1>
          <p class="detail-caption">${esc(c.editorial_nickname||c.course_caption||'コース情報を確認して、次のラウンドを選べます。')}</p>
          <dl class="detail-facts">
            <div><dt>評価</dt><dd>${Number(c.evaluation)>0?Number(c.evaluation).toFixed(1):'—'}</dd></div>
            <div><dt>平日</dt><dd>${yen(c.weekday_min_price_yen)}</dd></div>
            <div><dt>土日祝</dt><dd>${yen(c.holiday_min_price_yen)}</dd></div>
            <div><dt>ホール</dt><dd>${esc(c.hole_count||'—')}</dd></div>
          </dl>
          <div class="detail-actions">
            ${c.gora_reserve_url?`<a class="reserve-link reserve-primary" href="${esc(c.gora_reserve_url)}" target="_blank" rel="nofollow sponsored noopener"><span>楽天GORAで予約する</span><small>空き枠・プレー日・人数を選ぶ</small><b>→</b></a>`:''}
            ${c.gora_detail_url?`<a class="plain-link" href="${esc(c.gora_detail_url)}" target="_blank" rel="nofollow noopener">楽天GORAの詳細情報</a>`:''}
          </div>
        </div>
      </section>

      <nav class="detail-jump" aria-label="ページ内メニュー">
        <a href="#character">コースの特徴</a>
        <a href="#dress">服装</a>
        <a href="#season">季節</a>
        ${ads.length?'<a href="#gear">用品</a>':''}
      </nav>

      <div class="detail-layout">
        <main class="detail-content">
          <section id="character" class="detail-section">
            <p class="detail-section-no">01</p>
            <div class="detail-section-body">
              <h2>このコースは、どんな場所？</h2>
              <p class="detail-copy">${esc(c.course_caption||c.information||'掲載情報からコース概要を確認できます。')}</p>
              <div class="spec-grid">
                <div><small>PAR</small><b>${esc(c.par_count||'—')}</b></div>
                <div><small>COURSE TYPE</small><b>${esc(c.course_type||'—')}</b></div>
                <div><small>起伏</small><b>${esc(c.course_vertical_interval||'—')}</b></div>
                <div><small>設計</small><b>${esc(c.designer||'—')}</b></div>
              </div>
              ${sub?`<figure class="detail-secondary-photo"><img src="${esc(sub)}" alt="${esc(c.course_name)}のコース写真"></figure>`:''}
            </div>
          </section>

          <section id="dress" class="detail-section">
            <p class="detail-section-no">02</p>
            <div class="detail-section-body">
              <h2>当日の服装。</h2>
              <p class="detail-copy">${esc(official)}</p>
              <div class="rule-list">
                ${rule('ジャケット',Boolean(c.jacket_required),'必須','必須の記載なし')}
                ${rule('襟付き',Boolean(c.collar_mentioned),'記載あり','記載なし')}
                ${rule('デニム',Boolean(c.denim_banned),'不可','禁止の記載なし')}
                ${rule('Tシャツ',Boolean(c.tshirt_banned),'不可','禁止の記載なし')}
                ${rule('サンダル',Boolean(c.sandals_banned),'不可','禁止の記載なし')}
                ${rule('ゴルフシューズ',Boolean(c.golf_shoes_mentioned),'記載あり','記載なし')}
              </div>
              <p class="fine-print">「記載なし」は着用可能を保証するものではありません。最新規定を予約前にご確認ください。${c.shoes_raw?` シューズ指定：${esc(c.shoes_raw)}`:''}</p>
            </div>
          </section>

          <section id="season" class="detail-section">
            <p class="detail-section-no">03</p>
            <div class="detail-section-body">
              <h2>季節ごとの目安。</h2>
              <div class="season-lines">${seasons.length?seasons.map(s=>`<div><b>${seasonName(s.season)}</b><span><strong>${esc(s.wear_recommendation||'')}</strong>${s.regional_condition?`<small>${esc(s.regional_condition)}</small>`:''}${s.etiquette_note?`<small>${esc(s.etiquette_note)}</small>`:''}</span></div>`).join(''):'<p class="detail-copy">季節ガイドは準備中です。</p>'}</div>
              <p class="fine-print">地域情報を基にした目安です。当日の天候とゴルフ場の公式規定を優先してください。</p>
            </div>
          </section>

          ${ads.length?`<section id="gear" class="detail-section">
            <p class="detail-section-no">04</p>
            <div class="detail-section-body"><h2>この日のための用品。</h2><div class="gear-list">${ads.map(adCard).join('')}</div></div>
          </section>`:''}
        </main>

        <aside class="detail-side">
          <div class="side-book">
            <p>${esc(c.course_name)}</p>
            <span>平日 ${yen(c.weekday_min_price_yen)}〜</span>
            <span>土日祝 ${yen(c.holiday_min_price_yen)}〜</span>
            ${c.gora_reserve_url?`<a class="side-reserve" href="${esc(c.gora_reserve_url)}" target="_blank" rel="nofollow sponsored noopener">楽天GORAで予約する →</a>`:''}
          </div>
        </aside>
      </div>
    `;
  }catch{
    root.innerHTML='<div class="detail-loading">コース情報を読み込めませんでした。少し待って、もう一度お試しください。</div>';
  }
}
main();

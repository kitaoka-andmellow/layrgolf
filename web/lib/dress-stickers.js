/* Decorative-but-accurate dress-code stickers; only positive claims with evidence. */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const glyph={
 jacket:'<path d="m8 3-5 3-1 14h6l1-9 3 2 3-2 1 9h6L21 6l-5-3-4 5z"/><path d="m8 3 4 5 4-5M12 8v14m-3-9 3 0"/>',
 sandal:'<path d="M5 16c0-3 1-6 5-9 2-1 4-1 6 1l4 10c1 3-1 4-5 4H9c-4 0-5-3-4-6z"/><path d="m9 9 6 6m1-7-5 9m-5-3 7 2"/>',
 collar:'<path d="m8 3-6 4 3 5 3-1v10h8V11l3 1 3-5-6-4-4 4z"/><path d="m8 3 4 4 4-4-4 9-4-9"/>',
 shoes:'<path d="M3 13v4q0 4 5 4h12q2 0 2-3v-2q-5-1-7-6l-6-1-3 5z"/><path d="M4 18h17M10 11l2 2m-5 0 3 2"/>'
};
function svg(which) {
 return '<svg viewBox="0 0 24 24" width="38" height="38" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+glyph[which]+'</svg>';
}
export function dressFacts(c){
 const raw=String(c.dress_code_raw||"");
 const jacket=/(?:ジャケット|上着).{0,16}(不要|必要なし|着用自由|着用は不要|着なくてよい)/.test(raw)?["不要の明記あり","positive"]:c.jacket_required===true?["着用規定あり","caution"]:["要確認","unknown"];
 const collar=c.collar_mentioned===true?["襟の記載あり","positive"]:["要確認","unknown"];
 const sandal=c.sandals_banned===true?["禁止の記載あり","caution"]:["要確認","unknown"];
 const shoes=c.golf_shoes_mentioned===true?["指定に言及","positive"]:["要確認","unknown"];
 return [
  {key:"jacket",name:"JACKET",jp:"ジャケット",value:jacket[0],state:jacket[1]},
  {key:"collar",name:"TOPS",jp:"襟・トップス",value:collar[0],state:collar[1]},
  {key:"sandal",name:"SANDALS",jp:"サンダル",value:sandal[0],state:sandal[1]},
  {key:"shoes",name:"SHOES",jp:"ゴルフシューズ",value:shoes[0],state:shoes[1]}
 ];
}
export function renderDressStickers(course){
 const facts=dressFacts(course);
 const cards=facts.map((c,i)=>'<div class="wear-sticker wear-sticker--'+c.state+' wear-sticker--'+c.key+'">'+
 '<div class="wear-sticker__upper"><span>'+esc(c.name)+'</span><b>#0'+(i+1)+'</b></div>'+
 '<div class="wear-sticker__icon">'+svg(c.key)+'</div>'+
 '<div class="wear-sticker__name">'+esc(c.jp)+'</div>'+
 '<div class="wear-sticker__value">'+esc(c.value)+'</div></div>').join("");
 const priorities=facts.filter(x=>x.state==="caution").map(x=>x.jp+"："+x.value);
 const bubble=priorities.length
  ?priorities.slice(0,2).join(" ／ ")+"。来場前に確認を。"
  :"施設によってルールは違います。記載がない項目は要確認。";
 return '<div class="dress-sticker-showcase"><div class="sticker-grid">'+cards+'</div>'+
 '<div class="dress-voice"><span aria-hidden="true">↗</span><p><strong>BEFORE YOUR ROUND</strong>'+esc(bubble)+'</p></div></div>';
}

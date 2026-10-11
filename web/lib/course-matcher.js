/* Explainable, rules-based Japanese golf search. Not an LLM. */
import {parseJapaneseDate} from "../assets/round-date.js";
const PREFS="北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split(" ");
const REGIONS={北海道:["北海道"],東北:["青森県","岩手県","宮城県","秋田県","山形県","福島県"],関東:["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"],甲信越:["新潟県","山梨県","長野県"],北陸:["富山県","石川県","福井県"],東海:["岐阜県","静岡県","愛知県","三重県"],関西:["滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"],近畿:["滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"],中国地方:["鳥取県","島根県","岡山県","広島県","山口県"],四国:["徳島県","香川県","愛媛県","高知県"],九州:["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県"],沖縄:["沖縄県"]};
const ORIGINS={大阪:["大阪府","兵庫県","京都府","奈良県","滋賀県","和歌山県"],東京:["東京都","神奈川県","千葉県","埼玉県","茨城県"],名古屋:["愛知県","岐阜県","三重県"],福岡:["福岡県","佐賀県","大分県","熊本県"],神戸:["兵庫県","大阪府","京都府","奈良県"],京都:["京都府","滋賀県","大阪府","奈良県"],横浜:["神奈川県","東京都","千葉県","埼玉県"],札幌:["北海道"],仙台:["宮城県","福島県","山形県"],広島:["広島県","山口県","岡山県"]};
const INTENTS={
 beginner:{label:"初心者と楽しめる",re:/初心者|ビギナー|初ラウンド|はじめて|初めて|ゴルフデビュー|優しい|やさしい|易しい|難しくない|ハードすぎない/,neg:/初心者向けじゃない/},
 challenge:{label:"攻略を楽しむ",re:/上級者|難関|難しい|タフ|戦略的|テクニカル|腕試し|競技|手強い|歯応え|難易度高め|チャレンジ/,neg:/難しくない|難しいのは嫌|タフすぎない|ハードすぎない/},
 scenic:{label:"景色を楽しむ",re:/絶景|景色|眺め|眺望|風景|自然|映える|写真映え|インスタ|綺麗|きれい|開放感|ロケーション/,neg:/景色は不要|景色こだわらない/},
 sea:{label:"海の見える雰囲気",re:/海|オーシャン|シーサイド|海沿い|海辺|潮風|海が見える/,neg:/海は嫌|海沿いは嫌/},
 highland:{label:"高原・山の雰囲気",re:/高原|山岳|山並み|避暑|涼しい|避暑地|標高|高地/,neg:/山は嫌|高原は嫌/},
 forest:{label:"林間・緑豊か",re:/林間|森|森林|木々|木立|緑豊か|木陰|緑に囲まれた/,neg:/林間は嫌/},
 riverside:{label:"河川敷",re:/河川敷|リバーサイド|川沿い|河川/,neg:/河川敷は嫌/},
 premium:{label:"特別感・格式",re:/名門|格式|上質|ハイクラス|高級|ラグジュアリー|接待|記念日|特別な日/,neg:/格式ばらない|堅苦しくない/},
 casual:{label:"気軽な雰囲気",re:/カジュアル|気軽|気楽|堅苦しくない|格式ばらない|ラフに|のびのび|服装ゆる/,neg:/カジュアルは嫌/},
 affordable:{label:"コスパ重視",re:/安い|格安|リーズナブル|お得|コスパ|低価格|お財布に優しい|節約|予算重視|手頃|安め/,neg:/安さは気にしない|高くてもいい/},
 quiet:{label:"落ち着いた雰囲気",re:/静か|落ち着いた|ゆったり|のんびり|混んでない|空いてる|人が少ない/,neg:/静かすぎない/},
 wide:{label:"広々としたコース",re:/広い|広め|広々|ワイド|狭くない|OB少なめ/,neg:/広すぎない|狭いコースがいい/},
 flat:{label:"起伏が穏やか",re:/フラット|平坦|アップダウン少ない|起伏が少ない|高低差少ない|歩きやすい/,neg:/フラットじゃない|起伏多い/},
 short:{label:"短めに楽しむ",re:/ショートコース|9ホール|ハーフ|短時間|サクッと|午後から|練習ラウンド/,neg:/ショートじゃなく|ハーフじゃなく/},
 photo:{label:"写真も楽しみたい",re:/デート|カップル|彼女|彼氏|おしゃれ|オシャレ|写真撮りたい|インスタ映え/,neg:/写真撮らない/},
 group:{label:"仲間・家族と楽しむ",re:/家族|ファミリー|親子|夫婦|友達|友人|仲間|グループ|みんなで|女子会|同僚|コンペ/,neg:/一人で|ソロで/},
 dining:{label:"食事も楽しむ",re:/ご飯|ランチ|食事|ごはん|グルメ|レストラン|料理|美味しいもの|おいしいもの/,neg:/食事不要|ランチなし/},
 stay:{label:"宿泊も検討",re:/宿泊|泊まり|ホテル|温泉旅行|一泊|旅行ついで|ゴルフ旅行/,neg:/日帰り|宿泊なし/},
 practice:{label:"練習設備が気になる",re:/練習|打ちっぱなし|アプローチ練習|ドライビングレンジ|パター練習/,neg:/練習不要/}
};
const EVIDENCE={
 scenic:/絶景|景色|眺望|パノラマ|雄大|風景|富士山|海を望|美しい|自然豊か|四季|開放感/,
 sea:/海|シーサイド|オーシャン|海岸|海沿い|海を望|海が見え|潮風/,
 highland:/高原|高地|山岳|標高|山並み|避暑|涼しい/,
 forest:/林間|森林|木々|樹林|木立|緑豊か/,
 riverside:/河川敷|河川|リバーサイド|川沿い/,
 premium:/名門|伝統|格式|会員制|高級|品格|上質/,
 casual:/カジュアル|気軽|フレンドリー/,
 quiet:/静か|落ち着い|ゆったり|閑静/,
 wide:/広々|広大|幅広|ワイド|広いフェアウェイ/,
 flat:/フラット|平坦|起伏少|高低差少|アップダウン少/,
 photo:/絶景|景色|眺望|写真映え|自然豊か|海を望/,
 dining:/レストラン|食事|料理|ランチ|昼食|美味|グルメ/,
 stay:/宿泊|ホテル|ロッジ|宿泊施設/,
 practice:/練習場|ドライビングレンジ|アプローチ練習|練習施設/
};
const norm=x=>String(x??"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
const number=x=>x==null||x===""||!Number.isFinite(Number(x))?null:Number(x);
const uniq=x=>[...new Set(x)];
const yen=x=>"¥"+Number(x).toLocaleString("ja-JP");

function parseMoney(q){
 const m=q.match(/(\d{1,3}(?:\.\d{1,2})?)\s*万\s*円?\s*(以下|以内|まで|程度|くらい|ぐらい|前後)?/) ||
   q.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*円\s*(以下|以内|まで|程度|くらい|ぐらい|前後)?/);
 if(!m)return null;
 const amount=Math.round(Number(m[1].replace(/,/g,""))*(m[0].includes("万")?10000:1));
 if(amount<1500||amount>100000)return null;
 const hard=/以下|以内|まで/.test(m[2]||"")||/(?:予算|上限)\s*(?:は|で|[:：])?\s*$/.test(q.slice(0,m.index));
 return {amount,hard:hard&&!/程度|くらい|ぐらい|前後/.test(m[2]||"")};
}
function parseLocation(q){
 const origins=Object.keys(ORIGINS).filter(x=>new RegExp(x+"(?:市)?\\s*(?:から|発|起点)").test(q));
 const locations=[];
 for(const pref of PREFS){
  const short=pref==="北海道"?"北海道":pref.replace(/[都府県]$/,"");
  if(q.includes(pref)||(short.length>=2&&q.includes(short)))locations.push(pref);
 }
 for(const [city,pref] of Object.entries({神戸:"兵庫県",横浜:"神奈川県",名古屋:"愛知県",博多:"福岡県",梅田:"大阪府",都内:"東京都"}))if(q.includes(city))locations.push(pref);
 const hard=uniq(locations.filter(x=>!origins.some(o=>ORIGINS[o].includes(x))));
 if(!hard.length&&!origins.length)for(const [region,prefs] of Object.entries(REGIONS))if(q.includes(region))hard.push(...prefs);
 const time=q.match(/(?:から|起点)[^。、]{0,16}?(\d+(?:\.\d+)?)\s*時間/);
 return {hard:uniq(hard),soft:uniq(origins.flatMap(o=>ORIGINS[o])),origin:origins[0]||null,hours:time?Number(time[1]):null};
}
function termsFrom(q){
 let s=q.replace(/\d{4}年\d{1,2}月\d{1,2}日?|\d{1,2}月\d{1,2}日?|\d{4}[/-]\d{1,2}[/-]\d{1,2}/g," ");
 s=s.replace(/[\d,.]+\s*(?:万?円|時間|人|名|ホール)/g," ");
 for(const pref of PREFS){const short=pref.replace(/[都府県]$/,"");s=s.replaceAll(pref," ");if(short.length>=2)s=s.replaceAll(short," ");}
 for(const name of Object.keys(REGIONS).concat(Object.keys(ORIGINS)))s=s.replaceAll(name," ");
 for(const obj of Object.values(INTENTS)){
  for(const token of obj.re.source.split("|").filter(w=>w.length>=3&&/^[\u3040-\u30ff\u3400-\u9fff]+$/.test(w)))s=s.replaceAll(token," ");
 }
 s=s.replace(/ゴルフ場|ゴルフクラブ|カントリークラブ|ゴルフ|コース|ラウンド|プレー|予算|おすすめ|探して|行きたい|行ける|したい|がいい|ある|できる|など|です|ます|一緒|みんな|ところ|感じ|場所|近く|から|以内|以下|まで|くらい|ほど|程度|前後|付近|周辺|休日|平日|土日|日曜|土曜|初心者|初めて|来週末|今週末/g," ");
 return uniq((s.match(/[一-龥ぁ-ゔァ-ヴーa-z0-9]{2,25}/gi)||[]).filter(x=>!/\d/.test(x))).slice(0,12);
}
export function parseQuery(raw,reference=new Date()){
 const input=String(raw||"").slice(0,500),q=norm(input),loc=parseLocation(q),m=parseMoney(q),date=parseJapaneseDate(input,reference);
 const positive=[],negative=[];
 for(const [key,item] of Object.entries(INTENTS)){
  if(!item.re.test(q))continue;
  if(item.neg?.test(q))negative.push(key);else positive.push(key);
 }
 if(/難しくない|簡単|易しめ/.test(q)&&!positive.includes("beginner"))positive.push("beginner");
 if(/堅苦しくない|格式ばらない/.test(q)&&!positive.includes("casual"))positive.push("casual");
 const weekend=/土日|休日|週末|祝日/.test(q),weekday=/平日/.test(q);
 const priceMode=weekend?"holiday":weekday?"weekday":date?.weekend?"holiday":"weekday";
 const rating=q.match(/(?:評価|口コミ|星|レビュー)\s*(?:★|☆)?\s*([1-5](?:\.\d)?)\s*(?:以上|超)/);
 const holes=q.match(/(\d{1,2})\s*ホール\s*(?:以上|超)/);
 const jacketNo=/ジャケット(?:不要|なし|無し)|上着(?:不要|なし|無し)/.test(q);
 const jacketYes=!jacketNo&&/ジャケット(?:必須|必要)|上着(?:必須|必要)/.test(q);
 const p={raw:input.trim(),prefectures:loc.hard,softPrefectures:loc.soft,
   originApprox:loc.origin?loc.origin+"起点（移動時間未確認）":null,
   travelRequest:loc.hours,budget:m?.amount||null,budgetHard:Boolean(m?.hard),
   priceMode,playDate:date&&!date.past?date.iso:null,playDateLabel:date&&!date.past?date.label:null,
   dateWarning:date?.past?"希望日が過去の日付です":null,
   intentTags:uniq(positive.filter(x=>!negative.includes(x))),excludedIntents:negative,
   tags:uniq(positive.map(x=>INTENTS[x].label)),terms:termsFrom(q),
   jacketRequired:jacketNo?false:jacketYes?true:null,
   maxDifficulty:positive.includes("beginner")?54:null,
   minDifficulty:positive.includes("challenge")?65:null,
   coolSummer:positive.includes("highland"),
   minEvaluation:rating?Number(rating[1]):null,minHoles:holes?Number(holes[1]):null,
   understood:[],notices:[]};
 if(loc.hard.length)p.understood.push(loc.hard.length<=3?loc.hard.join("・"):loc.hard.length+"都道府県");
 if(loc.origin){p.understood.push(loc.origin+"周辺");p.notices.push("移動時間は計算していません。近隣エリアの候補です。");}
 if(p.playDateLabel){p.understood.push(p.playDateLabel);p.notices.push("希望日の空き枠と料金は未確認です。");}
 if(p.budget)p.understood.push((priceMode==="holiday"?"土日祝 ":"平日 ")+yen(p.budget)+(p.budgetHard?"以内":"前後"));
 if(p.minEvaluation)p.understood.push("評価"+p.minEvaluation+"以上");
 if(p.jacketRequired!==null)p.understood.push(p.jacketRequired?"ジャケット着用希望":"ジャケット不要希望");
 for(const key of p.intentTags.slice(0,4))p.understood.push(INTENTS[key].label);
 if(p.dateWarning)p.notices.push(p.dateWarning);
 return p;
}
function fuzzy(a,b){
 const A=norm(a),B=norm(b);if(A.length<2||B.length<2)return 0;
 const big=x=>{const o=new Map();for(let i=0;i<x.length-1;i++){const v=x.slice(i,i+2);o.set(v,(o.get(v)||0)+1);}return o;};
 const x=big(A),y=big(B);let overlap=0;for(const [k,v] of x)overlap+=Math.min(v,y.get(k)||0);
 return overlap*2/(A.length+B.length-2);
}
function scoreIntent(k,c,text){
 const d=number(c.difficulty_index);
 if(k==="beginner"){if(d!=null&&d<=54)return [17,"難易度が比較的穏やかな目安"];if(d!=null&&d>=75)return [-12,null];}
 if(k==="challenge"){if(d!=null&&d>=65)return [17,"挑戦しがいのある難易度目安"];if(d!=null&&d<=45)return [-10,null];}
 if(k==="affordable"){const v=number(c.weekday_min_price_yen);if(v!=null&&v<=8000)return [13,"平日"+yen(v)+"の目安"];}
 if(k==="sea"&&/シーサイド/.test(c.course_type||""))return [22,"シーサイドコース"];
 if(k==="forest"&&/林間/.test(c.course_type||""))return [19,"林間コース"];
 if(k==="riverside"&&/河川/.test(c.course_type||""))return [19,"河川敷コース"];
 if(k==="highland"&&/山岳/.test(c.course_type||""))return [14,"山岳タイプのコース"];
 if(k==="flat"&&/フラット|平坦|少ない/.test(c.course_vertical_interval||""))return [17,"起伏が少ないとの記載"];
 if(k==="short"&&number(c.hole_count)<18&&number(c.hole_count)>0)return [14,String(c.hole_count)+"ホール"];
 if(k==="dining"&&number(c.rating_meal)>=4.1)return [15,"食事の口コミ評価が高い"];
 if(k==="premium"&&c.dress_level==="FORMAL")return [8,"来場時の服装規定あり"];
 if(k==="casual"&&c.dress_level==="RELAXED")return [8,"服装規定が比較的簡素"];
 const regex=EVIDENCE[k];
 if(regex&&regex.test(text))return [13,INTENTS[k].label+"に関するコース案内"];
 return [0,null];
}
export function evaluateCourse(c,p,{relaxBudget=false,relaxArea=false}={}){
 let score=0;const reasons=[];
 const add=(v,label)=>{score+=v;if(v>0&&label)reasons.push({label,points:v});};
 if(p.prefectures.length){
  if(p.prefectures.includes(c.prefecture))add(26,"希望エリア："+c.prefecture);
  else if(!relaxArea)return null;
  else add(-12,null);
 }else if(p.softPrefectures.length){
  if(p.softPrefectures.includes(c.prefecture))add(24,c.prefecture+"（出発地周辺の候補）");
  else add(-10,null);
 }
 const price=number(p.priceMode==="holiday"?c.holiday_min_price_yen:c.weekday_min_price_yen);
 if(p.budget!=null){
  if(price==null&&p.budgetHard&&!relaxBudget)return null;
  if(price!=null&&price<=p.budget)add(19,(p.priceMode==="holiday"?"土日祝":"平日")+"料金目安 "+yen(price));
  else if(p.budgetHard&&!relaxBudget)return null;
  else add(-Math.min(24,price==null?14:4+(price-p.budget)/900),null);
 }
 if(p.minEvaluation!=null){
  const rating=number(c.evaluation);
  if(rating!=null&&rating<p.minEvaluation)return null;
  if(rating!=null)add(11,"口コミ評価 "+rating.toFixed(1));
 }
 if(p.minHoles!=null&&number(c.hole_count)!=null&&number(c.hole_count)<p.minHoles)return null;
 const text=norm([c.course_caption,c.editorial_feature_summary,c.editorial_nickname,c.course_type,c.address,c.highway,c.course_vertical_interval].join(" "));
 for(const key of p.intentTags){const [pts,reason]=scoreIntent(key,c,text);add(pts,reason);}
 for(const key of p.excludedIntents){const [pts]=scoreIntent(key,c,text);if(pts>0)add(-8,null);}
 const dress=norm(c.dress_code_raw);
 if(p.jacketRequired===false){
  if(/ジャケット不要|ジャケットの着用は不要|ジャケット着用不要/.test(dress))add(16,"ジャケット不要との明記あり");
  if(c.jacket_required===true)add(-18,null);
 }
 if(p.jacketRequired===true&&c.jacket_required===true)add(12,"ジャケット着用規定あり");
 const name=norm(c.course_name),abbr=norm(c.course_name_abbr);
 for(const term of p.terms){
  if(name.includes(term)||abbr.includes(term))add(36,"コース名の一致："+term);
  else if(text.includes(term))add(12,"コース案内の一致："+term);
  else if(term.length>=3&&fuzzy(name,term)>.69)add(12,"似たコース名："+term);
 }
 if(number(c.evaluation)>0)add(Math.min(8,Math.max(0,(number(c.evaluation)-2.5)*3)),null);
 if(number(c.review_count)>0)add(Math.min(4,Math.log10(number(c.review_count)+1)),null);
 reasons.sort((a,b)=>b.points-a.points);
 return {course:c,score:Math.round(score*10)/10,reasons:uniq(reasons.map(x=>x.label)).slice(0,3)};
}
export function searchCourses(rows,params,reference=new Date()){
 const p=parseQuery(params.get("q")||"",reference);
 const selected=params.get("prefecture")||"";
 if(PREFS.includes(selected)){p.prefectures=[selected];p.softPrefectures=[];}
 const sort=params.get("sort")||"recommended";
 const page=Math.max(1,Math.min(1000,parseInt(params.get("page")||"1",10)||1));
 const limit=Math.max(6,Math.min(48,parseInt(params.get("limit")||"24",10)||24));
 const run=options=>rows.map(c=>evaluateCourse(c,p,options)).filter(Boolean);
 let list=run({}),relaxation=null;
 if(!list.length&&p.budgetHard){list=run({relaxBudget:true});if(list.length)relaxation="予算を広げた参考候補です。";}
 if(!list.length&&p.prefectures.length){list=run({relaxBudget:true,relaxArea:true});if(list.length)relaxation="対象エリア外の参考候補も含みます。";}
 if(p.softPrefectures.length&&!p.prefectures.length){
  const nearby=list.filter(x=>p.softPrefectures.includes(x.course.prefecture));
  if(nearby.length)list=nearby;
 }
 if(relaxation)p.notices.push(relaxation);
 const priceField=sort==="weekday_price"?"weekday_min_price_yen":sort==="holiday_price"?"holiday_min_price_yen":null;
 list.sort((a,b)=>{
  if(sort==="rating"&&number(a.course.evaluation)!==number(b.course.evaluation))
   return (number(b.course.evaluation)||0)-(number(a.course.evaluation)||0);
  if(priceField){
   const ap=number(a.course[priceField])??Number.MAX_SAFE_INTEGER;
   const bp=number(b.course[priceField])??Number.MAX_SAFE_INTEGER;
   if(ap!==bp)return ap-bp;
  }
  return b.score-a.score||(number(b.course.evaluation)||0)-(number(a.course.evaluation)||0)||Number(a.course.gora_course_id)-Number(b.course.gora_course_id);
 });
 const counts={};for(const c of rows)counts[c.prefecture]=(counts[c.prefecture]||0)+1;
 const offset=(page-1)*limit;
 return {query:p.raw,parsed:p,selectedPrefecture:selected,sort,totalCourses:rows.length,total:list.length,
  facets:{prefectures:counts},page,limit,
  items:list.slice(offset,offset+limit).map(x=>({...x.course,match_score:x.score,match_reasons:x.reasons}))};
}

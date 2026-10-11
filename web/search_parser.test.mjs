import test from "node:test";
import assert from "node:assert/strict";
import {parseQuery,filterCourse} from "./api/search.js";
import {searchCourses} from "./lib/course-matcher.js";
const fixed=new Date("2026-10-11T09:00:00Z");

test("search understands regional synonym, budget, beginner and jacket intent",()=>{
 const p=parseQuery("関西で1.3万円以下、初心者、ジャケット不要",fixed);
 assert.ok(p.prefectures.includes("大阪府"));
 assert.equal(p.budget,13000);
 assert.equal(p.jacketRequired,false);
 assert.ok(p.intentTags.includes("beginner"));
 assert.equal(p.budgetHard,true);
});
test("travel origin is nearby-area hint, never a fabricated ETA",()=>{
 const p=parseQuery("大阪から1時間、初心者",fixed);
 assert.equal(p.prefectures.length,0);
 assert.ok(p.softPrefectures.includes("兵庫県"));
 assert.ok(p.notices.some(x=>x.includes("移動時間")));
 assert.equal(p.travelRequest,1);
});
test("specific dates do not become monetary budgets",()=>{
 const p=parseQuery("2026年10月18日に熊本で友達と海が見える予算15000円以下",fixed);
 assert.equal(p.playDate,"2026-10-18");
 assert.equal(p.priceMode,"holiday");
 assert.equal(p.budget,15000);
 assert.ok(p.intentTags.includes("sea"));
 assert.ok(p.prefectures.includes("熊本県"));
});
test("different wordings drive matching reasons without inventing compatibility percent",()=>{
 const rows=[
  {gora_course_id:1,prefecture:"熊本県",course_name:"シーサイドGC",course_caption:"海を望む景色の良い丘陵コース",course_type:"シーサイド",holiday_min_price_yen:14000,evaluation:4.4,review_count:80},
  {gora_course_id:2,prefecture:"熊本県",course_name:"林間GC",course_caption:"林間で静かな森のコース",course_type:"林間",holiday_min_price_yen:13000,evaluation:4.5,review_count:80}
 ];
 const result=searchCourses(rows,{get:key=>key==="q"?"熊本の海が見えて景色のいいコース 1.5万円以内":null},fixed);
 assert.equal(result.items[0].gora_course_id,1);
 assert.ok(result.items[0].match_reasons.some(x=>x.includes("シーサイド")||x.includes("景色")));
 assert.equal(result.parsed.availability,undefined);
 assert.equal(result.items[0].compatibilityPercentage,undefined);
});
test("strict budget protects users from over-budget recommendations",()=>{
 const row={gora_course_id:1,prefecture:"大阪府",course_name:"テスト",weekday_min_price_yen:10000};
 const p=parseQuery("大阪で平日1万円以内",fixed);
 assert.equal(filterCourse(row,p),true);
 const over={...row,weekday_min_price_yen:30000};
 assert.equal(filterCourse(over,p),false);
});
test("zero hard matches relax with an explicit warning",()=>{
 const result=searchCourses([{gora_course_id:1,prefecture:"大阪府",course_name:"参考",weekday_min_price_yen:11000}],{
  get:key=>key==="q"?"大阪で平日8000円以下":null
 },fixed);
 assert.equal(result.total,1);
 assert.ok(result.parsed.notices.some(x=>x.includes("予算を広げた")));
 assert.equal(result.items[0].match_reasons.some(x=>x.includes("¥8,000")),false);
});
test("jacket unknown must not be presented as confirmed free",()=>{
 const p=parseQuery("大阪でジャケット不要",fixed);
 const row={gora_course_id:1,prefecture:"大阪府",course_name:"例",jacket_required:false};
 const result=searchCourses([row],{get:key=>key==="q"?"大阪でジャケット不要":null},fixed);
 assert.equal(result.total,1);
 assert.ok(!result.items[0].match_reasons.some(x=>x.includes("不要との明記")));
});

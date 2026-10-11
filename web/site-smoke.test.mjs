import test from "node:test";
import assert from "node:assert/strict";
import {detailHTML,directoryHTML,guideHTML} from "./api/seo-page.js";
import {buildSitemap} from "./api/sitemap.js";
import {goraLink,courseImages,areaLink} from "./lib/site-server.js";

const sample={
 gora_course_id:90107,
 course_name:"テストゴルフ場",
 prefecture:"大阪府",
 course_caption:"季節ごとの景色を楽しめるサンプルコース。",
 address:"大阪府",
 image_url_1:"https://img.example.com/1.jpg",
 image_url_2:"https://img.example.com/2.jpg",
 gora_reserve_url:"https://gora.golf.rakuten.co.jp/guide/disp/c_id/90107",
 weekday_min_price_yen:8000,
 holiday_min_price_yen:12000,
 evaluation:4.1,
 review_count:100,
 hole_count:18,
 dress_code_raw:"ジャケットの着用をお願いします。"
};

test("course details are readable and directly bookable",()=>{
 const html=detailHTML({course:sample,seasons:[],ads:[]});
 assert.match(html,/テストゴルフ場/);
 assert.match(html,/楽天GORAで空き枠・プランを見る/);
 assert.match(html,/img.example.com\/2.jpg/);
 assert.match(html,/ジャケットの着用/);
 assert.match(html,/<script type='application\/ld\+json'>/);
 assert.match(html,/rel='canonical'/);
 assert.ok(!html.includes("予約リンクには広告を含みます"));
});

test("unknown dress code never implies no restrictions",()=>{
 const html=detailHTML({course:{...sample,dress_code_raw:""},seasons:[],ads:[]});
 assert.match(html,/「服装自由」を意味するものではありません/);
});

test("remote course names are HTML escaped",()=>{
 const html=detailHTML({course:{...sample,course_name:"<script>alert(1)</script>"},seasons:[],ads:[]});
 assert.ok(!html.includes("<script>alert(1)</script>"));
 assert.ok(html.includes("&lt;script&gt;"));
});

test("regional directory has real links and canonical",()=>{
 const html=directoryHTML([sample],1,"大阪府",1);
 assert.match(html,/\/course\/90107/);
 assert.match(html,/\/prefecture\/osaka/);
});

test("sitemap includes detail and area paths with images",()=>{
 const xml=buildSitemap([sample]);
 assert.match(xml,/\/course\/90107/);
 assert.match(xml,/\/prefecture\/osaka/);
 assert.match(xml,/image:image/);
});

test("booking URLs must use HTTPS Rakuten domains",()=>{
 assert.ok(goraLink(sample.gora_reserve_url));
 assert.equal(goraLink("javascript:alert(1)"),"");
 assert.equal(goraLink("https://rakuten.co.jp.attacker.test/x"),"");
 assert.equal(courseImages(sample).length,2);
 assert.equal(areaLink("大阪府"),"/prefecture/osaka");
});

test("dress guide is server-rendered",()=>{
 const html=guideHTML();
 assert.match(html,/ゴルフ場の服装/);
 assert.match(html,/予約前に確認/);
});

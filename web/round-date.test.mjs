import test from "node:test";
import assert from "node:assert/strict";
import {parseJapaneseDate} from "./assets/round-date.js";
import {parseQuery} from "./api/search.js";
const reference=new Date("2026-10-11T09:00:00Z"); // 18:00 JST

test("absolute Japanese dates and year rollover",()=>{
 assert.equal(parseJapaneseDate("10月18日の日曜、大阪で",reference).iso,"2026-10-18");
 assert.equal(parseJapaneseDate("2026/10/18",reference).iso,"2026-10-18");
 assert.equal(parseJapaneseDate("1月5日",reference).iso,"2027-01-05");
 assert.equal(parseJapaneseDate("10月32日",reference),null);
});
test("relative weekend and next week",()=>{
 assert.equal(parseJapaneseDate("来週土曜",reference).iso,"2026-10-17");
 assert.equal(parseJapaneseDate("今週末",reference).iso,"2026-10-17");
 assert.equal(parseJapaneseDate("明日",reference).iso,"2026-10-12");
 assert.equal(parseJapaneseDate("明後日",reference).iso,"2026-10-13");
});
test("do not invent a date for a vague weekend",()=>{
 assert.equal(parseJapaneseDate("土日で1万円以内",reference),null);
 assert.equal(parseJapaneseDate("17日に",reference),null);
});
test("search parses budget and recognizes date without claiming availability",()=>{
 const p=parseQuery("2026年10月18日、大阪で予算13,000円以下");
 assert.equal(p.playDate,"2026-10-18");
 assert.equal(p.budget,13000);
 assert.equal(p.priceMode,"holiday");
 assert.equal(p.availability,undefined);
});

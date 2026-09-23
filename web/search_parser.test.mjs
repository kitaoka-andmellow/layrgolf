import {parseQuery, filterCourse} from './api/search.js';
const p=parseQuery('関西で1.3万円以下、初心者、ジャケット不要');
if(!p.prefectures.includes('大阪府') || p.budget!==13000 || p.jacketRequired!==false || p.maxDifficulty!==54) throw new Error('parser failed');
const o=parseQuery('大阪から1時間、初心者');
if(!o.originApprox || !o.prefectures.includes('兵庫県')) throw new Error('origin heuristic failed');
const c={prefecture:'大阪府',weekday_min_price_yen:10000,difficulty_index:50,jacket_required:false,evaluation:4.1,hole_count:18};
if(!filterCourse(c,p)) throw new Error('filter failed');
console.log('OK');

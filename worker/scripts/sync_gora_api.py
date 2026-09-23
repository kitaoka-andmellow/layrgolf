#!/usr/bin/env python3
"""Sync Rakuten GORA nationwide course data via official APIs.

No credentials are stored in files. Set:
  RAKUTEN_APP_ID
  RAKUTEN_ACCESS_KEY
Optional:
  RAKUTEN_AFFILIATE_ID

Two stages:
  1) Search API by prefecture (areaCode 1..47), paginated at 30 rows/page.
  2) Detail API per golfCourseId, with resumable local cache and backoff.

Outputs are factual API fields + clearly separated derived/editorial fields.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
import sqlite3
import sys
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_OUT = ROOT / "output"
DEFAULT_CACHE = Path(os.getenv("COURSE_CODE_CACHE_DIR", str(ROOT / ".api_cache")))

SEARCH_API = "https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseSearch/20170623"
DETAIL_API = "https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseDetail/20170623"
DOC_SEARCH = "https://webservice.rakuten.co.jp/documentation/gora-golf-course-search"
DOC_DETAIL = "https://webservice.rakuten.co.jp/documentation/gora-golf-course-detail"

PREFS = [
    (1,"北海道"),(2,"青森県"),(3,"岩手県"),(4,"宮城県"),(5,"秋田県"),(6,"山形県"),(7,"福島県"),
    (8,"茨城県"),(9,"栃木県"),(10,"群馬県"),(11,"埼玉県"),(12,"千葉県"),(13,"東京都"),(14,"神奈川県"),
    (15,"新潟県"),(16,"富山県"),(17,"石川県"),(18,"福井県"),(19,"山梨県"),(20,"長野県"),(21,"岐阜県"),
    (22,"静岡県"),(23,"愛知県"),(24,"三重県"),(25,"滋賀県"),(26,"京都府"),(27,"大阪府"),(28,"兵庫県"),
    (29,"奈良県"),(30,"和歌山県"),(31,"鳥取県"),(32,"島根県"),(33,"岡山県"),(34,"広島県"),(35,"山口県"),
    (36,"徳島県"),(37,"香川県"),(38,"愛媛県"),(39,"高知県"),(40,"福岡県"),(41,"佐賀県"),(42,"長崎県"),
    (43,"熊本県"),(44,"大分県"),(45,"宮崎県"),(46,"鹿児島県"),(47,"沖縄県")
]

COLD = {"北海道","青森県","岩手県","秋田県","山形県","新潟県","長野県"}
COOL = {"宮城県","福島県","栃木県","群馬県","山梨県","富山県","石川県","福井県","岐阜県"}
WARM = {"和歌山県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県"}
SUBTROPICAL = {"沖縄県"}

SEASONS = {
    "cold": {
        "spring": ("朝夕の冷え込み", "保温ベース＋薄手防風", "寒暖差を前提に脱ぎ着できる層を重ねる。"),
        "summer": ("爽涼〜強い日差し", "吸汗速乾＋UV", "日中は軽装。高地は薄手の羽織りを携行する。"),
        "autumn": ("冷え込みが早い", "長袖モック＋ベスト", "日没前後の気温低下に備える。"),
        "winter": ("積雪・休場注意", "保温＋中綿＋防風", "営業状況を確認し、可動域を残す防寒を優先する。"),
    },
    "cool": {
        "spring": ("朝夕は冷える", "ポロ＋薄手ニット", "標高差を見込み一枚追加できる構成にする。"),
        "summer": ("平地は暑い", "吸汗速乾＋UV", "汗処理と日射対策を優先する。"),
        "autumn": ("寒暖差大", "長袖ポロ＋ベスト", "朝の冷え込みに合わせて調整する。"),
        "winter": ("防寒必須", "保温＋防風", "厚着より薄手を重ね、スイング可動域を確保する。"),
    },
    "normal": {
        "spring": ("寒暖差あり", "ポロ＋薄手ニット", "クラブハウス用の上着も準備する。"),
        "summer": ("高温多湿", "吸汗速乾＋UV", "襟・袖規定を守りつつ汗処理を優先する。"),
        "autumn": ("ベストシーズン", "長袖ポロ＋ベスト", "朝夕と日中で一枚ずつ調整する。"),
        "winter": ("風が冷たい", "保温＋防風", "着膨れを避け、防風性を優先する。"),
    },
    "warm": {
        "spring": ("温暖・日差し強", "半袖ポロ＋薄手羽織り", "朝の風を止められる軽い上着を持つ。"),
        "summer": ("猛暑・高湿度", "冷感速乾＋UV", "帽子・水分・替えインナーを準備する。"),
        "autumn": ("残暑あり", "半袖／長袖切替", "残暑を見込み袖丈を変えられる構成にする。"),
        "winter": ("比較的温暖", "長袖ベース＋軽量防風", "重装備より風対策を中心にする。"),
    },
    "subtropical": {
        "spring": ("暖かい", "半袖ポロ＋UV", "日射対策と急な雨への備えを優先する。"),
        "summer": ("猛暑・強日射", "冷感速乾＋UV＋帽子", "暑熱対策と水分補給を最優先にする。"),
        "autumn": ("暖かい・風雨注意", "半袖主体＋軽量レイン", "風雨予報を確認する。"),
        "winter": ("温暖", "長袖ポロ＋薄手防風", "朝夕の風に対応できる一枚を持つ。"),
    },
}

SEARCH_FIELDS = [
    "golfCourseId","golfCourseName","golfCourseAbbr","golfCourseNameKana","golfCourseCaption",
    "address","latitude","longitude","highway","golfCourseDetailUrl","reserveCalUrl","ratingUrl",
    "golfCourseImageUrl","evaluation"
]
DETAIL_FIELDS = [
    "golfCourseId","golfCourseName","golfCourseAbbr","golfCourseNameKana","golfCourseCaption","information",
    "highway","ic","icDistance","latitude","longitude","postalCode","address","telephoneNo","faxNo",
    "openDay","closeDay","creditCard","shoes","dressCode","practiceFacility","lodgingFacility","otherFacility",
    "golfCourseImageUrl1","golfCourseImageUrl2","golfCourseImageUrl3","golfCourseImageUrl4","golfCourseImageUrl5",
    "weekdayMinPrice","baseWeekdayMinPrice","holidayMinPrice","baseHolidayMinPrice","designer","courseType",
    "courseVerticalInterval","dimension","green","greenCount","holeCount","parCount","courseName","courseDistance",
    "longDrivingContest","nearPin","ratingNum","evaluation","staff","facility","meal","course","costperformance",
    "distance","fairway","reserveCalUrl","voiceUrl","layoutUrl","routeMapUrl"
]

FIELD_MAP = {
    "golfCourseId":"gora_course_id","golfCourseName":"course_name","golfCourseAbbr":"course_name_abbr",
    "golfCourseNameKana":"course_name_kana","golfCourseCaption":"course_caption","information":"information",
    "highway":"highway","ic":"ic","icDistance":"ic_distance","latitude":"latitude","longitude":"longitude",
    "postalCode":"postal_code","address":"address","telephoneNo":"telephone_no","faxNo":"fax_no",
    "openDay":"open_day","closeDay":"close_day","creditCard":"credit_card","shoes":"shoes_raw",
    "dressCode":"dress_code_raw","practiceFacility":"practice_facility","lodgingFacility":"lodging_facility",
    "otherFacility":"other_facility","golfCourseImageUrl":"image_url_1","golfCourseImageUrl1":"image_url_1",
    "golfCourseImageUrl2":"image_url_2","golfCourseImageUrl3":"image_url_3","golfCourseImageUrl4":"image_url_4",
    "golfCourseImageUrl5":"image_url_5","weekdayMinPrice":"weekday_min_price_yen",
    "baseWeekdayMinPrice":"base_weekday_min_price_yen","holidayMinPrice":"holiday_min_price_yen",
    "baseHolidayMinPrice":"base_holiday_min_price_yen","designer":"designer","courseType":"course_type",
    "courseVerticalInterval":"course_vertical_interval","dimension":"dimension","green":"green","greenCount":"green_count",
    "holeCount":"hole_count","parCount":"par_count","courseName":"course_names","courseDistance":"course_distance",
    "longDrivingContest":"long_driving_contest","nearPin":"near_pin","ratingNum":"review_count","evaluation":"evaluation",
    "staff":"rating_staff","facility":"rating_facility","meal":"rating_meal","course":"rating_course",
    "costperformance":"rating_costperformance","distance":"rating_distance","fairway":"rating_fairway",
    "golfCourseDetailUrl":"gora_detail_url","reserveCalUrl":"gora_reserve_url","ratingUrl":"gora_rating_url",
    "voiceUrl":"gora_voice_url","layoutUrl":"gora_layout_url","routeMapUrl":"gora_route_map_url",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def clean(s: Any) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(s or ""))).strip()


def bool01(v: bool) -> int:
    return 1 if v else 0


def api_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("Items") or payload.get("items") or []
    out = []
    for x in items:
        if isinstance(x, dict):
            y = x.get("Item") or x.get("item") or x
            if isinstance(y, dict): out.append(y)
    return out


def api_detail_item(payload: dict[str, Any]) -> dict[str, Any]:
    for key in ("Item","item"):
        if isinstance(payload.get(key), dict): return payload[key]
    items = api_items(payload)
    return items[0] if items else payload if isinstance(payload, dict) else {}


@dataclass
class Client:
    app_id: str
    access_key: str
    affiliate_id: str = ""
    min_interval: float = 0.50
    timeout: int = 30
    max_retries: int = 6

    def __post_init__(self):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": "CourseCodeJapan/4.0",
            "Accept": "application/json",
            # Keep the Access Key out of request URLs and error traces.
            "accessKey": self.access_key,
        })
        origin = os.getenv("RAKUTEN_ORIGIN", "https://layrgolf.andmellow.jp").rstrip("/")
        if origin:
            self.s.headers.update({"Origin": origin, "Referer": origin + "/"})
        self.last_request = 0.0

    def get(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        # Rakuten accepts accessKey in either the header or query parameter.
        # Header transport prevents credentials from leaking into URLs/logs.
        base = {
            "format":"json",
            "formatVersion":2,
            "applicationId":self.app_id,
            **params,
        }
        if self.affiliate_id:
            base["affiliateId"] = self.affiliate_id
        for attempt in range(self.max_retries + 1):
            elapsed = time.time() - self.last_request
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            try:
                r = self.s.get(url, params=base, timeout=self.timeout)
                self.last_request = time.time()
                if r.status_code in (429, 500, 503):
                    if attempt >= self.max_retries:
                        body = r.text[:1000].replace(self.access_key, "***REDACTED***")
                        raise RuntimeError(f"Rakuten API HTTP {r.status_code}: {body}")
                    delay = min(60, (2 ** attempt) + random.random())
                    print(f"[retry] {r.status_code}; sleep {delay:.1f}s", file=sys.stderr)
                    time.sleep(delay)
                    continue
                if r.status_code in (401, 403):
                    body = r.text[:1000].replace(self.access_key, "***REDACTED***")
                    hint = (
                        "Authentication/authorization failed. Verify that the Application ID and Access Key belong to the same Rakuten Web Service app, "
                        "and that the app's API access scopes include Rakuten GORA APIs."
                    )
                    raise RuntimeError(f"Rakuten API HTTP {r.status_code}: {body}\n{hint}")
                if r.status_code >= 400:
                    body = r.text[:1000].replace(self.access_key, "***REDACTED***")
                    raise RuntimeError(f"Rakuten API HTTP {r.status_code}: {body}")
                data = r.json()
                if isinstance(data, dict) and data.get("error"):
                    raise RuntimeError(f"Rakuten API error: {data.get('error')}: {data.get('error_description','')}")
                return data
            except (requests.RequestException, ValueError) as e:
                if attempt >= self.max_retries: raise
                delay = min(60, (2 ** attempt) + random.random())
                print(f"[retry] {type(e).__name__}: {e}; sleep {delay:.1f}s", file=sys.stderr)
                time.sleep(delay)
        raise RuntimeError("unreachable")


def climate_zone(pref: str) -> str:
    if pref in SUBTROPICAL: return "subtropical"
    if pref in COLD: return "cold"
    if pref in COOL: return "cool"
    if pref in WARM: return "warm"
    return "normal"


def dress_flags(text: str, shoes: str = "") -> dict[str, Any]:
    t = clean(text + " " + shoes)
    def has(p: str) -> bool: return bool(re.search(p, t, re.I))
    jacket_mentioned = has(r"ジャケット|ブレザー|上着")
    jacket_required = has(r"(?:ジャケット|ブレザー|上着).{0,22}(?:着用|必須|お願い|原則)") or has(r"(?:着用|必須|原則).{0,22}(?:ジャケット|ブレザー|上着)")
    denim_banned = has(r"(?:ジーンズ|ジーパン|Gパン|デニム).{0,20}(?:不可|禁止|遠慮|断り|NG)") or has(r"(?:不可|禁止|遠慮|断り|NG).{0,20}(?:ジーンズ|ジーパン|Gパン|デニム)")
    tshirt_banned = has(r"Tシャツ.{0,20}(?:不可|禁止|遠慮|断り|NG)") or has(r"(?:不可|禁止|遠慮|断り|NG).{0,20}Tシャツ")
    sandals_banned = has(r"(?:サンダル|クロックス|下駄|スリッパ).{0,20}(?:不可|禁止|遠慮|断り|NG)") or has(r"(?:不可|禁止|遠慮|断り|NG).{0,20}(?:サンダル|クロックス|下駄|スリッパ)")
    collar = has(r"襟|衿|ポロシャツ|ハイネック|モックネック")
    tuck = has(r"裾.{0,18}(?:入|出さ)|シャツ.{0,18}(?:入|出さ)|タックイン")
    shorts = has(r"短パン|ハーフパンツ|ショートパンツ")
    socks = has(r"ソックス|靴下|ハイソックス")
    shoes_flag = has(r"ソフトスパイク|スパイクレス|ゴルフシューズ|メタルスパイク")
    strict = sum([jacket_required, denim_banned, tshirt_banned, sandals_banned, tuck])
    level = "FORMAL" if strict >= 4 or (jacket_required and strict >= 2) else "SMART" if strict >= 2 or jacket_mentioned or collar else "RELAXED"
    return {
        "dress_level": level,
        "jacket_mentioned": bool01(jacket_mentioned),
        "jacket_required": bool01(jacket_required),
        "collar_mentioned": bool01(collar),
        "denim_banned": bool01(denim_banned),
        "tshirt_banned": bool01(tshirt_banned),
        "sandals_banned": bool01(sandals_banned),
        "tuck_in_mentioned": bool01(tuck),
        "shorts_mentioned": bool01(shorts),
        "socks_mentioned": bool01(socks),
        "golf_shoes_mentioned": bool01(shoes_flag),
    }


def parse_distance_yards(v: Any) -> int | None:
    m = re.search(r"([0-9][0-9,]*)\s*Y", str(v or ""), re.I)
    return int(m.group(1).replace(",", "")) if m else None


def difficulty(row: dict[str, Any]) -> tuple[int | None, str]:
    dist = parse_distance_yards(row.get("course_distance"))
    holes = row.get("hole_count")
    par = row.get("par_count")
    if not dist or not holes or int(holes) < 18:
        return None, "UNRATED"
    score = 48
    if dist >= 7100: score += 22
    elif dist >= 6800: score += 16
    elif dist >= 6500: score += 10
    elif dist <= 6000: score -= 7
    typ = clean(row.get("course_type"))
    vert = clean(row.get("course_vertical_interval"))
    if "山岳" in typ: score += 8
    if "河川" in typ: score -= 4
    if "フラット" in vert: score -= 3
    if "アップダウン" in vert: score += 3
    try:
        if int(par or 0) >= 73: score += 2
    except Exception: pass
    score = max(20, min(90, score))
    label = "CHALLENGING" if score >= 70 else "TACTICAL" if score >= 55 else "FRIENDLY"
    return score, label


def nickname(row: dict[str, Any]) -> tuple[str, str]:
    designer = clean(row.get("designer"))
    typ = clean(row.get("course_type"))
    holes = row.get("hole_count")
    dress = row.get("dress_level")
    if holes and int(holes) < 18: n = "ショートゲームを磨く一日"
    elif holes and int(holes) >= 27: n = f"{int(holes)}ホール、攻略ルートを選ぶ"
    elif "河川" in typ: n = "フラットを、正確に攻める"
    elif "林間" in typ: n = "樹林のラインを読む"
    elif "山岳" in typ: n = "高低差までコースになる"
    elif "シーサイド" in typ: n = "海風まで攻略する"
    elif designer: n = f"{designer}設計を辿る"
    else: n = "地形と戦略を楽しむ一日"
    facts = []
    if designer: facts.append(f"{designer}設計")
    if holes: facts.append(f"{int(holes)}ホール")
    if typ: facts.append(f"{typ}コース")
    if dress == "FORMAL": facts.append("来場時ドレスコードは厳格寄り")
    elif dress == "SMART": facts.append("服装マナーを明文化")
    else: facts.append("服装指定は比較的シンプル")
    return n, "・".join(facts[:4])


def seasons_for(row: dict[str, Any]) -> list[dict[str, Any]]:
    z = climate_zone(row["prefecture"])
    out = []
    for season, (cond, wear, note) in SEASONS[z].items():
        etiquette = note
        if row.get("dress_level") == "FORMAL":
            etiquette += " 来場時の上着規定を優先し、夏季免除の有無を予約前に確認する。"
        elif row.get("jacket_required"):
            etiquette += " 来場時の上着規定を予約前に再確認する。"
        out.append({
            "gora_course_id": row["gora_course_id"], "season": season, "climate_zone": z,
            "regional_condition": cond, "wear_recommendation": wear, "etiquette_note": etiquette,
            "data_type": "editorial_guidance", "rule_version": "2026-09-v3"
        })
    return out


def ads_for(row: dict[str, Any]) -> list[dict[str, Any]]:
    formal = row.get("dress_level") == "FORMAL"
    dress_kw = "ゴルフ ジャケット" if formal else "ゴルフ ポロシャツ"
    return [
        {"gora_course_id":row["gora_course_id"],"slot":"detail_sidebar_dress","season":"all","category":"dress","rakuten_search_keyword":dress_kw},
        {"gora_course_id":row["gora_course_id"],"slot":"detail_sidebar_shoes","season":"all","category":"footwear","rakuten_search_keyword":"ゴルフ シューズ"},
        {"gora_course_id":row["gora_course_id"],"slot":"detail_sidebar_summer","season":"summer","category":"seasonal","rakuten_search_keyword":"ゴルフ 冷感インナー UVカット"},
        {"gora_course_id":row["gora_course_id"],"slot":"detail_sidebar_winter","season":"winter","category":"seasonal","rakuten_search_keyword":"ゴルフ 防寒インナー 防風"},
    ]


def normalize(api_row: dict[str, Any], pref_code: int, pref: str, stage: str) -> dict[str, Any]:
    row: dict[str, Any] = {"pref_code":pref_code,"prefecture":pref}
    for k, v in api_row.items():
        if k in FIELD_MAP and v not in (None, ""):
            row[FIELD_MAP[k]] = v
    row["source_stage"] = stage
    row["api_source_url"] = DOC_DETAIL if stage == "detail" else DOC_SEARCH
    row["fetched_at"] = now_iso()
    return row


def load_cache(path: Path) -> dict[int, dict[str, Any]]:
    if not path.exists(): return {}
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
        return {int(x["gora_course_id"]): x for x in rows if x.get("gora_course_id")}
    except Exception: return {}


def save_json(path: Path, obj: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def save_csv(path: Path, rows: list[dict[str, Any]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    fields=[]; seen=set()
    for r in rows:
        for k in r:
            if k not in seen: seen.add(k); fields.append(k)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w=csv.DictWriter(f, fieldnames=fields, extrasaction="ignore"); w.writeheader(); w.writerows(rows)


def write_sqlite(path: Path, courses: list[dict[str, Any]], seasons: list[dict[str, Any]], ads: list[dict[str, Any]]):
    if path.exists(): path.unlink()
    cx=sqlite3.connect(path)
    def table(name: str, rows: list[dict[str, Any]], pk: str|None=None):
        if not rows: return
        fields=[]; seen=set()
        for r in rows:
            for k in r:
                if k not in seen: seen.add(k); fields.append(k)
        defs=[]
        for f in fields:
            vals=[r.get(f) for r in rows if r.get(f) is not None]
            typ="INTEGER" if vals and all(isinstance(v,(int,bool)) and not isinstance(v,float) for v in vals) else "REAL" if vals and all(isinstance(v,(int,float,bool)) for v in vals) else "TEXT"
            extra=" PRIMARY KEY" if pk == f else ""
            defs.append(f'"{f}" {typ}{extra}')
        cx.execute(f'CREATE TABLE "{name}" ({", ".join(defs)})')
        cols=",".join(f'"{f}"' for f in fields); q=",".join("?" for _ in fields)
        cx.executemany(f'INSERT INTO "{name}" ({cols}) VALUES ({q})', [[r.get(f) for f in fields] for r in rows])
    table("courses", courses, "gora_course_id")
    table("seasonal_guides", seasons)
    table("affiliate_slots", ads)
    cx.execute('CREATE INDEX idx_courses_pref ON courses(prefecture)')
    cx.execute('CREATE INDEX idx_courses_dress ON courses(dress_level)')
    cx.execute('CREATE INDEX idx_courses_price ON courses(weekday_min_price_yen)')
    cx.commit(); cx.close()


def fetch_search(client: Client, only_pref: int|None=None) -> list[dict[str, Any]]:
    rows=[]
    for code, pref in PREFS:
        if only_pref and code != only_pref: continue
        page=1
        while True:
            payload=client.get(SEARCH_API, {
                "areaCode":code, "hits":30, "page":page, "reservation":1,
                "elements":",".join(SEARCH_FIELDS)
            })
            items=api_items(payload)
            for it in items:
                rows.append(normalize(it, code, pref, "search"))
            pc=int(payload.get("pageCount") or 1)
            count=int(payload.get("count") or len(items))
            print(f"[search] {pref} page {page}/{pc} rows={len(items)} total={count}", file=sys.stderr)
            if page >= pc or not items: break
            page += 1
    # de-duplicate by ID; API area result is authoritative for pref label
    d={int(r["gora_course_id"]):r for r in rows if r.get("gora_course_id")}
    return sorted(d.values(), key=lambda x:(int(x.get("pref_code",99)), clean(x.get("course_name"))))


def enrich_details(client: Client, search_rows: list[dict[str, Any]], cache_file: Path, refresh: bool=False) -> list[dict[str, Any]]:
    cached={} if refresh else load_cache(cache_file)
    out=[]
    total=len(search_rows)
    for i, base in enumerate(search_rows,1):
        cid=int(base["gora_course_id"])
        if cid in cached:
            row={**base, **cached[cid]}
        else:
            payload=client.get(DETAIL_API, {
                "golfCourseId":cid, "elements":",".join(DETAIL_FIELDS)
            })
            detail=normalize(api_detail_item(payload), int(base["pref_code"]), base["prefecture"], "detail")
            row={**base, **detail}
            cached[cid]=detail
            if i % 10 == 0 or i == total:
                save_json(cache_file, list(cached.values()))
        flags=dress_flags(clean(row.get("dress_code_raw")), clean(row.get("shoes_raw")))
        row.update(flags)
        score,label=difficulty(row); row["difficulty_index"]=score; row["difficulty_label"]=label
        n,summary=nickname(row); row["editorial_nickname"]=n; row["editorial_feature_summary"]=summary
        row["editorial_disclosure"]="Course Code独自編集。ゴルフ場公式の愛称ではない。"
        row["dress_code_status"]="api_verified" if clean(row.get("dress_code_raw")) else "api_blank"
        row["record_updated_at"]=now_iso()
        out.append(row)
        if i % 25 == 0 or i == total:
            print(f"[detail] {i}/{total}", file=sys.stderr)
    save_json(cache_file, list(cached.values()))
    return out


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--pref-code", type=int, choices=range(1,48))
    ap.add_argument("--search-only", action="store_true")
    ap.add_argument("--refresh-details", action="store_true")
    ap.add_argument("--min-interval", type=float, default=0.50)
    ap.add_argument("--strict-min", type=int, default=1800, help="fail if nationwide course count is below this")
    args=ap.parse_args()

    app=os.getenv("RAKUTEN_APP_ID","").strip(); key=os.getenv("RAKUTEN_ACCESS_KEY","").strip(); aff=os.getenv("RAKUTEN_AFFILIATE_ID","").strip()
    if not app or not key:
        raise SystemExit("RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY are required")
    outdir=Path(args.out); outdir.mkdir(parents=True, exist_ok=True)
    cache=DEFAULT_CACHE; cache.mkdir(parents=True, exist_ok=True)
    client=Client(app,key,aff,min_interval=args.min_interval)

    search_rows=fetch_search(client,args.pref_code)
    save_csv(outdir/"courses_search.csv", search_rows)
    save_json(outdir/"courses_search.json", search_rows)
    if not args.pref_code and len(search_rows) < args.strict_min:
        raise SystemExit(f"nationwide search returned only {len(search_rows)} rows; expected >= {args.strict_min}")
    if args.search_only:
        print(json.dumps({"course_rows":len(search_rows),"affiliate_urls_requested":bool(aff),"generated_at":now_iso()},ensure_ascii=False,indent=2))
        return

    courses=enrich_details(client, search_rows, cache/"detail_cache.json", args.refresh_details)
    seasons=[s for c in courses for s in seasons_for(c)]
    ads=[a for c in courses for a in ads_for(c)]
    save_csv(outdir/"courses.csv", courses); save_json(outdir/"courses.json", courses)
    save_csv(outdir/"seasonal_guides.csv", seasons); save_json(outdir/"seasonal_guides.json", seasons)
    save_csv(outdir/"affiliate_slots.csv", ads); save_json(outdir/"affiliate_slots.json", ads)
    bundle={"meta":{"generated_at":now_iso(),"course_rows":len(courses),"source":"Rakuten GORA official APIs","affiliate_urls_requested":bool(aff),"facts_and_editorial_separated":True},"courses":courses,"seasonal_guides":seasons,"affiliate_slots":ads}
    save_json(outdir/"catalog_bundle.json", bundle)
    write_sqlite(outdir/"course_code.sqlite", courses,seasons,ads)
    report={
        "generated_at":now_iso(),"course_rows":len(courses),"unique_ids":len({c['gora_course_id'] for c in courses}),
        "detail_rows":sum(1 for c in courses if c.get('source_stage')=='detail'),
        "dress_code_nonblank":sum(1 for c in courses if clean(c.get('dress_code_raw'))),
        "affiliate_urls_requested":bool(aff),
        "prefecture_counts":{p:sum(1 for c in courses if c['prefecture']==p) for _,p in PREFS},
    }
    save_json(outdir/"validation_report.json", report)
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__ == "__main__": main()

#!/usr/bin/env python3
"""Resolve COURSE CODE affiliate ad slots through Rakuten Ichiba Item Search API.

The slot table stores search intent once per course. This script de-duplicates keywords,
queries Rakuten only once per unique keyword, then updates every matching slot.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import requests

ICHIBA_API = os.getenv(
    "RAKUTEN_ICHIBA_ITEM_API_URL",
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401",
)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def need(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def supabase_headers(key: str):
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def get_all_slots(base: str, key: str) -> list[dict[str, Any]]:
    s = requests.Session(); s.headers.update(supabase_headers(key))
    rows=[]; start=0; page=1000
    while True:
        r=s.get(
            f"{base.rstrip('/')}/rest/v1/affiliate_slots",
            params={"select":"gora_course_id,slot,season,rakuten_search_keyword,source_type", "source_type":"eq.rakuten_ichiba"},
            headers={"Range":f"{start}-{start+page-1}"}, timeout=60,
        )
        if r.status_code >= 400: raise RuntimeError(f"Supabase HTTP {r.status_code}: {r.text[:1000]}")
        batch=r.json(); rows.extend(batch)
        if len(batch) < page: break
        start += page
    return rows


def search_item(session: requests.Session, app: str, affiliate: str, keyword: str) -> dict[str, Any] | None:
    params={
        "format":"json", "formatVersion":2, "applicationId":app, "affiliateId":affiliate,
        "keyword":keyword, "hits":1, "availability":1, "imageFlag":1,
        "elements":"itemName,itemPrice,itemCode,itemUrl,affiliateUrl,mediumImageUrls,affiliateRate",
    }
    r=session.get(ICHIBA_API, params=params, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"Rakuten Ichiba HTTP {r.status_code} for keyword={keyword!r}: {r.text[:800]}")
    data=r.json(); items=data.get("items") or data.get("Items") or []
    if not items: return None
    item=items[0].get("item", items[0]) if isinstance(items[0],dict) else None
    return item if isinstance(item,dict) else None


def first_image(item: dict[str, Any]) -> str | None:
    imgs=item.get("mediumImageUrls") or []
    if not imgs: return None
    first=imgs[0]
    if isinstance(first, str): return first
    if isinstance(first, dict): return first.get("imageUrl") or first.get("url")
    return None


def patch_keyword(base: str, key: str, keyword: str, item: dict[str, Any]):
    target=item.get("affiliateUrl") or item.get("itemUrl")
    patch={
        "item_name":item.get("itemName"),
        "item_price_yen":item.get("itemPrice"),
        "item_image_url":first_image(item),
        "target_url":target,
        "affiliate_rate":item.get("affiliateRate"),
        "item_code":item.get("itemCode"),
        "fetched_at":now_iso(),
    }
    s=requests.Session(); s.headers.update(supabase_headers(key))
    r=s.patch(
        f"{base.rstrip('/')}/rest/v1/affiliate_slots",
        params={"rakuten_search_keyword":f"eq.{keyword}", "source_type":"eq.rakuten_ichiba"},
        headers={"Prefer":"return=minimal"},
        data=json.dumps(patch, ensure_ascii=False), timeout=60,
    )
    if r.status_code >= 400: raise RuntimeError(f"Supabase patch HTTP {r.status_code}: {r.text[:1000]}")


def main():
    app=need("RAKUTEN_APP_ID")
    access=need("RAKUTEN_ACCESS_KEY")
    affiliate=need("RAKUTEN_AFFILIATE_ID")
    supa=need("SUPABASE_URL")
    service=(os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or need("SUPABASE_SECRET_KEY"))

    slots=get_all_slots(supa, service)
    keywords=sorted({r.get("rakuten_search_keyword","").strip() for r in slots if r.get("rakuten_search_keyword")})
    session=requests.Session()
    origin=os.getenv("RAKUTEN_ORIGIN", "https://layrgolf.andmellow.jp").rstrip("/")
    session.headers.update({
        "accessKey":access,
        "Accept":"application/json",
        "User-Agent":"CourseCodeWorker/4.0",
        "Origin":origin,
        "Referer":origin + "/",
    })

    done=0
    for keyword in keywords:
        item=search_item(session, app, affiliate, keyword)
        if item:
            patch_keyword(supa, service, keyword, item)
            done += 1
            print(f"[ads] {keyword}: {item.get('itemName','')[:60]}", file=sys.stderr)
        time.sleep(0.6)
    print(json.dumps({"unique_keywords":len(keywords),"resolved":done,"updated_at":now_iso()}, ensure_ascii=False))


if __name__ == "__main__":
    main()

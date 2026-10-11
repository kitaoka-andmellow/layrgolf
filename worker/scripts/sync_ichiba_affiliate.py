#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Refresh Rakuten Ichiba product affiliate offers for every active golf course.

Runs on the existing fixed-IP Lolipop worker, NOT on the public Vercel app.
Never puts app credentials, Supabase service-role keys or access keys into URLs
shown to visitors, GitHub or browser JavaScript.

Uses Rakuten Ichiba Item Search API (2026-07-01), which returns affiliateUrl
only when an affiliate ID is supplied and the app is authorized.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests

API_URL = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
ACCESSORIES = [
    ("detail_accessory_glove", "all", "accessory", "ゴルフ グローブ"),
    ("detail_accessory_ball", "all", "accessory", "ゴルフボール"),
]
PAGE_SIZE = 500


def required(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit("Missing environment variable: {}".format(name))
    return value


def https_url(value):
    if not isinstance(value, str):
        return ""
    p = urlparse(value.strip())
    if p.scheme != "https" or not p.netloc or p.username or p.password:
        return ""
    return value.strip()


def first_image(item):
    for key in ("mediumImageUrls", "smallImageUrls"):
        urls = item.get(key) or []
        if isinstance(urls, dict):
            urls = [urls]
        for candidate in urls:
            value = candidate.get("imageUrl", "") if isinstance(candidate, dict) else candidate
            if https_url(value):
                return value.strip()
    return ""


def parse_items(payload):
    data = payload.get("items") or payload.get("Items") or []
    if isinstance(data, dict):
        data = [data]
    valid = []
    seen = set()
    for wrapper in data:
        item = wrapper.get("Item", wrapper) if isinstance(wrapper, dict) else {}
        if not isinstance(item, dict):
            continue
        url = https_url(item.get("affiliateUrl"))
        code = str(item.get("itemCode") or "")
        img = first_image(item)
        try:
            price = int(item.get("itemPrice") or 0)
            rating = float(item.get("reviewAverage") or 0)
            reviews = int(item.get("reviewCount") or 0)
            stock = int(item.get("availability") or 0)
        except (TypeError, ValueError):
            continue
        if not url or not code or code in seen or not img or price <= 0 or stock != 1:
            continue
        if rating > 0 and rating < 3.5:
            continue
        seen.add(code)
        rate = item.get("affiliateRate")
        try:
            rate = float(rate) if rate is not None else None
        except (TypeError, ValueError):
            rate = None
        valid.append({
            "item_name": str(item.get("itemName") or "ゴルフ用品").strip()[:180],
            "item_price_yen": price,
            "item_image_url": img,
            "target_url": url,
            "item_code": code,
            "affiliate_rate": rate,
            "_rating": rating,
            "_reviews": reviews,
        })
    valid.sort(key=lambda i: (-i["_reviews"], -i["_rating"], i["item_code"]))
    for i in valid:
        i.pop("_rating", None)
        i.pop("_reviews", None)
    return valid


def rakuten_search(session, app_id, keyword, affiliate_id, interval):
    params = {
        "applicationId": app_id,
        "affiliateId": affiliate_id,
        "keyword": keyword,
        "format": "json",
        "formatVersion": 2,
        "hits": 20,
        "page": 1,
        "availability": 1,
        "imageFlag": 1,
        "sort": "-reviewCount",
    }
    for attempt in range(5):
        if attempt or interval:
            time.sleep(min(60, interval + (2 ** attempt - 1 if attempt else 0)))
        try:
            response = session.get(API_URL, params=params, timeout=35)
        except requests.RequestException as exc:
            if attempt == 4:
                raise RuntimeError("Rakuten connection failed for keyword") from exc
            continue
        if response.status_code in (429, 500, 502, 503, 504):
            if attempt == 4:
                raise RuntimeError("Rakuten HTTP {}".format(response.status_code))
            continue
        if response.status_code in (401, 403):
            raise RuntimeError("Rakuten API access denied (check application approval and allowed IP/origin)")
        if response.status_code == 404:
            return []
        if response.status_code >= 400:
            raise RuntimeError("Rakuten HTTP {} for product query".format(response.status_code))
        return parse_items(response.json())
    return []


def get_page(session, url, params):
    r = session.get(url, params=params, timeout=35)
    if r.status_code >= 400:
        raise RuntimeError("Supabase query failed: HTTP {}".format(r.status_code))
    rows = r.json()
    if not isinstance(rows, list):
        raise RuntimeError("Unexpected Supabase response")
    return rows


def load_all(session, base, table, select, filters=None, limit=None):
    rows = []
    offset = 0
    while True:
        req = dict(filters or {})
        req.update({"select": select, "limit": PAGE_SIZE, "offset": offset})
        batch = get_page(session, base + "/rest/v1/" + table, req)
        rows.extend(batch)
        offset += len(batch)
        if not batch or len(batch) < PAGE_SIZE or (limit and len(rows) >= limit):
            break
        if offset > 30000:
            raise RuntimeError("Too many records; interrupted to protect against accidental API loops")
    return rows[:limit] if limit else rows


def product_for(products, course_id, slot):
    digest = hashlib.sha256("{}:{}".format(course_id, slot).encode("utf-8")).digest()
    return products[int.from_bytes(digest[:2], "big") % len(products)]


def push_batches(session, base, rows):
    endpoint = base + "/rest/v1/affiliate_slots"
    for start in range(0, len(rows), 100):
        batch = rows[start:start + 100]
        # All dictionaries have the same set of keys for PostgREST bulk upsert.
        response = session.post(
            endpoint,
            params={"on_conflict": "gora_course_id,slot,season"},
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            json=batch,
            timeout=70,
        )
        if response.status_code >= 400:
            raise RuntimeError("Supabase affiliate_slots upsert HTTP {}".format(response.status_code))
        print("[affiliate] uploaded {}/{}".format(start + len(batch), len(rows)), flush=True)


def main():
    ap = argparse.ArgumentParser(description="Populate course affiliate offers using Rakuten Ichiba API.")
    ap.add_argument("--dry-run", action="store_true", help="Read offers but do not write Supabase")
    ap.add_argument("--limit-courses", type=int, help="Limit to first N active courses for staging")
    ap.add_argument("--interval", type=float, default=1.8, help="Minimum wait between Rakuten API calls")
    args = ap.parse_args()

    app_id = required("RAKUTEN_APP_ID")
    access_key = required("RAKUTEN_ACCESS_KEY")
    affiliate_id = required("RAKUTEN_AFFILIATE_ID")
    base = required("SUPABASE_URL").rstrip("/")
    secret = (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not secret:
        raise SystemExit("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY")
    if urlparse(base).scheme != "https" or not urlparse(base).hostname.endswith(".supabase.co"):
        raise SystemExit("Invalid Supabase URL")

    origin = os.getenv("RAKUTEN_ORIGIN", "https://layrgolf.andmellow.jp").strip().rstrip("/")
    if urlparse(origin).scheme != "https":
        raise SystemExit("RAKUTEN_ORIGIN must be HTTPS")

    db = requests.Session()
    db.headers.update({
        "apikey": secret,
        "Authorization": "Bearer " + secret,
        "Content-Type": "application/json",
    })
    rakuten = requests.Session()
    rakuten.headers.update({
        "accessKey": access_key,
        "Origin": origin,
        "Referer": origin + "/",
        "User-Agent": "LAYR-GOLF-ProductSync/1.0",
    })

    courses = load_all(
        db, base, "courses", "gora_course_id",
        {"active": "eq.true", "detail_ready": "eq.true", "order": "gora_course_id.asc"},
        args.limit_courses,
    )
    if not courses:
        raise SystemExit("No active courses. Check whether Supabase was resumed.")

    ids = {int(c["gora_course_id"]) for c in courses}
    slots = load_all(
        db, base, "affiliate_slots",
        "gora_course_id,slot,season,category,rakuten_search_keyword",
    )
    grouped = {}
    for row in slots:
        if int(row["gora_course_id"]) not in ids:
            continue
        kw = str(row.get("rakuten_search_keyword") or "").strip()
        if kw:
            grouped[(int(row["gora_course_id"]),row["slot"],row.get("season") or "all")] = (
                str(row.get("category") or "gear"), kw,
            )
    for cid in ids:
        for slot, season, category, keyword in ACCESSORIES:
            grouped[(cid, slot, season)] = (category, keyword)
    keywords = sorted({v[1] for v in grouped.values()})
    print("[affiliate] courses={} slots={} unique_queries={} dry_run={}".format(
        len(courses), len(grouped), len(keywords), args.dry_run
    ), flush=True)

    cache = {}
    for keyword in keywords:
        try:
            products = rakuten_search(rakuten, app_id, keyword, affiliate_id, args.interval)
        except RuntimeError as exc:
            print("[affiliate] query skipped: {} ({})".format(keyword, exc), file=sys.stderr)
            products = []
        cache[keyword] = products
        print("[affiliate] keyword={} eligible_products={}".format(keyword, len(products)), flush=True)

    if not any(cache.values()):
        raise SystemExit("No verified affiliate URLs returned. No Supabase data was changed.")
    now = datetime.now(timezone.utc).isoformat()
    changes = []
    for (cid,slot,season), (category,keyword) in sorted(grouped.items()):
        products = cache[keyword]
        if not products:
            continue
        selected = product_for(products, cid, slot)
        row = {
            "gora_course_id": cid,
            "slot": slot,
            "season": season,
            "category": category,
            "source_type": "rakuten_ichiba",
            "rakuten_search_keyword": keyword,
            "fetched_at": now,
            "updated_at": now,
        }
        row.update(selected)
        changes.append(row)
    print("[affiliate] ready_to_update={}".format(len(changes)), flush=True)
    if args.dry_run:
        print("[affiliate] dry-run only. Database unchanged.", flush=True)
        return
    push_batches(db, base, changes)
    print("[affiliate] completed", flush=True)


if __name__ == "__main__":
    main()

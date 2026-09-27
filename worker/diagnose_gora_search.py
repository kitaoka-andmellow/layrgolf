#!/usr/bin/env python3
"""Small diagnostic for Rakuten GORA search counts.

Prints only aggregate counts. Credentials stay in environment variables and
are never printed.
"""
from __future__ import print_function

import json
import os
import time

import requests

API = "https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseSearch/20170623"


def main():
    app_id = os.getenv("RAKUTEN_APP_ID", "").strip()
    access_key = os.getenv("RAKUTEN_ACCESS_KEY", "").strip()
    if not app_id or not access_key:
        raise SystemExit("RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY are required")

    origin = os.getenv("RAKUTEN_ORIGIN", "https://layrgolf.andmellow.jp").rstrip("/")
    s = requests.Session()
    s.headers.update({
        "accessKey": access_key,
        "Accept": "application/json",
        "User-Agent": "CourseCodeDiagnostic/1.0",
        "Origin": origin,
        "Referer": origin + "/",
    })

    cases = [
        ("all_rating", {"areaCode": 0, "reservation": 0, "sort": "rating"}),
        ("all_50on", {"areaCode": 0, "reservation": 0, "sort": "50on"}),
        ("reservable_rating", {"areaCode": 0, "reservation": 1, "sort": "rating"}),
        ("reservable_50on", {"areaCode": 0, "reservation": 1, "sort": "50on"}),
    ]

    for name, extra in cases:
        params = {
            "format": "json",
            "formatVersion": 2,
            "applicationId": app_id,
            "hits": 1,
            "page": 1,
            "elements": "golfCourseId,golfCourseName",
        }
        params.update(extra)
        r = s.get(API, params=params, timeout=30)
        if r.status_code >= 400:
            print(json.dumps({
                "case": name,
                "http": r.status_code,
                "error": r.text[:300],
            }, ensure_ascii=False))
        else:
            data = r.json()
            print(json.dumps({
                "case": name,
                "http": r.status_code,
                "count": data.get("count"),
                "pageCount": data.get("pageCount"),
                "hits": data.get("hits"),
            }, ensure_ascii=False))
        time.sleep(1.2)


if __name__ == "__main__":
    main()

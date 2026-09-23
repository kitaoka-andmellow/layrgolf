#!/usr/bin/env python3
import getpass, json, os, sys
import requests

URL = "https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseSearch/20170623"
app = os.getenv("RAKUTEN_APP_ID") or input("Rakuten Application ID: ").strip()
key = os.getenv("RAKUTEN_ACCESS_KEY") or getpass.getpass("Rakuten Access Key: ").strip()
params = {
    "format":"json", "formatVersion":2, "applicationId":app,
    "areaCode":1, "hits":1, "page":1, "reservation":1,
    "elements":"golfCourseId,golfCourseName"
}
try:
    r = requests.get(
        URL, params=params, timeout=30,
        headers={"Accept":"application/json","User-Agent":"CourseCodeJapan/4.0-auth-check","accessKey":key},
    )
    print("HTTP", r.status_code)
    try:
        data = r.json()
        print(json.dumps(data, ensure_ascii=False, indent=2)[:4000])
    except Exception:
        print(r.text[:4000])
    if r.status_code == 200:
        print("OK: Rakuten GORA API access is enabled from this source IP.")
        sys.exit(0)
    if r.status_code == 403:
        print("\n403: Check Rakuten API access scopes AND the app's allowed source IPv4 address.")
    elif r.status_code == 401:
        print("\n401: Check that the Application ID and Access Key are valid and belong to the same app.")
    sys.exit(1)
except requests.RequestException as e:
    print(f"Network error: {type(e).__name__}: {e}")
    sys.exit(2)

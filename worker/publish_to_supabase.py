#!/usr/bin/env python3
"""Publish COURSE CODE sync output into Supabase through PostgREST.

Required env:
  SUPABASE_URL
  SUPABASE_SECRET_KEY or legacy SUPABASE_SERVICE_ROLE_KEY

The script deliberately uses the Supabase secret key (or legacy service-role key) only on the fixed-IP worker.
It is never shipped to the Vercel/browser bundle.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def chunks(rows: list[dict[str, Any]], size: int = 100) -> Iterable[list[dict[str, Any]]]:
    for i in range(0, len(rows), size):
        yield rows[i:i + size]


SEARCH_COLUMNS = {
    "gora_course_id", "pref_code", "prefecture", "course_name", "course_name_abbr",
    "course_name_kana", "course_caption", "address", "latitude", "longitude", "highway",
    "image_url_1", "evaluation", "gora_detail_url", "gora_reserve_url", "gora_rating_url",
    "source_stage", "api_source_url", "fetched_at",
}

BOOL_COLUMNS = {
    "jacket_mentioned", "jacket_required", "collar_mentioned", "denim_banned", "tshirt_banned",
    "sandals_banned", "tuck_in_mentioned", "shorts_mentioned", "socks_mentioned", "golf_shoes_mentioned",
}


class Supabase:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/")
        self.s = requests.Session()
        self.s.headers.update({
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "CourseCodeWorker/4.0",
        })

    def _check(self, r: requests.Response) -> requests.Response:
        if r.status_code >= 400:
            raise RuntimeError(f"Supabase HTTP {r.status_code}: {r.text[:1500]}")
        return r

    def upsert(self, table: str, rows: list[dict[str, Any]], conflict: str, batch_size: int = 100):
        if not rows:
            return
        for batch in chunks(rows, batch_size):
            r = self.s.post(
                f"{self.base}/rest/v1/{table}",
                params={"on_conflict": conflict},
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                data=json.dumps(batch, ensure_ascii=False),
                timeout=60,
            )
            self._check(r)

    def insert_run(self, row: dict[str, Any]):
        r = self.s.post(
            f"{self.base}/rest/v1/sync_runs",
            headers={"Prefer": "return=minimal"},
            data=json.dumps([row], ensure_ascii=False), timeout=30,
        )
        self._check(r)

    def update_run(self, sync_id: str, patch: dict[str, Any]):
        r = self.s.patch(
            f"{self.base}/rest/v1/sync_runs",
            params={"sync_id": f"eq.{sync_id}"},
            headers={"Prefer": "return=minimal"},
            data=json.dumps(patch, ensure_ascii=False), timeout=30,
        )
        self._check(r)

    def finalize(self, sync_id: str):
        r = self.s.post(
            f"{self.base}/rest/v1/rpc/course_code_finalize_sync",
            data=json.dumps({"p_sync_id": sync_id}), timeout=60,
        )
        self._check(r)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_course(row: dict[str, Any], sync_id: str, mode: str) -> dict[str, Any]:
    source = row if mode == "full" else {k: v for k, v in row.items() if k in SEARCH_COLUMNS}
    out: dict[str, Any] = {}
    for k, v in source.items():
        if v == "":
            v = None
        if k in BOOL_COLUMNS and v is not None:
            v = bool(int(v)) if isinstance(v, (int, str)) and str(v) in {"0", "1"} else bool(v)
        out[k] = v
    out["active"] = True
    if mode == "full":
        out["detail_ready"] = True
    out["last_seen_sync_id"] = sync_id
    out["updated_at"] = now_iso()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", required=True)
    ap.add_argument("--mode", choices=["search", "full"], required=True)
    ap.add_argument("--no-finalize", action="store_true", help="Do not mark missing courses inactive")
    args = ap.parse_args()

    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required")

    input_dir = Path(args.input_dir)
    course_file = input_dir / ("courses.json" if args.mode == "full" else "courses_search.json")
    courses = load_json(course_file)
    if not isinstance(courses, list) or not courses:
        raise SystemExit(f"No course rows found in {course_file}")

    sync_id = str(uuid.uuid4())
    db = Supabase(url, key)
    db.insert_run({
        "sync_id": sync_id,
        "sync_mode": args.mode,
        "status": "running",
        "started_at": now_iso(),
        "course_count": len(courses),
    })

    try:
        normalized = [normalize_course(r, sync_id, args.mode) for r in courses]
        db.upsert("courses", normalized, "gora_course_id")

        dress_count = 0
        if args.mode == "full":
            seasons = load_json(input_dir / "seasonal_guides.json")
            ads = load_json(input_dir / "affiliate_slots.json")
            stamp = now_iso()
            for row in seasons:
                row.setdefault("updated_at", stamp)
            for row in ads:
                row.setdefault("source_type", "rakuten_ichiba")
                row.setdefault("updated_at", stamp)
            db.upsert("seasonal_guides", seasons, "gora_course_id,season")
            db.upsert("affiliate_slots", ads, "gora_course_id,slot,season")
            dress_count = sum(1 for r in courses if r.get("dress_code_raw"))

        if not args.no_finalize:
            db.finalize(sync_id)

        db.update_run(sync_id, {
            "status": "success",
            "finished_at": now_iso(),
            "course_count": len(courses),
            "detail_count": len(courses) if args.mode == "full" else 0,
            "dress_code_count": dress_count,
            "message": "completed",
        })
        print(json.dumps({"sync_id": sync_id, "mode": args.mode, "course_count": len(courses)}, ensure_ascii=False))
    except Exception as e:
        try:
            db.update_run(sync_id, {"status": "failed", "finished_at": now_iso(), "message": str(e)[:1000]})
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()

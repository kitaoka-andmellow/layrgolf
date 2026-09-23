#!/usr/bin/env python3
import requests
for url in ("https://api.ipify.org", "https://ifconfig.me/ip"):
    try:
        r=requests.get(url, timeout=10, headers={"User-Agent":"CourseCodeWorker/4.0"})
        r.raise_for_status()
        ip=r.text.strip()
        if ip:
            print(ip)
            raise SystemExit(0)
    except Exception:
        pass
raise SystemExit("Could not determine outbound IPv4")

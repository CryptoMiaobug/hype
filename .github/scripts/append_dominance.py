#!/usr/bin/env python3
"""Daily append for btc-data/dominance.json (run by .github/workflows/btc-dominance.yml).

Runs shortly after 00:00 UTC and records CoinGecko /global as the value for UTC yesterday.
Append-only: existing rows (including the frozen CMC archive) are never modified. A missed
run leaves that day blank; it cannot be backfilled from free sources.
Exit 0 with no change when yesterday already exists.
"""
import json
import os
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "btc-data", "dominance.json")
URL = "https://api.coingecko.com/api/v3/global"


def main():
    now = datetime.now(timezone.utc)
    day = (now.date() - timedelta(days=1)).isoformat()
    with open(PATH) as f:
        seed = json.load(f)
    last = seed["rows"][-1][0]
    if day <= last:
        print("up to date:", last)
        return
    req = urllib.request.Request(URL, headers={"User-Agent": "btc-dominance-append", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)["data"]
    dom, tot = d["market_cap_percentage"]["btc"], d["total_market_cap"]["usd"]
    if not (isinstance(dom, (int, float)) and 0 < dom < 100 and isinstance(tot, (int, float)) and tot > 0):
        sys.exit("invalid CoinGecko values: %r %r" % (dom, tot))
    updated = datetime.fromtimestamp(d.get("updated_at", now.timestamp()), timezone.utc)
    if now - updated > timedelta(hours=3):
        sys.exit("stale CoinGecko snapshot: %s" % updated.isoformat())
    seed["rows"].append([day, round(dom, 4), round(tot)])
    seed["appendedAt"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(PATH, "w") as f:
        json.dump(seed, f, separators=(",", ":"))
    gap = (date.fromisoformat(day) - date.fromisoformat(last)).days - 1
    print("appended", day, dom, tot, "(gap %d days before)" % gap if gap else "")


if __name__ == "__main__":
    main()

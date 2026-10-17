#!/usr/bin/env python3
"""Daily append for btc-data/btc.json (run by .github/workflows/btc-daily.yml).

Fetches Coin Metrics Community PriceUSD / CapMrktCurUSD / CapMVRVCur for (seed.last, UTC yesterday]
and appends complete consecutive days only. Existing rows are never modified.

Rules:
  * A day missing any metric (or non-positive) stops the append at the day before; retried next run.
  * Date gaps also stop the append (no skipping ahead).
  * Missed runs self-heal: the next run fetches everything after seed.last.
  * Exit 0 with no change when already up to date or nothing new is complete yet.
"""
import hashlib
import json
import os
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone

PATH = os.environ.get("BTC_SEED_PATH") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "btc-data", "btc.json")
URL = ("https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc"
       "&metrics=PriceUSD,CapMrktCurUSD,CapMVRVCur&frequency=1d&page_size=10000"
       "&start_time={start}&end_time={end}")


def fetch(start, end):
    rows, url = [], URL.format(start=start, end=end)
    while url:
        req = urllib.request.Request(url, headers={"User-Agent": "btc-daily-append", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.load(r)
        rows += page["data"]
        url = page.get("next_page_url")
    return rows


def num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x > 0 else None


def main():
    now = datetime.now(timezone.utc)
    end = (now.date() - timedelta(days=1)).isoformat()
    with open(PATH, "rb") as f:
        before = f.read()
    seed = json.loads(before)
    last = seed["last"]
    if seed["rows"][-1][0] != last:
        sys.exit("seed.last does not match last row")
    if last >= end:
        print("up to date:", last)
        return
    start = (date.fromisoformat(last) + timedelta(days=1)).isoformat()
    data = fetch(start, end)
    blob = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()

    added, prev, stop = [], last, None
    for r in sorted(data, key=lambda r: r["time"]):
        d = r["time"][:10]
        if d <= prev:
            continue
        if (date.fromisoformat(d) - date.fromisoformat(prev)).days != 1:
            stop = "date gap after %s" % prev
            break
        p, m, v = num(r.get("PriceUSD")), num(r.get("CapMrktCurUSD")), num(r.get("CapMVRVCur"))
        if None in (p, m, v):
            stop = "incomplete metrics on %s" % d
            break
        added.append([d, float("%.8g" % p), round(m), round(v, 8)])
        prev = d
    if stop:
        print("stopped:", stop)
    if not added:
        print("nothing complete after", last)
        return

    seed["rows"] += added
    seed["last"] = added[-1][0]
    seed["appendedAt"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    # Chain hash: previous archive hash + this batch, so browser caches keyed on it reset.
    seed["sourceSHA256"] = hashlib.sha256((seed["sourceSHA256"] + ":" + hashlib.sha256(blob).hexdigest()).encode()).hexdigest()
    with open(PATH, "w") as f:
        json.dump(seed, f, separators=(",", ":"))

    # Safety: old rows must be byte-identical after the write.
    after = json.load(open(PATH))
    if after["rows"][: len(after["rows"]) - len(added)] != json.loads(before)["rows"]:
        with open(PATH, "wb") as f:
            f.write(before)
        sys.exit("existing rows changed; reverted")
    print("appended", ", ".join(r[0] for r in added), "| rows", len(after["rows"]))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Daily append for copy-data/daily.json (run by .github/workflows/copy-daily.yml).

反向交易账户日线固化。日界按北京时间（+08:00），00:05 运行，记录刚结束的那一天。
- 日终净值：spot USDC total（统一账户净值，含逐仓保证金和浮盈），取运行时刻的值，记录采样时间 at。
  漏跑的更早日子用 HL portfolio 里当天 24:00 前最后一个净值点补，src 标为 "hl"。
- 当日已实现、手续费、资金费、成交数、成交额：按日界精确汇总 fills / funding。
- 当日收益 = 日终净值 − 前日净值 − 当日净转入；累计收益 = 日终净值 − 本金 − 累计净转入。
只追加，不改写已有行。当天已存在则不改动、退出 0。
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
PATH = os.environ.get("COPY_OUT") or os.path.join(ROOT, "copy-data", "daily.json")  # COPY_OUT 仅本地测试用
ROSTER = os.path.join(ROOT, "copy-data", "roster.json")
API = "https://api.hyperliquid.xyz/info"
TZ = timezone(timedelta(hours=8))
DAY_MS = 86400000


def info(body):
    req = urllib.request.Request(API, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "copy-daily-append"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # 网络抖动/限流：退避重试
            if attempt == 3:
                raise
            print("retry", body["type"], e, file=sys.stderr)
            time.sleep(5 * (attempt + 1))


# 各接口单页上限：userFillsByTime 2000 条，userFunding 500 条（返回满一页就继续往后翻）
PAGE_LIMIT = {"userFillsByTime": 2000, "userFunding": 500}


def paged(kind, user, start, end):
    """按时间往后翻页直到拉完。HL 按时间升序返回；下一页从本页最后时间开始，重叠部分去重。"""
    out, seen, t = [], set(), start
    for _ in range(200):  # 防死循环；按天拉一页就够，200 页 = 10 万条
        batch = info({"type": kind, "user": user, "startTime": t, "endTime": end})
        new = [x for x in batch if (x.get("tid") or x.get("hash"), x["time"], json.dumps(x, sort_keys=True)) not in seen]
        for x in new:
            seen.add((x.get("tid") or x.get("hash"), x["time"], json.dumps(x, sort_keys=True)))
        out += new
        if len(batch) < PAGE_LIMIT[kind] or not new:
            return out
        t = max(x["time"] for x in batch)
    sys.exit(f"{kind} 翻页超过 200 页，停止（检查接口是否异常）")


def net_flow(ledger, me, a, b):
    """与 copy-core.js netFlow 同口径：转入正、转出负（含费），统一账户内部划转不算。"""
    total = 0.0
    for x in ledger:
        if not (a <= x["time"] < b):
            continue
        d = x.get("delta") or {}
        t, v = d.get("type"), 0.0
        if t == "deposit":
            v = float(d.get("usdc") or 0)
        elif t == "withdraw":
            v = -float(d.get("usdc") or 0) - float(d.get("fee") or 0)
        elif t in ("send", "spotTransfer", "internalTransfer", "subAccountTransfer"):
            if (d.get("token") or "USDC") != "USDC" and d.get("usdcValue") is None:
                continue
            amt = float(d.get("usdcValue") or d.get("usdc") or d.get("amount") or 0)
            to, frm = str(d.get("destination", "")).lower(), str(d.get("user", "")).lower()
            if to == me and frm != me:
                v = amt
            elif frm == me and to != me:
                v = -amt - float(d.get("fee") or 0)
        total += v
    return total


def main():
    now_ms = int(time.time() * 1000)
    roster = json.load(open(ROSTER))
    me, start, capital = roster["account"], roster["start"]["time"], roster["start"]["capital"]
    seed = json.load(open(PATH)) if os.path.exists(PATH) else {
        "account": me, "tz": "+08:00", "start": roster["start"], "rows": []}
    rows = seed["rows"]

    # 待补的日子：上一行之后 → 昨天（北京时间）
    today = datetime.fromtimestamp(now_ms / 1000, TZ).date()
    if os.environ.get("COPY_TODAY"):  # 仅本地测试：假装今天是某日
        today = datetime.fromisoformat(os.environ["COPY_TODAY"]).date()
    first = datetime.fromtimestamp(start / 1000, TZ).date()
    if datetime.fromtimestamp(start / 1000, TZ).hour >= 23:  # 起点在当日最后一小时，并入次日
        first += timedelta(days=1)
    nxt = datetime.fromisoformat(rows[-1]["d"]).date() + timedelta(days=1) if rows else first
    days = []
    while nxt < today:
        days.append(nxt)
        nxt += timedelta(days=1)
    if not days:
        print("up to date:", rows[-1]["d"] if rows else "(no full day yet)")
        return

    # 只拉待补日子起点之后的数据（已固化的日子不重拉，数据量不随运行天数增长）
    lo = start if not rows else int(datetime.combine(days[0], datetime.min.time(), TZ).timestamp() * 1000)
    hi = int(datetime.combine(days[-1] + timedelta(days=1), datetime.min.time(), TZ).timestamp() * 1000)
    fills = [f for f in paged("userFillsByTime", me, lo, now_ms) if f["time"] >= start]
    funding = [f for f in paged("userFunding", me, lo, now_ms) if f["time"] >= start]
    ledger = info({"type": "userNonFundingLedgerUpdates", "user": me, "startTime": lo})  # 出入金很少，单页足够
    spot = info({"type": "spotClearinghouseState", "user": me})
    eq_now = next((float(b["total"]) for b in spot.get("balances", []) if b["coin"] == "USDC"), None)
    if eq_now is None:
        sys.exit("no USDC balance in spotClearinghouseState")
    hist = {}
    for k, v in info({"type": "portfolio", "user": me}):
        if not k.startswith("perp"):
            for t, val in v.get("accountValueHistory", []):
                hist[t] = float(val)

    prev_eq = rows[-1]["equity"] if rows else capital
    cum_flow = rows[-1]["cumFlow"] if rows else 0.0
    for d in days:
        a = int(datetime.combine(d, datetime.min.time(), TZ).timestamp() * 1000)
        b = a + DAY_MS
        if d == days[0] and not rows:  # 第一行从收益起点算起（含 10-19 23:54 之后那几分钟）
            a = start
        if d == days[-1]:
            eq, at, src = eq_now, now_ms, "live"
            # 采样晚于日界：剔除日界之后的手续费、资金费、出入金（平仓只是浮盈转已实现，不改变净值）。
            # 剩余误差只有这几分钟的价格波动。
            late = [f for f in fills if f["time"] >= b]
            lf = [f for f in funding if f["time"] >= b]
            eq -= -sum(float(f["fee"]) for f in late) + sum(float(f["delta"]["usdc"]) for f in lf)
            eq -= net_flow(ledger, me, b, now_ms + 1)
        else:
            pts = [(t, v) for t, v in hist.items() if t < b]
            if not pts:
                print("skip", d, "(no equity sample)")
                continue
            at, eq = max(pts)
            src = "hl"
        flow = net_flow(ledger, me, a, b)
        f = [x for x in fills if a <= x["time"] < b]
        fu = [x for x in funding if a <= x["time"] < b]
        cum_flow += flow
        row = {"d": d.isoformat(), "equity": round(eq, 6), "pnl": round(eq - prev_eq - flow, 6),
               "cum": round(eq - capital - cum_flow, 6), "flow": round(flow, 6), "cumFlow": round(cum_flow, 6),
               "closed": round(sum(float(x["closedPnl"]) for x in f), 6), "fees": round(sum(float(x["fee"]) for x in f), 6),
               "funding": round(sum(float(x["delta"]["usdc"]) for x in fu), 6), "fills": len(f),
               "volume": round(sum(float(x["px"]) * float(x["sz"]) for x in f), 2), "at": at, "src": src}
        if src == "live" and at - b > 2 * 3600000:
            print("warn", d, "sampled %.1fh after day end" % ((at - b) / 3600000))
        rows.append(row)
        prev_eq = eq
        print("appended", row["d"], "| equity %.2f pnl %+.2f cum %+.2f fills %d" % (eq, row["pnl"], row["cum"], row["fills"]))

    seed["appendedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    with open(PATH, "w") as fh:
        json.dump(seed, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Daily Discord summary for the data jobs (btc-dominance / btc-daily / pe-daily).

Usage: python3 notify.py <dominance|btc|pe> <append-log-file>
Reads the committed data files for the latest values and the append step log for what changed.
Posts to $DISCORD_WEBHOOK; prints the message instead when DISCORD_WEBHOOK is unset (local test).
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
SITE = "https://value.miao77.xyz/"


def load(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return json.load(f)


def usd(x):
    for unit, div in (("T", 1e12), ("B", 1e9), ("M", 1e6)):
        if abs(x) >= div:
            return "$%.2f%s" % (x / div, unit)
    return "$%.0f" % x


def log_lines(path):
    try:
        with open(path) as f:
            return [l.rstrip("\n") for l in f if l.strip()]
    except OSError:
        return []


def dominance(log):
    d = load("btc-data/dominance.json")
    day, dom, total = d["rows"][-1][:3]
    added = any(l.startswith("appended") for l in log)
    state = "✅ 新增 " + day if added else "无新数据（最新 " + day + "）"
    return "📊 BTC 市值占比（T-1）：%s\n占比 %.2f%% · 加密总市值 %s\n%sbtc-dominance.html" % (state, dom, usd(total), SITE)


def btc(log):
    import subprocess
    # Use btc-core.js itself so drawdown / Z match the site exactly.
    js = ("const C=require('./btc-core.js'),s=require('./btc-data/btc.json');"
          "const r=C.derive(s.rows).at(-1);console.log(JSON.stringify(r))")
    r = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))
    day = r["date"]
    appended = [l for l in log if l.startswith("appended")]
    stopped = [l for l in log if l.startswith("stopped")]
    if appended:
        state = "✅ 新增 " + appended[0].split("appended ", 1)[1].split(" |")[0]
    else:
        state = "无新数据（最新 " + day + "）"
    if stopped:
        state += "；⚠️ " + stopped[0]
    return ("₿ BTC 价格/MVRV（T-1）：%s\n%s 收盘 $%s · 回撤 %.1f%% · MVRV %.2f · Z %.2f\n%sbtc-overview.html"
            % (state, day, format(round(r["price"]), ","), r["dd"] * 100, r["mvrv"], r["z"], SITE))


PE_NAMES = {"hype": "HYPE", "uni": "UNI", "aave": "AAVE", "bnb": "BNB"}


def pe(log):
    status = {}
    for l in log:
        name, _, rest = l.partition(": ")
        if name in ("hype", "uni", "aave", "bnb", "payout", "hype-sources", "uni-chains"):
            status[name] = rest
    head = next((l for l in log if l.startswith("freeze through")), "")
    out = ["📈 PE 数据（T-2" + (" " + head.split(": ", 1)[1] if head else "") + "）"]
    for a, label in PE_NAMES.items():
        d = load("pe-data/%s.json" % a)
        r = d["rows"][-1]
        val = r.get("circ", r.get("pe"))
        s = status.get(a, "")
        if s.startswith("FAILED"):
            mark = "❌ " + s[len("FAILED "):][:120]
        elif "HELD" in s:
            mark = "⏸ 等第 %d 次季度销毁" % (d["burns"][-1]["n"] + 1)
        elif "added" in s:
            mark = "✅ 新增 %d 天" % s.split("added ", 1)[1].split(" (")[0].count("PE ")
        else:
            mark = "无新数据"
        out.append("%s：%s · PE %.2f（%s）" % (label, mark, val, d["last"]))
    others = []
    for f, label in (("payout", "回馈率"), ("hype-sources", "HYPE 收入来源"), ("uni-chains", "UNI 链分布")):
        s = status.get(f, "")
        d = load("pe-data/%s.json" % f)
        last = d.get("last") or d.get("cutoff")
        others.append(label + ("❌" if s.startswith("FAILED") else "") + " " + last)
    out.append("其他：" + " · ".join(others))
    out.append(SITE + "pe-list.html")
    return "\n".join(out)


def main():
    kind, logf = sys.argv[1], sys.argv[2]
    msg = {"dominance": dominance, "btc": btc, "pe": pe}[kind](log_lines(logf))
    hook = os.environ.get("DISCORD_WEBHOOK")
    if not hook:
        print(msg)
        return
    req = urllib.request.Request(hook, data=json.dumps({"content": msg[:1900]}).encode(),
                                 headers={"content-type": "application/json", "User-Agent": "value-data-bot"})
    urllib.request.urlopen(req, timeout=20).read()


if __name__ == "__main__":
    main()

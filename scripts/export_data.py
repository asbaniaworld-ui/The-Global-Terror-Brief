# -*- coding: utf-8 -*-
"""从 xlsx 导出 data/terror-attacks.json（网页图表数据源）"""
import json
import glob
import os

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

COLS = [
    "eventId",
    "date",
    "country",
    "city",
    "group",
    "nkill",
    "nwound",
    "targetType",
    "region",
    "attackType",
    "weaponType",
]


def main():
    xlsx = glob.glob("*.xlsx")
    if not xlsx:
        raise SystemExit("未找到 xlsx 文件")
    df = pd.read_excel(xlsx[0]).iloc[:, :11]
    df.columns = COLS
    for c in ("nkill", "nwound"):
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    records = df.to_dict(orient="records")
    for r in records:
        r["date"] = r["date"].strftime("%Y-%m-%d")
    os.makedirs("data", exist_ok=True)
    out = os.path.join("data", "terror-attacks.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)
    js_out = os.path.join("js", "terror-data.js")
    with open(js_out, "w", encoding="utf-8") as f:
        f.write("window.TERROR_ATTACKS_DATA = ")
        json.dump(records, f, ensure_ascii=False)
        f.write(";\n")
    print("Wrote", len(records), "records ->", out, "and", js_out)


if __name__ == "__main__":
    main()

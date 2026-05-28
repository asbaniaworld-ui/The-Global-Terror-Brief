"""将 data/world.json 打包为 js/world-geo-data.js（支持 file:// 直接打开）。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / "data" / "world.json"
dst = ROOT / "js" / "world-geo-data.js"

geo = src.read_text(encoding="utf-8").strip()
dst.write_text(
    "/* Auto-generated from data/world.json — do not edit by hand */\n"
    "(function (g) {\n"
    "  if (typeof window !== 'undefined') window.__WORLD_GEO = g;\n"
    "})(\n"
    + geo
    + "\n);\n",
    encoding="utf-8",
)
print(f"wrote {dst} ({dst.stat().st_size} bytes)")

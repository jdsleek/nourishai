import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # food-app/
REPO = ROOT.parent

csv_path = REPO / "vault" / "data" / "qaf-ideation" / "QAF 1.0 Product Ideation.csv"

out_path = ROOT / "registry" / "qaf-product-ideation-registry.html"


def map_cat(bucket: str):
    b = (bucket or "").lower()
    if "income" in b:
        return "income", "inc"
    if "data" in b and "driven" in b:
        return "data", "data"
    if "agenda" in b:
        return "agenda", "agenda"
    if "espees" in b or "loveworld" in b:
        return "espees", "esp"
    return "utility", "util"


rows = []
with open(csv_path, newline="", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader, start=1):
        sub = (row.get("Your Subgroup") or "").strip()
        bucket = (
            row.get("Which bucket does your product idea fall under?") or ""
        ).strip()
        idea = (
            row.get("What product(s) would you like to build during the training?")
            or ""
        ).strip()
        ts = (row.get("Timestamp") or "").strip()
        if not idea:
            continue
        cat, cclass = map_cat(bucket)
        first = idea.split("\n")[0].strip()
        title = (first[:88] + "…") if len(first) > 88 else first
        rows.append(
            {
                "n": i,
                "title": title,
                "cat": cat,
                "cclass": cclass,
                "sub": sub or "—",
                "bucketRaw": bucket,
                "desc": idea,
                "time": ts,
            }
        )

counts = {k: 0 for k in ("income", "data", "agenda", "espees", "utility")}
for x in rows:
    counts[x["cat"]] = counts.get(x["cat"], 0) + 1

data_json = json.dumps(rows, ensure_ascii=False)
counts_json = json.dumps(counts, ensure_ascii=False)

if not out_path.exists():
    raise SystemExit(
        f"Missing registry shell {out_path}; ensure the HTML template is present under food-app/registry/"
    )

template = out_path.read_text(encoding="utf-8")
out = re.sub(
    r'(<script type="application/json" id="qaf-data">).*?(</script>)',
    r"\1" + data_json + r"\2",
    template,
    count=1,
    flags=re.DOTALL,
)
out = re.sub(
    r'(<script type="application/json" id="qaf-counts">).*?(</script>)',
    r"\1" + counts_json + r"\2",
    out,
    count=1,
    flags=re.DOTALL,
)
out_path.write_text(out, encoding="utf-8")
print("Wrote", out_path, "rows", len(rows), "counts", counts)

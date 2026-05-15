import csv
import json
from pathlib import Path

csv_path = Path(
    "/Users/juliusarebo/Desktop/Training Classes Project/vault/data/qaf-ideation/"
    "QAF 1.0 Product Ideation.csv"
)
out_path = Path(
    "/Users/juliusarebo/Desktop/Training Classes Project/food-app/public/"
    "qaf-product-ideation-registry.html"
)


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

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QAF 1.0 — Cohort product ideation</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --font-sans:'DM Sans',system-ui,sans-serif;
  --color-text-primary:#0f172a;
  --color-text-secondary:#475569;
  --color-text-tertiary:#94a3b8;
  --color-background-primary:#ffffff;
  --color-background-secondary:#f8fafc;
  --color-border-secondary:#e2e8f0;
  --color-border-tertiary:#f1f5f9;
  --border-radius-md:8px;
  --border-radius-lg:12px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);color:var(--color-text-primary);background:linear-gradient(165deg,#f8fafc 0%,#eef2ff 40%,#fff7ed 100%);min-height:100vh}
.wrap{max-width:1200px;margin:0 auto;padding:1.25rem 1rem 3rem}
.cover{background:var(--color-background-primary);border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-lg);padding:1.25rem 1.5rem;margin-bottom:1.25rem;box-shadow:0 1px 3px rgba(15,23,42,.06)}
.cover h1{font-size:1.35rem;font-weight:700;margin-bottom:.6rem;color:#0f172a}
.cover .lead{font-size:.95rem;line-height:1.65;color:var(--color-text-secondary);margin-bottom:.85rem}
.cover .buckets{font-size:.9rem;color:var(--color-text-secondary);line-height:1.55}
.cover .buckets strong{color:#0f172a}
.cover .note{font-size:.8rem;color:var(--color-text-tertiary);margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--color-border-tertiary);font-family:'JetBrains Mono',monospace}
.hdr{padding:0 0 .75rem}
.pillar-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1rem}
.tab{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-secondary);transition:all .15s}
.tab:hover{background:#e2e8f0}
.tab.active{color:#fff;border-color:transparent}
.tab-all.active{background:#334155}
.tab-inc.active{background:#147A45}
.tab-data.active{background:#185FA5}
.tab-agenda.active{background:#6B1A3A}
.tab-esp.active{background:#8B6914}
.tab-util.active{background:#4A1470}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:1rem}
.stat{border-radius:var(--border-radius-md);padding:.65rem .75rem;text-align:center}
.stat-n{font-size:20px;font-weight:600}
.stat-l{font-size:11px;margin-top:2px;font-weight:500}
.s-inc{background:#EAF3DE;color:#27500A}
.s-data{background:#E6F1FB;color:#0C447C}
.s-agenda{background:#FBEAF0;color:#72243E}
.s-esp{background:#FDF8E8;color:#633806}
.s-util{background:#EEEDFE;color:#3C3489}
.controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:1rem;align-items:center}
.controls input{font-size:13px;padding:8px 12px;border-radius:var(--border-radius-md);border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);flex:1;min-width:200px}
.controls select{font-size:13px;padding:8px 10px;border-radius:var(--border-radius-md);border:1px solid var(--color-border-secondary);background:var(--color-background-primary)}
.count-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:8px}
.count-bar span{font-size:12px;color:var(--color-text-secondary)}
.back{font-size:12px;color:#185FA5;text-decoration:none;font-weight:600}
.back:hover{text-decoration:underline}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px}
.card{background:var(--color-background-primary);border:1px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:.9rem;border-left-width:3px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.card.inc{border-left-color:#147A45}
.card.data{border-left-color:#185FA5}
.card.agenda{border-left-color:#6B1A3A}
.card.esp{border-left-color:#8B6914}
.card.util{border-left-color:#4A1470}
.card-num{font-size:10px;color:var(--color-text-tertiary);margin-bottom:3px;font-family:'JetBrains Mono',monospace}
.card-title{font-size:13px;font-weight:600;margin-bottom:.4rem;line-height:1.35}
.badges{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:.45rem}
.badge{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:600}
.b-sub{background:#f1f5f9;color:#475569}
.b-inc{background:#EAF3DE;color:#27500A}
.b-data{background:#E6F1FB;color:#0C447C}
.b-agenda{background:#FBEAF0;color:#72243E}
.b-esp{background:#FDF8E8;color:#633806}
.b-util{background:#EEEDFE;color:#3C3489}
.card-desc{font-size:11px;color:var(--color-text-secondary);line-height:1.55;margin-bottom:.5rem;white-space:pre-wrap}
.card-footer{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:.6rem;padding-top:.6rem;border-top:1px solid var(--color-border-tertiary)}
.time-tag{font-size:10px;color:var(--color-text-tertiary);font-family:'JetBrains Mono',monospace}
.no-res{text-align:center;padding:3rem;color:var(--color-text-secondary);font-size:14px}
@media (max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/">← Day 03 slides (home)</a>

  <div class="cover">
    <h1>QAF 1.0 — Product ideation</h1>
    <p class="lead">Hello <strong>QAF Fellows,</strong> — as we continue the training, we would like each Fellow to share the product idea(s) they are interested in building during the program. This helps us understand your interests, provide the right support, and ensure alignment with the focus areas of the training.</p>
    <p class="buckets"><strong>Your product idea must fall under at least one of these buckets:</strong></p>
    <ul class="buckets" style="margin:.5rem 0 0 1.1rem">
      <li>Income-generating products</li>
      <li>Data-driven products</li>
      <li>Agenda-driven products</li>
      <li>Products that promote the use of Espees (Loveworld’s currency)</li>
    </ul>
    <p class="buckets" style="margin-top:.75rem">Kindly fill out the form carefully and ensure your responses are clear and concise.</p>
    <p class="note">Privacy: this page shows <strong>subgroup</strong>, <strong>bucket</strong>, idea text, and submission time only — <strong>no names or emails</strong>.</p>
  </div>

  <div class="hdr">
    <div class="stats">
      <div class="stat s-inc"><div class="stat-n" id="c-inc">0</div><div class="stat-l">Income-Generating</div></div>
      <div class="stat s-data"><div class="stat-n" id="c-data">0</div><div class="stat-l">Data-Driven</div></div>
      <div class="stat s-agenda"><div class="stat-n" id="c-agenda">0</div><div class="stat-l">Agenda-Driven</div></div>
      <div class="stat s-esp"><div class="stat-n" id="c-esp">0</div><div class="stat-l">Espees-Promoting</div></div>
      <div class="stat s-util"><div class="stat-n" id="c-util">0</div><div class="stat-l">Other</div></div>
    </div>

    <div class="pillar-tabs">
      <div class="tab tab-all active" data-cat="all">All ideas</div>
      <div class="tab tab-inc" data-cat="income">Income-Generating</div>
      <div class="tab tab-data" data-cat="data">Data-Driven</div>
      <div class="tab tab-agenda" data-cat="agenda">Agenda-Driven</div>
      <div class="tab tab-esp" data-cat="espees">Espees-Promoting</div>
      <div class="tab tab-util" data-cat="utility">Other</div>
    </div>

    <div class="controls">
      <input type="search" id="search" placeholder="Search ideas or subgroup (e.g. Goshen, inventory, NFT…)">
      <select id="subF"><option value="">All subgroups</option></select>
    </div>

    <div class="count-bar"><span id="countLbl">Loading…</span></div>
    <div class="grid" id="grid"></div>
    <div class="no-res" id="noRes" style="display:none">No ideas match.</div>
  </div>
</div>

<script type="application/json" id="qaf-data">__DATA__</script>
<script type="application/json" id="qaf-counts">__COUNTS__</script>
<script>
const apps = JSON.parse(document.getElementById('qaf-data').textContent);
const badgeClass = { income:'b-inc', data:'b-data', agenda:'b-agenda', espees:'b-esp', utility:'b-util' };

function esc(s){
  const d=document.createElement('div'); d.textContent=s; return d.innerHTML;
}

let currentCat='all';
const subs = [...new Set(apps.map(a=>a.sub).filter(Boolean))].sort();
const subSel = document.getElementById('subF');
subs.forEach(s=>{
  const o=document.createElement('option');
  o.value=s; o.textContent=s;
  subSel.appendChild(o);
});

document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    currentCat=t.dataset.cat;
    render();
  });
});

document.getElementById('search').addEventListener('input', render);
document.getElementById('subF').addEventListener('change', render);

function applyTotals(){
  const z = { income:0,data:0,agenda:0,espees:0,utility:0 };
  apps.forEach(a=>{ z[a.cat]=(z[a.cat]||0)+1; });
  document.getElementById('c-inc').textContent= z.income;
  document.getElementById('c-data').textContent= z.data;
  document.getElementById('c-agenda').textContent= z.agenda;
  document.getElementById('c-esp').textContent= z.espees;
  document.getElementById('c-util').textContent= z.utility;
}

function render(){
  const q=document.getElementById('search').value.trim().toLowerCase();
  const sub=document.getElementById('subF').value;
  let list=apps.filter(a=>{
    if(currentCat!=='all' && a.cat!==currentCat) return false;
    if(sub && a.sub!==sub) return false;
    if(!q) return true;
    const hay=(a.title+' '+a.desc+' '+a.sub+' '+a.bucketRaw).toLowerCase();
    return hay.includes(q);
  });
  document.getElementById('countLbl').textContent = list.length+' / '+apps.length+' shown';
  const grid=document.getElementById('grid');
  const no=document.getElementById('noRes');
  grid.innerHTML='';
  if(!list.length){ no.style.display='block'; return; }
  no.style.display='none';
  list.forEach(a=>{
    const bc = badgeClass[a.cat] || 'b-util';
    const bucketShort = a.bucketRaw.length>72 ? a.bucketRaw.slice(0,70)+'…' : a.bucketRaw;
    const card=document.createElement('div');
    card.className='card '+ (a.cclass||'util');
    card.innerHTML=
      '<div class="card-num">Idea #'+a.n+'</div>'+
      '<div class="card-title">'+esc(a.title)+'</div>'+
      '<div class="badges">'+
        '<span class="badge b-sub">Subgroup: '+esc(a.sub)+'</span>'+
        '<span class="badge '+bc+'">'+esc(bucketShort)+'</span>'+
      '</div>'+
      '<div class="card-desc">'+esc(a.desc)+'</div>'+
      '<div class="card-footer">'+
        '<span class="time-tag">'+(a.time? esc(a.time):'')+'</span>'+
      '</div>';
    grid.appendChild(card);
  });
}

applyTotals();
render();
</script>
</body>
</html>
"""

out = HTML.replace("__DATA__", data_json).replace("__COUNTS__", counts_json)
out_path.write_text(out, encoding="utf-8")
print("Wrote", out_path, "rows", len(rows), "counts", counts)

# Builds out/grade-batches/batch{1..5}.json from out/results.json for the
# Claude sub-agent graders (see GRADING.md). Batches are grouped by client: each
# file is a list of {client, forms, items}. `forms` holds ALL of that client's
# forms (v1 and __v2), keyed by stem, in date order, so an answer drawing on a
# later session can be checked. Each item names its `primaryForm`, the form the
# question was written from. Each form carries the session date and attendees
# line so names and job titles are not flagged as unsupported.
# Usage: python3 -I build_grade_batches.py <path to functions/test/knowledge/eval>
import json, os, sys
E = sys.argv[1]  # eval dir
SPECS = os.path.join(E, "data/specs"); OUT = os.path.join(E, "out")
V2 = {f.replace("__v2.content.json", "") for f in os.listdir(SPECS) if f.endswith("__v2.content.json")}
N = 5

def ymd(d):  # "18/07/2026" -> "2026-07-18"
    p = d.split("/")
    return f"{p[2]}-{p[1]}-{p[0]}" if len(p) == 3 else d

def forms(client):
    out = []
    for f in os.listdir(SPECS):
        if not (f.startswith(client + "__p") and f.endswith(".content.json")): continue
        stem = f[: -len(".content.json")]
        spec = json.load(open(os.path.join(SPECS, stem + ".json")))
        date = spec.get("0,2,1", ""); pillar = stem.split("__")[1][1:]
        label = f"{spec.get('0,0,1', 'Pillar ' + pillar)}; {spec.get('0,3,1', '')}; {date}" + ("; later form (v2)" if stem.endswith("__v2") else "")
        head = f"Session date: {date}\nAttendees: {spec.get('0,4,1', '').replace(chr(10), '; ')}"
        out.append((ymd(date), stem, {"label": label, "pillar": pillar, "date": date,
                                      "text": head + "\n" + open(os.path.join(SPECS, f)).read()}))
    return {stem: v for _, stem, v in sorted(out)}

def primary(r):
    if not r["pillar"]: return None
    stem = f"{r['client']}__p{r['pillar']}"
    # "latest" questions are written from the later form; everything else from v1.
    return stem + "__v2" if r["kind"] == "latest" and stem in V2 else stem

res = json.load(open(os.path.join(OUT, "results.json")))["results"]
groups = {}
for r in res:
    groups.setdefault(r["client"], []).append({
        "id": r["id"], "kind": r["kind"], "question": r["question"], "expectedFacts": r["expectedFacts"],
        "oldPositions": r.get("forbiddenFacts", []), "primaryForm": primary(r),
        "answer": r["answer"] if not r.get("error") else f"(ERROR: {r['error']})"})

# Greedy balance by item count (forms are about the same size per client).
bins = [[] for _ in range(N)]; load = [0] * N
for c in sorted(groups, key=lambda c: -len(groups[c])):
    k = load.index(min(load)); bins[k].append(c); load[k] += len(groups[c])
d = os.path.join(OUT, "grade-batches"); os.makedirs(d, exist_ok=True)
for k, cs in enumerate(bins):
    batch = [{"client": c, "forms": forms(c), "items": groups[c]} for c in sorted(cs)]
    json.dump(batch, open(os.path.join(d, f"batch{k+1}.json"), "w"), indent=1, ensure_ascii=False)
    print(k + 1, ",".join(sorted(cs)), load[k], "items", os.path.getsize(os.path.join(d, f"batch{k+1}.json")) // 1024, "KB")
